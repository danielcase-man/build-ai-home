'use client'

import { useState, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  CheckCircle2, AlertTriangle, Clock, Gavel,
  Plus, ChevronDown, ChevronRight, Loader2, DollarSign,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { DecisionLogEntry, DecisionQueueCategory } from '@/types'

// ── Types ──

interface OpenTask {
  id: string
  title: string
  status: string
}

interface DecisionsClientProps {
  decisions: DecisionLogEntry[]
  decisionQueue: DecisionQueueCategory[]
  lockedIn: DecisionQueueCategory[]
  futureTrades: DecisionQueueCategory[]
  openTasks: OpenTask[]
  projectId: string
}

// ── Helpers ──

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmt(amount: number | null | undefined): string {
  if (amount == null) return ''
  return '$' + Math.abs(amount).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

const TYPE_LABELS: Record<string, string> = {
  vendor_selection: 'Vendor Selection',
  material_choice: 'Material Choice',
  design_change: 'Design Change',
  budget_adjustment: 'Budget Adjustment',
  schedule_change: 'Schedule Change',
}

const OUTCOME_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  successful: 'bg-green-100 text-green-700',
  problematic: 'bg-red-100 text-red-700',
  reversed: 'bg-orange-100 text-orange-700',
}

// ── Component ──

export default function DecisionsClient({
  decisions: initialDecisions,
  decisionQueue,
  lockedIn,
  futureTrades,
  openTasks,
  projectId,
}: DecisionsClientProps) {
  const [decisions, setDecisions] = useState(initialDecisions)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expandedMade, setExpandedMade] = useState(true)
  const [expandedNeeded, setExpandedNeeded] = useState(true)
  const [expandedFuture, setExpandedFuture] = useState(false)

  // Form state
  const [formType, setFormType] = useState('vendor_selection')
  const [formCategory, setFormCategory] = useState('')
  const [formTitle, setFormTitle] = useState('')
  const [formChosen, setFormChosen] = useState('')
  const [formReasoning, setFormReasoning] = useState('')
  const [formCostImpact, setFormCostImpact] = useState('')
  const [formCloseTasks, setFormCloseTasks] = useState<string[]>([])

  // Stats
  const madeCount = decisions.length
  const neededCount = decisionQueue.length
  const blockedCount = decisionQueue.filter(c => c.urgency === 'urgent').length

  // Find tasks related to a category
  const getRelatedTasks = useCallback((category: string) => {
    const catLower = category.toLowerCase()
    return openTasks.filter(t =>
      t.title.toLowerCase().includes(catLower)
    )
  }, [openTasks])

  // Pre-fill form from a decision queue item
  const prefillFromQueue = useCallback((item: DecisionQueueCategory) => {
    setFormType('vendor_selection')
    setFormCategory(item.category)
    setFormTitle(`Select vendor for ${item.category}`)
    setFormChosen('')
    setFormReasoning('')
    setFormCostImpact('')
    const related = getRelatedTasks(item.category)
    setFormCloseTasks(related.map(t => t.id))
    setShowForm(true)
  }, [getRelatedTasks])

  const handleSave = useCallback(async () => {
    if (!formTitle || !formChosen) {
      toast.error('Title and chosen option are required')
      return
    }
    setSaving(true)
    try {
      const response = await fetch('/api/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision_type: formType,
          category: formCategory || undefined,
          title: formTitle,
          chosen_option: formChosen,
          reasoning: formReasoning || undefined,
          cost_impact: formCostImpact ? parseFloat(formCostImpact) : undefined,
          close_task_ids: formCloseTasks.length > 0 ? formCloseTasks : undefined,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to save')

      toast.success('Decision recorded')
      setDecisions(prev => [data.data.decision, ...prev])
      if (data.data.closedTasks?.length > 0) {
        toast.success(`Closed ${data.data.closedTasks.length} related task(s)`)
      }
      setShowForm(false)
      // Reset form
      setFormTitle('')
      setFormChosen('')
      setFormReasoning('')
      setFormCostImpact('')
      setFormCategory('')
      setFormCloseTasks([])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save decision')
    } finally {
      setSaving(false)
    }
  }, [formType, formCategory, formTitle, formChosen, formReasoning, formCostImpact, formCloseTasks])

  const toggleTaskSelection = useCallback((taskId: string) => {
    setFormCloseTasks(prev =>
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    )
  }, [])

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Decision Tracker</h1>
          <p className="text-muted-foreground text-sm">
            Decisions made, needed, and upcoming — with cascading updates
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Record Decision
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="animate-fade-in">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Decisions Made</p>
                <p className="text-2xl font-bold text-green-700">{madeCount}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="animate-fade-in" style={{ animationDelay: '75ms' }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Decisions Needed</p>
                <p className="text-2xl font-bold text-orange-600">{neededCount}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="animate-fade-in" style={{ animationDelay: '150ms' }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Urgent / Blocked</p>
                <p className="text-2xl font-bold text-red-600">{blockedCount}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Decisions Needed ── */}
      {decisionQueue.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/30">
          <button onClick={() => setExpandedNeeded(!expandedNeeded)} className="w-full text-left">
            <CardHeader className="cursor-pointer hover:bg-accent/30 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {expandedNeeded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4 text-orange-500" />
                    Decisions Needed
                  </CardTitle>
                  <Badge variant="warning">{decisionQueue.length}</Badge>
                </div>
              </div>
            </CardHeader>
          </button>
          {expandedNeeded && (
            <CardContent className="pt-0 space-y-2">
              {decisionQueue.map(item => (
                <div
                  key={item.category}
                  className={cn(
                    'flex items-center justify-between gap-3 p-3 rounded-lg border',
                    item.urgency === 'urgent' ? 'bg-red-50 border-red-200'
                      : item.urgency === 'high' ? 'bg-orange-50 border-orange-200'
                      : 'bg-white border-gray-200',
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{item.category}</p>
                      <Badge variant={item.urgency === 'urgent' ? 'destructive' : item.urgency === 'high' ? 'warning' : 'secondary'} className="text-xs">
                        {item.urgency}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.bids.length} bid{item.bids.length !== 1 ? 's' : ''}
                      {item.bids.length > 0 && ` · ${item.bids.map(b => b.vendorName).join(', ')}`}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="shrink-0" onClick={() => prefillFromQueue(item)}>
                    <Gavel className="h-3 w-3 mr-1" />Decide
                  </Button>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      {/* ── Decisions Made ── */}
      <Card>
        <button onClick={() => setExpandedMade(!expandedMade)} className="w-full text-left">
          <CardHeader className="cursor-pointer hover:bg-accent/30 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {expandedMade ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Decisions Made
                </CardTitle>
                <Badge variant="secondary">{madeCount}</Badge>
              </div>
            </div>
          </CardHeader>
        </button>
        {expandedMade && (
          <CardContent className="pt-0">
            {decisions.length > 0 ? (
              <div className="space-y-2">
                {decisions.map(d => (
                  <div key={d.id} className="flex items-start gap-3 p-3 rounded-lg border bg-white">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{d.title}</p>
                        <Badge variant="outline" className="text-xs">{TYPE_LABELS[d.decision_type] || d.decision_type}</Badge>
                        <Badge className={cn('text-xs', OUTCOME_COLORS[d.outcome_status])}>{d.outcome_status}</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{formatDate(d.decided_date)}</span>
                        {d.chosen_option && <span>Chose: <span className="font-medium text-foreground">{d.chosen_option}</span></span>}
                        {d.cost_impact != null && d.cost_impact !== 0 && (
                          <span className="flex items-center gap-0.5">
                            <DollarSign className="h-3 w-3" />
                            {fmt(d.cost_impact)}
                          </span>
                        )}
                      </div>
                      {d.reasoning && <p className="text-xs text-muted-foreground mt-1 italic">{d.reasoning}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Gavel className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No decisions recorded yet.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Click &quot;Record Decision&quot; to start tracking.</p>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* ── Locked In (already decided) ── */}
      {lockedIn.length > 0 && (
        <Card className="border-green-200/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Vendor Selections Locked In
              <Badge variant="secondary">{lockedIn.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {lockedIn.map(item => (
                <div key={item.category} className="flex items-center gap-2 p-2 rounded border text-sm">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  <span className="font-medium">{item.category}</span>
                  {item.selectedBid && (
                    <span className="text-muted-foreground ml-auto truncate max-w-[120px]">{item.selectedBid.vendorName}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Future Trades ── */}
      {futureTrades.length > 0 && (
        <Card>
          <button onClick={() => setExpandedFuture(!expandedFuture)} className="w-full text-left">
            <CardHeader className="cursor-pointer hover:bg-accent/30 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {expandedFuture ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <CardTitle className="text-base">Future Trades</CardTitle>
                  <Badge variant="outline">{futureTrades.length}</Badge>
                </div>
              </div>
            </CardHeader>
          </button>
          {expandedFuture && (
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {futureTrades.map(item => (
                  <div key={item.category} className="p-2 rounded border text-sm text-muted-foreground">
                    {item.category}
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* ── Record Decision Dialog ── */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gavel className="h-5 w-5" />Record Decision
            </DialogTitle>
            <DialogDescription>Record a decision and cascade updates to tasks and bids.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vendor_selection">Vendor Selection</SelectItem>
                    <SelectItem value="material_choice">Material Choice</SelectItem>
                    <SelectItem value="design_change">Design Change</SelectItem>
                    <SelectItem value="budget_adjustment">Budget Adjustment</SelectItem>
                    <SelectItem value="schedule_change">Schedule Change</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Input value={formCategory} onChange={e => setFormCategory(e.target.value)} placeholder="e.g., Foundation, HVAC" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Decision Title</Label>
              <Input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Selected Acme for Foundation" />
            </div>

            <div className="space-y-2">
              <Label>Chosen Option</Label>
              <Input value={formChosen} onChange={e => setFormChosen(e.target.value)} placeholder="Vendor name, material, option..." />
            </div>

            <div className="space-y-2">
              <Label>Reasoning (optional)</Label>
              <Textarea value={formReasoning} onChange={e => setFormReasoning(e.target.value)} placeholder="Why this choice?" rows={3} />
            </div>

            <div className="space-y-2">
              <Label>Cost Impact (optional)</Label>
              <Input type="number" value={formCostImpact} onChange={e => setFormCostImpact(e.target.value)} placeholder="85000" />
            </div>

            {/* Related tasks to close */}
            {(() => {
              const related = formCategory ? getRelatedTasks(formCategory) : openTasks.slice(0, 5)
              if (related.length === 0) return null
              return (
                <div className="space-y-2">
                  <Label>Close Related Tasks</Label>
                  <div className="border rounded-md max-h-32 overflow-y-auto divide-y">
                    {related.map(task => (
                      <button
                        key={task.id}
                        type="button"
                        className={cn(
                          'w-full text-left px-3 py-2 text-sm hover:bg-accent/50 transition-colors flex items-center gap-2',
                          formCloseTasks.includes(task.id) && 'bg-green-50',
                        )}
                        onClick={() => toggleTaskSelection(task.id)}
                      >
                        <div className={cn(
                          'h-4 w-4 rounded border shrink-0 flex items-center justify-center',
                          formCloseTasks.includes(task.id) ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300',
                        )}>
                          {formCloseTasks.includes(task.id) && <CheckCircle2 className="h-3 w-3" />}
                        </div>
                        <span className="truncate">{task.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Gavel className="h-3 w-3 mr-1" />}
              Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
