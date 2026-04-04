'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  DollarSign,
  TrendingDown,
  PiggyBank,
  Building2,
  ChevronDown,
  ChevronRight,
  Download,
  Check,
  Search,
  Receipt,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CONSTRUCTION_PHASES } from '@/lib/construction-phases'
import type { BudgetItemRecord } from '@/lib/budget-service'
import type { Bid } from '@/types'
import type { Selection } from '@/types'
import { calculateForecast } from '@/lib/budget-forecast'
import BudgetForecastCard from '@/components/BudgetForecastCard'

// ── Helpers ──

function fmt(amount: number | null | undefined): string {
  if (amount == null || amount === 0) return '—'
  return '$' + amount.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function fmtShort(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}k`
  return `$${amount.toFixed(0)}`
}

function fmtFull(amount: number | null | undefined): string {
  if (amount == null) return '—'
  return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Types ──

interface TradeRow {
  name: string
  bidCategory: string
  phaseEstimate: number
  required: boolean
  phaseName: string
  phaseNumber: number
  // Bid data
  bidCount: number
  lowestBid: { vendor: string; amount: number } | null
  selectedBid: { vendor: string; amount: number } | null
  // Actual cost from budget items
  actualCost: number
  // Smart budget picks this value
  smartValue: number
  smartSource: 'selected' | 'lowest_bid' | 'estimate' | 'actual'
}

interface PhaseGroup {
  phase: number
  name: string
  trades: TradeRow[]
  phaseTotal: number
}

interface BudgetClientProps {
  initialItems: BudgetItemRecord[]
  bids: Bid[]
  selections: Selection[]
  budgetTotal: number
  projectStartDate?: string
}

// ── Component ──

export default function BudgetClient({ initialItems, bids, selections, budgetTotal, projectStartDate }: BudgetClientProps) {
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(() => new Set(CONSTRUCTION_PHASES.map(p => p.phase)))
  const [showPayments, setShowPayments] = useState(false)

  // ── Compute trade-level breakdown ──
  const { phases, smartTotal, preconItems, preconTotal, contingency, tradesWithBids, tradesWithSelected } = useMemo(() => {
    const phaseGroups: PhaseGroup[] = []
    let total = 0
    let withBids = 0
    let withSelected = 0

    for (const phase of CONSTRUCTION_PHASES) {
      const trades: TradeRow[] = []

      for (const trade of phase.trades) {
        const cat = trade.bidCategory.toLowerCase()

        // Find bids for this trade
        const tradeBids = bids.filter(b =>
          b.category.toLowerCase() === cat &&
          b.status !== 'rejected' && b.status !== 'expired'
        )

        const selected = tradeBids.find(b => b.status === 'selected')
        const lowest = tradeBids.length > 0
          ? tradeBids.reduce((min, b) => b.total_amount < min.total_amount ? b : min)
          : null

        // Actual cost from budget items (non-JobTread, matching category)
        const actuals = initialItems.filter(item =>
          (item.category || '').toLowerCase() === cat &&
          item.source !== 'jobtread' &&
          (item.actual_cost || 0) > 0
        )
        const actualCost = actuals.reduce((sum, item) => sum + (item.actual_cost || 0), 0)

        // Smart value: selected bid > lowest bid > phase estimate
        let smartValue = trade.budgetEstimate || 0
        let smartSource: TradeRow['smartSource'] = 'estimate'
        if (actualCost > 0) {
          smartValue = actualCost
          smartSource = 'actual'
        } else if (selected) {
          smartValue = selected.total_amount
          smartSource = 'selected'
        } else if (lowest) {
          smartValue = lowest.total_amount
          smartSource = 'lowest_bid'
        }

        if (tradeBids.length > 0) withBids++
        if (selected) withSelected++

        trades.push({
          name: trade.name,
          bidCategory: trade.bidCategory,
          phaseEstimate: trade.budgetEstimate || 0,
          required: trade.required,
          phaseName: phase.name,
          phaseNumber: phase.phase,
          bidCount: tradeBids.length,
          lowestBid: lowest ? { vendor: lowest.vendor_name, amount: lowest.total_amount } : null,
          selectedBid: selected ? { vendor: selected.vendor_name, amount: selected.total_amount } : null,
          actualCost,
          smartValue,
          smartSource,
        })

        total += smartValue
      }

      const phaseTotal = trades.reduce((s, t) => s + t.smartValue, 0)
      phaseGroups.push({ phase: phase.phase, name: phase.name, trades, phaseTotal })
    }

    // Pre-construction actuals (already spent, not covered by trades)
    const coveredCats = new Set(CONSTRUCTION_PHASES.flatMap(p => p.trades.map(t => t.bidCategory.toLowerCase())))
    const preconCategories = ['architectural design', 'civil engineering', 'foundation engineering',
      'structural engineering', 'surveying', 'consulting', 'pool design', 'septic', 'building materials']
    const precon = initialItems.filter(item => {
      const catLower = (item.category || '').toLowerCase()
      if (item.source === 'jobtread') return false
      if (coveredCats.has(catLower)) return false
      return preconCategories.some(pc => catLower.includes(pc)) && (item.actual_cost || 0) > 0
    })
    const preconSum = precon.reduce((s, item) => s + (item.actual_cost || 0), 0)
    total += preconSum

    // Contingency
    const cont = initialItems.find(b => (b.category || '').toLowerCase().includes('contingency'))
    const contValue = cont && (cont.estimated_cost || 0) > 0 ? cont.estimated_cost! : 0
    total += contValue

    return {
      phases: phaseGroups,
      smartTotal: total,
      preconItems: precon,
      preconTotal: preconSum,
      contingency: contValue,
      tradesWithBids: withBids,
      tradesWithSelected: withSelected,
    }
  }, [bids, initialItems])

  // ── Transaction payments (verified bank/CC) ──
  const { transactions, txnTotal } = useMemo(() => {
    const txns = initialItems.filter(item => item.notes?.startsWith('Source: Chase'))
    const total = txns.reduce((sum, item) => sum + (item.actual_cost || 0), 0)
    return { transactions: txns, txnTotal: total }
  }, [initialItems])

  const totalTrades = CONSTRUCTION_PHASES.flatMap(p => p.trades).length

  function togglePhase(phase: number) {
    setExpandedPhases(prev => {
      const next = new Set(prev)
      if (next.has(phase)) next.delete(phase)
      else next.add(phase)
      return next
    })
  }

  // ── Render ──

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Budget</h1>
          <p className="text-muted-foreground text-sm">
            Smart budget: one choice per trade — selected bid, best bid, or phase estimate
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open('/api/export/budget-summary?format=csv', '_blank')} className="flex items-center gap-1.5">
            <Download className="h-3.5 w-3.5" />CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open('/api/export/budget-summary?format=pdf', '_blank')} className="flex items-center gap-1.5">
            <Download className="h-3.5 w-3.5" />PDF
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="animate-fade-in">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Smart Budget</p>
                <p className="text-2xl font-bold">{fmtShort(smartTotal)}</p>
                <p className="text-xs text-muted-foreground">current best estimate</p>
              </div>
              <DollarSign className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '75ms' }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Trades Covered</p>
                <p className="text-2xl font-bold">{tradesWithBids}<span className="text-base font-normal text-muted-foreground">/{totalTrades}</span></p>
                <p className="text-xs text-muted-foreground">{tradesWithSelected} selected</p>
              </div>
              <Building2 className="h-8 w-8 text-construction-blue" />
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '150ms' }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Actual Spent</p>
                <p className="text-2xl font-bold">{fmtShort(txnTotal)}</p>
                <p className="text-xs text-muted-foreground">{transactions.length} payments</p>
              </div>
              <Receipt className="h-8 w-8 text-construction-red" />
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '225ms' }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Estimate Only</p>
                <p className="text-2xl font-bold">{totalTrades - tradesWithBids}</p>
                <p className="text-xs text-muted-foreground">trades need bids</p>
              </div>
              <Search className="h-8 w-8 text-construction-orange" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget Progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium">Smart Budget Total</span>
            <span className="text-muted-foreground">{fmtShort(smartTotal)} estimated</span>
          </div>
          <Progress value={Math.min((txnTotal / smartTotal) * 100, 100)} className="h-3" />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{fmtShort(txnTotal)} spent</span>
            <span>{fmtShort(smartTotal - txnTotal)} remaining</span>
          </div>
        </CardContent>
      </Card>

      {/* Budget Forecast */}
      {projectStartDate && (
        <BudgetForecastCard
          forecast={calculateForecast(initialItems, budgetTotal, projectStartDate)}
          budgetTotal={budgetTotal}
        />
      )}

      {/* ── Trade-Level Budget Table ── */}
      {phases.map(phase => (
        <Card key={phase.phase} className="animate-fade-in overflow-hidden">
          <button
            onClick={() => togglePhase(phase.phase)}
            className="w-full text-left"
          >
            <CardHeader className="pb-3 cursor-pointer hover:bg-accent/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {expandedPhases.has(phase.phase) ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div>
                    <CardTitle className="text-base">Phase {phase.phase}: {phase.name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {phase.trades.length} trade{phase.trades.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <p className="text-lg font-bold tabular-nums">{fmt(phase.phaseTotal)}</p>
              </div>
            </CardHeader>
          </button>

          {expandedPhases.has(phase.phase) && (
            <CardContent className="pt-0 pb-3 px-3">
              <div className="border rounded-md overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2.5 font-medium">Trade</th>
                      <th className="text-right p-2.5 font-medium whitespace-nowrap">Phase Est.</th>
                      <th className="text-right p-2.5 font-medium whitespace-nowrap">Best Bid</th>
                      <th className="text-right p-2.5 font-medium whitespace-nowrap">Selected</th>
                      <th className="text-right p-2.5 font-medium whitespace-nowrap">Actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {phase.trades.map(trade => (
                      <tr key={trade.bidCategory} className="border-t hover:bg-accent/30">
                        <td className="p-2.5">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              'h-2 w-2 rounded-full shrink-0',
                              trade.smartSource === 'selected' || trade.smartSource === 'actual' ? 'bg-green-500'
                                : trade.smartSource === 'lowest_bid' ? 'bg-blue-500'
                                : 'bg-gray-300',
                            )} />
                            <div>
                              <p className="font-medium">{trade.name}</p>
                              {trade.bidCount > 0 && (
                                <Link href={`/bids?category=${encodeURIComponent(trade.bidCategory)}`} className="text-xs text-primary hover:underline">
                                  {trade.bidCount} bid{trade.bidCount !== 1 ? 's' : ''}
                                </Link>
                              )}
                              {trade.bidCount === 0 && trade.required && (
                                <span className="text-xs text-muted-foreground">needs bids</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className={cn(
                          'p-2.5 text-right tabular-nums whitespace-nowrap',
                          trade.smartSource === 'estimate' ? 'font-medium' : 'text-muted-foreground',
                        )}>
                          {fmt(trade.phaseEstimate)}
                        </td>
                        <td className={cn(
                          'p-2.5 text-right whitespace-nowrap',
                          trade.smartSource === 'lowest_bid' ? 'font-medium' : 'text-muted-foreground',
                        )}>
                          {trade.lowestBid ? (
                            <div>
                              <p className="tabular-nums">{fmt(trade.lowestBid.amount)}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-[120px] ml-auto">{trade.lowestBid.vendor}</p>
                            </div>
                          ) : '—'}
                        </td>
                        <td className={cn(
                          'p-2.5 text-right whitespace-nowrap',
                          trade.smartSource === 'selected' ? 'font-medium text-green-700' : 'text-muted-foreground',
                        )}>
                          {trade.selectedBid ? (
                            <div>
                              <div className="flex items-center gap-1 justify-end">
                                <Check className="h-3 w-3 text-green-600" />
                                <span className="tabular-nums">{fmt(trade.selectedBid.amount)}</span>
                              </div>
                              <p className="text-xs text-muted-foreground truncate max-w-[120px] ml-auto">{trade.selectedBid.vendor}</p>
                            </div>
                          ) : '—'}
                        </td>
                        <td className={cn(
                          'p-2.5 text-right tabular-nums whitespace-nowrap',
                          trade.actualCost > 0 ? 'font-medium' : 'text-muted-foreground',
                        )}>
                          {trade.actualCost > 0 ? fmt(trade.actualCost) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/30">
                    <tr className="border-t font-medium">
                      <td className="p-2.5">Subtotal</td>
                      <td className="p-2.5 text-right tabular-nums">
                        {fmt(phase.trades.reduce((s, t) => s + t.phaseEstimate, 0))}
                      </td>
                      <td className="p-2.5" />
                      <td className="p-2.5" />
                      <td className="p-2.5 text-right tabular-nums">
                        {fmt(phase.trades.reduce((s, t) => s + t.actualCost, 0)) !== '—'
                          ? fmt(phase.trades.reduce((s, t) => s + t.actualCost, 0))
                          : '—'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          )}
        </Card>
      ))}

      {/* ── Pre-Construction & Other Costs ── */}
      {(preconTotal > 0 || contingency > 0) && (
        <Card className="animate-fade-in">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Pre-Construction & Other
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-3 px-3">
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2.5 font-medium">Item</th>
                    <th className="text-right p-2.5 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {preconItems.map(item => (
                    <tr key={item.id} className="border-t hover:bg-accent/30">
                      <td className="p-2.5">
                        <p>{item.description || item.category}</p>
                        {item.category !== item.description && (
                          <p className="text-xs text-muted-foreground">{item.category}</p>
                        )}
                      </td>
                      <td className="p-2.5 text-right tabular-nums font-medium">{fmtFull(item.actual_cost)}</td>
                    </tr>
                  ))}
                  {contingency > 0 && (
                    <tr className="border-t hover:bg-accent/30">
                      <td className="p-2.5 font-medium">Contingency</td>
                      <td className="p-2.5 text-right tabular-nums font-medium">{fmt(contingency)}</td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-muted/30">
                  <tr className="border-t font-medium">
                    <td className="p-2.5">Subtotal</td>
                    <td className="p-2.5 text-right tabular-nums">{fmt(preconTotal + contingency)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Grand Total ── */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-5">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-bold text-lg">Smart Budget Total</p>
              <div className="flex items-center gap-4 mt-1">
                <span className="flex items-center gap-1.5 text-xs">
                  <span className="h-2 w-2 rounded-full bg-green-500" /> Selected
                </span>
                <span className="flex items-center gap-1.5 text-xs">
                  <span className="h-2 w-2 rounded-full bg-blue-500" /> Best bid
                </span>
                <span className="flex items-center gap-1.5 text-xs">
                  <span className="h-2 w-2 rounded-full bg-gray-300" /> Estimate only
                </span>
              </div>
            </div>
            <p className="text-3xl font-bold tabular-nums">{fmtShort(smartTotal)}</p>
          </div>
        </CardContent>
      </Card>

      {/* ── Verified Payments (collapsible) ── */}
      <Card>
        <button onClick={() => setShowPayments(!showPayments)} className="w-full text-left">
          <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {showPayments ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Receipt className="h-4 w-4" />
                    Verified Payments
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {transactions.length} payments · {fmtShort(txnTotal)} total
                  </p>
                </div>
              </div>
              <p className="text-lg font-bold tabular-nums">{fmtShort(txnTotal)}</p>
            </div>
          </CardHeader>
        </button>
        {showPayments && (
          <CardContent className="pt-0 pb-3 px-3">
            <div className="border rounded-md overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2 font-medium">Date</th>
                    <th className="text-left p-2 font-medium">Description</th>
                    <th className="text-left p-2 font-medium hidden sm:table-cell">Category</th>
                    <th className="text-right p-2 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions
                    .sort((a, b) => (b.payment_date || '').localeCompare(a.payment_date || ''))
                    .map(item => (
                    <tr key={item.id} className="border-t hover:bg-accent/30">
                      <td className="p-2 whitespace-nowrap text-muted-foreground">{formatDate(item.payment_date)}</td>
                      <td className="p-2">
                        <div>{item.description}</div>
                        {item.subcategory && <span className="text-xs text-muted-foreground">{item.subcategory}</span>}
                      </td>
                      <td className="p-2 hidden sm:table-cell">
                        <Badge variant="outline" className="text-xs font-normal">{item.category}</Badge>
                      </td>
                      <td className="p-2 text-right font-medium whitespace-nowrap tabular-nums">{fmtFull(item.actual_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
