'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { Progress } from '@/components/ui/progress'
import { CONSTRUCTION_PHASES } from '@/lib/construction-phases'
import type { Bid } from '@/types'
import type { BudgetItemRecord } from '@/lib/budget-service'
import {
  Grid3X3,
  CheckCircle2,
  CircleDollarSign,
  AlertTriangle,
  TrendingUp,
  HardHat,
} from 'lucide-react'

interface CoverageClientProps {
  bids: Bid[]
  budgetItems: BudgetItemRecord[]
}

type CoverageStatus = 'selected' | 'bids_pending' | 'estimate_only' | 'gap'

interface TradeCoverage {
  tradeName: string
  bidCategory: string
  required: boolean
  budgetEstimate: number
  actualBudget: number | null
  bidCount: number
  lowestBid: number | null
  selectedBid: { vendor: string; amount: number } | null
  status: CoverageStatus
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function getStatusBadge(status: CoverageStatus) {
  switch (status) {
    case 'selected':
      return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100">Selected</Badge>
    case 'bids_pending':
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100">Bids Pending</Badge>
    case 'estimate_only':
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">Estimate Only</Badge>
    case 'gap':
      return <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100">Gap</Badge>
  }
}

function getStatusDot(status: CoverageStatus) {
  switch (status) {
    case 'selected': return 'bg-emerald-500'
    case 'bids_pending': return 'bg-blue-500'
    case 'estimate_only': return 'bg-amber-500'
    case 'gap': return 'bg-red-500'
  }
}

export default function CoverageClient({ bids, budgetItems }: CoverageClientProps) {
  const { coverageByPhase, summary } = useMemo(() => {
    const bidsByCategory = new Map<string, Bid[]>()
    for (const bid of bids) {
      const existing = bidsByCategory.get(bid.category) || []
      existing.push(bid)
      bidsByCategory.set(bid.category, existing)
    }

    // Budget items indexed by category (lowercase match)
    const budgetByCategory = new Map<string, BudgetItemRecord[]>()
    for (const item of budgetItems) {
      const key = item.category.toLowerCase()
      const existing = budgetByCategory.get(key) || []
      existing.push(item)
      budgetByCategory.set(key, existing)
    }

    let totalCovered = 0
    let totalCommitted = 0
    let totalBudgetEstimate = 0
    let totalLowestBids = 0
    let gapCount = 0

    const coverageByPhase = CONSTRUCTION_PHASES.map(phase => {
      const trades: TradeCoverage[] = phase.trades.map(trade => {
        const tradeBids = bidsByCategory.get(trade.bidCategory) || []
        const budgetMatches = budgetByCategory.get(trade.bidCategory.toLowerCase()) || []
        const actualBudget = budgetMatches.reduce((sum, b) => sum + (b.actual_cost ?? 0), 0) || null
        const selectedBid = tradeBids.find(b => b.status === 'selected')
        const lowestBid = tradeBids.length > 0
          ? Math.min(...tradeBids.filter(b => b.status !== 'rejected').map(b => b.total_amount))
          : null

        let status: CoverageStatus
        if (selectedBid) {
          status = 'selected'
          totalCovered++
          totalCommitted += selectedBid.total_amount
        } else if (tradeBids.length > 0) {
          status = 'bids_pending'
          totalCovered++
        } else if (trade.budgetEstimate) {
          status = 'estimate_only'
        } else {
          status = 'gap'
          gapCount++
        }

        totalBudgetEstimate += trade.budgetEstimate || 0
        if (lowestBid !== null && isFinite(lowestBid)) {
          totalLowestBids += lowestBid
        }

        return {
          tradeName: trade.name,
          bidCategory: trade.bidCategory,
          required: trade.required,
          budgetEstimate: trade.budgetEstimate || 0,
          actualBudget,
          bidCount: tradeBids.length,
          lowestBid: lowestBid !== null && isFinite(lowestBid) ? lowestBid : null,
          selectedBid: selectedBid ? { vendor: selectedBid.vendor_name, amount: selectedBid.total_amount } : null,
          status,
        }
      })

      return { phase, trades }
    })

    const allTrades = CONSTRUCTION_PHASES.flatMap(p => p.trades)
    return {
      coverageByPhase,
      summary: {
        totalTrades: allTrades.length,
        covered: totalCovered,
        committed: totalCommitted,
        budgetEstimate: totalBudgetEstimate,
        lowestBids: totalLowestBids,
        delta: totalBudgetEstimate - totalCommitted,
        gaps: gapCount,
      },
    }
  }, [bids, budgetItems])

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Coverage Matrix</h1>
        <p className="text-muted-foreground">
          Budget, bid, and vendor coverage across all construction trades
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Trades Covered
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.covered} / {summary.totalTrades}</p>
            <Progress value={Math.round((summary.covered / summary.totalTrades) * 100)} className="mt-2 h-1.5" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CircleDollarSign className="h-4 w-4" />
              Total Committed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(summary.committed)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Budget vs Bids
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${summary.delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {summary.delta >= 0 ? '+' : ''}{formatCurrency(summary.delta)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Est. {formatCurrency(summary.budgetEstimate)} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Gaps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${summary.gaps > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {summary.gaps}
            </p>
            <p className="text-xs text-muted-foreground mt-1">trades with no bids or estimates</p>
          </CardContent>
        </Card>
      </div>

      {/* Status Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="text-muted-foreground font-medium">Coverage:</span>
        <div className="flex items-center gap-1">
          <span className={`h-2.5 w-2.5 rounded-full ${getStatusDot('selected')}`} />
          <span>Selected Vendor</span>
        </div>
        <div className="flex items-center gap-1">
          <span className={`h-2.5 w-2.5 rounded-full ${getStatusDot('bids_pending')}`} />
          <span>Bids Pending</span>
        </div>
        <div className="flex items-center gap-1">
          <span className={`h-2.5 w-2.5 rounded-full ${getStatusDot('estimate_only')}`} />
          <span>Estimate Only</span>
        </div>
        <div className="flex items-center gap-1">
          <span className={`h-2.5 w-2.5 rounded-full ${getStatusDot('gap')}`} />
          <span>Gap</span>
        </div>
      </div>

      {/* Phase Accordion */}
      <Accordion type="multiple" defaultValue={coverageByPhase.map(p => `phase-${p.phase.phase}`)}>
        {coverageByPhase.map(({ phase, trades }) => {
          const selectedCount = trades.filter(t => t.status === 'selected').length
          const bidsCount = trades.filter(t => t.status === 'bids_pending').length
          const gapCount = trades.filter(t => t.status === 'gap').length
          const phaseEstimate = trades.reduce((sum, t) => sum + t.budgetEstimate, 0)

          return (
            <AccordionItem key={phase.phase} value={`phase-${phase.phase}`}>
              <AccordionTrigger className="hover:no-underline px-1">
                <div className="flex flex-1 items-center justify-between pr-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {phase.phase}
                    </span>
                    <div className="text-left">
                      <span className="font-semibold">{phase.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {trades.length} trades
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedCount > 0 && (
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100">
                        {selectedCount} selected
                      </Badge>
                    )}
                    {bidsCount > 0 && (
                      <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100">
                        {bidsCount} pending
                      </Badge>
                    )}
                    {gapCount > 0 && (
                      <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100">
                        {gapCount} gaps
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      {formatCurrency(phaseEstimate)}
                    </span>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-2 px-3 font-medium">Trade</th>
                        <th className="text-right py-2 px-3 font-medium">Budget Est.</th>
                        <th className="text-right py-2 px-3 font-medium">Actual</th>
                        <th className="text-center py-2 px-3 font-medium">Bids</th>
                        <th className="text-right py-2 px-3 font-medium">Lowest Bid</th>
                        <th className="text-right py-2 px-3 font-medium">Selected</th>
                        <th className="text-center py-2 px-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trades.map((trade) => (
                        <tr key={trade.bidCategory} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <HardHat className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="font-medium">{trade.tradeName}</span>
                              {!trade.required && (
                                <span className="text-xs text-muted-foreground italic">(opt)</span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right text-muted-foreground">
                            {trade.budgetEstimate > 0 ? formatCurrency(trade.budgetEstimate) : '-'}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {trade.actualBudget ? formatCurrency(trade.actualBudget) : '-'}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {trade.bidCount > 0 ? (
                              <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-100 text-blue-800 text-xs font-medium">
                                {trade.bidCount}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {trade.lowestBid !== null ? formatCurrency(trade.lowestBid) : '-'}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {trade.selectedBid ? (
                              <div>
                                <span className="font-medium">{formatCurrency(trade.selectedBid.amount)}</span>
                                <span className="block text-xs text-muted-foreground">{trade.selectedBid.vendor}</span>
                              </div>
                            ) : '-'}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {getStatusBadge(trade.status)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </div>
  )
}
