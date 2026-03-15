/**
 * Transaction Matching Engine
 *
 * Auto-matches Plaid bank transactions to vendors, budget items, and invoices.
 * Construction payments are often large ACH/wire transfers with truncated merchant names,
 * so matching must handle fuzzy name comparison and amount correlation.
 */

import { supabase } from './supabase'
import type { Transaction, VendorMatchRule } from '@/types'

export interface MatchResult {
  vendor_id: string | null
  budget_item_id: string | null
  invoice_id: string | null
  match_status: Transaction['match_status']
  match_confidence: number
  is_construction_related: boolean
  category_override?: string
}

interface VendorRecord {
  id: string
  company_name: string
  plaid_merchant_name: string | null
  category: string | null
}

// Categories from Plaid that indicate non-construction transactions
const NON_CONSTRUCTION_CATEGORIES = [
  'Food and Drink',
  'Travel',
  'Recreation',
  'Healthcare',
  'Personal Care',
  'General Merchandise',
  'Entertainment',
  'Subscription',
  'Transfer',  // Internal transfers
]

/**
 * Match a single transaction to vendor/budget/invoice.
 */
export async function matchTransaction(
  txn: { merchant_name?: string | null; name?: string | null; amount: number; date: string; plaid_category?: unknown },
  projectId: string,
  rules: VendorMatchRule[],
  vendors: VendorRecord[],
): Promise<MatchResult> {
  const merchantName = txn.merchant_name || txn.name || ''

  // Step 0: Check if this is construction-related
  const isConstructionRelated = checkConstructionRelated(txn.plaid_category, merchantName)
  if (!isConstructionRelated) {
    return {
      vendor_id: null,
      budget_item_id: null,
      invoice_id: null,
      match_status: 'excluded',
      match_confidence: 0.9,
      is_construction_related: false,
    }
  }

  // Step 1: Check explicit match rules (highest priority)
  const ruleMatch = matchByRules(merchantName, rules, vendors)
  if (ruleMatch) return { ...ruleMatch, is_construction_related: true }

  // Step 2: Check vendor plaid_merchant_name (exact mapping from previous confirmations)
  const plaidNameMatch = matchByPlaidMerchantName(merchantName, vendors)
  if (plaidNameMatch) return { ...plaidNameMatch, is_construction_related: true }

  // Step 3: Fuzzy match vendor name
  const fuzzyMatch = fuzzyMatchVendor(merchantName, vendors)
  if (fuzzyMatch) {
    // Step 3b: Try to match to an invoice by amount + vendor
    const invoiceMatch = await matchToInvoice(fuzzyMatch.vendor_id!, txn.amount, txn.date, projectId)
    return {
      ...fuzzyMatch,
      invoice_id: invoiceMatch?.invoice_id || null,
      is_construction_related: true,
    }
  }

  // Step 4: Try amount-based invoice matching (no vendor match)
  const amountMatch = await matchByAmount(txn.amount, txn.date, projectId)
  if (amountMatch) return { ...amountMatch, is_construction_related: true }

  // No match found
  return {
    vendor_id: null,
    budget_item_id: null,
    invoice_id: null,
    match_status: 'unmatched',
    match_confidence: 0,
    is_construction_related: true,
  }
}

function checkConstructionRelated(plaidCategory: unknown, merchantName: string): boolean {
  // Check Plaid categories
  if (Array.isArray(plaidCategory)) {
    const topCategory = plaidCategory[0] as string
    if (NON_CONSTRUCTION_CATEGORIES.some(c => topCategory?.includes(c))) {
      return false
    }
  }

  // Common non-construction merchants
  const nonConstructionPatterns = [
    /walmart/i, /target/i, /amazon(?!.*supply)/i, /starbucks/i, /mcdonald/i,
    /netflix/i, /spotify/i, /uber(?!.*freight)/i, /doordash/i, /grubhub/i,
    /heb\s/i, /kroger/i, /costco/i, /sam'?s club/i,
  ]

  return !nonConstructionPatterns.some(p => p.test(merchantName))
}

function matchByRules(
  merchantName: string,
  rules: VendorMatchRule[],
  vendors: VendorRecord[]
): Omit<MatchResult, 'is_construction_related'> | null {
  const lower = merchantName.toLowerCase()

  for (const rule of rules) {
    let matched = false
    switch (rule.match_type) {
      case 'exact':
        matched = lower === rule.match_pattern.toLowerCase()
        break
      case 'contains':
        matched = lower.includes(rule.match_pattern.toLowerCase())
        break
      case 'regex':
        try {
          matched = new RegExp(rule.match_pattern, 'i').test(merchantName)
        } catch {
          matched = false
        }
        break
    }

    if (matched) {
      const vendor = vendors.find(v => v.id === rule.vendor_id)
      return {
        vendor_id: rule.vendor_id,
        budget_item_id: null,
        invoice_id: null,
        match_status: 'auto_matched',
        match_confidence: 0.95,
        category_override: rule.budget_category || vendor?.category || undefined,
      }
    }
  }

  return null
}

function matchByPlaidMerchantName(
  merchantName: string,
  vendors: VendorRecord[]
): Omit<MatchResult, 'is_construction_related'> | null {
  const lower = merchantName.toLowerCase()

  for (const vendor of vendors) {
    if (vendor.plaid_merchant_name && lower === vendor.plaid_merchant_name.toLowerCase()) {
      return {
        vendor_id: vendor.id,
        budget_item_id: null,
        invoice_id: null,
        match_status: 'auto_matched',
        match_confidence: 0.92,
        category_override: vendor.category || undefined,
      }
    }
  }

  return null
}

function fuzzyMatchVendor(
  merchantName: string,
  vendors: VendorRecord[]
): Omit<MatchResult, 'is_construction_related'> | null {
  const lower = merchantName.toLowerCase()
  let bestMatch: VendorRecord | null = null
  let bestScore = 0

  for (const vendor of vendors) {
    const vendorLower = vendor.company_name.toLowerCase()

    // Check if merchant contains vendor name or vice versa
    if (lower.includes(vendorLower) || vendorLower.includes(lower)) {
      const score = 0.85
      if (score > bestScore) {
        bestScore = score
        bestMatch = vendor
      }
      continue
    }

    // Check first word match (handles "KIPP FLORES ARCHITEC" → "Kipp Flores Architects")
    const merchantWords = lower.split(/\s+/)
    const vendorWords = vendorLower.split(/\s+/)
    if (merchantWords.length >= 2 && vendorWords.length >= 2) {
      if (merchantWords[0] === vendorWords[0] && merchantWords[1].startsWith(vendorWords[1].substring(0, 3))) {
        const score = 0.75
        if (score > bestScore) {
          bestScore = score
          bestMatch = vendor
        }
        continue
      }
    }

    // Simple similarity: shared character trigrams
    const similarity = trigramSimilarity(lower, vendorLower)
    if (similarity > 0.5 && similarity > bestScore) {
      bestScore = similarity * 0.8 // cap fuzzy matches at 0.8
      bestMatch = vendor
    }
  }

  if (bestMatch && bestScore >= 0.6) {
    return {
      vendor_id: bestMatch.id,
      budget_item_id: null,
      invoice_id: null,
      match_status: 'auto_matched',
      match_confidence: bestScore,
      category_override: bestMatch.category || undefined,
    }
  }

  return null
}

function trigramSimilarity(a: string, b: string): number {
  const trigramsA = new Set<string>()
  const trigramsB = new Set<string>()

  for (let i = 0; i <= a.length - 3; i++) trigramsA.add(a.substring(i, i + 3))
  for (let i = 0; i <= b.length - 3; i++) trigramsB.add(b.substring(i, i + 3))

  if (trigramsA.size === 0 || trigramsB.size === 0) return 0

  let intersection = 0
  for (const t of trigramsA) {
    if (trigramsB.has(t)) intersection++
  }

  return intersection / Math.max(trigramsA.size, trigramsB.size)
}

async function matchToInvoice(
  vendorId: string,
  amount: number,
  date: string,
  projectId: string
): Promise<{ invoice_id: string } | null> {
  // Look for unpaid invoices from this vendor with matching amount (within 1%)
  const { data } = await supabase
    .from('invoices')
    .select('id, total_amount')
    .eq('project_id', projectId)
    .eq('vendor_id', vendorId)
    .in('status', ['received', 'approved', 'partial'])
    .order('date_issued', { ascending: true })

  if (!data) return null

  const tolerance = amount * 0.01 // 1% tolerance
  const match = data.find(
    (inv: { id: string; total_amount: number }) => Math.abs(Number(inv.total_amount) - amount) <= tolerance
  )

  return match ? { invoice_id: match.id } : null
}

async function matchByAmount(
  amount: number,
  date: string,
  projectId: string
): Promise<Omit<MatchResult, 'is_construction_related'> | null> {
  // For large, distinct amounts, try to find an invoice that matches exactly
  if (amount < 500) return null // skip small amounts

  const tolerance = amount * 0.005 // 0.5% tolerance for amount-only matching
  const { data } = await supabase
    .from('invoices')
    .select('id, vendor_id, total_amount')
    .eq('project_id', projectId)
    .in('status', ['received', 'approved'])
    .gte('total_amount', amount - tolerance)
    .lte('total_amount', amount + tolerance)

  if (!data || data.length !== 1) return null // only match if exactly one invoice fits

  const inv = data[0] as { id: string; vendor_id: string | null; total_amount: number }
  return {
    vendor_id: inv.vendor_id,
    budget_item_id: null,
    invoice_id: inv.id,
    match_status: 'auto_matched',
    match_confidence: 0.7,
  }
}

/**
 * After a user confirms a match, learn from it by saving the merchant name
 * to the vendor's plaid_merchant_name for future auto-matching.
 */
export async function learnFromConfirmedMatch(
  merchantName: string,
  vendorId: string,
  projectId: string
): Promise<void> {
  if (!merchantName) return

  // Save plaid_merchant_name on the vendor for exact matching next time
  await supabase
    .from('vendors')
    .update({ plaid_merchant_name: merchantName })
    .eq('id', vendorId)

  // Also create a match rule for substring matching
  const { data: existing } = await supabase
    .from('vendor_match_rules')
    .select('id')
    .eq('project_id', projectId)
    .eq('vendor_id', vendorId)
    .eq('match_pattern', merchantName)
    .maybeSingle()

  if (!existing) {
    await supabase.from('vendor_match_rules').insert({
      project_id: projectId,
      vendor_id: vendorId,
      match_pattern: merchantName,
      match_type: 'contains',
      priority: 10,
      is_active: true,
    })
  }
}
