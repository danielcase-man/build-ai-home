'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  Lock,
  Package,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Truck,
  X,
} from 'lucide-react'
import type {
  DecisionQueueResult,
  DecisionQueueCategory,
  DecisionQueueBid,
  DecisionUrgency,
  SelectionStatus,
} from '@/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount)
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')
}

const URGENCY_STYLES: Record<DecisionUrgency, { badge: string; dot: string }> = {
  urgent: {
    badge: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    dot: 'bg-red-500',
  },
  high: {
    badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    dot: 'bg-orange-500',
  },
  medium: {
    badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    dot: 'bg-yellow-500',
  },
  low: {
    badge: 'bg-gray-100 text-gray-800 dark:bg-gray-800/40 dark:text-gray-300',
    dot: 'bg-gray-400',
  },
  none: {
    badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400',
    dot: 'bg-gray-300',
  },
}

const STATUS_ORDER: SelectionStatus[] = [
  'considering',
  'selected',
  'ordered',
  'received',
  'installed',
  'alternative',
]

/** Numeric sort key for urgency (lower = more urgent) */
function sortUrgency(u: DecisionUrgency): number {
  const map: Record<DecisionUrgency, number> = {
    urgent: 0, high: 1, medium: 2, low: 3, none: 4,
  }
  return map[u] ?? 4
}

/** Build a human-readable summary like "4 items: 2 ordered, 1 received, 1 selected" */
function buildStatusLine(
  count: number,
  summary: Partial<Record<SelectionStatus, number>>
): string {
  const parts = STATUS_ORDER
    .filter((s) => summary[s] && summary[s]! > 0)
    .map((s) => `${summary[s]} ${s}`)
  if (parts.length === 0) return `${count} item${count !== 1 ? 's' : ''}`
  return `${count} item${count !== 1 ? 's' : ''}: ${parts.join(', ')}`
}

/** Weighted progress for a locked-in category (installed=100, received=75, ordered=50, selected=25) */
function progressPercent(
  summary: Partial<Record<SelectionStatus, number>>,
  total: number
): number {
  if (total === 0) return 0
  const installed = summary.installed ?? 0
  const received = summary.received ?? 0
  const ordered = summary.ordered ?? 0
  const selected = summary.selected ?? 0
  const weighted = installed * 100 + received * 75 + ordered * 50 + selected * 25
  return Math.round(weighted / total)
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function DashboardSkeleton() {
  return (
    <div className="container max-w-6xl py-8 space-y-8">
      {/* Header skeleton */}
      <div>
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Zone 1 skeleton */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-5 w-8 rounded-full" />
        </div>
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <div className="flex justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-8 w-20 rounded-md" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Zone 2 skeleton */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-5 w-8 rounded-full" />
        </div>
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <div className="flex items-center gap-4 p-4">
              <Skeleton className="h-4 w-4" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-64" />
              </div>
              <Skeleton className="h-2 w-24" />
            </div>
          </Card>
        ))}
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Error State
// ---------------------------------------------------------------------------

interface ErrorStateProps {
  message: string
  onRetry: () => void
}

function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="container max-w-6xl py-8">
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/30">
            <ShieldAlert className="h-7 w-7 text-red-500 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Failed to Load Selections</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md">{message}</p>
          <Button onClick={onRetry} variant="outline" className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inline Error Banner (for mutation errors while data is still visible)
// ---------------------------------------------------------------------------

interface ErrorBannerProps {
  message: string
  onDismiss: () => void
}

function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="mb-4 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
    >
      <ShieldAlert className="h-4 w-4 shrink-0" />
      <span className="flex-1">{message}</span>
      <button
        onClick={onDismiss}
        className="shrink-0 rounded p-1 hover:bg-red-100 dark:hover:bg-red-900/40"
        aria-label="Dismiss error"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Zone 1 Sub-components
// ---------------------------------------------------------------------------

interface BidRowProps {
  bid: DecisionQueueBid
  isLocking: boolean
  onLockIn: (bidId: string) => void
}

function BidRow({ bid, isLocking, onLockIn }: BidRowProps) {
  return (
    <tr className="border-t border-border/50 transition-colors hover:bg-muted/30">
      <td className="py-2.5 pr-4 font-medium">{bid.vendorName}</td>
      <td className="py-2.5 pr-4 font-mono tabular-nums text-right">
        {formatCurrency(bid.totalAmount)}
      </td>
      <td className="py-2.5 pr-4 text-muted-foreground">
        {bid.leadTimeWeeks ? `${bid.leadTimeWeeks} wk${bid.leadTimeWeeks !== 1 ? 's' : ''}` : '\u2014'}
      </td>
      <td className="py-2.5 text-right">
        <Button
          size="sm"
          onClick={() => onLockIn(bid.bidId)}
          disabled={isLocking}
          className="h-8 gap-1.5"
        >
          {isLocking ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Lock className="h-3.5 w-3.5" />
          )}
          Lock In
        </Button>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Zone 1 Decision Card
// ---------------------------------------------------------------------------

interface DecisionCardProps {
  category: DecisionQueueCategory
  lockingBidId: string | null
  onLockIn: (bidId: string) => void
}

function DecisionCard({ category, lockingBidId, onLockIn }: DecisionCardProps) {
  const { bids, urgency, urgencyReason, leadTimeAlert, phase, phaseName } = category

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-base">{capitalize(category.category)}</CardTitle>
            <p className="text-xs text-muted-foreground">
              Phase {phase}: {phaseName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {urgency !== 'none' && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${URGENCY_STYLES[urgency].badge}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${URGENCY_STYLES[urgency].dot}`} />
                {capitalize(urgency)}
              </span>
            )}
          </div>
        </div>

        {/* Urgency reason text for urgent/high items */}
        {urgencyReason && (urgency === 'urgent' || urgency === 'high') && (
          <p className="mt-1 text-xs text-muted-foreground italic">{urgencyReason}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Lead-time alert banner */}
        {leadTimeAlert && (
          <div className="flex items-start gap-2.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm dark:border-amber-800 dark:bg-amber-950/30">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-300">
                {leadTimeAlert.title}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {leadTimeAlert.message}
                {leadTimeAlert.order_by_date && (
                  <> &mdash; order by <strong>{leadTimeAlert.order_by_date}</strong></>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Bid comparison table */}
        {bids.length > 0 ? (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="pb-2 pr-4 text-left font-medium">Vendor</th>
                  <th className="pb-2 pr-4 text-right font-medium">Amount</th>
                  <th className="pb-2 pr-4 text-left font-medium">Lead Time</th>
                  <th className="pb-2 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {bids.map((bid) => (
                  <BidRow
                    key={bid.bidId}
                    bid={bid}
                    isLocking={lockingBidId === bid.bidId}
                    onLockIn={onLockIn}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-2 text-center text-xs text-muted-foreground">
            No bids received yet.
          </p>
        )}

        {/* Pros/cons for bids that have them */}
        {bids.some((b) => b.pros || b.cons) && (
          <div className="space-y-2 border-t border-border/50 pt-3">
            {bids
              .filter((b) => b.pros || b.cons)
              .map((bid) => (
                <div key={bid.bidId} className="text-xs">
                  <p className="font-medium text-muted-foreground">{bid.vendorName}</p>
                  {bid.pros && (
                    <p className="mt-0.5 text-green-700 dark:text-green-400">
                      <span className="font-semibold">Pros:</span> {bid.pros}
                    </p>
                  )}
                  {bid.cons && (
                    <p className="mt-0.5 text-red-700 dark:text-red-400">
                      <span className="font-semibold">Cons:</span> {bid.cons}
                    </p>
                  )}
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Zone 2 Sub-components
// ---------------------------------------------------------------------------

interface BatchButtonProps {
  label: string
  count: number
  isLoading: boolean
  onClick: () => void
}

function BatchButton({ label, count, isLoading, onClick }: BatchButtonProps) {
  if (count === 0) return null
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={isLoading}
      className="h-8 text-xs gap-1.5"
    >
      {isLoading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Truck className="h-3.5 w-3.5" />
      )}
      {label} ({count})
    </Button>
  )
}

function StatusIcon({ status }: { status: SelectionStatus }) {
  switch (status) {
    case 'considering':
      return <Clock className="h-3.5 w-3.5 text-muted-foreground" />
    case 'selected':
      return <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
    case 'ordered':
      return <Truck className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
    case 'received':
      return <Package className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
    case 'installed':
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-700 dark:text-green-300" />
    default:
      return <Clock className="h-3.5 w-3.5 text-muted-foreground" />
  }
}

// ---------------------------------------------------------------------------
// Zone 2 Locked In Card
// ---------------------------------------------------------------------------

interface LockedInCardProps {
  category: DecisionQueueCategory
  isOpen: boolean
  onToggle: () => void
  batchLoading: string | null
  onBatchStatus: (fromStatus: SelectionStatus, newStatus: SelectionStatus) => void
  swapping: boolean
  onSwap: (bidId: string) => void
}

function LockedInCard({
  category,
  isOpen,
  onToggle,
  batchLoading,
  onBatchStatus,
  swapping,
  onSwap,
}: LockedInCardProps) {
  const [showSwap, setShowSwap] = useState(false)
  const { selectedBid, selectionCount, statusSummary, bids } = category
  const progress = progressPercent(statusSummary, selectionCount)

  const selectedCount = statusSummary.selected ?? 0
  const orderedCount = statusSummary.ordered ?? 0
  const receivedCount = statusSummary.received ?? 0

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={onToggle}>
        {/* Compact header -- always visible */}
        <div className="flex items-center gap-4 p-4">
          <CollapsibleTrigger asChild>
            <button
              className="flex shrink-0 items-center justify-center rounded p-0.5 hover:bg-accent transition-colors"
              aria-label={isOpen ? 'Collapse details' : 'Expand details'}
            >
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </CollapsibleTrigger>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-medium">{capitalize(category.category)}</span>
              {selectedBid && (
                <>
                  <span className="text-muted-foreground">&middot;</span>
                  <span className="text-sm text-muted-foreground">
                    {selectedBid.vendorName}
                  </span>
                </>
              )}
              {selectedBid && (
                <span className="font-mono text-sm tabular-nums">
                  {formatCurrency(selectedBid.totalAmount)}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {buildStatusLine(selectionCount, statusSummary)}
            </p>
          </div>

          {/* Compact progress bar */}
          <div className="hidden w-24 sm:block" title={`${progress}% complete`}>
            <Progress value={progress} className="h-2" />
          </div>
        </div>

        {/* Expanded detail */}
        <CollapsibleContent>
          <div className="border-t border-border/50 px-4 pb-4 pt-3">
            {/* Batch action buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <BatchButton
                label="Mark All Ordered"
                count={selectedCount}
                isLoading={batchLoading === `${category.category}-selected-ordered`}
                onClick={() => onBatchStatus('selected', 'ordered')}
              />
              <BatchButton
                label="Mark All Received"
                count={orderedCount}
                isLoading={batchLoading === `${category.category}-ordered-received`}
                onClick={() => onBatchStatus('ordered', 'received')}
              />
              <BatchButton
                label="Mark All Installed"
                count={receivedCount}
                isLoading={batchLoading === `${category.category}-received-installed`}
                onClick={() => onBatchStatus('received', 'installed')}
              />

              {/* Swap Vendor -- subtle, pushed right */}
              <div className="ml-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setShowSwap(!showSwap)}
                  disabled={swapping || bids.length < 2}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Swap Vendor
                </Button>
              </div>
            </div>

            {/* Swap vendor panel */}
            {showSwap && bids.length > 1 && (
              <div className="mt-3 rounded-md border border-border bg-muted/30 p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Select a different vendor for this category:
                </p>
                <div className="space-y-1.5">
                  {bids.map((bid) => {
                    const isCurrent = bid.bidId === selectedBid?.bidId
                    return (
                      <div
                        key={bid.bidId}
                        className="flex items-center justify-between rounded px-2.5 py-1.5 text-sm"
                      >
                        <div className="flex items-center gap-3">
                          <span className={isCurrent ? 'font-semibold' : ''}>
                            {bid.vendorName}
                          </span>
                          <span className="font-mono tabular-nums text-muted-foreground">
                            {formatCurrency(bid.totalAmount)}
                          </span>
                          {isCurrent && (
                            <Badge variant="secondary" className="text-xs">
                              Current
                            </Badge>
                          )}
                        </div>
                        {!isCurrent && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={swapping}
                            onClick={() => onSwap(bid.bidId)}
                          >
                            {swapping ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              'Select'
                            )}
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Status breakdown grid */}
            {selectionCount > 0 && (
              <div className="mt-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Status Breakdown
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
                  {STATUS_ORDER.filter((s) => s !== 'alternative').map((status) => {
                    const count = statusSummary[status] ?? 0
                    if (count === 0 && status !== 'installed') return null
                    return (
                      <div
                        key={status}
                        className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-1.5"
                      >
                        <StatusIcon status={status} />
                        <div className="text-xs">
                          <span className="font-mono tabular-nums font-semibold">{count}</span>
                          <span className="ml-1 text-muted-foreground">{capitalize(status)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

interface SelectionsDashboardProps {
  initialData: DecisionQueueResult
}

export default function SelectionsDashboard({ initialData }: SelectionsDashboardProps) {
  const [data, setData] = useState<DecisionQueueResult>(initialData)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [lockingBidId, setLockingBidId] = useState<string | null>(null)
  const [batchLoading, setBatchLoading] = useState<string | null>(null)
  const [swappingCategory, setSwappingCategory] = useState<string | null>(null)
  const [futureOpen, setFutureOpen] = useState(false)
  const [lockedSectionOpen, setLockedSectionOpen] = useState(true)
  const [openLockedDetails, setOpenLockedDetails] = useState<Set<string>>(new Set())
  const [mutationError, setMutationError] = useState<string | null>(null)

  const { decisionQueue, lockedIn, future } = data

  // Auto-expand locked section details when <= 5 items
  useEffect(() => {
    if (lockedIn.length <= 5 && lockedIn.length > 0) {
      setOpenLockedDetails(new Set(lockedIn.map((c) => c.category)))
    }
  }, []) // Intentionally only on mount -- don't re-collapse when items change

  // Summary metrics computed from current data
  const summaryMetrics = useMemo(() => {
    const totalLocked = lockedIn.reduce(
      (sum, c) => sum + (c.selectedBid?.totalAmount ?? 0),
      0
    )
    const totalDecisions = decisionQueue.length
    const urgentCount = decisionQueue.filter(
      (c) => c.urgency === 'urgent' || c.urgency === 'high'
    ).length
    const fullyInstalled = lockedIn.filter((c) => {
      const installed = c.statusSummary.installed ?? 0
      return c.selectionCount > 0 && installed === c.selectionCount
    }).length
    return { totalLocked, totalDecisions, urgentCount, fullyInstalled }
  }, [decisionQueue, lockedIn])

  // --- Fetch / Refresh data ---
  const fetchData = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch('/api/selections/decision-queue')
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(body.error || `Failed to load (${res.status})`)
      }
      const json = await res.json()
      setData(json.data)
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load selections')
    } finally {
      setLoading(false)
    }
  }, [])

  // --- API: Lock in a vendor ---
  const handleLockIn = useCallback(
    async (category: DecisionQueueCategory, bidId: string) => {
      setLockingBidId(bidId)
      setMutationError(null)

      // Optimistic: move category from decision queue to locked in
      const selectedBid = category.bids.find((b) => b.bidId === bidId)
      if (!selectedBid) return

      const optimisticCategory: DecisionQueueCategory = {
        ...category,
        zone: 'locked',
        selectedBid,
      }

      setData((prev) => ({
        ...prev,
        decisionQueue: prev.decisionQueue.filter(
          (c) => c.category !== category.category
        ),
        lockedIn: [...prev.lockedIn, optimisticCategory],
      }))

      try {
        const res = await fetch('/api/bids/select-vendor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bid_id: bidId }),
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: 'Request failed' }))
          throw new Error(body.error || `Failed (${res.status})`)
        }
      } catch (err) {
        // Revert optimistic update
        setData((prev) => ({
          ...prev,
          decisionQueue: [...prev.decisionQueue, category].sort(
            (a, b) =>
              sortUrgency(a.urgency) - sortUrgency(b.urgency) || a.phase - b.phase
          ),
          lockedIn: prev.lockedIn.filter(
            (c) => c.category !== category.category
          ),
        }))
        setMutationError(
          err instanceof Error ? err.message : 'Failed to lock in vendor'
        )
      } finally {
        setLockingBidId(null)
      }
    },
    []
  )

  // --- API: Batch status update ---
  const handleBatchStatus = useCallback(
    async (
      category: string,
      fromStatus: SelectionStatus,
      newStatus: SelectionStatus
    ) => {
      const key = `${category}-${fromStatus}-${newStatus}`
      setBatchLoading(key)
      setMutationError(null)

      // Snapshot for revert
      const snapshot = data.lockedIn.find((c) => c.category === category)

      // Optimistic update
      setData((prev) => ({
        ...prev,
        lockedIn: prev.lockedIn.map((c) => {
          if (c.category !== category) return c
          const moveCount = c.statusSummary[fromStatus] ?? 0
          return {
            ...c,
            statusSummary: {
              ...c.statusSummary,
              [fromStatus]: 0,
              [newStatus]: (c.statusSummary[newStatus] ?? 0) + moveCount,
            },
          }
        }),
      }))

      try {
        const res = await fetch('/api/selections/batch-status', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category, newStatus, fromStatus }),
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: 'Request failed' }))
          throw new Error(body.error || `Failed (${res.status})`)
        }
      } catch (err) {
        // Revert using snapshot
        if (snapshot) {
          setData((prev) => ({
            ...prev,
            lockedIn: prev.lockedIn.map((c) =>
              c.category === category
                ? { ...c, statusSummary: snapshot.statusSummary }
                : c
            ),
          }))
        }
        setMutationError(
          err instanceof Error ? err.message : 'Failed to update status'
        )
      } finally {
        setBatchLoading(null)
      }
    },
    [data.lockedIn]
  )

  // --- API: Swap vendor ---
  const handleSwapVendor = useCallback(
    async (category: DecisionQueueCategory, newBidId: string) => {
      setSwappingCategory(category.category)
      setMutationError(null)

      try {
        const res = await fetch('/api/bids/select-vendor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bid_id: newBidId }),
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: 'Request failed' }))
          throw new Error(body.error || `Failed (${res.status})`)
        }

        // Update local state with new selected bid
        const newSelected = category.bids.find((b) => b.bidId === newBidId)
        if (newSelected) {
          setData((prev) => ({
            ...prev,
            lockedIn: prev.lockedIn.map((c) =>
              c.category === category.category
                ? { ...c, selectedBid: newSelected }
                : c
            ),
          }))
        }
      } catch (err) {
        setMutationError(
          err instanceof Error ? err.message : 'Failed to swap vendor'
        )
      } finally {
        setSwappingCategory(null)
      }
    },
    []
  )

  const toggleLockedDetail = useCallback((category: string) => {
    setOpenLockedDetails((prev) => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }, [])

  // --- Loading skeleton for refetch ---
  if (loading && !data) {
    return <DashboardSkeleton />
  }

  // --- Fatal error with no data ---
  if (fetchError && !data) {
    return <ErrorState message={fetchError} onRetry={fetchData} />
  }

  return (
    <div className="container max-w-6xl py-8 space-y-8">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Selections & Decisions</h1>
          <p className="text-muted-foreground text-sm">
            Vendor decisions, material selections, and procurement tracking
          </p>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Decisions Pending</p>
            <p className="text-2xl font-bold tabular-nums">
              {summaryMetrics.totalDecisions}
            </p>
            {summaryMetrics.urgentCount > 0 && (
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                {summaryMetrics.urgentCount} urgent
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Locked In</p>
            <p className="text-2xl font-bold tabular-nums">{lockedIn.length}</p>
            <p className="text-xs text-muted-foreground">
              {summaryMetrics.fullyInstalled} fully installed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Committed Cost</p>
            <p className="text-2xl font-bold font-mono tabular-nums">
              {formatCurrency(summaryMetrics.totalLocked)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Not Yet Needed</p>
            <p className="text-2xl font-bold tabular-nums">{future.length}</p>
            <p className="text-xs text-muted-foreground">categories without bids</p>
          </CardContent>
        </Card>
      </div>

      {/* Mutation error banner */}
      {mutationError && (
        <ErrorBanner
          message={mutationError}
          onDismiss={() => setMutationError(null)}
        />
      )}

      {/* ================================================================ */}
      {/* Zone 1 -- Decision Queue                                        */}
      {/* ================================================================ */}
      <section aria-label="Decisions needed">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight">
            Decisions Needed
          </h2>
          {decisionQueue.length > 0 && (
            <Badge variant="destructive" className="text-xs tabular-nums">
              {decisionQueue.length}
            </Badge>
          )}
        </div>

        {decisionQueue.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-50 dark:bg-green-950/30">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-sm font-medium">All vendor decisions made</p>
              <p className="text-xs text-muted-foreground mt-1">
                No pending vendor decisions. Check back when new bids arrive.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {decisionQueue.map((cat) => (
              <DecisionCard
                key={cat.category}
                category={cat}
                lockingBidId={lockingBidId}
                onLockIn={(bidId) => handleLockIn(cat, bidId)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ================================================================ */}
      {/* Zone 2 -- Locked In                                             */}
      {/* ================================================================ */}
      <section aria-label="Locked in vendors">
        <Collapsible
          open={lockedSectionOpen}
          onOpenChange={setLockedSectionOpen}
        >
          <CollapsibleTrigger className="group flex w-full items-center gap-3 text-left mb-4">
            <h2 className="text-lg font-semibold tracking-tight">Locked In</h2>
            {lockedIn.length > 0 && (
              <Badge variant="success" className="text-xs tabular-nums">
                {lockedIn.length}
              </Badge>
            )}
            <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
          </CollapsibleTrigger>

          <CollapsibleContent>
            {lockedIn.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Package className="mb-3 h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-muted-foreground">
                    No vendors locked in yet.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Make decisions above to get started.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {lockedIn.map((cat) => (
                  <LockedInCard
                    key={cat.category}
                    category={cat}
                    isOpen={openLockedDetails.has(cat.category)}
                    onToggle={() => toggleLockedDetail(cat.category)}
                    batchLoading={batchLoading}
                    onBatchStatus={(from, to) =>
                      handleBatchStatus(cat.category, from, to)
                    }
                    swapping={swappingCategory === cat.category}
                    onSwap={(bidId) => handleSwapVendor(cat, bidId)}
                  />
                ))}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </section>

      {/* ================================================================ */}
      {/* Zone 3 -- Not Yet Needed                                        */}
      {/* ================================================================ */}
      <section aria-label="Future categories">
        <Collapsible open={futureOpen} onOpenChange={setFutureOpen}>
          <CollapsibleTrigger className="group flex w-full items-center gap-3 text-left">
            <h2 className="text-lg font-semibold tracking-tight">
              Not Yet Needed
            </h2>
            {future.length > 0 && (
              <Badge variant="secondary" className="text-xs tabular-nums">
                {future.length}
              </Badge>
            )}
            <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
          </CollapsibleTrigger>

          <CollapsibleContent className="mt-3">
            {future.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                All categories have bids or selections.
              </p>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <ul className="divide-y divide-border/50">
                    {future.map((cat) => (
                      <li
                        key={cat.category}
                        className="flex items-center justify-between px-4 py-3 text-sm"
                      >
                        <div>
                          <span className="font-medium">
                            {capitalize(cat.category)}
                          </span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            Phase {cat.phase}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground italic">
                          No bids yet
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </CollapsibleContent>
        </Collapsible>
      </section>
    </div>
  )
}
