'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Receipt,
  RefreshCw,
  Loader2,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Circle,
  Link2,
  Plus,
  FileText,
  Building2,
  ArrowRight,
} from 'lucide-react'
import PlaidLinkButton from '@/components/PlaidLinkButton'
import type {
  Transaction,
  Contract,
  Invoice,
  VendorBalance,
  FinancialOverview,
} from '@/types'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function matchStatusBadge(status: Transaction['match_status']) {
  switch (status) {
    case 'confirmed':
      return <Badge variant="success">Confirmed</Badge>
    case 'auto_matched':
      return <Badge variant="warning">Auto-Matched</Badge>
    case 'excluded':
      return <Badge variant="secondary">Excluded</Badge>
    case 'manual':
      return <Badge variant="default">Manual</Badge>
    default:
      return <Badge variant="destructive">Unmatched</Badge>
  }
}

function invoiceStatusBadge(status: Invoice['status']) {
  switch (status) {
    case 'paid':
      return <Badge variant="success">Paid</Badge>
    case 'partial':
      return <Badge variant="warning">Partial</Badge>
    case 'overdue':
      return <Badge variant="destructive">Overdue</Badge>
    case 'approved':
      return <Badge variant="default">Approved</Badge>
    case 'disputed':
      return <Badge variant="destructive">Disputed</Badge>
    case 'voided':
      return <Badge variant="secondary">Voided</Badge>
    default:
      return <Badge variant="outline">Received</Badge>
  }
}

export default function PaymentsClient() {
  const [activeTab, setActiveTab] = useState('transactions')
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Data
  const [overview, setOverview] = useState<FinancialOverview | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [transactionTotal, setTransactionTotal] = useState(0)
  const [contracts, setContracts] = useState<Contract[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [vendorBalances, setVendorBalances] = useState<VendorBalance[]>([])
  const [connections, setConnections] = useState<Array<{ institution_name: string; status: string; last_sync?: string; accounts: Array<{ name: string; mask: string }> }>>([])

  // Filters
  const [matchFilter, setMatchFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Dialogs
  const [contractDialogOpen, setContractDialogOpen] = useState(false)
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false)

  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/payments/overview')
      const json = await res.json()
      if (json.success) {
        setOverview(json.data)
        setVendorBalances(json.data.vendorBalances || [])
      }
    } catch {
      console.error('Failed to fetch overview')
    }
  }, [])

  const fetchTransactions = useCallback(async () => {
    const params = new URLSearchParams()
    if (matchFilter !== 'all') params.set('matchStatus', matchFilter)
    if (searchQuery) params.set('search', searchQuery)
    params.set('limit', '100')

    try {
      const res = await fetch(`/api/transactions?${params}`)
      const json = await res.json()
      if (json.success) {
        setTransactions(json.data.transactions)
        setTransactionTotal(json.data.total)
      }
    } catch {
      console.error('Failed to fetch transactions')
    }
  }, [matchFilter, searchQuery])

  const fetchContracts = useCallback(async () => {
    try {
      const res = await fetch('/api/contracts')
      const json = await res.json()
      if (json.success) setContracts(json.data.contracts)
    } catch {
      console.error('Failed to fetch contracts')
    }
  }, [])

  const fetchInvoices = useCallback(async () => {
    try {
      const res = await fetch('/api/invoices')
      const json = await res.json()
      if (json.success) setInvoices(json.data.invoices)
    } catch {
      console.error('Failed to fetch invoices')
    }
  }, [])

  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch('/api/plaid/connections')
      const json = await res.json()
      if (json.success) setConnections(json.data.connections)
    } catch {
      console.error('Failed to fetch connections')
    }
  }, [])

  const loadAllData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([
        fetchOverview(),
        fetchTransactions(),
        fetchContracts(),
        fetchInvoices(),
        fetchConnections(),
      ])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load financial data')
    } finally {
      setLoading(false)
    }
  }, [fetchOverview, fetchTransactions, fetchContracts, fetchInvoices, fetchConnections])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadAllData() }, [])
  useEffect(() => { fetchTransactions() }, [matchFilter, searchQuery, fetchTransactions])

  const handleSync = async () => {
    setSyncing(true)
    try {
      await fetch('/api/transactions/sync', { method: 'POST' })
      await Promise.all([fetchTransactions(), fetchOverview()])
    } catch {
      console.error('Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const handleBankConnected = () => {
    fetchConnections()
    handleSync()
  }

  // -------------------------------------------
  // Contract dialog form
  // -------------------------------------------
  const [contractForm, setContractForm] = useState({
    title: '', total_amount: '', vendor_id: '', description: '', payment_terms: '', status: 'draft',
  })

  const handleSaveContract = async () => {
    const res = await fetch('/api/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...contractForm,
        total_amount: parseFloat(contractForm.total_amount) || 0,
        vendor_id: contractForm.vendor_id || undefined,
      }),
    })
    if ((await res.json()).success) {
      setContractDialogOpen(false)
      setContractForm({ title: '', total_amount: '', vendor_id: '', description: '', payment_terms: '', status: 'draft' })
      fetchContracts()
      fetchOverview()
    }
  }

  // -------------------------------------------
  // Invoice dialog form
  // -------------------------------------------
  const [invoiceForm, setInvoiceForm] = useState({
    contract_id: '', vendor_id: '', invoice_number: '', description: '',
    amount: '', tax_amount: '0', date_issued: new Date().toISOString().split('T')[0],
    date_due: '', notes: '',
  })

  const handleSaveInvoice = async () => {
    const amount = parseFloat(invoiceForm.amount) || 0
    const tax = parseFloat(invoiceForm.tax_amount) || 0
    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...invoiceForm,
        amount,
        tax_amount: tax,
        total_amount: amount + tax,
        contract_id: invoiceForm.contract_id || undefined,
        vendor_id: invoiceForm.vendor_id || undefined,
      }),
    })
    if ((await res.json()).success) {
      setInvoiceDialogOpen(false)
      setInvoiceForm({ contract_id: '', vendor_id: '', invoice_number: '', description: '', amount: '', tax_amount: '0', date_issued: new Date().toISOString().split('T')[0], date_due: '', notes: '' })
      fetchInvoices()
      fetchOverview()
    }
  }

  if (loading) {
    return (
      <div className="container py-8">
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Loading financial data...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container py-8">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="container py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payments & Financial Tracking</h1>
          <p className="text-muted-foreground text-sm">
            Track transactions, contracts, invoices, and vendor balances
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleSync} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Sync Now
          </Button>
          {connections.length === 0 && (
            <PlaidLinkButton onSuccess={handleBankConnected} />
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contracted</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(overview?.totalContracted || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoiced</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(overview?.totalInvoiced || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(overview?.totalPaid || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(overview?.outstandingBalance || 0)}</div>
            {(overview?.overdueInvoices || 0) > 0 && (
              <p className="text-xs text-destructive mt-1">{overview!.overdueInvoices} overdue</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bank Connection Status */}
      {connections.length > 0 && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                {connections[0].status === 'active' ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                )}
                <span className="font-medium">{connections[0].institution_name}</span>
              </div>
              {connections[0].accounts?.map((a, i) => (
                <Badge key={i} variant="outline">{a.name} ...{a.mask}</Badge>
              ))}
              {connections[0].last_sync && (
                <span className="text-muted-foreground ml-auto">
                  Last sync: {new Date(connections[0].last_sync).toLocaleDateString()}
                </span>
              )}
              {(overview?.unmatchedTransactions || 0) > 0 && (
                <Badge variant="destructive">{overview!.unmatchedTransactions} unmatched</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="contracts">Contracts & Invoices</TabsTrigger>
          <TabsTrigger value="vendors">Vendor Balances</TabsTrigger>
        </TabsList>

        {/* === TRANSACTIONS TAB === */}
        <TabsContent value="transactions" className="space-y-4">
          <div className="flex items-center gap-4">
            <Input
              placeholder="Search by merchant name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
            <Select value={matchFilter} onValueChange={setMatchFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Transactions</SelectItem>
                <SelectItem value="unmatched">Unmatched</SelectItem>
                <SelectItem value="auto_matched">Auto-Matched</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="excluded">Excluded</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground ml-auto">
              {transactionTotal} transaction{transactionTotal !== 1 ? 's' : ''}
            </span>
          </div>

          {transactions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {connections.length === 0 ? (
                  <div className="space-y-3">
                    <Building2 className="h-10 w-10 mx-auto text-muted-foreground/50" />
                    <p>Connect your bank account to start tracking transactions</p>
                    <PlaidLinkButton onSuccess={handleBankConnected} />
                  </div>
                ) : (
                  <p>No transactions found. Click &quot;Sync Now&quot; to pull latest transactions.</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">Date</th>
                      <th className="text-left p-3 font-medium">Description</th>
                      <th className="text-right p-3 font-medium">Amount</th>
                      <th className="text-left p-3 font-medium">Vendor</th>
                      <th className="text-left p-3 font-medium">Category</th>
                      <th className="text-left p-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(txn => (
                      <tr key={txn.id} className="border-b hover:bg-muted/30">
                        <td className="p-3 whitespace-nowrap">{txn.date}</td>
                        <td className="p-3">
                          <div className="font-medium">{txn.merchant_name || txn.name}</div>
                          {txn.payment_channel && (
                            <div className="text-xs text-muted-foreground">{txn.payment_channel}</div>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono whitespace-nowrap">
                          {formatCurrency(txn.amount)}
                        </td>
                        <td className="p-3">
                          {txn.vendor_name ? (
                            <span className="text-sm">{txn.vendor_name}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3">
                          {txn.category_override || txn.budget_category || (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3">{matchStatusBadge(txn.match_status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* === CONTRACTS & INVOICES TAB === */}
        <TabsContent value="contracts" className="space-y-4">
          <div className="flex items-center gap-2">
            <Dialog open={contractDialogOpen} onOpenChange={setContractDialogOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" /> Add Contract</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Contract</DialogTitle>
                  <DialogDescription>Record a vendor contract or agreement</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="contract-title">Title</Label>
                    <Input id="contract-title" value={contractForm.title} onChange={e => setContractForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g., Foundation - XYZ Concrete" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="contract-amount">Total Amount</Label>
                    <Input id="contract-amount" type="number" value={contractForm.total_amount} onChange={e => setContractForm(f => ({ ...f, total_amount: e.target.value }))} placeholder="0.00" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="contract-terms">Payment Terms</Label>
                    <Input id="contract-terms" value={contractForm.payment_terms} onChange={e => setContractForm(f => ({ ...f, payment_terms: e.target.value }))} placeholder="e.g., 50% deposit, 50% on completion" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="contract-desc">Description</Label>
                    <Textarea id="contract-desc" value={contractForm.description} onChange={e => setContractForm(f => ({ ...f, description: e.target.value }))} rows={3} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setContractDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleSaveContract} disabled={!contractForm.title || !contractForm.total_amount}>Save Contract</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline"><Plus className="h-4 w-4 mr-2" /> Add Invoice</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Invoice</DialogTitle>
                  <DialogDescription>Record an invoice received from a vendor</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="inv-number">Invoice #</Label>
                      <Input id="inv-number" value={invoiceForm.invoice_number} onChange={e => setInvoiceForm(f => ({ ...f, invoice_number: e.target.value }))} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="inv-amount">Amount</Label>
                      <Input id="inv-amount" type="number" value={invoiceForm.amount} onChange={e => setInvoiceForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="inv-issued">Date Issued</Label>
                      <Input id="inv-issued" type="date" value={invoiceForm.date_issued} onChange={e => setInvoiceForm(f => ({ ...f, date_issued: e.target.value }))} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="inv-due">Date Due</Label>
                      <Input id="inv-due" type="date" value={invoiceForm.date_due} onChange={e => setInvoiceForm(f => ({ ...f, date_due: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="inv-desc">Description</Label>
                    <Input id="inv-desc" value={invoiceForm.description} onChange={e => setInvoiceForm(f => ({ ...f, description: e.target.value }))} placeholder="What is this invoice for?" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="inv-notes">Notes</Label>
                    <Textarea id="inv-notes" value={invoiceForm.notes} onChange={e => setInvoiceForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setInvoiceDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleSaveInvoice} disabled={!invoiceForm.amount || !invoiceForm.date_issued}>Save Invoice</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Contracts */}
          {contracts.length === 0 && invoices.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                <p>No contracts or invoices yet. Add a contract to start tracking what you owe.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {contracts.map(contract => (
                <Card key={contract.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">{contract.title}</CardTitle>
                        {contract.vendor_name && (
                          <p className="text-sm text-muted-foreground">{contract.vendor_name}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">{formatCurrency(contract.total_amount)}</div>
                        <Badge variant={contract.status === 'active' ? 'success' : contract.status === 'completed' ? 'secondary' : 'outline'}>
                          {contract.status}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Progress bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Paid: {formatCurrency(contract.total_paid || 0)}</span>
                        <span>Remaining: {formatCurrency(contract.remaining || 0)}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all"
                          style={{ width: `${Math.min(100, ((contract.total_paid || 0) / contract.total_amount) * 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Invoiced: {formatCurrency(contract.total_invoiced || 0)}</span>
                        {contract.payment_terms && <span>{contract.payment_terms}</span>}
                      </div>
                    </div>

                    {/* Invoices under this contract */}
                    {invoices.filter(inv => inv.contract_id === contract.id).length > 0 && (
                      <>
                        <Separator className="my-3" />
                        <div className="space-y-2">
                          {invoices.filter(inv => inv.contract_id === contract.id).map(inv => (
                            <div key={inv.id} className="flex items-center justify-between text-sm py-1">
                              <div className="flex items-center gap-2">
                                <Circle className="h-3 w-3 text-muted-foreground" />
                                <span>{inv.invoice_number || inv.description || 'Invoice'}</span>
                                <span className="text-muted-foreground">{inv.date_issued}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono">{formatCurrency(inv.total_amount)}</span>
                                {invoiceStatusBadge(inv.status)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}

              {/* Standalone invoices (not linked to a contract) */}
              {invoices.filter(inv => !inv.contract_id).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Standalone Invoices</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {invoices.filter(inv => !inv.contract_id).map(inv => (
                        <div key={inv.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                          <div>
                            <span className="font-medium">{inv.invoice_number || inv.description || 'Invoice'}</span>
                            {inv.vendor_name && <span className="text-muted-foreground ml-2">— {inv.vendor_name}</span>}
                            <span className="text-muted-foreground ml-2">{inv.date_issued}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{formatCurrency(inv.total_amount)}</span>
                            {invoiceStatusBadge(inv.status)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* === VENDOR BALANCES TAB === */}
        <TabsContent value="vendors" className="space-y-4">
          {vendorBalances.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Building2 className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                <p>No vendor financial activity yet. Add contracts and record payments to see balances.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">Vendor</th>
                      <th className="text-left p-3 font-medium">Category</th>
                      <th className="text-right p-3 font-medium">Contract Total</th>
                      <th className="text-right p-3 font-medium">Invoiced</th>
                      <th className="text-right p-3 font-medium">Paid</th>
                      <th className="text-right p-3 font-medium">Remaining</th>
                      <th className="text-left p-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendorBalances.map(vb => (
                      <tr key={vb.vendor_id} className="border-b hover:bg-muted/30">
                        <td className="p-3 font-medium">{vb.vendor_name}</td>
                        <td className="p-3 text-muted-foreground">{vb.category || '—'}</td>
                        <td className="p-3 text-right font-mono">{formatCurrency(vb.contract_total)}</td>
                        <td className="p-3 text-right font-mono">{formatCurrency(vb.invoiced)}</td>
                        <td className="p-3 text-right font-mono text-green-600">{formatCurrency(vb.paid)}</td>
                        <td className="p-3 text-right font-mono">{formatCurrency(vb.remaining)}</td>
                        <td className="p-3">
                          {vb.overdue_amount > 0 ? (
                            <Badge variant="destructive">Overdue {formatCurrency(vb.overdue_amount)}</Badge>
                          ) : vb.remaining <= 0 ? (
                            <Badge variant="success">Paid Up</Badge>
                          ) : vb.invoiced > vb.paid ? (
                            <Badge variant="warning">Outstanding</Badge>
                          ) : (
                            <Badge variant="outline">Current</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-bold">
                      <td className="p-3" colSpan={2}>Totals</td>
                      <td className="p-3 text-right font-mono">{formatCurrency(vendorBalances.reduce((s, v) => s + v.contract_total, 0))}</td>
                      <td className="p-3 text-right font-mono">{formatCurrency(vendorBalances.reduce((s, v) => s + v.invoiced, 0))}</td>
                      <td className="p-3 text-right font-mono text-green-600">{formatCurrency(vendorBalances.reduce((s, v) => s + v.paid, 0))}</td>
                      <td className="p-3 text-right font-mono">{formatCurrency(vendorBalances.reduce((s, v) => s + v.remaining, 0))}</td>
                      <td className="p-3" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
