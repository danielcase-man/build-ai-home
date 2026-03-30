'use client'

import { useState, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Skeleton } from '@/components/ui/skeleton'
import {
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Zap,
  Loader2,
  RefreshCw,
  BarChart3,
  Filter,
  ArrowUpDown,
} from 'lucide-react'
import type { CategoryCoverageSummary, BidCoverageScore } from '@/types'

// ─── Props ───────────────────────────────────��──────────────────────────────

interface CoverageMatrixProps {
  summaries: CategoryCoverageSummary[]
  projectId: string
}

// ─── Formatting ──────���────────────────────────────���─────────────────────────

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

function phaseName(phase: number): string {
  const names: Record<number, string> = {
    1: 'Pre-Construction',
    2: 'Foundation',
    3: 'Framing',
    4: 'MEP Rough-In',
    5: 'Exterior Envelope',
    6: 'Interior Finishes',
    7: 'Final Fixtures',
    8: 'Landscaping & Final',
  }
  return names[phase] || `Phase ${phase}`
}

/** Color class for coverage percentage */
function coverageColor(pct: number): string {
  if (pct >= 80) return 'text-emerald-600'
  if (pct >= 50) return 'text-amber-600'
  return 'text-red-600'
}

/** Progress bar color class by coverage */
function progressColor(pct: number): string {
  if (pct >= 80) return '[&>div]:bg-emerald-500'
  if (pct >= 50) return '[&>div]:bg-amber-500'
  return '[&>div]:bg-red-500'
}

/** Confidence indicator color */
function confidenceColor(confidence: number): string {
  if (confidence >= 0.9) return 'text-emerald-600 bg-emerald-50 border-emerald-200'
  if (confidence >= 0.7) return 'text-amber-700 bg-amber-50 border-amber-200'
  return 'text-slate-500 bg-slate-50 border-slate-200'
}

/** Variance color: green if under takeoff, red if over */
function varianceColor(variance: number): string {
  if (variance <= -5) return 'text-emerald-600'
  if (variance >= 5) return 'text-red-600'
  return 'text-muted-foreground'
}

// ─── Sort Options ───────────���────────────────────────���──────────────────────

type SortKey = 'phase' | 'coverage' | 'gaps'

function sortLabel(key: SortKey): string {
  switch (key) {
    case 'phase': return 'Phase'
    case 'coverage': return 'Coverage %'
    case 'gaps': return 'Gap Count'
  }
}

// ─── Component ─────────────────���────────────────────────────────────────────

export default function CoverageMatrixClient({ summaries: initialSummaries, projectId }: CoverageMatrixProps) {
  const [summaries, setSummaries] = useState(initialSummaries)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [pipelineLoading, setPipelineLoading] = useState(false)
  const [refreshLoading, setRefreshLoading] = useState(false)
  const [pipelineResult, setPipelineResult] = useState<string | null>(null)
  const [phaseFilter, setPhaseFilter] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState<SortKey>('phase')

  // ── Computed data ───────────────────────────────────────────────────────

  const phases = useMemo(() => {
    const set = new Set(summaries.map(s => s.phase))
    return [...set].sort((a, b) => a - b)
  }, [summaries])

  const sortedSummaries = useMemo(() => {
    let filtered = phaseFilter !== null
      ? summaries.filter(s => s.phase === phaseFilter)
      : summaries

    const sorted = [...filtered]
    switch (sortBy) {
      case 'phase':
        sorted.sort((a, b) => a.phase - b.phase || a.category.localeCompare(b.category))
        break
      case 'coverage': {
        sorted.sort((a, b) => {
          const aCov = a.bestCoverageBid?.coveragePct ?? 0
          const bCov = b.bestCoverageBid?.coveragePct ?? 0
          return aCov - bCov // lowest coverage first (worst to best)
        })
        break
      }
      case 'gaps':
        sorted.sort((a, b) => b.gapCount - a.gapCount)
        break
    }
    return sorted
  }, [summaries, phaseFilter, sortBy])

  const aggregateStats = useMemo(() => {
    const totalItems = summaries.reduce((s, c) => s + c.takeoffItemCount, 0)
    const totalCost = summaries.reduce((s, c) => s + c.takeoffTotalCost, 0)
    const totalBids = summaries.reduce((s, c) => s + c.bidCount, 0)
    const totalGaps = summaries.reduce((s, c) => s + c.gapCount, 0)
    const avgCoverage = summaries.length > 0
      ? Math.round(
          summaries
            .filter(s => s.bidCount > 0)
            .reduce((s, c) => s + (c.bestCoverageBid?.coveragePct ?? 0), 0)
          / Math.max(summaries.filter(s => s.bidCount > 0).length, 1)
        )
      : 0
    return { totalItems, totalCost, totalBids, totalGaps, avgCoverage, categories: summaries.length }
  }, [summaries])

  // ── Actions ──────────────────────────────���──────────────────────────────

  const refreshData = useCallback(async () => {
    setRefreshLoading(true)
    try {
      const res = await fetch(`/api/coverage/summary?projectId=${projectId}`)
      const json = await res.json()
      if (json.success && json.data?.summaries) {
        setSummaries(json.data.summaries)
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      setRefreshLoading(false)
    }
  }, [projectId])

  const runPipeline = useCallback(async () => {
    setPipelineLoading(true)
    setPipelineResult(null)
    try {
      const res = await fetch('/api/coverage/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      })
      const json = await res.json()
      if (json.success) {
        const results = json.data as Array<{
          category: string
          matchesCreated: number
          errors: string[]
        }>
        const totalMatches = results.reduce((s, r) => s + r.matchesCreated, 0)
        const totalErrors = results.reduce((s, r) => s + r.errors.length, 0)
        setPipelineResult(
          `Pipeline complete: ${results.length} categories, ${totalMatches} matches${totalErrors > 0 ? `, ${totalErrors} errors` : ''}`
        )
        // Refresh data after pipeline completes
        await refreshData()
      } else {
        setPipelineResult(`Pipeline failed: ${json.error || 'Unknown error'}`)
      }
    } catch (err) {
      setPipelineResult(`Pipeline failed: ${err instanceof Error ? err.message : 'Network error'}`)
    } finally {
      setPipelineLoading(false)
    }
  }, [refreshData])

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategory(prev => prev === category ? null : category)
  }, [])

  // ── Empty State ──��──────────────────────────────────────────────────────

  if (summaries.length === 0) {
    return (
      <div className="space-y-6">
        <SectionHeader
          pipelineLoading={pipelineLoading}
          refreshLoading={refreshLoading}
          onRunPipeline={runPipeline}
          onRefresh={refreshData}
          pipelineResult={pipelineResult}
        />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Coverage Data Yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              Run the coverage pipeline to generate takeoff items from your selections,
              match them against vendor bids, and compute coverage scores.
            </p>
            <Button
              onClick={runPipeline}
              disabled={pipelineLoading}
              className="gap-2"
            >
              {pipelineLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              Run Coverage Pipeline
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Main Render ───────���─────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <SectionHeader
        pipelineLoading={pipelineLoading}
        refreshLoading={refreshLoading}
        onRunPipeline={runPipeline}
        onRefresh={refreshData}
        pipelineResult={pipelineResult}
      />

      {/* Aggregate Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{aggregateStats.categories}</p>
            <p className="text-xs text-muted-foreground mt-1">with takeoff data</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Takeoff Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{aggregateStats.totalItems}</p>
            <p className="text-xs text-muted-foreground mt-1">{fmt.format(aggregateStats.totalCost)} total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Bids Compared
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{aggregateStats.totalBids}</p>
            <p className="text-xs text-muted-foreground mt-1">across all categories</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Coverage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold tabular-nums ${coverageColor(aggregateStats.avgCoverage)}`}>
              {aggregateStats.avgCoverage}%
            </p>
            <Progress value={aggregateStats.avgCoverage} className={`mt-2 h-1.5 ${progressColor(aggregateStats.avgCoverage)}`} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Universal Gaps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold tabular-nums ${aggregateStats.totalGaps > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {aggregateStats.totalGaps}
            </p>
            <p className="text-xs text-muted-foreground mt-1">items no vendor covers</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters + Sort */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          <span className="font-medium">Phase:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            variant={phaseFilter === null ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setPhaseFilter(null)}
          >
            All
          </Button>
          {phases.map(p => (
            <Button
              key={p}
              variant={phaseFilter === p ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setPhaseFilter(phaseFilter === p ? null : p)}
            >
              {p} - {phaseName(p)}
            </Button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span className="font-medium">Sort:</span>
          {(['phase', 'coverage', 'gaps'] as SortKey[]).map(key => (
            <Button
              key={key}
              variant={sortBy === key ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setSortBy(key)}
            >
              {sortLabel(key)}
            </Button>
          ))}
        </div>
      </div>

      {/* Category Cards */}
      <div className="space-y-3">
        {sortedSummaries.map(summary => (
          <CategoryCard
            key={summary.category}
            summary={summary}
            isExpanded={expandedCategory === summary.category}
            onToggle={() => toggleCategory(summary.category)}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Section Header ─────────────────────────────────────────────────────────

function SectionHeader({
  pipelineLoading,
  refreshLoading,
  onRunPipeline,
  onRefresh,
  pipelineResult,
}: {
  pipelineLoading: boolean
  refreshLoading: boolean
  onRunPipeline: () => void
  onRefresh: () => void
  pipelineResult: string | null
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Item-Level Coverage
          </h2>
          <p className="text-sm text-muted-foreground">
            Bid-by-bid comparison against takeoff items
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={refreshLoading}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={onRunPipeline}
            disabled={pipelineLoading}
            className="gap-1.5"
          >
            {pipelineLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Zap className="h-3.5 w-3.5" />
            )}
            Run Pipeline
          </Button>
        </div>
      </div>
      {pipelineResult && (
        <div className={`text-sm px-3 py-2 rounded-md ${
          pipelineResult.includes('failed')
            ? 'bg-red-50 text-red-800 border border-red-200'
            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
        }`}>
          {pipelineResult}
        </div>
      )}
    </div>
  )
}

// ─── Category Card ─────────���───────────────────────────���────────────────────

function CategoryCard({
  summary,
  isExpanded,
  onToggle,
}: {
  summary: CategoryCoverageSummary
  isExpanded: boolean
  onToggle: () => void
}) {
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full text-left">
            <CardHeader className="pb-3 hover:bg-muted/30 transition-colors cursor-pointer">
              <div className="flex items-start justify-between gap-4">
                {/* Left: category info */}
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex items-center justify-center shrink-0 mt-0.5">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-base">{summary.category}</CardTitle>
                      <Badge variant="outline" className="text-xs font-normal">
                        Phase {summary.phase}
                      </Badge>
                      {summary.gapCount > 0 && (
                        <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100 text-xs">
                          {summary.gapCount} gap{summary.gapCount !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {summary.takeoffItemCount} items &middot; {fmt.format(summary.takeoffTotalCost)} takeoff total
                      {summary.bidCount > 0 && ` \u00B7 ${summary.bidCount} bid${summary.bidCount !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                </div>

                {/* Right: best coverage indicator */}
                {summary.bestCoverageBid && (
                  <div className="text-right shrink-0">
                    <p className={`text-lg font-bold tabular-nums ${coverageColor(summary.bestCoverageBid.coveragePct)}`}>
                      {summary.bestCoverageBid.coveragePct}%
                    </p>
                    <p className="text-xs text-muted-foreground truncate max-w-[140px]">
                      {summary.bestCoverageBid.vendorName}
                    </p>
                  </div>
                )}
                {!summary.bestCoverageBid && summary.bidCount === 0 && (
                  <Badge variant="outline" className="text-xs text-muted-foreground shrink-0">
                    No bids
                  </Badge>
                )}
              </div>

              {/* Vendor coverage bars (compact, always visible) */}
              {summary.scores.length > 0 && (
                <div className="mt-3 space-y-1.5 pl-7">
                  {summary.scores.map(score => (
                    <VendorCoverageBar key={score.bidId} score={score} />
                  ))}
                </div>
              )}
            </CardHeader>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            <ItemDrillDown summary={summary} />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

// ─── Vendor Coverage Bar (compact) ────��─────────────────────────────────────

function VendorCoverageBar({ score }: { score: BidCoverageScore }) {
  return (
    <div className="flex items-center gap-3 text-xs">
      <div className="w-28 truncate text-muted-foreground flex items-center gap-1.5">
        <span className="truncate">{score.vendorName}</span>
        {score.latestVersion && (
          <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100 text-[10px] px-1 py-0 leading-tight">
            Latest
          </Badge>
        )}
      </div>
      <div className="flex-1 max-w-[200px]">
        <Progress
          value={score.coveragePct}
          className={`h-2 ${progressColor(score.coveragePct)}`}
        />
      </div>
      <span className={`w-10 text-right font-medium tabular-nums ${coverageColor(score.coveragePct)}`}>
        {score.coveragePct}%
      </span>
      <span className="w-20 text-right text-muted-foreground tabular-nums">
        {fmt.format(score.bidTotal)}
      </span>
      <span className={`w-14 text-right tabular-nums ${varianceColor(score.priceVariance)}`}>
        {score.priceVariance > 0 ? '+' : ''}{score.priceVariance}%
      </span>
    </div>
  )
}

// ─── Item Drill-Down Table ���─────────────────────────────────────────────────

const EMPTY_TAKEOFF_ITEMS: NonNullable<CategoryCoverageSummary['takeoffItems']> = []

function ItemDrillDown({ summary }: { summary: CategoryCoverageSummary }) {
  const takeoffItems = summary.takeoffItems ?? EMPTY_TAKEOFF_ITEMS
  const scores = summary.scores

  // All hooks MUST be called before any early return
  // Group takeoff items by room
  const roomGroups = useMemo(() => {
    if (takeoffItems.length === 0) return []
    const groups = new Map<string, typeof takeoffItems>()
    for (const item of takeoffItems) {
      const room = item.room || 'General'
      const existing = groups.get(room) || []
      existing.push(item)
      groups.set(room, existing)
    }
    // Sort rooms: General last, rest alphabetical
    return [...groups.entries()].sort((a, b) => {
      if (a[0] === 'General') return 1
      if (b[0] === 'General') return -1
      return a[0].localeCompare(b[0])
    })
  }, [takeoffItems])

  // Build a lookup: for each takeoff item name+room, get each vendor's match
  const matchLookup = useMemo(() => {
    const lookup = new Map<string, Map<string, BidCoverageScore['matchDetails'][0]>>()
    for (const score of scores) {
      for (const match of score.matchDetails) {
        const key = `${match.takeoffItemName}||${match.takeoffRoom}`
        if (!lookup.has(key)) lookup.set(key, new Map())
        lookup.get(key)!.set(score.bidId, match)
      }
    }
    return lookup
  }, [scores])

  // Determine which takeoff items are universal gaps (missing from ALL bids)
  const universalGapNames = useMemo(() => {
    const gapSet = new Set(summary.gapItems.map(g => `${g.name}||${g.room}`))
    return gapSet
  }, [summary.gapItems])

  if (takeoffItems.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-6">
        No takeoff items available for drill-down.
      </div>
    )
  }

  return (
    <div className="border rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="text-left py-2.5 px-3 font-medium text-muted-foreground min-w-[200px]">
              Takeoff Item
            </th>
            <th className="text-right py-2.5 px-3 font-medium text-muted-foreground w-14">
              Qty
            </th>
            <th className="text-right py-2.5 px-3 font-medium text-muted-foreground w-24">
              Takeoff $
            </th>
            {scores.map(score => (
              <th key={score.bidId} className="text-center py-2.5 px-3 font-medium text-muted-foreground min-w-[150px]">
                <div className="flex flex-col items-center gap-0.5">
                  <span className="truncate max-w-[130px]">{score.vendorName}</span>
                  {score.latestVersion && (
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100 text-[10px] px-1 py-0">
                      Latest
                    </Badge>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {roomGroups.map(([room, items]) => (
            <RoomGroup
              key={room}
              room={room}
              items={items}
              scores={scores}
              matchLookup={matchLookup}
              universalGapNames={universalGapNames}
            />
          ))}
          {/* Footer: totals per vendor */}
          <tr className="border-t-2 bg-muted/30 font-medium">
            <td className="py-2.5 px-3">
              Total Coverage
            </td>
            <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
              {takeoffItems.reduce((s, i) => s + i.quantity, 0)}
            </td>
            <td className="py-2.5 px-3 text-right tabular-nums">
              {fmt.format(summary.takeoffTotalCost)}
            </td>
            {scores.map(score => (
              <td key={score.bidId} className="py-2.5 px-3 text-center">
                <div className="flex flex-col items-center gap-1">
                  <span className={`font-bold tabular-nums ${coverageColor(score.coveragePct)}`}>
                    {score.coveragePct}%
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {fmt.format(score.bidTotal)}
                  </span>
                </div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ─── Room Group (header + items) ────────────────────────────────────────────

function RoomGroup({
  room,
  items,
  scores,
  matchLookup,
  universalGapNames,
}: {
  room: string
  items: NonNullable<CategoryCoverageSummary['takeoffItems']>
  scores: BidCoverageScore[]
  matchLookup: Map<string, Map<string, BidCoverageScore['matchDetails'][0]>>
  universalGapNames: Set<string>
}) {
  return (
    <>
      {/* Room header row */}
      <tr className="bg-muted/20">
        <td
          colSpan={3 + scores.length}
          className="py-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {room}
        </td>
      </tr>
      {/* Item rows */}
      {items.map(item => {
        const itemKey = `${item.name}||${item.room}`
        const isUniversalGap = universalGapNames.has(itemKey)
        const vendorMatches = matchLookup.get(itemKey)

        return (
          <tr
            key={item.id}
            className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${
              isUniversalGap ? 'border-l-2 border-l-red-400' : ''
            }`}
          >
            {/* Item name + specs */}
            <td className="py-2 px-3">
              <div className="font-medium text-sm">{item.name}</div>
              {item.materialSpec && (
                <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-[240px]">
                  {item.materialSpec}
                </div>
              )}
            </td>
            {/* Quantity */}
            <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
              {item.quantity} {item.unit}
            </td>
            {/* Takeoff price */}
            <td className="py-2 px-3 text-right tabular-nums">
              {item.totalCost > 0 ? fmt.format(item.totalCost) : '-'}
            </td>
            {/* Per-vendor match cells */}
            {scores.map(score => {
              const match = vendorMatches?.get(score.bidId)
              return (
                <td key={score.bidId} className="py-2 px-3 text-center">
                  {match ? (
                    <MatchCell match={match} />
                  ) : (
                    <MissingCell />
                  )}
                </td>
              )
            })}
          </tr>
        )
      })}
    </>
  )
}

// ─── Match Cell (vendor matched this item) ──────────────────────────────────

function MatchCell({ match }: { match: BidCoverageScore['matchDetails'][0] }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs border ${confidenceColor(match.confidence)}`}>
        <CheckCircle2 className="h-3 w-3" />
        <span className="tabular-nums">{fmt.format(match.bidItemPrice)}</span>
      </div>
      {match.bidItemName && match.bidItemName !== match.takeoffItemName && (
        <div className="text-[10px] text-muted-foreground truncate max-w-[130px]" title={match.bidItemName}>
          {match.bidItemName}
        </div>
      )}
    </div>
  )
}

// ─── Missing Cell (vendor does not cover this item) ─────────────────────────

function MissingCell() {
  return (
    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-red-50 text-red-600 border border-red-200">
      <AlertTriangle className="h-3 w-3" />
      <span>MISSING</span>
    </div>
  )
}

// ─── Loading Skeleton ───────────────────────────────────────────────────────

export function CoverageMatrixSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-32 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Card skeletons */}
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-8 w-12" />
            </div>
            <div className="space-y-1.5 mt-3">
              <Skeleton className="h-3 w-full max-w-[400px]" />
              <Skeleton className="h-3 w-full max-w-[350px]" />
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}
