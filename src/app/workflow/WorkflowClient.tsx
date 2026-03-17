'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { cn, formatCurrency } from '@/lib/utils'
import {
  CheckCircle2,
  Circle,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronRight,
  Lock,
  ListChecks,
  Target,
  Lightbulb,
  ArrowRight,
  Play,
  BarChart2,
  Package,
  ClipboardCheck,
  Loader2,
  ShieldAlert,
  Sparkles,
  Ban,
  Minus,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface PhaseOverview {
  phase_number: number
  name: string
  status: 'not_started' | 'active' | 'completed' | 'on_hold'
  total_items: number
  completed_items: number
  blocked_items: number
  ready_items: number
  progress_percentage: number
}

interface WorkflowStats {
  totalItems: number
  completed: number
  inProgress: number
  blocked: number
  ready: number
  pending: number
  decisionsPending: number
}

interface WorkflowAlert {
  type: 'blocker' | 'decision_needed' | 'ready_to_start' | 'phase_complete' | 'lead_time_warning'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  title: string
  message: string
  knowledge_id?: string
  phase_number?: number
  selection_id?: string
  order_by_date?: string
}

interface DecisionOption {
  option: string
  pros?: string
  cons?: string
  cost_impact?: string
}

interface ItemState {
  status: string
  notes: string | null
  blocking_reason: string | null
  completed_date: string | null
  actual_cost: number | null
}

interface PhaseTreeItem {
  id: string
  item_name: string
  trade: string
  phase_number: number
  item_type: 'task' | 'material' | 'inspection' | 'decision_point'
  description: string | null
  decision_required: boolean
  inspection_required: boolean
  typical_duration_days: number | null
  typical_cost_range: { min: number; max: number } | null
  decision_options: DecisionOption[] | null
  children: PhaseTreeItem[]
  state?: ItemState | null
}

interface WorkflowClientProps {
  overview: {
    phases: PhaseOverview[]
    stats: WorkflowStats
    alerts: WorkflowAlert[]
  }
  phaseTree: PhaseTreeItem[]
  projectId: string
}

// ── Status helpers ───────────────────────────────────────────────────────────

type ItemStatus = string

function getItemStatus(item: PhaseTreeItem): ItemStatus {
  return item.state?.status ?? 'pending'
}

function getStatusLabel(status: ItemStatus): string {
  const labels: Record<string, string> = {
    completed: 'Completed',
    in_progress: 'In Progress',
    ready: 'Ready',
    blocked: 'Blocked',
    pending: 'Pending',
    not_applicable: 'N/A',
    skipped: 'Skipped',
  }
  return labels[status] ?? status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function getStatusClasses(status: ItemStatus): {
  text: string
  bg: string
  border: string
  dot: string
  badge: string
} {
  switch (status) {
    case 'completed':
      return {
        text: 'text-green-700',
        bg: 'bg-green-50',
        border: 'border-green-200',
        dot: 'bg-green-500',
        badge: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100',
      }
    case 'in_progress':
      return {
        text: 'text-blue-700',
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        dot: 'bg-blue-500',
        badge: 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100',
      }
    case 'ready':
      return {
        text: 'text-emerald-700',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        dot: 'bg-emerald-500',
        badge: 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100',
      }
    case 'blocked':
      return {
        text: 'text-red-700',
        bg: 'bg-red-50',
        border: 'border-red-200',
        dot: 'bg-red-600',
        badge: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100',
      }
    case 'not_applicable':
    case 'skipped':
      return {
        text: 'text-gray-400',
        bg: 'bg-gray-50',
        border: 'border-gray-200',
        dot: 'bg-gray-300',
        badge: 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-100',
      }
    default: // pending
      return {
        text: 'text-gray-500',
        bg: 'bg-gray-50/50',
        border: 'border-gray-200',
        dot: 'bg-gray-400',
        badge: 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100',
      }
  }
}

function getPhaseStatusClasses(status: PhaseOverview['status']): string {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100'
    case 'active':
      return 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100'
    case 'on_hold':
      return 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100'
    default:
      return 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100'
  }
}

function getPhaseStatusLabel(status: PhaseOverview['status']): string {
  switch (status) {
    case 'completed': return 'Complete'
    case 'active': return 'Active'
    case 'on_hold': return 'On Hold'
    default: return 'Not Started'
  }
}

function getItemTypeIcon(item: PhaseTreeItem, status: ItemStatus) {
  const iconClass = 'h-4 w-4 shrink-0'

  // Status-driven icon takes precedence for terminal states
  if (status === 'completed') return <CheckCircle2 className={cn(iconClass, 'text-green-600')} />
  if (status === 'blocked') return <Lock className={cn(iconClass, 'text-red-500')} />
  if (status === 'in_progress') return <Play className={cn(iconClass, 'text-blue-600')} />
  if (status === 'not_applicable' || status === 'skipped') return <Ban className={cn(iconClass, 'text-gray-300')} />

  // Type-driven icon for pending/ready
  switch (item.item_type) {
    case 'inspection':
      return <ClipboardCheck className={cn(iconClass, status === 'ready' ? 'text-emerald-600' : 'text-gray-400')} />
    case 'decision_point':
      return <AlertTriangle className={cn(iconClass, status === 'ready' ? 'text-amber-500' : 'text-gray-400')} />
    case 'material':
      return <Package className={cn(iconClass, status === 'ready' ? 'text-emerald-600' : 'text-gray-400')} />
    default:
      return <Circle className={cn(iconClass, status === 'ready' ? 'text-emerald-500' : 'text-gray-300')} />
  }
}

function getAlertVariant(priority: WorkflowAlert['priority']): 'default' | 'destructive' | 'warning' | 'success' {
  switch (priority) {
    case 'urgent': return 'destructive'
    case 'high': return 'destructive'
    case 'medium': return 'warning'
    default: return 'default'
  }
}

function getAlertIcon(type: WorkflowAlert['type']) {
  const iconClass = 'h-4 w-4'
  switch (type) {
    case 'blocker': return <ShieldAlert className={iconClass} />
    case 'decision_needed': return <AlertTriangle className={iconClass} />
    case 'ready_to_start': return <Sparkles className={iconClass} />
    case 'phase_complete': return <CheckCircle2 className={iconClass} />
    case 'lead_time_warning': return <Clock className={iconClass} />
  }
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string
  value: number | string
  icon: React.ElementType
  accent?: string
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className={cn('text-2xl font-bold mt-1 tabular-nums', accent)}>{value}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2.5">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function AlertsSection({ alerts }: { alerts: WorkflowAlert[] }) {
  const [showAll, setShowAll] = useState(false)

  if (alerts.length === 0) return null

  // Sort by priority: urgent > high > medium > low
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 }
  const sortedAlerts = [...alerts].sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  )

  const visibleAlerts = showAll ? sortedAlerts : sortedAlerts.slice(0, 3)
  const hiddenCount = sortedAlerts.length - 3

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Alerts
        </h2>
        {sortedAlerts.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(!showAll)}
            className="text-xs h-7"
          >
            {showAll ? 'Show fewer' : `+${hiddenCount} more`}
            <ChevronDown className={cn('h-3 w-3 ml-1 transition-transform', showAll && 'rotate-180')} />
          </Button>
        )}
      </div>
      <div className="grid gap-2">
        {visibleAlerts.map((alert, idx) => (
          <Alert key={idx} variant={getAlertVariant(alert.priority)}>
            {getAlertIcon(alert.type)}
            <AlertTitle className="text-sm">{alert.title}</AlertTitle>
            <AlertDescription className="text-xs">{alert.message}</AlertDescription>
          </Alert>
        ))}
      </div>
    </div>
  )
}

function DecisionDialog({
  item,
  open,
  onOpenChange,
  onSelectOption,
  loading,
}: {
  item: PhaseTreeItem
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectOption: (itemId: string, option: string) => void
  loading: boolean
}) {
  const options = item.decision_options ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            Decision Required
          </DialogTitle>
          <DialogDescription>{item.item_name}</DialogDescription>
        </DialogHeader>
        {item.description && (
          <p className="text-sm text-muted-foreground">{item.description}</p>
        )}
        <Separator />
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {options.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No predefined options. Update this decision point in the knowledge base.
            </p>
          ) : (
            options.map((opt, idx) => (
              <button
                key={idx}
                disabled={loading}
                onClick={() => onSelectOption(item.id, opt.option)}
                className={cn(
                  'w-full text-left rounded-lg border p-4 transition-colors',
                  'hover:border-primary/50 hover:bg-primary/5',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:opacity-50 disabled:pointer-events-none'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{opt.option}</p>
                    {opt.pros && (
                      <p className="text-xs text-green-700 mt-1.5">
                        <span className="font-medium">Pros:</span> {opt.pros}
                      </p>
                    )}
                    {opt.cons && (
                      <p className="text-xs text-red-700 mt-1">
                        <span className="font-medium">Cons:</span> {opt.cons}
                      </p>
                    )}
                    {opt.cost_impact && (
                      <p className="text-xs text-muted-foreground mt-1">
                        <span className="font-medium">Cost impact:</span> {opt.cost_impact}
                      </p>
                    )}
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function WorkflowItemRow({
  item,
  depth,
  projectId,
  onMutate,
}: {
  item: PhaseTreeItem
  depth: number
  projectId: string
  onMutate: (itemId: string, action: string, payload?: Record<string, unknown>) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [decisionOpen, setDecisionOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const status = getItemStatus(item)
  const statusClasses = getStatusClasses(status)
  const hasChildren = item.children && item.children.length > 0
  const isDecision = item.item_type === 'decision_point'
  const isStrikethrough = status === 'not_applicable' || status === 'skipped'

  const handleAction = useCallback(async (action: string, payload?: Record<string, unknown>) => {
    setLoading(true)
    try {
      await onMutate(item.id, action, payload)
    } finally {
      setLoading(false)
    }
  }, [item.id, onMutate])

  const handleSelectOption = useCallback(async (itemId: string, option: string) => {
    setLoading(true)
    try {
      await onMutate(itemId, 'decide', { decision: option })
      setDecisionOpen(false)
    } finally {
      setLoading(false)
    }
  }, [onMutate])

  const costDisplay = item.typical_cost_range
    ? `${formatCurrency(item.typical_cost_range.min)} - ${formatCurrency(item.typical_cost_range.max)}`
    : null

  const actualCostDisplay = item.state?.actual_cost != null
    ? formatCurrency(item.state.actual_cost)
    : null

  return (
    <>
      <div
        className={cn(
          'group flex items-center gap-2 py-2.5 px-3 rounded-md transition-colors',
          'hover:bg-muted/40',
          depth > 0 && 'ml-6',
          depth > 1 && 'ml-12',
        )}
        role="listitem"
      >
        {/* Expand toggle for items with children */}
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-0.5 rounded hover:bg-muted shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={expanded ? 'Collapse children' : 'Expand children'}
          >
            <ChevronRight className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', expanded && 'rotate-90')} />
          </button>
        ) : (
          <span className="w-[18px] shrink-0" />
        )}

        {/* Status icon */}
        {getItemTypeIcon(item, status)}

        {/* Name + metadata */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                'text-sm font-medium truncate',
                isStrikethrough && 'line-through text-gray-400'
              )}
              title={item.item_name}
            >
              {item.item_name}
            </span>

            {/* Type pill */}
            {item.item_type !== 'task' && (
              <span className={cn(
                'text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded',
                item.item_type === 'inspection' && 'bg-violet-50 text-violet-700',
                item.item_type === 'material' && 'bg-sky-50 text-sky-700',
                item.item_type === 'decision_point' && 'bg-amber-50 text-amber-700',
              )}>
                {item.item_type === 'decision_point' ? 'Decision' : item.item_type}
              </span>
            )}

            {/* Status badge */}
            {status !== 'pending' && (
              <Badge className={cn('text-[10px] px-1.5 py-0', statusClasses.badge)}>
                {getStatusLabel(status)}
              </Badge>
            )}
          </div>

          {/* Description row with metadata */}
          {(item.description || item.typical_duration_days || costDisplay || item.state?.blocking_reason) && (
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              {item.description && (
                <span className="text-xs text-muted-foreground truncate max-w-[300px]" title={item.description}>
                  {item.description}
                </span>
              )}
              {item.typical_duration_days && (
                <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                  <Clock className="h-3 w-3" />
                  {item.typical_duration_days}d
                </span>
              )}
              {costDisplay && (
                <span className="text-xs text-muted-foreground shrink-0">
                  {actualCostDisplay ? (
                    <span className="font-medium text-foreground">{actualCostDisplay}</span>
                  ) : (
                    costDisplay
                  )}
                </span>
              )}
              {item.state?.blocking_reason && (
                <span className="text-xs text-red-600 flex items-center gap-1 shrink-0">
                  <Lock className="h-3 w-3" />
                  {item.state.blocking_reason}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}

          {!loading && status === 'ready' && !isDecision && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
              onClick={() => handleAction('start')}
              aria-label={`Start ${item.item_name}`}
            >
              <Play className="h-3 w-3 mr-1" />
              Start
            </Button>
          )}

          {!loading && status === 'ready' && isDecision && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2.5 border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
              onClick={() => setDecisionOpen(true)}
              aria-label={`Decide on ${item.item_name}`}
            >
              <Lightbulb className="h-3 w-3 mr-1" />
              Decide
            </Button>
          )}

          {!loading && status === 'in_progress' && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2.5 border-green-300 text-green-700 hover:bg-green-50 hover:text-green-800"
              onClick={() => handleAction('complete')}
              aria-label={`Complete ${item.item_name}`}
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Complete
            </Button>
          )}

          {!loading && status === 'pending' && isDecision && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2.5 text-muted-foreground"
              onClick={() => setDecisionOpen(true)}
              aria-label={`View options for ${item.item_name}`}
            >
              <Target className="h-3 w-3 mr-1" />
              Options
            </Button>
          )}
        </div>
      </div>

      {/* Decision dialog */}
      {isDecision && (
        <DecisionDialog
          item={item}
          open={decisionOpen}
          onOpenChange={setDecisionOpen}
          onSelectOption={handleSelectOption}
          loading={loading}
        />
      )}

      {/* Recursively render children when expanded */}
      {hasChildren && expanded && (
        <div role="list" aria-label={`Sub-items of ${item.item_name}`}>
          {item.children.map(child => (
            <WorkflowItemRow
              key={child.id}
              item={child}
              depth={depth + 1}
              projectId={projectId}
              onMutate={onMutate}
            />
          ))}
        </div>
      )}
    </>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function WorkflowClient({ overview, phaseTree, projectId }: WorkflowClientProps) {
  const router = useRouter()
  const { phases, stats, alerts } = overview

  // Group tree items by phase
  const itemsByPhase = useMemo(() => {
    const grouped = new Map<number, PhaseTreeItem[]>()
    for (const item of phaseTree) {
      const existing = grouped.get(item.phase_number) ?? []
      existing.push(item)
      grouped.set(item.phase_number, existing)
    }
    return grouped
  }, [phaseTree])

  // Group items within each phase by trade
  const tradesByPhase = useMemo(() => {
    const result = new Map<number, Map<string, PhaseTreeItem[]>>()
    for (const [phaseNum, items] of itemsByPhase) {
      const trades = new Map<string, PhaseTreeItem[]>()
      for (const item of items) {
        const tradeName = item.trade || 'General'
        const existing = trades.get(tradeName) ?? []
        existing.push(item)
        trades.set(tradeName, existing)
      }
      result.set(phaseNum, trades)
    }
    return result
  }, [itemsByPhase])

  // Default open: active phases
  const defaultOpenPhases = useMemo(() => {
    return phases
      .filter(p => p.status === 'active')
      .map(p => `phase-${p.phase_number}`)
  }, [phases])

  // Mutation handler
  const handleMutate = useCallback(async (
    itemId: string,
    action: string,
    payload?: Record<string, unknown>
  ) => {
    const statusMap: Record<string, string> = {
      start: 'in_progress',
      complete: 'completed',
      decide: 'completed',
    }

    const body: Record<string, unknown> = {
      projectId,
      knowledgeItemId: itemId,
      status: statusMap[action] ?? action,
    }

    if (action === 'decide' && payload?.decision) {
      body.notes = `Decision: ${payload.decision}`
    }

    try {
      const res = await fetch('/api/workflow/update-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('Workflow update failed:', err)
      }
    } catch (err) {
      console.error('Workflow update error:', err)
    }

    router.refresh()
  }, [projectId, router])

  // Overall progress
  const overallProgress = stats.totalItems > 0
    ? Math.round((stats.completed / stats.totalItems) * 100)
    : 0

  return (
    <TooltipProvider delayDuration={300}>
      <div className="container max-w-6xl py-8 space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Construction Workflow</h1>
          <p className="text-muted-foreground">
            Guided construction checklist across {phases.length} phases
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            label="Progress"
            value={`${overallProgress}%`}
            icon={BarChart2}
            accent="text-primary"
          />
          <StatCard
            label="Completed"
            value={stats.completed}
            icon={CheckCircle2}
            accent="text-green-600"
          />
          <StatCard
            label="In Progress"
            value={stats.inProgress}
            icon={Play}
            accent="text-blue-600"
          />
          <StatCard
            label="Blocked"
            value={stats.blocked}
            icon={Lock}
            accent={stats.blocked > 0 ? 'text-red-600' : undefined}
          />
          <StatCard
            label="Ready"
            value={stats.ready}
            icon={Sparkles}
            accent={stats.ready > 0 ? 'text-emerald-600' : undefined}
          />
          <StatCard
            label="Decisions"
            value={stats.decisionsPending}
            icon={AlertTriangle}
            accent={stats.decisionsPending > 0 ? 'text-amber-600' : undefined}
          />
        </div>

        {/* Overall progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Overall completion</span>
            <span className="font-medium tabular-nums">{stats.completed} of {stats.totalItems} items</span>
          </div>
          <Progress value={overallProgress} className="h-2" />
        </div>

        {/* Alerts */}
        <AlertsSection alerts={alerts} />

        {/* Phase accordion */}
        <Accordion
          type="multiple"
          defaultValue={defaultOpenPhases}
          className="space-y-2"
        >
          {phases.map(phase => {
            const phaseItems = itemsByPhase.get(phase.phase_number) ?? []
            const phaseTrades = tradesByPhase.get(phase.phase_number) ?? new Map<string, PhaseTreeItem[]>()
            const isCompleted = phase.status === 'completed'
            const isEmpty = phaseItems.length === 0

            return (
              <AccordionItem
                key={phase.phase_number}
                value={`phase-${phase.phase_number}`}
                className={cn(
                  'rounded-lg border bg-card shadow-sm overflow-hidden',
                  isCompleted && 'opacity-80',
                  'data-[state=closed]:border-b'
                )}
              >
                <AccordionTrigger className="hover:no-underline px-4 py-3">
                  <div className="flex flex-1 items-center justify-between pr-3 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Phase number circle */}
                      <span
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold shrink-0',
                          phase.status === 'completed' && 'bg-green-100 text-green-800',
                          phase.status === 'active' && 'bg-blue-100 text-blue-800',
                          phase.status === 'on_hold' && 'bg-amber-100 text-amber-800',
                          phase.status === 'not_started' && 'bg-gray-100 text-gray-500',
                        )}
                      >
                        {phase.status === 'completed' ? (
                          <CheckCircle2 className="h-4.5 w-4.5" />
                        ) : (
                          phase.phase_number
                        )}
                      </span>

                      <div className="text-left min-w-0">
                        <span className="font-semibold text-sm">{phase.name}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge className={cn('text-[10px] px-1.5 py-0', getPhaseStatusClasses(phase.status))}>
                            {getPhaseStatusLabel(phase.status)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {phase.completed_items}/{phase.total_items} items
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right side: mini-stats + progress */}
                    <div className="flex items-center gap-3 shrink-0">
                      {phase.blocked_items > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex items-center gap-1 text-xs text-red-600">
                              <Lock className="h-3 w-3" />
                              {phase.blocked_items}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {phase.blocked_items} blocked item{phase.blocked_items !== 1 ? 's' : ''}
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {phase.ready_items > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex items-center gap-1 text-xs text-emerald-600">
                              <Sparkles className="h-3 w-3" />
                              {phase.ready_items}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {phase.ready_items} item{phase.ready_items !== 1 ? 's' : ''} ready to start
                          </TooltipContent>
                        </Tooltip>
                      )}
                      <div className="hidden sm:flex items-center gap-2 w-24">
                        <Progress value={phase.progress_percentage} className="h-1.5 flex-1" />
                        <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">
                          {phase.progress_percentage}%
                        </span>
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="px-4 pb-4">
                  {isEmpty ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <ListChecks className="h-8 w-8 text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">No items in this phase yet</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Items will appear as the knowledge base is populated
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {Array.from(phaseTrades.entries()).map(([tradeName, items]) => (
                        <div key={tradeName}>
                          {/* Trade header (only if multiple trades) */}
                          {phaseTrades.size > 1 && (
                            <div className="flex items-center gap-2 mb-1.5 px-3">
                              <Minus className="h-3 w-3 text-muted-foreground/50" />
                              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                {tradeName}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                ({items.length})
                              </span>
                            </div>
                          )}

                          {/* Item rows */}
                          <div role="list" aria-label={`${tradeName} items in ${phase.name}`}>
                            {items.map(item => (
                              <WorkflowItemRow
                                key={item.id}
                                item={item}
                                depth={0}
                                projectId={projectId}
                                onMutate={handleMutate}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground pt-2 pb-4">
          <span className="font-medium">Legend:</span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-green-600" /> Completed
          </span>
          <span className="flex items-center gap-1">
            <Play className="h-3 w-3 text-blue-600" /> In Progress
          </span>
          <span className="flex items-center gap-1">
            <Circle className="h-3 w-3 text-emerald-500" /> Ready
          </span>
          <span className="flex items-center gap-1">
            <Lock className="h-3 w-3 text-red-500" /> Blocked
          </span>
          <span className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-amber-500" /> Decision
          </span>
          <span className="flex items-center gap-1">
            <ClipboardCheck className="h-3 w-3 text-violet-600" /> Inspection
          </span>
          <span className="flex items-center gap-1">
            <Package className="h-3 w-3 text-sky-600" /> Material
          </span>
          <span className="flex items-center gap-1">
            <Circle className="h-3 w-3 text-gray-300" /> Pending
          </span>
        </div>
      </div>
    </TooltipProvider>
  )
}
