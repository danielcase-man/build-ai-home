'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import {
  DollarSign,
  TrendingDown,
  Receipt,
  PiggyBank,
  Calendar,
  Building2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import type { BudgetItemRecord } from '@/lib/budget-service'

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '--'
  return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatCurrencyShort(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}k`
  return `$${amount.toFixed(0)}`
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface CategoryGroup {
  category: string
  items: BudgetItemRecord[]
  totalEstimated: number
  totalActual: number
  paidCount: number
}

interface BudgetClientProps {
  initialItems: BudgetItemRecord[]
  budgetTotal: number
}

export default function BudgetClient({ initialItems, budgetTotal }: BudgetClientProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState('transactions')

  // Separate transaction-sourced items (real payments) from budget estimates
  const { transactions, estimates } = useMemo(() => {
    const txns: BudgetItemRecord[] = []
    const ests: BudgetItemRecord[] = []
    for (const item of initialItems) {
      if (item.notes?.startsWith('Source: Chase')) {
        txns.push(item)
      } else {
        ests.push(item)
      }
    }
    return { transactions: txns, estimates: ests }
  }, [initialItems])

  // Summary stats from real transactions only
  const summary = useMemo(() => {
    const totalSpent = transactions.reduce((sum, item) => sum + (item.actual_cost || 0), 0)
    const remaining = budgetTotal - totalSpent
    const percentUsed = (totalSpent / budgetTotal) * 100
    const txnCount = transactions.length
    const categories = new Set(transactions.map(t => t.category)).size
    const firstDate = transactions.length > 0
      ? transactions.reduce((min, t) => t.payment_date && t.payment_date < min ? t.payment_date : min, '9999-99-99')
      : null
    const lastDate = transactions.length > 0
      ? transactions.reduce((max, t) => t.payment_date && t.payment_date > max ? t.payment_date : max, '0000-00-00')
      : null

    return { totalSpent, remaining, percentUsed, txnCount, categories, firstDate, lastDate }
  }, [transactions, budgetTotal])

  // Group transactions by category
  const categoryGroups = useMemo(() => {
    const groups = new Map<string, BudgetItemRecord[]>()
    for (const item of transactions) {
      const cat = item.category
      if (!groups.has(cat)) groups.set(cat, [])
      groups.get(cat)!.push(item)
    }

    const result: CategoryGroup[] = []
    for (const [category, items] of Array.from(groups.entries())) {
      items.sort((a, b) => (a.payment_date || '').localeCompare(b.payment_date || ''))
      result.push({
        category,
        items,
        totalEstimated: items.reduce((s, i) => s + (i.estimated_cost || 0), 0),
        totalActual: items.reduce((s, i) => s + (i.actual_cost || 0), 0),
        paidCount: items.filter(i => i.status === 'paid').length,
      })
    }

    // Sort by total actual descending
    result.sort((a, b) => b.totalActual - a.totalActual)
    return result
  }, [transactions])

  // Group budget estimates by category
  const estimateGroups = useMemo(() => {
    const groups = new Map<string, BudgetItemRecord[]>()
    for (const item of estimates) {
      const cat = item.category
      if (!groups.has(cat)) groups.set(cat, [])
      groups.get(cat)!.push(item)
    }

    const result: CategoryGroup[] = []
    for (const [category, items] of Array.from(groups.entries())) {
      result.push({
        category,
        items,
        totalEstimated: items.reduce((s, i) => s + (i.estimated_cost || 0), 0),
        totalActual: items.reduce((s, i) => s + (i.actual_cost || 0), 0),
        paidCount: items.filter(i => i.status === 'paid').length,
      })
    }
    result.sort((a, b) => b.totalEstimated - a.totalEstimated)
    return result
  }, [estimates])

  function toggleCategory(cat: string) {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold">Budget & Expenses</h1>
        <p className="text-muted-foreground text-sm">
          Verified construction cash outflows from bank and credit card transactions
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="animate-fade-in" style={{ animationDelay: '0ms' }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Spent</p>
                <p className="text-2xl font-bold">{formatCurrencyShort(summary.totalSpent)}</p>
                <p className="text-xs text-muted-foreground">{summary.txnCount} transactions</p>
              </div>
              <DollarSign className="h-8 w-8 text-construction-red" />
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '75ms' }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Budget Remaining</p>
                <p className="text-2xl font-bold">{formatCurrencyShort(summary.remaining)}</p>
                <p className="text-xs text-muted-foreground">of {formatCurrencyShort(budgetTotal)} total</p>
              </div>
              <PiggyBank className="h-8 w-8 text-construction-green" />
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '150ms' }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">% of Budget Used</p>
                <p className="text-2xl font-bold">{summary.percentUsed.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">{summary.categories} categories</p>
              </div>
              <TrendingDown className="h-8 w-8 text-construction-blue" />
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '225ms' }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Date Range</p>
                <p className="text-lg font-bold">{summary.firstDate ? formatDate(summary.firstDate).split(',')[0] : '--'}</p>
                <p className="text-xs text-muted-foreground">to {summary.lastDate ? formatDate(summary.lastDate) : '--'}</p>
              </div>
              <Calendar className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget Progress Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium">Overall Budget Progress</span>
            <span className="text-muted-foreground">
              {formatCurrency(summary.totalSpent)} of {formatCurrency(budgetTotal)}
            </span>
          </div>
          <Progress value={Math.min(summary.percentUsed, 100)} className="h-3" />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Land + Pre-Construction Phase</span>
            <span>{formatCurrency(summary.remaining)} remaining</span>
          </div>
        </CardContent>
      </Card>

      {/* Tabs: Transactions vs Budget Estimates */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="transactions" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Verified Payments ({transactions.length})
          </TabsTrigger>
          <TabsTrigger value="estimates" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Budget Estimates ({estimates.length})
          </TabsTrigger>
        </TabsList>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-3 mt-4">
          {categoryGroups.map(group => (
            <Card key={group.category}>
              <button
                onClick={() => toggleCategory(group.category)}
                className="w-full text-left"
              >
                <CardHeader className="pb-2 cursor-pointer hover:bg-accent/50 transition-colors rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {expandedCategories.has(group.category) ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div>
                        <CardTitle className="text-base">{group.category}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {group.items.length} payment{group.items.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{formatCurrency(group.totalActual)}</p>
                    </div>
                  </div>
                </CardHeader>
              </button>

              {expandedCategories.has(group.category) && (
                <CardContent className="pt-0 pb-3">
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-2 font-medium">Date</th>
                          <th className="text-left p-2 font-medium">Description</th>
                          <th className="text-left p-2 font-medium hidden sm:table-cell">Source</th>
                          <th className="text-right p-2 font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map((item) => (
                          <tr key={item.id} className="border-t hover:bg-accent/30">
                            <td className="p-2 whitespace-nowrap text-muted-foreground">
                              {formatDate(item.payment_date)}
                            </td>
                            <td className="p-2">
                              <div>{item.description}</div>
                              {item.subcategory && (
                                <span className="text-xs text-muted-foreground">
                                  {item.subcategory}
                                </span>
                              )}
                            </td>
                            <td className="p-2 hidden sm:table-cell">
                              <Badge variant="outline" className="text-xs font-normal">
                                {item.notes?.replace('Source: ', '') || '--'}
                              </Badge>
                            </td>
                            <td className="p-2 text-right font-medium whitespace-nowrap">
                              {formatCurrency(item.actual_cost)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {group.items.length > 1 && (
                        <tfoot className="bg-muted/30">
                          <tr className="border-t font-medium">
                            <td className="p-2" colSpan={2}>Subtotal</td>
                            <td className="p-2 hidden sm:table-cell" />
                            <td className="p-2 text-right">{formatCurrency(group.totalActual)}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}

          {/* Grand Total */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold text-lg">Total Verified Expenditures</p>
                  <p className="text-sm text-muted-foreground">
                    {transactions.length} payments across {categoryGroups.length} categories
                  </p>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(summary.totalSpent)}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Estimates Tab */}
        <TabsContent value="estimates" className="space-y-3 mt-4">
          {estimateGroups.map(group => (
            <Card key={group.category}>
              <button
                onClick={() => toggleCategory('est_' + group.category)}
                className="w-full text-left"
              >
                <CardHeader className="pb-2 cursor-pointer hover:bg-accent/50 transition-colors rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {expandedCategories.has('est_' + group.category) ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div>
                        <CardTitle className="text-base">{group.category}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {group.items.length} line item{group.items.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{formatCurrency(group.totalEstimated)}</p>
                      <p className="text-xs text-muted-foreground">
                        {group.paidCount > 0 ? `${group.paidCount} paid` : 'estimated'}
                      </p>
                    </div>
                  </div>
                </CardHeader>
              </button>

              {expandedCategories.has('est_' + group.category) && (
                <CardContent className="pt-0 pb-3">
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-2 font-medium">Item</th>
                          <th className="text-left p-2 font-medium hidden sm:table-cell">Status</th>
                          <th className="text-right p-2 font-medium">Estimated</th>
                          <th className="text-right p-2 font-medium">Actual</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map((item) => (
                          <tr key={item.id} className="border-t hover:bg-accent/30">
                            <td className="p-2">
                              <div>{item.description}</div>
                              {item.subcategory && (
                                <span className="text-xs text-muted-foreground">{item.subcategory}</span>
                              )}
                            </td>
                            <td className="p-2 hidden sm:table-cell">
                              <Badge
                                variant={
                                  item.status === 'paid' ? 'success'
                                    : item.status === 'approved' ? 'default'
                                    : item.status === 'bid_received' ? 'warning'
                                    : 'secondary'
                                }
                                className="text-xs"
                              >
                                {item.status}
                              </Badge>
                            </td>
                            <td className="p-2 text-right text-muted-foreground whitespace-nowrap">
                              {formatCurrency(item.estimated_cost)}
                            </td>
                            <td className="p-2 text-right font-medium whitespace-nowrap">
                              {item.actual_cost ? formatCurrency(item.actual_cost) : '--'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}

          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold">Total Estimated Budget</p>
                  <p className="text-sm text-muted-foreground">
                    From construction budget spreadsheet
                  </p>
                </div>
                <p className="text-xl font-bold">
                  {formatCurrency(estimateGroups.reduce((s, g) => s + g.totalEstimated, 0))}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
