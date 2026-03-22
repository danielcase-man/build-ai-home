'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FileText,
  Plus,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Send,
  ClipboardList,
  TrendingUp,
  TrendingDown,
  CalendarDays,
  Minus,
} from 'lucide-react'
import type {
  ChangeOrder,
  ChangeOrderReason,
  ChangeOrderStatus,
} from '@/lib/change-order-service'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChangeOrdersClientProps {
  orders: ChangeOrder[]
  summary: {
    total: number
    approved: number
    pending: number
    total_cost_impact: number
    total_schedule_impact_days: number
  }
  projectId: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(amount))
}

function formatCostImpact(amount: number): { text: string; className: string } {
  if (amount === 0) return { text: '$0', className: 'text-muted-foreground' }
  if (amount > 0) return { text: `+${formatCurrency(amount)}`, className: 'text-red-600 font-semibold' }
  return { text: `-${formatCurrency(amount)}`, className: 'text-emerald-600 font-semibold' }
}

const STATUS_CONFIG: Record<ChangeOrderStatus, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700 border-gray-200', icon: FileText },
  submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Send },
  approved: { label: 'Approved', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
  completed: { label: 'Completed', color: 'bg-purple-100 text-purple-800 border-purple-200', icon: CheckCircle2 },
}

const REASON_CONFIG: Record<ChangeOrderReason, { label: string; color: string }> = {
  owner_request: { label: 'Owner Request', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  field_condition: { label: 'Field Condition', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  code_requirement: { label: 'Code Requirement', color: 'bg-red-50 text-red-700 border-red-200' },
  design_change: { label: 'Design Change', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  value_engineering: { label: 'Value Engineering', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
}

/** Groups to display in a fixed visual order */
const STATUS_ORDER: ChangeOrderStatus[] = ['draft', 'submitted', 'approved', 'rejected', 'completed']

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: ChangeOrderStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
      <cfg.icon className="h-3 w-3" />
      {cfg.label}
    </span>
  )
}

function ReasonBadge({ reason }: { reason: ChangeOrderReason }) {
  const cfg = REASON_CONFIG[reason]
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

function CostImpactDisplay({ amount }: { amount: number }) {
  const { text, className } = formatCostImpact(amount)
  const Icon = amount > 0 ? TrendingUp : amount < 0 ? TrendingDown : Minus
  return (
    <span className={`inline-flex items-center gap-1 text-sm ${className}`}>
      <Icon className="h-3.5 w-3.5" />
      {text}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Change Order Card
// ---------------------------------------------------------------------------

function ChangeOrderCard({
  order,
  onStatusChange,
}: {
  order: ChangeOrder
  onStatusChange: (id: string, status: ChangeOrderStatus) => void
}) {
  const isRejected = order.status === 'rejected'
  const formattedDate = order.created_at
    ? new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null
  const approvedDate = order.approved_date
    ? new Date(order.approved_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div className={`rounded-lg border p-4 transition-colors ${isRejected ? 'opacity-60 bg-gray-50' : 'bg-white hover:border-gray-300'}`}>
      {/* Row 1: CO number, title, status, cost */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground">CO-{String(order.change_order_number).padStart(3, '0')}</span>
            <span className="font-medium text-sm">{order.title}</span>
            <StatusBadge status={order.status} />
            <ReasonBadge reason={order.reason} />
          </div>
          {order.description && (
            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{order.description}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <CostImpactDisplay amount={order.cost_impact} />
          {order.schedule_impact_days !== null && order.schedule_impact_days !== 0 && (
            <div className="flex items-center justify-end gap-1 mt-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className={`text-xs font-medium ${order.schedule_impact_days > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {order.schedule_impact_days > 0 ? '+' : ''}{order.schedule_impact_days}d
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Metadata */}
      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
        {order.category && (
          <span className="flex items-center gap-1">
            <ClipboardList className="h-3 w-3" />
            {order.category}
          </span>
        )}
        {formattedDate && (
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            Created {formattedDate}
          </span>
        )}
        {approvedDate && (
          <span className="flex items-center gap-1 text-emerald-600">
            <CheckCircle2 className="h-3 w-3" />
            Approved {approvedDate}
          </span>
        )}
        {order.requested_by && (
          <span>Requested by {order.requested_by}</span>
        )}
      </div>

      {/* Row 3: Notes */}
      {order.notes && (
        <p className="mt-2 text-xs text-muted-foreground italic border-l-2 border-gray-200 pl-2">
          {order.notes}
        </p>
      )}

      {/* Row 4: Action buttons (contextual based on current status) */}
      <div className="mt-3 pt-3 border-t flex items-center gap-2">
        {order.status === 'draft' && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => onStatusChange(order.id!, 'submitted')}
          >
            <Send className="h-3 w-3" />
            Submit for Review
          </Button>
        )}
        {order.status === 'submitted' && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              onClick={() => onStatusChange(order.id!, 'approved')}
            >
              <CheckCircle2 className="h-3 w-3" />
              Approve
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1 border-red-200 text-red-700 hover:bg-red-50"
              onClick={() => onStatusChange(order.id!, 'rejected')}
            >
              <XCircle className="h-3 w-3" />
              Reject
            </Button>
          </>
        )}
        {order.status === 'approved' && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1 border-purple-200 text-purple-700 hover:bg-purple-50"
            onClick={() => onStatusChange(order.id!, 'completed')}
          >
            <CheckCircle2 className="h-3 w-3" />
            Mark Completed
          </Button>
        )}
        {(order.status === 'completed' || order.status === 'rejected') && (
          <span className="text-xs text-muted-foreground">No actions available</span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// New Change Order Dialog
// ---------------------------------------------------------------------------

const INITIAL_FORM = {
  title: '',
  description: '',
  reason: '' as ChangeOrderReason | '',
  cost_impact: '',
  schedule_impact_days: '',
  category: '',
  notes: '',
}

function NewChangeOrderDialog({
  projectId,
  open,
  onOpenChange,
  onCreated,
}: {
  projectId: string
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: () => void
}) {
  const [form, setForm] = useState(INITIAL_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateField<K extends keyof typeof INITIAL_FORM>(key: K, value: typeof INITIAL_FORM[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.reason) {
      setError('Title and reason are required.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/change-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim(),
          reason: form.reason,
          cost_impact: parseFloat(form.cost_impact) || 0,
          schedule_impact_days: form.schedule_impact_days ? parseInt(form.schedule_impact_days, 10) : null,
          category: form.category.trim() || null,
          notes: form.notes.trim() || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Failed to create change order')
      }

      setForm(INITIAL_FORM)
      onOpenChange(false)
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Change Order</DialogTitle>
          <DialogDescription>
            Record a scope, cost, or schedule change for the project.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="co-title">Title <span className="text-red-500">*</span></Label>
            <Input
              id="co-title"
              placeholder="e.g. Upgrade kitchen countertops to quartz"
              value={form.title}
              onChange={e => updateField('title', e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="co-description">Description</Label>
            <Textarea
              id="co-description"
              placeholder="Describe what changed and why..."
              rows={3}
              value={form.description}
              onChange={e => updateField('description', e.target.value)}
            />
          </div>

          {/* Reason + Category row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Reason <span className="text-red-500">*</span></Label>
              <Select value={form.reason} onValueChange={v => updateField('reason', v as ChangeOrderReason)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner_request">Owner Request</SelectItem>
                  <SelectItem value="field_condition">Field Condition</SelectItem>
                  <SelectItem value="code_requirement">Code Requirement</SelectItem>
                  <SelectItem value="design_change">Design Change</SelectItem>
                  <SelectItem value="value_engineering">Value Engineering</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="co-category">Category</Label>
              <Input
                id="co-category"
                placeholder="e.g. Kitchen, Electrical"
                value={form.category}
                onChange={e => updateField('category', e.target.value)}
              />
            </div>
          </div>

          {/* Cost + Schedule Impact row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="co-cost">Cost Impact ($)</Label>
              <div className="relative">
                <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="co-cost"
                  type="number"
                  step="0.01"
                  placeholder="0"
                  className="pl-8"
                  value={form.cost_impact}
                  onChange={e => updateField('cost_impact', e.target.value)}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">Positive = cost increase, negative = savings</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="co-schedule">Schedule Impact (days)</Label>
              <div className="relative">
                <Clock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="co-schedule"
                  type="number"
                  placeholder="0"
                  className="pl-8"
                  value={form.schedule_impact_days}
                  onChange={e => updateField('schedule_impact_days', e.target.value)}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">Positive = delay, negative = time saved</p>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="co-notes">Internal Notes</Label>
            <Textarea
              id="co-notes"
              placeholder="Any additional context, reference numbers, attachments..."
              rows={2}
              value={form.notes}
              onChange={e => updateField('notes', e.target.value)}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Creating...' : 'Create Change Order'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ChangeOrdersClient({ orders, summary, projectId }: ChangeOrdersClientProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // Group orders by status
  const grouped = useMemo(() => {
    const map = new Map<ChangeOrderStatus, ChangeOrder[]>()
    for (const order of orders) {
      const list = map.get(order.status) || []
      list.push(order)
      map.set(order.status, list)
    }
    return map
  }, [orders])

  async function handleStatusChange(id: string, newStatus: ChangeOrderStatus) {
    setUpdatingId(id)
    try {
      const body: Record<string, unknown> = { id, status: newStatus }
      if (newStatus === 'approved') {
        body.approved_date = new Date().toISOString()
      }

      const res = await fetch('/api/change-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        router.refresh()
      }
    } catch {
      // Silently fail — the UI will remain in previous state
    } finally {
      setUpdatingId(null)
    }
  }

  const netImpact = formatCostImpact(summary.total_cost_impact)

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Change Orders</h1>
          <p className="text-muted-foreground">
            Track scope, cost, and schedule changes throughout construction
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          New Change Order
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Total COs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.total}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Approved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">{summary.approved}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">{summary.pending}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Net Cost Impact
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${netImpact.className}`}>
              {summary.total_cost_impact === 0 ? '$0' : netImpact.text}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Schedule Impact
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${summary.total_schedule_impact_days > 0 ? 'text-amber-600' : summary.total_schedule_impact_days < 0 ? 'text-emerald-600' : ''}`}>
              {summary.total_schedule_impact_days > 0 ? '+' : ''}{summary.total_schedule_impact_days}d
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="text-muted-foreground font-medium">Status:</span>
        {STATUS_ORDER.map(status => {
          const cfg = STATUS_CONFIG[status]
          const count = grouped.get(status)?.length || 0
          return (
            <div key={status} className="flex items-center gap-1">
              <cfg.icon className="h-3 w-3 text-muted-foreground" />
              <span>{cfg.label}</span>
              <span className="text-muted-foreground">({count})</span>
            </div>
          )
        })}
      </div>

      <Separator />

      {/* Grouped Change Order Cards */}
      {orders.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <h3 className="text-sm font-medium text-muted-foreground">No change orders yet</h3>
            <p className="text-xs text-muted-foreground/70 mt-1 max-w-sm">
              Change orders track modifications to scope, cost, or schedule during construction.
              Create one when a change is needed.
            </p>
            <Button size="sm" className="mt-4 gap-1.5" onClick={() => setDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Create First Change Order
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {STATUS_ORDER.map(status => {
            const groupOrders = grouped.get(status)
            if (!groupOrders || groupOrders.length === 0) return null

            const cfg = STATUS_CONFIG[status]
            return (
              <div key={status}>
                <div className="flex items-center gap-2 mb-3">
                  <cfg.icon className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">{cfg.label}</h2>
                  <Badge variant="secondary" className="text-xs">
                    {groupOrders.length}
                  </Badge>
                </div>
                <div className="space-y-3">
                  {groupOrders.map(order => (
                    <ChangeOrderCard
                      key={order.id}
                      order={order}
                      onStatusChange={handleStatusChange}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* New Change Order Dialog */}
      <NewChangeOrderDialog
        projectId={projectId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => router.refresh()}
      />
    </div>
  )
}
