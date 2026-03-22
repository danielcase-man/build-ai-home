'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { cn } from '@/lib/utils'
import {
  ClipboardCheck,
  Plus,
  AlertTriangle,
  Shield,
  Wrench,
  Eye,
  CheckCircle2,
  Clock,
  User,
  MapPin,
  Calendar,
  Loader2,
  CircleDot,
  ArrowRight,
  Paintbrush,
  HardHat,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

type PunchSeverity = 'cosmetic' | 'functional' | 'safety' | 'structural'
type PunchStatus = 'identified' | 'assigned' | 'in_progress' | 'completed' | 'verified'
type PunchSource = 'walkthrough' | 'inspection' | 'owner' | 'consultant'

interface PunchListItem {
  id?: string
  project_id: string
  room: string | null
  location_detail: string | null
  category: string | null
  description: string
  severity: PunchSeverity
  status: PunchStatus
  assigned_vendor_id: string | null
  assigned_vendor_name: string | null
  before_photo_id: string | null
  after_photo_id: string | null
  source: PunchSource
  due_date: string | null
  completed_date: string | null
  notes: string | null
  created_at?: string
}

interface PunchListStats {
  total: number
  bySeverity: Record<string, number>
  byStatus: Record<string, number>
  byRoom: Record<string, number>
  completionRate: number
}

interface PunchListClientProps {
  items: PunchListItem[]
  stats: PunchListStats
  projectId: string
}

// ── Severity config ──────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<PunchSeverity, { label: string; color: string; bgColor: string; borderColor: string; icon: typeof Shield }> = {
  safety:     { label: 'Safety',     color: 'text-red-700',    bgColor: 'bg-red-50',    borderColor: 'border-red-200',    icon: Shield },
  structural: { label: 'Structural', color: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-200', icon: HardHat },
  functional: { label: 'Functional', color: 'text-amber-700',  bgColor: 'bg-amber-50',  borderColor: 'border-amber-200',  icon: Wrench },
  cosmetic:   { label: 'Cosmetic',   color: 'text-slate-600',  bgColor: 'bg-slate-50',  borderColor: 'border-slate-200',  icon: Paintbrush },
}

// ── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PunchStatus, { label: string; color: string; bgColor: string; borderColor: string; icon: typeof CircleDot }> = {
  identified:  { label: 'Identified',  color: 'text-gray-700',    bgColor: 'bg-gray-50',    borderColor: 'border-gray-200',    icon: CircleDot },
  assigned:    { label: 'Assigned',    color: 'text-blue-700',    bgColor: 'bg-blue-50',    borderColor: 'border-blue-200',    icon: User },
  in_progress: { label: 'In Progress', color: 'text-amber-700',   bgColor: 'bg-amber-50',   borderColor: 'border-amber-200',   icon: Clock },
  completed:   { label: 'Completed',   color: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200', icon: CheckCircle2 },
  verified:    { label: 'Verified',    color: 'text-green-700',   bgColor: 'bg-green-50',   borderColor: 'border-green-200',   icon: Eye },
}

const SOURCE_LABELS: Record<PunchSource, string> = {
  walkthrough: 'Walkthrough',
  inspection: 'Inspection',
  owner: 'Owner',
  consultant: 'Consultant',
}

const SEVERITY_ORDER: PunchSeverity[] = ['safety', 'structural', 'functional', 'cosmetic']
const STATUS_ORDER: PunchStatus[] = ['identified', 'assigned', 'in_progress', 'completed', 'verified']

// ── Empty form ───────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  description: '',
  room: '',
  location_detail: '',
  category: '',
  severity: 'functional' as PunchSeverity,
  source: 'owner' as PunchSource,
  notes: '',
  due_date: '',
}

// ── Helper: format date ──────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function isOverdue(dateStr: string | null, status: PunchStatus): boolean {
  if (!dateStr || status === 'completed' || status === 'verified') return false
  return new Date(dateStr) < new Date()
}

// ── Component ────────────────────────────────────────────────────────────────

export default function PunchListClient({ items, stats, projectId }: PunchListClientProps) {
  const router = useRouter()

  // Filters
  const [roomFilter, setRoomFilter] = useState<string>('all')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [createSaving, setCreateSaving] = useState(false)
  const [createForm, setCreateForm] = useState({ ...EMPTY_FORM })

  // Action loading
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // Derive unique rooms from items
  const rooms = useMemo(() => {
    const set = new Set<string>()
    items.forEach(item => { if (item.room) set.add(item.room) })
    return Array.from(set).sort()
  }, [items])

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (roomFilter !== 'all' && item.room !== roomFilter) return false
      if (severityFilter !== 'all' && item.severity !== severityFilter) return false
      if (statusFilter !== 'all' && item.status !== statusFilter) return false
      return true
    })
  }, [items, roomFilter, severityFilter, statusFilter])

  // Sort: safety first, then by status (open before closed), then by date
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      const sevA = SEVERITY_ORDER.indexOf(a.severity)
      const sevB = SEVERITY_ORDER.indexOf(b.severity)
      if (sevA !== sevB) return sevA - sevB
      const statA = STATUS_ORDER.indexOf(a.status)
      const statB = STATUS_ORDER.indexOf(b.status)
      if (statA !== statB) return statA - statB
      return (b.created_at ?? '').localeCompare(a.created_at ?? '')
    })
  }, [filteredItems])

  const activeFilterCount = [roomFilter, severityFilter, statusFilter].filter(f => f !== 'all').length

  // ── Mutations ────────────────────────────────────────────────────────────

  function updateCreateField(field: string, value: string) {
    setCreateForm(prev => ({ ...prev, [field]: value }))
  }

  const handleCreate = useCallback(async () => {
    if (!createForm.description.trim()) return
    setCreateSaving(true)
    try {
      const payload = {
        project_id: projectId,
        description: createForm.description.trim(),
        room: createForm.room.trim() || null,
        location_detail: createForm.location_detail.trim() || null,
        category: createForm.category.trim() || null,
        severity: createForm.severity,
        source: createForm.source,
        notes: createForm.notes.trim() || null,
        due_date: createForm.due_date || null,
        status: 'identified' as PunchStatus,
      }
      const res = await fetch('/api/punch-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setCreateForm({ ...EMPTY_FORM })
        setCreateOpen(false)
        router.refresh()
      }
    } catch (error) {
      console.error('Failed to create punch list item:', error)
    } finally {
      setCreateSaving(false)
    }
  }, [createForm, projectId, router])

  const handleStatusUpdate = useCallback(async (itemId: string, newStatus: PunchStatus) => {
    setUpdatingId(itemId)
    try {
      const res = await fetch('/api/punch-list', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId, status: newStatus }),
      })
      if (res.ok) {
        router.refresh()
      }
    } catch (error) {
      console.error('Failed to update punch list item:', error)
    } finally {
      setUpdatingId(null)
    }
  }, [router])

  // ── Render ───────────────────────────────────────────────────────────────

  const openCount = stats.byStatus['identified'] ?? 0
  const assignedCount = stats.byStatus['assigned'] ?? 0
  const inProgressCount = stats.byStatus['in_progress'] ?? 0

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Punch List</h1>
          <p className="text-muted-foreground">
            Track and resolve construction deficiencies before final walkthrough
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>Add Punch List Item</DialogTitle>
              <DialogDescription>
                Log a new deficiency or issue found during walkthrough or inspection.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* Description - required */}
              <div className="space-y-2">
                <Label htmlFor="description">
                  Description <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="description"
                  placeholder="Describe the issue (e.g., 'Drywall crack above master bedroom door frame')"
                  value={createForm.description}
                  onChange={(e) => updateCreateField('description', e.target.value)}
                  rows={3}
                />
              </div>

              {/* Room + Location detail */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="room">Room</Label>
                  <Input
                    id="room"
                    placeholder="e.g., Master Bedroom"
                    value={createForm.room}
                    onChange={(e) => updateCreateField('room', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location_detail">Location Detail</Label>
                  <Input
                    id="location_detail"
                    placeholder="e.g., East wall, near outlet"
                    value={createForm.location_detail}
                    onChange={(e) => updateCreateField('location_detail', e.target.value)}
                  />
                </div>
              </div>

              {/* Category + Severity */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    placeholder="e.g., Drywall, Paint, Trim"
                    value={createForm.category}
                    onChange={(e) => updateCreateField('category', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="severity">Severity</Label>
                  <Select
                    value={createForm.severity}
                    onValueChange={(v) => updateCreateField('severity', v)}
                  >
                    <SelectTrigger id="severity">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SEVERITY_ORDER.map(sev => (
                        <SelectItem key={sev} value={sev}>
                          <span className="flex items-center gap-2">
                            <span className={cn(
                              'h-2 w-2 rounded-full',
                              sev === 'safety' && 'bg-red-500',
                              sev === 'structural' && 'bg-orange-500',
                              sev === 'functional' && 'bg-amber-500',
                              sev === 'cosmetic' && 'bg-slate-400',
                            )} />
                            {SEVERITY_CONFIG[sev].label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Source + Due Date */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="source">Source</Label>
                  <Select
                    value={createForm.source}
                    onValueChange={(v) => updateCreateField('source', v)}
                  >
                    <SelectTrigger id="source">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="walkthrough">Walkthrough</SelectItem>
                      <SelectItem value="inspection">Inspection</SelectItem>
                      <SelectItem value="owner">Owner</SelectItem>
                      <SelectItem value="consultant">Consultant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="due_date">Due Date</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={createForm.due_date}
                    onChange={(e) => updateCreateField('due_date', e.target.value)}
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional context, photos to reference, or special instructions"
                  value={createForm.notes}
                  onChange={(e) => updateCreateField('notes', e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createSaving || !createForm.description.trim()}
              >
                {createSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Items */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Total Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {(stats.byStatus['completed'] ?? 0) + (stats.byStatus['verified'] ?? 0)} resolved
            </p>
          </CardContent>
        </Card>

        {/* Completion Rate */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Completion Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{Math.round(stats.completionRate)}%</p>
            <Progress value={stats.completionRate} className="mt-2 h-1.5" />
          </CardContent>
        </Card>

        {/* By Severity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              By Severity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              {SEVERITY_ORDER.map(sev => {
                const count = stats.bySeverity[sev] ?? 0
                if (count === 0) return null
                const cfg = SEVERITY_CONFIG[sev]
                return (
                  <div key={sev} className="flex items-center gap-1" title={cfg.label}>
                    <span className={cn(
                      'h-2.5 w-2.5 rounded-full',
                      sev === 'safety' && 'bg-red-500',
                      sev === 'structural' && 'bg-orange-500',
                      sev === 'functional' && 'bg-amber-500',
                      sev === 'cosmetic' && 'bg-slate-400',
                    )} />
                    <span className="text-sm font-semibold">{count}</span>
                  </div>
                )
              })}
              {SEVERITY_ORDER.every(sev => (stats.bySeverity[sev] ?? 0) === 0) && (
                <span className="text-sm text-muted-foreground">None</span>
              )}
            </div>
            <div className="flex gap-2 mt-1.5 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-0.5"><span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Safety</span>
              <span className="flex items-center gap-0.5"><span className="h-1.5 w-1.5 rounded-full bg-orange-500" /> Struct</span>
              <span className="flex items-center gap-0.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Func</span>
              <span className="flex items-center gap-0.5"><span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Cosm</span>
            </div>
          </CardContent>
        </Card>

        {/* Open Items */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Open Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn(
              'text-2xl font-bold',
              (openCount + assignedCount + inProgressCount) > 0 ? 'text-amber-600' : 'text-emerald-600'
            )}>
              {openCount + assignedCount + inProgressCount}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {openCount} new, {assignedCount} assigned, {inProgressCount} active
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">Filter:</span>

            {/* Room filter */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setRoomFilter('all')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                  roomFilter === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                All Rooms
              </button>
              {rooms.map(room => (
                <button
                  key={room}
                  onClick={() => setRoomFilter(roomFilter === room ? 'all' : room)}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                    roomFilter === room
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  {room}
                </button>
              ))}
            </div>

            <Separator orientation="vertical" className="h-5" />

            {/* Severity filter */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setSeverityFilter('all')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                  severityFilter === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                All Severity
              </button>
              {SEVERITY_ORDER.map(sev => {
                const cfg = SEVERITY_CONFIG[sev]
                return (
                  <button
                    key={sev}
                    onClick={() => setSeverityFilter(severityFilter === sev ? 'all' : sev)}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-xs font-medium transition-colors border',
                      severityFilter === sev
                        ? cn(cfg.bgColor, cfg.color, cfg.borderColor)
                        : 'bg-muted text-muted-foreground border-transparent hover:bg-muted/80'
                    )}
                  >
                    {cfg.label}
                  </button>
                )
              })}
            </div>

            <Separator orientation="vertical" className="h-5" />

            {/* Status filter */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setStatusFilter('all')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                  statusFilter === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                All Status
              </button>
              {STATUS_ORDER.map(status => {
                const cfg = STATUS_CONFIG[status]
                return (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-xs font-medium transition-colors border',
                      statusFilter === status
                        ? cn(cfg.bgColor, cfg.color, cfg.borderColor)
                        : 'bg-muted text-muted-foreground border-transparent hover:bg-muted/80'
                    )}
                  >
                    {cfg.label}
                  </button>
                )
              })}
            </div>

            {activeFilterCount > 0 && (
              <>
                <Separator orientation="vertical" className="h-5" />
                <button
                  onClick={() => { setRoomFilter('all'); setSeverityFilter('all'); setStatusFilter('all') }}
                  className="px-2.5 py-1 rounded-md text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  Clear filters ({activeFilterCount})
                </button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {sortedItems.length} of {items.length} item{items.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Item Cards */}
      {sortedItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardCheck className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <h3 className="font-semibold text-lg">No punch list items</h3>
            <p className="text-muted-foreground text-sm mt-1 max-w-sm mx-auto">
              {items.length === 0
                ? 'No items have been logged yet. Add your first punch list item to start tracking deficiencies.'
                : 'No items match the current filters. Try adjusting your filter criteria.'
              }
            </p>
            {items.length === 0 && (
              <Button className="mt-4" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Item
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedItems.map((item) => {
            const sevCfg = SEVERITY_CONFIG[item.severity]
            const statCfg = STATUS_CONFIG[item.status]
            const SevIcon = sevCfg.icon
            const overdue = isOverdue(item.due_date, item.status)
            const isLoading = updatingId === item.id

            return (
              <Card
                key={item.id ?? item.description}
                className={cn(
                  'transition-colors',
                  item.status === 'completed' && 'opacity-75',
                  item.status === 'verified' && 'opacity-60',
                  overdue && 'border-red-300',
                )}
              >
                <CardContent className="py-4 px-5">
                  <div className="flex items-start gap-4">
                    {/* Severity icon */}
                    <div className={cn(
                      'flex items-center justify-center h-9 w-9 rounded-lg shrink-0 mt-0.5',
                      sevCfg.bgColor,
                      sevCfg.borderColor,
                      'border',
                    )}>
                      <SevIcon className={cn('h-4 w-4', sevCfg.color)} />
                    </div>

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={cn(
                            'font-medium leading-snug',
                            (item.status === 'completed' || item.status === 'verified') && 'line-through text-muted-foreground'
                          )}>
                            {item.description}
                          </p>

                          {/* Meta row */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                            {item.room && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {item.room}
                                {item.location_detail && ` - ${item.location_detail}`}
                              </span>
                            )}
                            {item.category && (
                              <span className="flex items-center gap-1">
                                <Wrench className="h-3 w-3" />
                                {item.category}
                              </span>
                            )}
                            {item.assigned_vendor_name && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {item.assigned_vendor_name}
                              </span>
                            )}
                            {item.due_date && (
                              <span className={cn(
                                'flex items-center gap-1',
                                overdue && 'text-red-600 font-medium',
                              )}>
                                <Calendar className="h-3 w-3" />
                                {overdue ? 'Overdue: ' : 'Due: '}{formatDate(item.due_date)}
                              </span>
                            )}
                            <span>
                              Source: {SOURCE_LABELS[item.source]}
                            </span>
                          </div>

                          {item.notes && (
                            <p className="text-xs text-muted-foreground mt-1.5 italic line-clamp-2">
                              {item.notes}
                            </p>
                          )}
                        </div>

                        {/* Badges */}
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className={cn(
                            sevCfg.bgColor,
                            sevCfg.color,
                            sevCfg.borderColor,
                            'hover:' + sevCfg.bgColor,
                          )}>
                            {sevCfg.label}
                          </Badge>
                          <Badge className={cn(
                            statCfg.bgColor,
                            statCfg.color,
                            statCfg.borderColor,
                            'hover:' + statCfg.bgColor,
                          )}>
                            {statCfg.label}
                          </Badge>
                        </div>
                      </div>

                      {/* Action buttons */}
                      {item.status !== 'verified' && (
                        <div className="flex items-center gap-2 mt-3">
                          {item.status === 'identified' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              disabled={isLoading}
                              onClick={() => item.id && handleStatusUpdate(item.id, 'assigned')}
                            >
                              {isLoading ? (
                                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                              ) : (
                                <User className="h-3 w-3 mr-1.5" />
                              )}
                              Assign Vendor
                            </Button>
                          )}
                          {(item.status === 'identified' || item.status === 'assigned') && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              disabled={isLoading}
                              onClick={() => item.id && handleStatusUpdate(item.id, 'in_progress')}
                            >
                              {isLoading ? (
                                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                              ) : (
                                <ArrowRight className="h-3 w-3 mr-1.5" />
                              )}
                              Mark In Progress
                            </Button>
                          )}
                          {(item.status === 'in_progress' || item.status === 'assigned') && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                              disabled={isLoading}
                              onClick={() => item.id && handleStatusUpdate(item.id, 'completed')}
                            >
                              {isLoading ? (
                                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3 w-3 mr-1.5" />
                              )}
                              Mark Complete
                            </Button>
                          )}
                          {item.status === 'completed' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-green-700 border-green-200 hover:bg-green-50"
                              disabled={isLoading}
                              onClick={() => item.id && handleStatusUpdate(item.id, 'verified')}
                            >
                              {isLoading ? (
                                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                              ) : (
                                <Eye className="h-3 w-3 mr-1.5" />
                              )}
                              Verify
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
