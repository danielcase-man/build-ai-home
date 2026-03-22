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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Plus,
  Clock,
  Calendar,
  Building2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Wrench,
  Package,
  Factory,
  Landmark,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WarrantyStatus = 'active' | 'expiring_soon' | 'expired' | 'claimed'

interface Warranty {
  id?: string
  project_id: string
  vendor_id: string | null
  vendor_name: string | null
  category: string
  item_description: string
  warranty_type: 'workmanship' | 'materials' | 'manufacturer' | 'structural'
  start_date: string
  end_date: string
  duration_months: number
  coverage_details: string | null
  status: WarrantyStatus
  created_at?: string
  updated_at?: string
}

interface SubcontractorCompliance {
  id?: string
  project_id: string
  vendor_id: string | null
  vendor_name: string | null
  insurance_type: 'GL' | 'WC' | 'auto' | 'umbrella' | 'professional'
  policy_number: string | null
  carrier: string | null
  coverage_amount: number | null
  effective_date: string
  expiration_date: string
  verified: boolean
  created_at?: string
  updated_at?: string
}

interface WarrantiesClientProps {
  warranties: Warranty[]
  compliance: SubcontractorCompliance[]
  complianceGaps: {
    expired: SubcontractorCompliance[]
    expiring_soon: SubcontractorCompliance[]
    unverified: SubcontractorCompliance[]
  }
  projectId: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// ---------------------------------------------------------------------------
// Config Maps
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<WarrantyStatus, { label: string; color: string; dot: string }> = {
  active: {
    label: 'Active',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100',
    dot: 'bg-emerald-500',
  },
  expiring_soon: {
    label: 'Expiring Soon',
    color: 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100',
    dot: 'bg-amber-500',
  },
  expired: {
    label: 'Expired',
    color: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100',
    dot: 'bg-red-500',
  },
  claimed: {
    label: 'Claimed',
    color: 'bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-100',
    dot: 'bg-purple-500',
  },
}

const WARRANTY_TYPE_CONFIG: Record<Warranty['warranty_type'], { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  workmanship: {
    label: 'Workmanship',
    color: 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100',
    icon: Wrench,
  },
  materials: {
    label: 'Materials',
    color: 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100',
    icon: Package,
  },
  manufacturer: {
    label: 'Manufacturer',
    color: 'bg-violet-100 text-violet-800 border-violet-200 hover:bg-violet-100',
    icon: Factory,
  },
  structural: {
    label: 'Structural',
    color: 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100',
    icon: Landmark,
  },
}

const INSURANCE_TYPE_CONFIG: Record<SubcontractorCompliance['insurance_type'], { label: string; fullLabel: string; color: string }> = {
  GL: {
    label: 'GL',
    fullLabel: 'General Liability',
    color: 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100',
  },
  WC: {
    label: 'WC',
    fullLabel: "Workers' Comp",
    color: 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100',
  },
  auto: {
    label: 'Auto',
    fullLabel: 'Auto Insurance',
    color: 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100',
  },
  umbrella: {
    label: 'Umbrella',
    fullLabel: 'Umbrella Policy',
    color: 'bg-violet-100 text-violet-800 border-violet-200 hover:bg-violet-100',
  },
  professional: {
    label: 'Professional',
    fullLabel: 'Professional Liability',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100',
  },
}

// ---------------------------------------------------------------------------
// Badge Subcomponents
// ---------------------------------------------------------------------------

function WarrantyStatusBadge({ status }: { status: WarrantyStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <Badge className={cfg.color}>
      {cfg.label}
    </Badge>
  )
}

function WarrantyTypeBadge({ type }: { type: Warranty['warranty_type'] }) {
  const cfg = WARRANTY_TYPE_CONFIG[type]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
      <cfg.icon className="h-3 w-3" />
      {cfg.label}
    </span>
  )
}

function InsuranceTypeBadge({ type }: { type: SubcontractorCompliance['insurance_type'] }) {
  const cfg = INSURANCE_TYPE_CONFIG[type]
  return (
    <Badge className={cfg.color}>
      {cfg.label}
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// Warranty Card
// ---------------------------------------------------------------------------

function WarrantyCard({ warranty }: { warranty: Warranty }) {
  const daysUntilExpiry = Math.ceil(
    (new Date(warranty.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )

  return (
    <div className={`rounded-lg border p-4 transition-colors ${
      warranty.status === 'expired'
        ? 'opacity-60 bg-gray-50'
        : warranty.status === 'expiring_soon'
          ? 'bg-amber-50/30 border-amber-200 hover:border-amber-300'
          : 'bg-white hover:border-gray-300'
    }`}>
      {/* Row 1: Category, description, badges */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wide">
              {warranty.category}
            </span>
            <WarrantyTypeBadge type={warranty.warranty_type} />
            <WarrantyStatusBadge status={warranty.status} />
          </div>
          <p className="font-medium text-sm mt-1.5">{warranty.item_description}</p>
        </div>
        {/* Duration callout */}
        <div className="text-right shrink-0">
          <span className="text-sm font-semibold tabular-nums">{warranty.duration_months}mo</span>
          {warranty.status === 'active' && daysUntilExpiry > 0 && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {daysUntilExpiry}d remaining
            </p>
          )}
          {warranty.status === 'expiring_soon' && daysUntilExpiry > 0 && (
            <p className="text-[11px] text-amber-600 font-medium mt-0.5">
              {daysUntilExpiry}d left
            </p>
          )}
        </div>
      </div>

      {/* Row 2: Vendor + date range */}
      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
        {warranty.vendor_name && (
          <span className="flex items-center gap-1">
            <Building2 className="h-3 w-3" />
            {warranty.vendor_name}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {formatDate(warranty.start_date)} &rarr; {formatDate(warranty.end_date)}
        </span>
      </div>

      {/* Row 3: Coverage details */}
      {warranty.coverage_details && (
        <p className="mt-2 text-xs text-muted-foreground border-l-2 border-gray-200 pl-2 line-clamp-2">
          {warranty.coverage_details}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Compliance Card
// ---------------------------------------------------------------------------

function ComplianceCard({
  item,
  onVerify,
  verifying,
}: {
  item: SubcontractorCompliance
  onVerify: (id: string) => void
  verifying: boolean
}) {
  const isExpired = new Date(item.expiration_date) < new Date()
  const daysUntilExpiry = Math.ceil(
    (new Date(item.expiration_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )
  const isExpiringSoon = !isExpired && daysUntilExpiry <= 30

  return (
    <div className={`rounded-lg border p-4 transition-colors ${
      isExpired
        ? 'opacity-60 bg-red-50/30 border-red-200'
        : isExpiringSoon
          ? 'bg-amber-50/30 border-amber-200 hover:border-amber-300'
          : 'bg-white hover:border-gray-300'
    }`}>
      {/* Row 1: Vendor, insurance type, verified status */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {item.vendor_name && (
              <span className="font-medium text-sm">{item.vendor_name}</span>
            )}
            <InsuranceTypeBadge type={item.insurance_type} />
            {item.verified ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="h-3 w-3" />
                Verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-xs font-medium text-gray-500">
                <Clock className="h-3 w-3" />
                Unverified
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {INSURANCE_TYPE_CONFIG[item.insurance_type].fullLabel}
          </p>
        </div>
        {/* Verify button for unverified items */}
        {!item.verified && item.id && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50 shrink-0"
            disabled={verifying}
            onClick={() => onVerify(item.id!)}
          >
            <ShieldCheck className="h-3 w-3" />
            {verifying ? 'Verifying...' : 'Verify'}
          </Button>
        )}
      </div>

      {/* Row 2: Policy details */}
      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        {item.carrier && (
          <span className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            {item.carrier}
          </span>
        )}
        {item.policy_number && (
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {item.policy_number}
          </span>
        )}
        {item.coverage_amount != null && (
          <span className="font-medium text-foreground">
            {formatCurrency(item.coverage_amount)}
          </span>
        )}
      </div>

      {/* Row 3: Date range + expiry warning */}
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {formatDate(item.effective_date)} &rarr; {formatDate(item.expiration_date)}
        </span>
        {isExpired && (
          <span className="text-red-600 font-medium flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Expired
          </span>
        )}
        {isExpiringSoon && (
          <span className="text-amber-600 font-medium flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {daysUntilExpiry}d until expiry
          </span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Add Warranty Dialog
// ---------------------------------------------------------------------------

const INITIAL_WARRANTY_FORM = {
  category: '',
  item_description: '',
  vendor_name: '',
  warranty_type: '' as Warranty['warranty_type'] | '',
  start_date: '',
  end_date: '',
  duration_months: '',
  coverage_details: '',
}

function AddWarrantyDialog({
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
  const [form, setForm] = useState(INITIAL_WARRANTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateField<K extends keyof typeof INITIAL_WARRANTY_FORM>(key: K, value: typeof INITIAL_WARRANTY_FORM[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.category.trim() || !form.item_description.trim() || !form.warranty_type || !form.start_date || !form.end_date) {
      setError('Category, description, warranty type, start date, and end date are required.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/warranties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          category: form.category.trim(),
          item_description: form.item_description.trim(),
          vendor_name: form.vendor_name.trim() || null,
          warranty_type: form.warranty_type,
          start_date: form.start_date,
          end_date: form.end_date,
          duration_months: form.duration_months ? parseInt(form.duration_months, 10) : null,
          coverage_details: form.coverage_details.trim() || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Failed to create warranty')
      }

      setForm(INITIAL_WARRANTY_FORM)
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
          <DialogTitle>Add Warranty</DialogTitle>
          <DialogDescription>
            Record a warranty for a construction item, material, or system.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category + Warranty Type row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="w-category">Category <span className="text-red-500">*</span></Label>
              <Input
                id="w-category"
                placeholder="e.g. Roofing, HVAC, Appliances"
                value={form.category}
                onChange={e => updateField('category', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Warranty Type <span className="text-red-500">*</span></Label>
              <Select value={form.warranty_type} onValueChange={v => updateField('warranty_type', v as Warranty['warranty_type'])}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="workmanship">Workmanship</SelectItem>
                  <SelectItem value="materials">Materials</SelectItem>
                  <SelectItem value="manufacturer">Manufacturer</SelectItem>
                  <SelectItem value="structural">Structural</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Item Description */}
          <div className="space-y-1.5">
            <Label htmlFor="w-description">Item Description <span className="text-red-500">*</span></Label>
            <Input
              id="w-description"
              placeholder="e.g. Standing seam metal roof, Carrier HVAC system"
              value={form.item_description}
              onChange={e => updateField('item_description', e.target.value)}
            />
          </div>

          {/* Vendor Name */}
          <div className="space-y-1.5">
            <Label htmlFor="w-vendor">Vendor / Manufacturer</Label>
            <Input
              id="w-vendor"
              placeholder="e.g. ABC Roofing Co., Carrier"
              value={form.vendor_name}
              onChange={e => updateField('vendor_name', e.target.value)}
            />
          </div>

          {/* Start Date + End Date + Duration row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="w-start">Start Date <span className="text-red-500">*</span></Label>
              <Input
                id="w-start"
                type="date"
                value={form.start_date}
                onChange={e => updateField('start_date', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="w-end">End Date <span className="text-red-500">*</span></Label>
              <Input
                id="w-end"
                type="date"
                value={form.end_date}
                onChange={e => updateField('end_date', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="w-duration">Duration (months)</Label>
              <Input
                id="w-duration"
                type="number"
                min="1"
                placeholder="e.g. 12"
                value={form.duration_months}
                onChange={e => updateField('duration_months', e.target.value)}
              />
            </div>
          </div>

          {/* Coverage Details */}
          <div className="space-y-1.5">
            <Label htmlFor="w-coverage">Coverage Details</Label>
            <Textarea
              id="w-coverage"
              placeholder="What is covered and any exclusions or conditions..."
              rows={3}
              value={form.coverage_details}
              onChange={e => updateField('coverage_details', e.target.value)}
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
              {saving ? 'Creating...' : 'Add Warranty'}
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

export default function WarrantiesClient({
  warranties,
  compliance,
  complianceGaps,
  projectId,
}: WarrantiesClientProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [verifyingId, setVerifyingId] = useState<string | null>(null)

  // Warranty summary stats
  const warrantySummary = useMemo(() => {
    const total = warranties.length
    const active = warranties.filter(w => w.status === 'active').length
    const expiringSoon = warranties.filter(w => w.status === 'expiring_soon').length
    const expired = warranties.filter(w => w.status === 'expired').length
    return { total, active, expiringSoon, expired }
  }, [warranties])

  // Total compliance gap count
  const totalGaps = complianceGaps.expired.length + complianceGaps.expiring_soon.length + complianceGaps.unverified.length

  async function handleVerify(id: string) {
    setVerifyingId(id)
    try {
      const res = await fetch('/api/warranties', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'verify_compliance' }),
      })

      if (res.ok) {
        router.refresh()
      }
    } catch {
      // Silently fail -- UI remains in previous state
    } finally {
      setVerifyingId(null)
    }
  }

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Warranty Tracker</h1>
          <p className="text-muted-foreground">
            Track warranties, coverage periods, and subcontractor insurance compliance
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Add Warranty
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="warranties" className="space-y-6">
        <TabsList>
          <TabsTrigger value="warranties" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Warranties
          </TabsTrigger>
          <TabsTrigger value="compliance" className="gap-1.5 relative">
            <ShieldCheck className="h-3.5 w-3.5" />
            Subcontractor Compliance
            {totalGaps > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-[16px] rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                {totalGaps}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ============================================================= */}
        {/* WARRANTIES TAB                                                 */}
        {/* ============================================================= */}
        <TabsContent value="warranties" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Total Warranties
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{warrantySummary.total}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Active
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-emerald-600">{warrantySummary.active}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Expiring Soon
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${warrantySummary.expiringSoon > 0 ? 'text-amber-600' : ''}`}>
                  {warrantySummary.expiringSoon}
                </p>
                {warrantySummary.expiringSoon > 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">Requires attention</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4" />
                  Expired
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${warrantySummary.expired > 0 ? 'text-red-600' : ''}`}>
                  {warrantySummary.expired}
                </p>
                {warrantySummary.expired > 0 && (
                  <p className="text-[11px] text-red-600 mt-1">No longer covered</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Status Legend */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-muted-foreground font-medium">Status:</span>
            {(['active', 'expiring_soon', 'expired', 'claimed'] as WarrantyStatus[]).map(status => {
              const cfg = STATUS_CONFIG[status]
              const count = warranties.filter(w => w.status === status).length
              return (
                <div key={status} className="flex items-center gap-1">
                  <span className={`h-2.5 w-2.5 rounded-full ${cfg.dot}`} />
                  <span>{cfg.label}</span>
                  <span className="text-muted-foreground">({count})</span>
                </div>
              )
            })}
          </div>

          <Separator />

          {/* Warranty Cards */}
          {warranties.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Shield className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <h3 className="text-sm font-medium text-muted-foreground">No warranties recorded</h3>
                <p className="text-xs text-muted-foreground/70 mt-1 max-w-sm">
                  Track warranties for roofing, HVAC, appliances, structural work, and more.
                  Add them as work is completed and warranties are issued.
                </p>
                <Button size="sm" className="mt-4 gap-1.5" onClick={() => setDialogOpen(true)}>
                  <Plus className="h-3.5 w-3.5" />
                  Add First Warranty
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {warranties.map(warranty => (
                <WarrantyCard key={warranty.id ?? warranty.item_description} warranty={warranty} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ============================================================= */}
        {/* COMPLIANCE TAB                                                 */}
        {/* ============================================================= */}
        <TabsContent value="compliance" className="space-y-6">
          {/* Gap Alert Banner */}
          {totalGaps > 0 && (
            <Alert variant="destructive" className="border-red-200 bg-red-50 text-red-900 [&>svg]:text-red-600">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="font-semibold">Compliance Gaps Detected</AlertTitle>
              <AlertDescription>
                <div className="flex flex-wrap gap-4 mt-1.5 text-sm">
                  {complianceGaps.expired.length > 0 && (
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-red-500" />
                      <strong>{complianceGaps.expired.length}</strong> expired
                    </span>
                  )}
                  {complianceGaps.expiring_soon.length > 0 && (
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      <strong>{complianceGaps.expiring_soon.length}</strong> expiring soon
                    </span>
                  )}
                  {complianceGaps.unverified.length > 0 && (
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-gray-400" />
                      <strong>{complianceGaps.unverified.length}</strong> unverified
                    </span>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Compliance Cards */}
          {compliance.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <ShieldCheck className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <h3 className="text-sm font-medium text-muted-foreground">No compliance records</h3>
                <p className="text-xs text-muted-foreground/70 mt-1 max-w-sm">
                  Track subcontractor insurance certificates, policy numbers, coverage amounts,
                  and verification status to stay compliant throughout construction.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {compliance.map(item => (
                <ComplianceCard
                  key={item.id ?? `${item.vendor_name}-${item.insurance_type}`}
                  item={item}
                  onVerify={handleVerify}
                  verifying={verifyingId === item.id}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Warranty Dialog */}
      <AddWarrantyDialog
        projectId={projectId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => router.refresh()}
      />
    </div>
  )
}
