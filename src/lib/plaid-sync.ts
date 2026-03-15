/**
 * Plaid Sync Service
 *
 * Orchestrates syncing transactions from all connected Plaid items.
 * Uses cursor-based incremental sync and auto-matches transactions.
 * Follows the same pattern as JobTreadSyncService.
 */

import * as plaidClient from './plaid-client'
import {
  getPlaidConnections,
  upsertPlaidConnection,
  upsertTransaction,
  removeTransactionsByPlaidIds,
  getVendorMatchRules,
} from './financial-service'
import { matchTransaction } from './transaction-matcher'
import { decryptTokens, isEncryptedTokens } from './token-encryption'
import { supabase } from './supabase'
import type { PlaidSyncResult } from '@/types'

interface VendorRecord {
  id: string
  company_name: string
  plaid_merchant_name: string | null
  category: string | null
}

export async function syncAllConnections(projectId: string): Promise<PlaidSyncResult> {
  const result: PlaidSyncResult = { added: 0, modified: 0, removed: 0, autoMatched: 0, errors: [] }

  const connections = await getPlaidConnections(projectId)
  const activeConnections = connections.filter(c => c.status === 'active')

  if (activeConnections.length === 0) {
    return result
  }

  // Load matching data once for all connections
  const [rules, vendorsResult] = await Promise.all([
    getVendorMatchRules(projectId),
    supabase
      .from('vendors')
      .select('id, company_name, plaid_merchant_name, category')
      .eq('project_id', projectId),
  ])
  const vendors: VendorRecord[] = (vendorsResult.data || []) as VendorRecord[]

  for (const connection of activeConnections) {
    try {
      const connectionResult = await syncSingleConnection(
        connection.id,
        connection.item_id,
        connection.access_token,
        connection.cursor || undefined,
        projectId,
        rules,
        vendors,
      )

      result.added += connectionResult.added
      result.modified += connectionResult.modified
      result.removed += connectionResult.removed
      result.autoMatched += connectionResult.autoMatched
      result.errors.push(...connectionResult.errors)
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      result.errors.push(`Connection ${connection.institution_name}: ${msg}`)

      // Mark connection as needing reauth if Plaid returns ITEM_LOGIN_REQUIRED
      if (msg.includes('ITEM_LOGIN_REQUIRED')) {
        await upsertPlaidConnection({
          project_id: projectId,
          item_id: connection.item_id,
          status: 'needs_reauth',
          error_code: 'ITEM_LOGIN_REQUIRED',
        })
      }
    }
  }

  return result
}

async function syncSingleConnection(
  connectionId: string,
  itemId: string,
  encryptedAccessToken: string,
  cursor: string | undefined,
  projectId: string,
  rules: Awaited<ReturnType<typeof getVendorMatchRules>>,
  vendors: VendorRecord[],
): Promise<PlaidSyncResult> {
  const result: PlaidSyncResult = { added: 0, modified: 0, removed: 0, autoMatched: 0, errors: [] }

  // Decrypt the access token
  let accessToken: string
  try {
    const parsed = JSON.parse(encryptedAccessToken)
    if (isEncryptedTokens(parsed)) {
      const decrypted = decryptTokens(parsed)
      accessToken = decrypted.access_token as string
    } else {
      accessToken = encryptedAccessToken
    }
  } catch {
    // Token stored as plain string (sandbox/dev mode)
    accessToken = encryptedAccessToken
  }

  // Fetch transactions from Plaid
  const syncResponse = await plaidClient.syncTransactions(accessToken, cursor)

  // Process added transactions
  for (const txn of syncResponse.added) {
    try {
      // Auto-match
      const match = await matchTransaction(
        {
          merchant_name: txn.merchant_name,
          name: txn.name,
          amount: txn.amount,
          date: txn.date,
          plaid_category: txn.personal_finance_category
            ? [txn.personal_finance_category.primary, txn.personal_finance_category.detailed]
            : txn.category,
        },
        projectId,
        rules,
        vendors,
      )

      await upsertTransaction({
        project_id: projectId,
        plaid_connection_id: connectionId,
        plaid_transaction_id: txn.transaction_id,
        account_id: txn.account_id,
        account_name: txn.account_id, // Will be enriched later
        date: txn.date,
        authorized_date: txn.authorized_date || undefined,
        amount: txn.amount,
        merchant_name: txn.merchant_name || undefined,
        name: txn.name,
        payment_channel: txn.payment_channel,
        plaid_category: txn.personal_finance_category
          ? [txn.personal_finance_category.primary, txn.personal_finance_category.detailed]
          : txn.category || undefined,
        pending: txn.pending,
        vendor_id: match.vendor_id || undefined,
        budget_item_id: match.budget_item_id || undefined,
        invoice_id: match.invoice_id || undefined,
        match_status: match.match_status,
        match_confidence: match.match_confidence,
        is_construction_related: match.is_construction_related,
        category_override: match.category_override,
      })

      result.added++
      if (match.match_status === 'auto_matched') result.autoMatched++
    } catch (error) {
      result.errors.push(`Add ${txn.transaction_id}: ${error instanceof Error ? error.message : 'Unknown'}`)
    }
  }

  // Process modified transactions
  for (const txn of syncResponse.modified) {
    try {
      await upsertTransaction({
        project_id: projectId,
        plaid_connection_id: connectionId,
        plaid_transaction_id: txn.transaction_id,
        account_id: txn.account_id,
        date: txn.date,
        authorized_date: txn.authorized_date || undefined,
        amount: txn.amount,
        merchant_name: txn.merchant_name || undefined,
        name: txn.name,
        payment_channel: txn.payment_channel,
        pending: txn.pending,
      })
      result.modified++
    } catch (error) {
      result.errors.push(`Mod ${txn.transaction_id}: ${error instanceof Error ? error.message : 'Unknown'}`)
    }
  }

  // Process removed transactions
  if (syncResponse.removed.length > 0) {
    const removedIds = syncResponse.removed.map(r => r.transaction_id)
    result.removed = await removeTransactionsByPlaidIds(removedIds)
  }

  // Update cursor and last_sync on the connection
  await upsertPlaidConnection({
    project_id: projectId,
    item_id: itemId,
    cursor: syncResponse.next_cursor,
    last_sync: new Date().toISOString(),
  })

  return result
}
