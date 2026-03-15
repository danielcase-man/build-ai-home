/**
 * Financial Service
 *
 * CRUD and aggregation queries for contracts, invoices, payments, and transactions.
 * Also provides the financial overview used by the dashboard and AI status reports.
 */

import { supabase } from './supabase'
import type {
  Contract,
  Invoice,
  Payment,
  Transaction,
  VendorBalance,
  FinancialOverview,
  VendorMatchRule,
  PlaidConnection,
} from '@/types'

// ============================================================
// Plaid Connections
// ============================================================

export async function getPlaidConnections(projectId: string): Promise<PlaidConnection[]> {
  const { data, error } = await supabase
    .from('plaid_connections')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching plaid connections:', error)
    return []
  }
  return data || []
}

export async function upsertPlaidConnection(
  connection: Partial<PlaidConnection> & { project_id: string; item_id: string }
): Promise<PlaidConnection | null> {
  const { data, error } = await supabase
    .from('plaid_connections')
    .upsert(
      { ...connection, updated_at: new Date().toISOString() },
      { onConflict: 'item_id' }
    )
    .select()
    .single()

  if (error) {
    console.error('Error upserting plaid connection:', error)
    return null
  }
  return data
}

// ============================================================
// Transactions
// ============================================================

export interface TransactionFilters {
  dateFrom?: string
  dateTo?: string
  vendorId?: string
  matchStatus?: Transaction['match_status']
  isConstructionRelated?: boolean
  minAmount?: number
  maxAmount?: number
  search?: string
  limit?: number
  offset?: number
}

export async function getTransactions(
  projectId: string,
  filters: TransactionFilters = {}
): Promise<{ transactions: Transaction[]; total: number }> {
  let query = supabase
    .from('transactions')
    .select('*, vendors(company_name), budget_items(category)', { count: 'exact' })
    .eq('project_id', projectId)
    .order('date', { ascending: false })

  if (filters.dateFrom) query = query.gte('date', filters.dateFrom)
  if (filters.dateTo) query = query.lte('date', filters.dateTo)
  if (filters.vendorId) query = query.eq('vendor_id', filters.vendorId)
  if (filters.matchStatus) query = query.eq('match_status', filters.matchStatus)
  if (filters.isConstructionRelated !== undefined) {
    query = query.eq('is_construction_related', filters.isConstructionRelated)
  }
  if (filters.minAmount) query = query.gte('amount', filters.minAmount)
  if (filters.maxAmount) query = query.lte('amount', filters.maxAmount)
  if (filters.search) {
    query = query.or(`merchant_name.ilike.%${filters.search}%,name.ilike.%${filters.search}%`)
  }

  const limit = filters.limit || 50
  const offset = filters.offset || 0
  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    console.error('Error fetching transactions:', error)
    return { transactions: [], total: 0 }
  }

  const transactions: Transaction[] = (data || []).map((row: Record<string, unknown>) => ({
    ...row,
    vendor_name: (row.vendors as Record<string, string> | null)?.company_name,
    budget_category: (row.budget_items as Record<string, string> | null)?.category,
  })) as Transaction[]

  return { transactions, total: count || 0 }
}

export async function upsertTransaction(
  txn: Partial<Transaction> & { project_id: string; plaid_transaction_id: string }
): Promise<Transaction | null> {
  const { data, error } = await supabase
    .from('transactions')
    .upsert(
      { ...txn, updated_at: new Date().toISOString() },
      { onConflict: 'plaid_transaction_id' }
    )
    .select()
    .single()

  if (error) {
    console.error('Error upserting transaction:', error)
    return null
  }
  return data
}

export async function updateTransactionMatch(
  transactionId: string,
  match: {
    vendor_id?: string | null
    budget_item_id?: string | null
    invoice_id?: string | null
    match_status: Transaction['match_status']
    match_confidence?: number
    is_construction_related?: boolean
    category_override?: string
  }
): Promise<boolean> {
  const { error } = await supabase
    .from('transactions')
    .update({ ...match, updated_at: new Date().toISOString() })
    .eq('id', transactionId)

  if (error) {
    console.error('Error updating transaction match:', error)
    return false
  }
  return true
}

export async function removeTransactionsByPlaidIds(plaidTransactionIds: string[]): Promise<number> {
  if (plaidTransactionIds.length === 0) return 0

  const { error, count } = await supabase
    .from('transactions')
    .delete({ count: 'exact' })
    .in('plaid_transaction_id', plaidTransactionIds)

  if (error) {
    console.error('Error removing transactions:', error)
    return 0
  }
  return count || 0
}

// ============================================================
// Contracts
// ============================================================

export async function getContracts(projectId: string): Promise<Contract[]> {
  const { data, error } = await supabase
    .from('contracts')
    .select('*, vendors(company_name)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching contracts:', error)
    return []
  }

  // Compute invoiced/paid totals for each contract
  const contracts = data || []
  const contractIds = contracts.map((c: { id: string }) => c.id)

  if (contractIds.length === 0) return []

  const [invoiceTotals, paymentTotals] = await Promise.all([
    supabase
      .from('invoices')
      .select('contract_id, total_amount')
      .in('contract_id', contractIds)
      .not('status', 'eq', 'voided'),
    supabase
      .from('payments')
      .select('contract_id, amount')
      .in('contract_id', contractIds),
  ])

  const invoicedByContract = new Map<string, number>()
  for (const inv of invoiceTotals.data || []) {
    const current = invoicedByContract.get(inv.contract_id) || 0
    invoicedByContract.set(inv.contract_id, current + Number(inv.total_amount))
  }

  const paidByContract = new Map<string, number>()
  for (const pay of paymentTotals.data || []) {
    const current = paidByContract.get(pay.contract_id) || 0
    paidByContract.set(pay.contract_id, current + Number(pay.amount))
  }

  return contracts.map((c: Record<string, unknown>) => {
    const id = c.id as string
    const totalInvoiced = invoicedByContract.get(id) || 0
    const totalPaid = paidByContract.get(id) || 0
    return {
      ...c,
      vendor_name: (c.vendors as Record<string, string> | null)?.company_name,
      total_invoiced: totalInvoiced,
      total_paid: totalPaid,
      remaining: Number(c.total_amount) - totalPaid,
    } as Contract
  })
}

export async function upsertContract(
  contract: Partial<Contract> & { project_id: string; title: string; total_amount: number }
): Promise<Contract | null> {
  const { data, error } = await supabase
    .from('contracts')
    .upsert({ ...contract, updated_at: new Date().toISOString() })
    .select()
    .single()

  if (error) {
    console.error('Error upserting contract:', error)
    return null
  }
  return data
}

// ============================================================
// Invoices
// ============================================================

export async function getInvoices(
  projectId: string,
  filters: { vendorId?: string; contractId?: string; status?: string } = {}
): Promise<Invoice[]> {
  let query = supabase
    .from('invoices')
    .select('*, vendors(company_name)')
    .eq('project_id', projectId)
    .order('date_issued', { ascending: false })

  if (filters.vendorId) query = query.eq('vendor_id', filters.vendorId)
  if (filters.contractId) query = query.eq('contract_id', filters.contractId)
  if (filters.status) query = query.eq('status', filters.status)

  const { data, error } = await query

  if (error) {
    console.error('Error fetching invoices:', error)
    return []
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    ...row,
    vendor_name: (row.vendors as Record<string, string> | null)?.company_name,
  })) as Invoice[]
}

export async function upsertInvoice(
  invoice: Partial<Invoice> & { project_id: string; amount: number; total_amount: number; date_issued: string }
): Promise<Invoice | null> {
  const { data, error } = await supabase
    .from('invoices')
    .upsert({ ...invoice, updated_at: new Date().toISOString() })
    .select()
    .single()

  if (error) {
    console.error('Error upserting invoice:', error)
    return null
  }
  return data
}

// ============================================================
// Payments
// ============================================================

export async function getPayments(
  projectId: string,
  filters: { vendorId?: string; invoiceId?: string; contractId?: string } = {}
): Promise<Payment[]> {
  let query = supabase
    .from('payments')
    .select('*, vendors(company_name)')
    .eq('project_id', projectId)
    .order('date', { ascending: false })

  if (filters.vendorId) query = query.eq('vendor_id', filters.vendorId)
  if (filters.invoiceId) query = query.eq('invoice_id', filters.invoiceId)
  if (filters.contractId) query = query.eq('contract_id', filters.contractId)

  const { data, error } = await query

  if (error) {
    console.error('Error fetching payments:', error)
    return []
  }
  return (data || []) as Payment[]
}

export async function createPayment(
  payment: Omit<Payment, 'id' | 'created_at' | 'updated_at'>
): Promise<Payment | null> {
  const { data, error } = await supabase
    .from('payments')
    .insert(payment)
    .select()
    .single()

  if (error) {
    console.error('Error creating payment:', error)
    return null
  }

  // Update invoice status if linked
  if (payment.invoice_id) {
    await updateInvoicePaymentStatus(payment.invoice_id)
  }

  return data
}

/** Recalculate invoice status based on total payments received */
async function updateInvoicePaymentStatus(invoiceId: string): Promise<void> {
  const [invoiceResult, paymentsResult] = await Promise.all([
    supabase.from('invoices').select('total_amount').eq('id', invoiceId).single(),
    supabase.from('payments').select('amount').eq('invoice_id', invoiceId),
  ])

  if (invoiceResult.error || !invoiceResult.data) return

  const invoiceTotal = Number(invoiceResult.data.total_amount)
  const paidTotal = (paymentsResult.data || []).reduce(
    (sum: number, p: { amount: number }) => sum + Number(p.amount),
    0
  )

  let status: string
  if (paidTotal >= invoiceTotal) {
    status = 'paid'
  } else if (paidTotal > 0) {
    status = 'partial'
  } else {
    return // no change needed
  }

  await supabase
    .from('invoices')
    .update({
      status,
      date_paid: status === 'paid' ? new Date().toISOString().split('T')[0] : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoiceId)
}

// ============================================================
// Vendor Match Rules
// ============================================================

export async function getVendorMatchRules(projectId: string): Promise<VendorMatchRule[]> {
  const { data, error } = await supabase
    .from('vendor_match_rules')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_active', true)
    .order('priority', { ascending: false })

  if (error) {
    console.error('Error fetching vendor match rules:', error)
    return []
  }
  return (data || []) as VendorMatchRule[]
}

export async function upsertVendorMatchRule(
  rule: Partial<VendorMatchRule> & { project_id: string; vendor_id: string; match_pattern: string }
): Promise<VendorMatchRule | null> {
  const { data, error } = await supabase
    .from('vendor_match_rules')
    .upsert({ ...rule, updated_at: new Date().toISOString() })
    .select()
    .single()

  if (error) {
    console.error('Error upserting vendor match rule:', error)
    return null
  }
  return data
}

// ============================================================
// Financial Overview (Dashboard / AI Status)
// ============================================================

export async function getFinancialOverview(projectId: string): Promise<FinancialOverview> {
  const [contracts, invoices, payments, unmatched, recent] = await Promise.all([
    supabase
      .from('contracts')
      .select('total_amount, status')
      .eq('project_id', projectId)
      .in('status', ['active', 'completed']),
    supabase
      .from('invoices')
      .select('total_amount, status, date_due')
      .eq('project_id', projectId)
      .not('status', 'eq', 'voided'),
    supabase
      .from('payments')
      .select('amount')
      .eq('project_id', projectId),
    supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('match_status', 'unmatched')
      .eq('is_construction_related', true),
    supabase
      .from('transactions')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_construction_related', true)
      .order('date', { ascending: false })
      .limit(10),
  ])

  const totalContracted = (contracts.data || []).reduce(
    (s: number, c: { total_amount: number }) => s + Number(c.total_amount),
    0
  )
  const totalInvoiced = (invoices.data || []).reduce(
    (s: number, i: { total_amount: number }) => s + Number(i.total_amount),
    0
  )
  const totalPaid = (payments.data || []).reduce(
    (s: number, p: { amount: number }) => s + Number(p.amount),
    0
  )

  const today = new Date().toISOString().split('T')[0]
  const overdueInvoices = (invoices.data || []).filter(
    (i: { status: string; date_due?: string }) =>
      i.status !== 'paid' && i.date_due && i.date_due < today
  ).length

  return {
    totalContracted,
    totalInvoiced,
    totalPaid,
    outstandingBalance: totalInvoiced - totalPaid,
    overdueInvoices,
    unmatchedTransactions: unmatched.count || 0,
    recentTransactions: (recent.data || []) as Transaction[],
    vendorBalances: [], // populated by getVendorBalances() when needed
  }
}

export async function getVendorBalances(projectId: string): Promise<VendorBalance[]> {
  // Get all vendors with financial activity
  const { data: vendors } = await supabase
    .from('vendors')
    .select('id, company_name, category')
    .eq('project_id', projectId)
    .order('company_name')

  if (!vendors || vendors.length === 0) return []

  const vendorIds = vendors.map((v: { id: string }) => v.id)

  const [contractsResult, invoicesResult, paymentsResult] = await Promise.all([
    supabase
      .from('contracts')
      .select('vendor_id, total_amount')
      .in('vendor_id', vendorIds)
      .in('status', ['active', 'completed']),
    supabase
      .from('invoices')
      .select('vendor_id, total_amount, status, date_due')
      .in('vendor_id', vendorIds)
      .not('status', 'eq', 'voided'),
    supabase
      .from('payments')
      .select('vendor_id, amount')
      .in('vendor_id', vendorIds),
  ])

  const today = new Date().toISOString().split('T')[0]

  return vendors.map((v: { id: string; company_name: string; category: string | null }) => {
    const contractTotal = (contractsResult.data || [])
      .filter((c: { vendor_id: string }) => c.vendor_id === v.id)
      .reduce((s: number, c: { total_amount: number }) => s + Number(c.total_amount), 0)
    const invoiced = (invoicesResult.data || [])
      .filter((i: { vendor_id: string }) => i.vendor_id === v.id)
      .reduce((s: number, i: { total_amount: number }) => s + Number(i.total_amount), 0)
    const paid = (paymentsResult.data || [])
      .filter((p: { vendor_id: string }) => p.vendor_id === v.id)
      .reduce((s: number, p: { amount: number }) => s + Number(p.amount), 0)
    const overdueAmount = (invoicesResult.data || [])
      .filter(
        (i: { vendor_id: string; status: string; date_due?: string }) =>
          i.vendor_id === v.id && i.status !== 'paid' && i.date_due && i.date_due < today
      )
      .reduce((s: number, i: { total_amount: number }) => s + Number(i.total_amount), 0)

    return {
      vendor_id: v.id,
      vendor_name: v.company_name,
      category: v.category,
      contract_total: contractTotal,
      invoiced,
      paid,
      remaining: contractTotal - paid,
      overdue_amount: overdueAmount,
    }
  }).filter((vb: VendorBalance) =>
    vb.contract_total > 0 || vb.invoiced > 0 || vb.paid > 0
  )
}
