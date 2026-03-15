/**
 * Plaid API Client
 *
 * Low-level wrapper around the Plaid Node SDK.
 * Handles link token creation, token exchange, and transaction sync.
 * Access tokens are encrypted at rest using token-encryption.ts (same as Gmail OAuth).
 */

import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
  type LinkTokenCreateRequest,
  type TransactionsSyncRequest,
  type AccountBase,
  type Transaction as PlaidTransaction,
  type RemovedTransaction,
} from 'plaid'
import { env } from './env'

let _client: PlaidApi | null = null

function getClient(): PlaidApi {
  if (!_client) {
    const clientId = env.plaidClientId
    const secret = env.plaidSecret
    const plaidEnv = env.plaidEnv || 'sandbox'

    if (!clientId || !secret) {
      throw new Error('Missing PLAID_CLIENT_ID or PLAID_SECRET environment variables')
    }

    const basePath = PlaidEnvironments[plaidEnv as keyof typeof PlaidEnvironments]
    if (!basePath) {
      throw new Error(`Invalid PLAID_ENV: ${plaidEnv}. Must be sandbox, development, or production`)
    }

    const configuration = new Configuration({
      basePath,
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': clientId,
          'PLAID-SECRET': secret,
        },
      },
    })

    _client = new PlaidApi(configuration)
  }
  return _client
}

/** Create a link token for Plaid Link initialization */
export async function createLinkToken(userId: string): Promise<string> {
  const webhookUrl = env.plaidWebhookUrl

  const request: LinkTokenCreateRequest = {
    user: { client_user_id: userId },
    client_name: 'UBuildIt Manager',
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: 'en',
    ...(webhookUrl ? { webhook: webhookUrl } : {}),
  }

  const response = await getClient().linkTokenCreate(request)
  return response.data.link_token
}

/** Exchange a public_token from Plaid Link for a persistent access_token */
export async function exchangePublicToken(publicToken: string): Promise<{
  accessToken: string
  itemId: string
}> {
  const response = await getClient().itemPublicTokenExchange({
    public_token: publicToken,
  })

  return {
    accessToken: response.data.access_token,
    itemId: response.data.item_id,
  }
}

/** Get accounts for a connected item */
export async function getAccounts(accessToken: string): Promise<AccountBase[]> {
  const response = await getClient().accountsGet({ access_token: accessToken })
  return response.data.accounts
}

/** Get institution info by ID */
export async function getInstitutionName(institutionId: string): Promise<string> {
  try {
    const response = await getClient().institutionsGetById({
      institution_id: institutionId,
      country_codes: [CountryCode.Us],
    })
    return response.data.institution.name
  } catch {
    return 'Unknown Institution'
  }
}

export interface SyncResult {
  added: PlaidTransaction[]
  modified: PlaidTransaction[]
  removed: RemovedTransaction[]
  next_cursor: string
}

/**
 * Sync transactions using cursor-based incremental sync.
 * Returns added, modified, and removed transactions plus the new cursor.
 */
export async function syncTransactions(
  accessToken: string,
  cursor?: string
): Promise<SyncResult> {
  const allAdded: PlaidTransaction[] = []
  const allModified: PlaidTransaction[] = []
  const allRemoved: RemovedTransaction[] = []

  let hasMore = true
  let nextCursor = cursor || ''

  while (hasMore) {
    const request: TransactionsSyncRequest = {
      access_token: accessToken,
      cursor: nextCursor || undefined,
      count: 100,
    }

    const response = await getClient().transactionsSync(request)
    const data = response.data

    allAdded.push(...data.added)
    allModified.push(...data.modified)
    allRemoved.push(...data.removed)

    hasMore = data.has_more
    nextCursor = data.next_cursor
  }

  return {
    added: allAdded,
    modified: allModified,
    removed: allRemoved,
    next_cursor: nextCursor,
  }
}

/** Remove a Plaid item (disconnect bank) */
export async function removeItem(accessToken: string): Promise<void> {
  await getClient().itemRemove({ access_token: accessToken })
}
