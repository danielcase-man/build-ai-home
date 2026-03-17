'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import {
  DollarSign,
  Package,
  ChevronDown,
  ExternalLink,
  Droplets,
  Lightbulb,
  Wrench,
  CheckCircle2,
  Clock,
  ShoppingCart,
  Filter,
  Plus,
  Layers,
  Grid3X3,
  PanelTop,
  AlertTriangle,
} from 'lucide-react'
import type { Selection, SelectionStatus } from '@/types'

const STATUS_OPTIONS: SelectionStatus[] = ['considering', 'selected', 'ordered', 'received', 'installed', 'alternative']

const STATUS_VARIANT: Record<SelectionStatus, 'default' | 'secondary' | 'warning' | 'success' | 'destructive' | 'outline'> = {
  considering: 'secondary',
  selected: 'default',
  ordered: 'warning',
  received: 'success',
  installed: 'success',
  alternative: 'outline',
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof Droplets; description: string }> = {
  plumbing: { label: 'Plumbing', icon: Droplets, description: 'Faucets, fixtures, sinks, toilets, and water systems' },
  lighting: { label: 'Lighting', icon: Lightbulb, description: 'Chandeliers, sconces, vanity lights, and recessed fixtures' },
  hardware: { label: 'Hardware', icon: Wrench, description: 'Door hardware, cabinet pulls, and accessories' },
  appliance: { label: 'Appliances', icon: Package, description: 'Kitchen and laundry appliances' },
  tile: { label: 'Tile', icon: Grid3X3, description: 'Floor and wall tile selections' },
  paint: { label: 'Paint', icon: Package, description: 'Interior and exterior paint colors' },
  countertop: { label: 'Countertops', icon: Layers, description: 'Kitchen and bath countertop surfaces' },
  flooring: { label: 'Flooring', icon: Grid3X3, description: 'Hardwood, LVP, carpet, and specialty flooring' },
  cabinetry: { label: 'Cabinetry', icon: PanelTop, description: 'Kitchen, bath, and built-in cabinetry' },
  windows: { label: 'Windows', icon: PanelTop, description: 'Windows, doors, and exterior openings' },
}

const ALL_CATEGORIES = Object.keys(CATEGORY_CONFIG)

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

function formatCurrency(amount: number | undefined | null): string {
  if (amount == null) return '--'
  return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const EMPTY_FORM = {
  room: '',
  category: 'plumbing',
  product_name: '',
  brand: '',
  model_number: '',
  finish: '',
  color: '',
  quantity: '1',
  unit_price: '',
  lead_time: '',
  product_url: '',
  notes: '',
}

interface SelectionsClientProps {
  initialSelections: Selection[]
  leadTimeAlerts?: WorkflowAlert[]
}

export default function SelectionsClient({ initialSelections, leadTimeAlerts = [] }: SelectionsClientProps) {
  const [selections, setSelections] = useState<Selection[]>(initialSelections)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [createSaving, setCreateSaving] = useState(false)
  const [createForm, setCreateForm] = useState({ ...EMPTY_FORM })

  function updateCreateField(field: string, value: string) {
    setCreateForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleCreate() {
    if (!createForm.room.trim() || !createForm.product_name.trim()) return
    setCreateSaving(true)
    try {
      const quantity = parseInt(createForm.quantity) || 1
      const unitPrice = parseFloat(createForm.unit_price) || undefined
      const payload = {
        room: createForm.room.trim(),
        category: createForm.category,
        product_name: createForm.product_name.trim(),
        brand: createForm.brand.trim() || undefined,
        model_number: createForm.model_number.trim() || undefined,
        finish: createForm.finish.trim() || undefined,
        color: createForm.color.trim() || undefined,
        quantity,
        unit_price: unitPrice,
        total_price: unitPrice ? unitPrice * quantity : undefined,
        lead_time: createForm.lead_time.trim() || undefined,
        product_url: createForm.product_url.trim() || undefined,
        notes: createForm.notes.trim() || undefined,
        status: 'considering' as SelectionStatus,
      }
      const res = await fetch('/api/selections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const { data } = await res.json()
        setSelections(prev => [...prev, data])
        setCreateForm({ ...EMPTY_FORM })
        setCreateOpen(false)
      }
    } catch (error) {
      console.error('Failed to create selection:', error)
    } finally {
      setCreateSaving(false)
    }
  }

  const urgentAlerts = leadTimeAlerts.filter(a =>
    a.type === 'lead_time_warning' && (a.priority === 'urgent' || a.priority === 'high')
  )

  const categories = useMemo(() => {
    const cats = Array.from(new Set(selections.map(s => s.category)))
    return cats.sort()
  }, [selections])

  const summary = useMemo(() => {
    const total = selections.length
    const selected = selections.filter(s => s.status === 'selected').length
    const considering = selections.filter(s => s.status === 'considering').length
    const ordered = selections.filter(s => ['ordered', 'received', 'installed'].includes(s.status)).length
    const selectedCost = selections
      .filter(s => s.status === 'selected')
      .reduce((sum, s) => sum + (s.total_price || 0), 0)
    const totalCost = selections
      .filter(s => s.status !== 'alternative')
      .reduce((sum, s) => sum + (s.total_price || 0), 0)
    return { total, selected, considering, ordered, selectedCost, totalCost }
  }, [selections])

  function filterSelections(items: Selection[]): Selection[] {
    if (statusFilter === 'all') return items
    return items.filter(s => s.status === statusFilter)
  }

  function groupByRoom(items: Selection[]): Record<string, Selection[]> {
    const groups: Record<string, Selection[]> = {}
    for (const item of items) {
      if (!groups[item.room]) groups[item.room] = []
      groups[item.room].push(item)
    }
    return groups
  }

  async function handleStatusChange(id: string, newStatus: SelectionStatus) {
    setUpdatingId(id)
    try {
      const res = await fetch('/api/selections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      })
      if (res.ok) {
        const { data } = await res.json()
        setSelections(prev => prev.map(s => s.id === id ? data : s))
      }
    } catch (error) {
      console.error('Failed to update status:', error)
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Selections & Materials
            </h1>
            <p className="text-muted-foreground text-lg">
              Track product selections, finishes, and fixtures for every room
            </p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-1.5 shrink-0">
                <Plus className="h-4 w-4" />
                Add Selection
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Selection</DialogTitle>
                <DialogDescription>
                  Add a new product selection to track for your build.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-2">
                {/* Room & Category */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="create-room">Room *</Label>
                    <Input
                      id="create-room"
                      value={createForm.room}
                      onChange={e => updateCreateField('room', e.target.value)}
                      placeholder="e.g., Primary Kitchen"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-category">Category *</Label>
                    <Select value={createForm.category} onValueChange={v => updateCreateField('category', v)}>
                      <SelectTrigger id="create-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_CATEGORIES.map(cat => (
                          <SelectItem key={cat} value={cat}>
                            {CATEGORY_CONFIG[cat]?.label || cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Product Name & Brand */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="create-product-name">Product Name *</Label>
                    <Input
                      id="create-product-name"
                      value={createForm.product_name}
                      onChange={e => updateCreateField('product_name', e.target.value)}
                      placeholder="e.g., Brizo Litze Pull-Down Faucet"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-brand">Brand</Label>
                    <Input
                      id="create-brand"
                      value={createForm.brand}
                      onChange={e => updateCreateField('brand', e.target.value)}
                      placeholder="e.g., Brizo"
                    />
                  </div>
                </div>

                {/* Model Number & Finish */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="create-model">Model Number</Label>
                    <Input
                      id="create-model"
                      value={createForm.model_number}
                      onChange={e => updateCreateField('model_number', e.target.value)}
                      placeholder="e.g., 63054LF-GL"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-finish">Finish</Label>
                    <Input
                      id="create-finish"
                      value={createForm.finish}
                      onChange={e => updateCreateField('finish', e.target.value)}
                      placeholder="e.g., Luxe Gold"
                    />
                  </div>
                </div>

                {/* Color & Quantity */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="create-color">Color</Label>
                    <Input
                      id="create-color"
                      value={createForm.color}
                      onChange={e => updateCreateField('color', e.target.value)}
                      placeholder="e.g., Matte Black"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-quantity">Quantity</Label>
                    <Input
                      id="create-quantity"
                      type="number"
                      min="1"
                      value={createForm.quantity}
                      onChange={e => updateCreateField('quantity', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-unit-price">Unit Price ($)</Label>
                    <Input
                      id="create-unit-price"
                      type="number"
                      step="0.01"
                      value={createForm.unit_price}
                      onChange={e => updateCreateField('unit_price', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <Separator />

                {/* Lead Time & Product URL */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="create-lead-time">Lead Time</Label>
                    <Input
                      id="create-lead-time"
                      value={createForm.lead_time}
                      onChange={e => updateCreateField('lead_time', e.target.value)}
                      placeholder="e.g., 6-8 weeks"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-product-url">Product URL</Label>
                    <Input
                      id="create-product-url"
                      type="url"
                      value={createForm.product_url}
                      onChange={e => updateCreateField('product_url', e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="create-notes">Notes</Label>
                  <Textarea
                    id="create-notes"
                    value={createForm.notes}
                    onChange={e => updateCreateField('notes', e.target.value)}
                    rows={3}
                    placeholder="Any additional details, alternates being considered, etc."
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createSaving}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={createSaving || !createForm.room.trim() || !createForm.product_name.trim()}
                >
                  {createSaving ? 'Saving...' : 'Add Selection'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Lead Time Warnings */}
        {urgentAlerts.length > 0 && (
          <div className="mb-6 space-y-3">
            {urgentAlerts.map((alert, i) => (
              <Alert key={alert.selection_id || i} variant="warning">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{alert.title}</AlertTitle>
                <AlertDescription>
                  {alert.message}
                  {alert.order_by_date && (
                    <span className="block mt-1 text-xs font-medium">
                      Order by: {new Date(alert.order_by_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="animate-fade-in" style={{ animationDelay: '0ms' }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Items</p>
                  <p className="text-2xl font-bold">{summary.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="animate-fade-in" style={{ animationDelay: '75ms' }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Confirmed</p>
                  <p className="text-2xl font-bold">{summary.selected}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="animate-fade-in" style={{ animationDelay: '150ms' }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary/10">
                  <Clock className="h-5 w-5 text-secondary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Still Deciding</p>
                  <p className="text-2xl font-bold">{summary.considering}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="animate-fade-in" style={{ animationDelay: '225ms' }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-construction-green/10">
                  <DollarSign className="h-5 w-5 text-construction-green" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Selected Cost</p>
                  <p className="text-xl font-bold">{formatCurrency(summary.selectedCost)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Bar */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filter</span>
              </div>
              <div className="w-48">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {STATUS_OPTIONS.map(s => (
                      <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Badge variant="secondary" className="text-sm ml-auto">
                {statusFilter === 'all'
                  ? `${selections.length} total`
                  : `${selections.filter(s => s.status === statusFilter).length} of ${selections.length}`
                }
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Category Tabs */}
        <Tabs defaultValue={categories[0] || 'plumbing'} className="space-y-6">
          <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${categories.length}, 1fr)` }}>
            {categories.map(cat => {
              const config = CATEGORY_CONFIG[cat]
              const Icon = config?.icon || Package
              return (
                <TabsTrigger key={cat} value={cat} className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {config?.label || cat}
                </TabsTrigger>
              )
            })}
          </TabsList>

          {categories.map(cat => {
            const config = CATEGORY_CONFIG[cat]
            const catSelections = filterSelections(selections.filter(s => s.category === cat))
            const roomGroups = groupByRoom(catSelections)
            const roomNames = Object.keys(roomGroups).sort()
            const catSelectedCost = catSelections
              .filter(s => s.status === 'selected')
              .reduce((sum, s) => sum + (s.total_price || 0), 0)
            const catTotalCost = catSelections
              .filter(s => s.status !== 'alternative')
              .reduce((sum, s) => sum + (s.total_price || 0), 0)

            return (
              <TabsContent key={cat} value={cat} className="space-y-6">
                {/* Category Header */}
                <Card className="border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          {config && <config.icon className="h-5 w-5 text-primary" />}
                        </div>
                        <div>
                          <p className="font-semibold">{config?.label || cat}</p>
                          <p className="text-sm text-muted-foreground">{config?.description}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-4 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">Selected</p>
                            <p className="font-semibold">{formatCurrency(catSelectedCost)}</p>
                          </div>
                          <Separator orientation="vertical" className="h-8" />
                          <div>
                            <p className="text-xs text-muted-foreground">Total (incl. TBD)</p>
                            <p className="font-semibold">{formatCurrency(catTotalCost)}</p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="mt-1">
                          {catSelections.length} item{catSelections.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Empty State */}
                {roomNames.length === 0 && (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No selections found</h3>
                      <p className="text-muted-foreground text-center">
                        {statusFilter !== 'all'
                          ? `No ${config?.label?.toLowerCase() || cat} items with status "${statusFilter}".`
                          : `No ${config?.label?.toLowerCase() || cat} selections have been added yet.`
                        }
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Rooms */}
                {roomNames.map(room => (
                  <Card key={room} className="border-border">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-xl">{room}</CardTitle>
                          <Badge variant="secondary">
                            {roomGroups[room].length} item{roomGroups[room].length !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                        <span className="text-sm font-medium text-muted-foreground">
                          {formatCurrency(roomGroups[room].filter(s => s.status !== 'alternative').reduce((sum, s) => sum + (s.total_price || 0), 0))}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3">
                        {roomGroups[room].map(sel => (
                          <SelectionItem
                            key={sel.id}
                            selection={sel}
                            updating={updatingId === sel.id}
                            onStatusChange={handleStatusChange}
                          />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            )
          })}
        </Tabs>
      </div>
    </div>
  )
}

// --- Individual Selection Item (Card-based, Lovable style) ---

function SelectionItem({
  selection: sel,
  updating,
  onStatusChange,
}: {
  selection: Selection
  updating: boolean
  onStatusChange: (id: string, status: SelectionStatus) => void
}) {
  const hasDetails = sel.notes || sel.lead_time || sel.product_url || sel.collection || sel.material || sel.price_source

  const itemContent = (
    <Card className="border-l-4 border-l-primary">
      <CardContent className="p-4">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          {/* Left: Product Info */}
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-base">{sel.product_name}</h4>
              <Badge variant={STATUS_VARIANT[sel.status]}>
                {sel.status}
              </Badge>
            </div>

            {(sel.brand || sel.collection) && (
              <p className="text-sm text-muted-foreground">
                {[sel.brand, sel.collection].filter(Boolean).join(' - ')}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {sel.location_detail && (
                <span>{sel.location_detail}</span>
              )}
              {sel.finish && (
                <span>{sel.finish}</span>
              )}
              {sel.model_number && (
                <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{sel.model_number}</span>
              )}
              {sel.quantity > 1 && (
                <span>Qty: {sel.quantity}</span>
              )}
            </div>
          </div>

          {/* Right: Price + Status */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex items-center gap-1 text-sm font-semibold">
              <DollarSign className="h-4 w-4" />
              <span>{formatCurrency(sel.total_price)}</span>
            </div>
            {sel.quantity > 1 && sel.unit_price && (
              <span className="text-xs text-muted-foreground">
                {formatCurrency(sel.unit_price)} each
              </span>
            )}
            <Select
              value={sel.status}
              onValueChange={(v) => onStatusChange(sel.id, v as SelectionStatus)}
              disabled={updating}
            >
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(s => (
                  <SelectItem key={s} value={s} className="text-xs capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Expandable Details */}
        {hasDetails && (
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-1 mt-3 pt-3 border-t text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ChevronDown className="h-3.5 w-3.5" />
              Details
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 grid gap-1.5 text-sm text-muted-foreground">
                {sel.material && (
                  <p><span className="font-medium text-foreground">Material:</span> {sel.material}</p>
                )}
                {sel.lead_time && (
                  <p><span className="font-medium text-foreground">Lead Time:</span> {sel.lead_time}</p>
                )}
                {sel.price_source && (
                  <p><span className="font-medium text-foreground">Source:</span> {sel.price_source}</p>
                )}
                {sel.notes && (
                  <p><span className="font-medium text-foreground">Notes:</span> {sel.notes}</p>
                )}
                {sel.product_url && (
                  <a
                    href={sel.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline w-fit"
                  >
                    View Product <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  )

  return itemContent
}
