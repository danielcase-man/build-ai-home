'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
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
import {
  Landmark,
  ExternalLink,
  Phone,
  Mail,
  FileCheck,
  Clock,
  AlertCircle,
  CheckCircle2,
  Circle,
  ChevronRight,
  Pencil,
  User,
  Building2,
  CreditCard,
  CalendarDays,
  StickyNote,
  Shield,
} from 'lucide-react'
import type { ConstructionLoan } from '@/types'

interface FinancingClientProps {
  loan: ConstructionLoan | null
  projectId: string
}

// --- Application status pipeline ---

const STATUS_STEPS = [
  { key: 'not_started', label: 'Not Started' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'under_review', label: 'Under Review' },
  { key: 'conditionally_approved', label: 'Conditional' },
  { key: 'approved', label: 'Approved' },
  { key: 'funded', label: 'Funded' },
] as const

type ApplicationStatus = ConstructionLoan['application_status']

function getStatusIndex(status: ApplicationStatus): number {
  // rejected/withdrawn are terminal — render at the step where they happened
  if (status === 'rejected' || status === 'withdrawn') return -1
  return STATUS_STEPS.findIndex(s => s.key === status)
}

function getStatusBadgeVariant(status: ApplicationStatus): 'default' | 'secondary' | 'destructive' | 'warning' | 'success' | 'outline' {
  switch (status) {
    case 'not_started': return 'secondary'
    case 'in_progress': return 'outline'
    case 'submitted': return 'warning'
    case 'under_review': return 'warning'
    case 'conditionally_approved': return 'default'
    case 'approved': return 'success'
    case 'funded': return 'success'
    case 'rejected': return 'destructive'
    case 'withdrawn': return 'secondary'
    default: return 'secondary'
  }
}

function getStatusLabel(status: ApplicationStatus): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function getLoanTypeLabel(type: ConstructionLoan['loan_type']): string {
  switch (type) {
    case 'construction': return 'Construction Only'
    case 'construction_permanent': return 'Construction-to-Permanent'
    case '1x_close': return 'One-Time Close'
    case '2x_close': return 'Two-Time Close'
    case 'bridge': return 'Bridge Loan'
    case 'other': return 'Other'
    default: return type
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '--'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// --- Progress Stepper ---

function ApplicationProgress({ status }: { status: ApplicationStatus }) {
  const currentIndex = getStatusIndex(status)
  const isTerminal = status === 'rejected' || status === 'withdrawn'

  return (
    <div className="w-full">
      {/* Desktop: horizontal stepper */}
      <div className="hidden sm:flex items-center justify-between relative">
        {/* Connecting line (behind the dots) */}
        <div className="absolute top-4 left-4 right-4 h-0.5 bg-border" aria-hidden="true" />
        <div
          className="absolute top-4 left-4 h-0.5 bg-primary transition-all duration-500"
          style={{ width: currentIndex >= 0 ? `${(currentIndex / (STATUS_STEPS.length - 1)) * 100}%` : '0%' }}
          aria-hidden="true"
        />

        {STATUS_STEPS.map((step, i) => {
          const isCompleted = !isTerminal && currentIndex > i
          const isCurrent = !isTerminal && currentIndex === i
          const isFuture = isTerminal || currentIndex < i

          return (
            <div key={step.key} className="flex flex-col items-center relative z-10" style={{ width: `${100 / STATUS_STEPS.length}%` }}>
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors duration-300 ${
                  isCompleted
                    ? 'bg-primary border-primary text-primary-foreground'
                    : isCurrent
                      ? 'bg-background border-primary text-primary ring-4 ring-primary/20'
                      : 'bg-background border-muted-foreground/30 text-muted-foreground/50'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : isCurrent ? (
                  <Circle className="h-3 w-3 fill-primary" />
                ) : (
                  <Circle className={`h-3 w-3 ${isFuture ? 'text-muted-foreground/30' : ''}`} />
                )}
              </div>
              <span className={`text-xs mt-1.5 text-center leading-tight ${
                isCurrent ? 'font-semibold text-primary' : isCompleted ? 'text-foreground' : 'text-muted-foreground'
              }`}>
                {step.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Mobile: compact vertical list */}
      <div className="sm:hidden space-y-1">
        {STATUS_STEPS.map((step, i) => {
          const isCompleted = !isTerminal && currentIndex > i
          const isCurrent = !isTerminal && currentIndex === i

          return (
            <div key={step.key} className={`flex items-center gap-2 px-2 py-1 rounded ${isCurrent ? 'bg-primary/10' : ''}`}>
              {isCompleted ? (
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              ) : isCurrent ? (
                <ChevronRight className="h-4 w-4 text-primary shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground/30 shrink-0" />
              )}
              <span className={`text-sm ${isCurrent ? 'font-semibold text-primary' : isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                {step.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Terminal state warning */}
      {isTerminal && (
        <div className="mt-3 flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <span className="text-destructive font-medium">
            Application {status === 'rejected' ? 'Rejected' : 'Withdrawn'}
          </span>
        </div>
      )}
    </div>
  )
}

// --- Document Checklist ---

function DocumentChecklist({ details }: { details: Record<string, unknown> | undefined }) {
  const uploaded = (details?.documentsUploaded as string[]) || []
  const pending = (details?.pendingTasks as string[]) || []

  if (uploaded.length === 0 && pending.length === 0) {
    return (
      <div className="text-center py-6">
        <FileCheck className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No document information available</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {uploaded.map((doc, i) => (
        <div key={i} className="flex items-center gap-3">
          <CheckCircle2 className="h-4 w-4 text-construction-green shrink-0" />
          <span className="text-sm">{doc}</span>
        </div>
      ))}
      {pending.map((doc, i) => (
        <div key={`pending-${i}`} className="flex items-center gap-3">
          <Clock className="h-4 w-4 text-construction-orange shrink-0" />
          <span className="text-sm text-muted-foreground">{doc}</span>
          <Badge variant="warning" className="text-xs ml-auto">Pending</Badge>
        </div>
      ))}
    </div>
  )
}

// --- Contact Card ---

function ContactCard({
  icon: Icon,
  title,
  name,
  email,
  phone,
  nmls,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  name?: string | null
  email?: string | null
  phone?: string | null
  nmls?: string | null
}) {
  if (!name && !email && !phone) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="h-4 w-4 text-construction-blue" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {name && (
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium">{name}</span>
          </div>
        )}
        {email && (
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            <a
              href={`mailto:${email}`}
              className="text-sm text-primary hover:underline underline-offset-2 break-all"
            >
              {email}
            </a>
          </div>
        )}
        {phone && (
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
            <a
              href={`tel:${phone}`}
              className="text-sm text-primary hover:underline underline-offset-2"
            >
              {phone}
            </a>
          </div>
        )}
        {nmls && (
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground">NMLS #{nmls}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// --- Edit Dialog ---

function EditLoanDialog({
  loan,
  projectId,
  onSave,
}: {
  loan: ConstructionLoan | null
  projectId: string
  onSave: (updated: ConstructionLoan) => void
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state — seed from existing loan or empty defaults
  const [form, setForm] = useState({
    lender_name: loan?.lender_name || '',
    loan_type: loan?.loan_type || 'construction_permanent',
    loan_amount: loan?.loan_amount?.toString() || '',
    cost_of_construction: loan?.cost_of_construction?.toString() || '',
    lot_value: loan?.lot_value?.toString() || '',
    interest_rate: loan?.interest_rate?.toString() || '',
    loan_term_months: loan?.loan_term_months?.toString() || '',
    application_status: loan?.application_status || 'not_started',
    application_url: loan?.application_url || '',
    application_date: loan?.application_date || '',
    approval_date: loan?.approval_date || '',
    funding_date: loan?.funding_date || '',
    closing_date: loan?.closing_date || '',
    loan_officer_name: loan?.loan_officer_name || '',
    loan_officer_email: loan?.loan_officer_email || '',
    loan_officer_phone: loan?.loan_officer_phone || '',
    loan_contact_name: loan?.loan_contact_name || '',
    loan_contact_email: loan?.loan_contact_email || '',
    loan_contact_phone: loan?.loan_contact_phone || '',
    loan_contact_nmls: loan?.loan_contact_nmls || '',
    notes: loan?.notes || '',
  })

  function updateField(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit() {
    setSaving(true)
    try {
      const payload: Partial<ConstructionLoan> = {
        ...loan, // preserve existing fields like loan_details
        lender_name: form.lender_name,
        loan_type: form.loan_type as ConstructionLoan['loan_type'],
        loan_amount: parseFloat(form.loan_amount) || 0,
        cost_of_construction: parseFloat(form.cost_of_construction) || undefined,
        lot_value: parseFloat(form.lot_value) || undefined,
        interest_rate: parseFloat(form.interest_rate) || undefined,
        loan_term_months: parseInt(form.loan_term_months) || undefined,
        application_status: form.application_status as ApplicationStatus,
        application_url: form.application_url || undefined,
        application_date: form.application_date || undefined,
        approval_date: form.approval_date || undefined,
        funding_date: form.funding_date || undefined,
        closing_date: form.closing_date || undefined,
        loan_officer_name: form.loan_officer_name || undefined,
        loan_officer_email: form.loan_officer_email || undefined,
        loan_officer_phone: form.loan_officer_phone || undefined,
        loan_contact_name: form.loan_contact_name || undefined,
        loan_contact_email: form.loan_contact_email || undefined,
        loan_contact_phone: form.loan_contact_phone || undefined,
        loan_contact_nmls: form.loan_contact_nmls || undefined,
        notes: form.notes || undefined,
        project_id: projectId,
      }

      const res = await fetch('/api/financing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await res.json()
      if (result.success && result.data?.loan) {
        onSave(result.data.loan)
        setOpen(false)
      }
    } catch {
      // Silently handle — form stays open for retry
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Pencil className="h-3.5 w-3.5" />
          Edit Details
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Loan Details</DialogTitle>
          <DialogDescription>
            Update your construction loan application information.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Lender & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lender_name">Lender Name</Label>
              <Input id="lender_name" value={form.lender_name} onChange={e => updateField('lender_name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="application_status">Application Status</Label>
              <Select value={form.application_status} onValueChange={v => updateField('application_status', v)}>
                <SelectTrigger id="application_status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_started">Not Started</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="conditionally_approved">Conditionally Approved</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="funded">Funded</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="withdrawn">Withdrawn</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Loan Type & Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="loan_type">Loan Type</Label>
              <Select value={form.loan_type} onValueChange={v => updateField('loan_type', v)}>
                <SelectTrigger id="loan_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="construction">Construction Only</SelectItem>
                  <SelectItem value="construction_permanent">Construction-to-Permanent</SelectItem>
                  <SelectItem value="1x_close">One-Time Close</SelectItem>
                  <SelectItem value="2x_close">Two-Time Close</SelectItem>
                  <SelectItem value="bridge">Bridge Loan</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="loan_amount">Loan Amount ($)</Label>
              <Input id="loan_amount" type="number" value={form.loan_amount} onChange={e => updateField('loan_amount', e.target.value)} placeholder="450000" />
            </div>
          </div>

          {/* Financial details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cost_of_construction">Cost of Construction ($)</Label>
              <Input id="cost_of_construction" type="number" value={form.cost_of_construction} onChange={e => updateField('cost_of_construction', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lot_value">Lot Value ($)</Label>
              <Input id="lot_value" type="number" value={form.lot_value} onChange={e => updateField('lot_value', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="interest_rate">Interest Rate (%)</Label>
              <Input id="interest_rate" type="number" step="0.01" value={form.interest_rate} onChange={e => updateField('interest_rate', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="loan_term_months">Term (months)</Label>
              <Input id="loan_term_months" type="number" value={form.loan_term_months} onChange={e => updateField('loan_term_months', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="application_url">Application Portal URL</Label>
              <Input id="application_url" type="url" value={form.application_url} onChange={e => updateField('application_url', e.target.value)} />
            </div>
          </div>

          <Separator />

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="application_date">Application Date</Label>
              <Input id="application_date" type="date" value={form.application_date} onChange={e => updateField('application_date', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="approval_date">Approval Date</Label>
              <Input id="approval_date" type="date" value={form.approval_date} onChange={e => updateField('approval_date', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="funding_date">Funding Date</Label>
              <Input id="funding_date" type="date" value={form.funding_date} onChange={e => updateField('funding_date', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="closing_date">Closing Date</Label>
              <Input id="closing_date" type="date" value={form.closing_date} onChange={e => updateField('closing_date', e.target.value)} />
            </div>
          </div>

          <Separator />

          {/* Loan Officer */}
          <p className="text-sm font-medium text-muted-foreground">Loan Officer</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="loan_officer_name">Name</Label>
              <Input id="loan_officer_name" value={form.loan_officer_name} onChange={e => updateField('loan_officer_name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loan_officer_email">Email</Label>
              <Input id="loan_officer_email" type="email" value={form.loan_officer_email} onChange={e => updateField('loan_officer_email', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loan_officer_phone">Phone</Label>
              <Input id="loan_officer_phone" type="tel" value={form.loan_officer_phone} onChange={e => updateField('loan_officer_phone', e.target.value)} />
            </div>
          </div>

          {/* Loan Contact */}
          <p className="text-sm font-medium text-muted-foreground">Additional Contact</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="loan_contact_name">Name</Label>
              <Input id="loan_contact_name" value={form.loan_contact_name} onChange={e => updateField('loan_contact_name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loan_contact_email">Email</Label>
              <Input id="loan_contact_email" type="email" value={form.loan_contact_email} onChange={e => updateField('loan_contact_email', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loan_contact_phone">Phone</Label>
              <Input id="loan_contact_phone" type="tel" value={form.loan_contact_phone} onChange={e => updateField('loan_contact_phone', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loan_contact_nmls">NMLS #</Label>
              <Input id="loan_contact_nmls" value={form.loan_contact_nmls} onChange={e => updateField('loan_contact_nmls', e.target.value)} />
            </div>
          </div>

          <Separator />

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={form.notes} onChange={e => updateField('notes', e.target.value)} rows={4} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- Empty State ---

function EmptyLoanState({ projectId, onSave }: { projectId: string; onSave: (loan: ConstructionLoan) => void }) {
  return (
    <div className="container max-w-5xl py-8">
      <Card>
        <CardContent className="py-16">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Landmark className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">No Financing Set Up</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                Track your construction loan application progress, documents, and lender contacts all in one place.
              </p>
            </div>
            <EditLoanDialog loan={null} projectId={projectId} onSave={onSave} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// --- Main Component ---

export default function FinancingClient({ loan: initialLoan, projectId }: FinancingClientProps) {
  const [loan, setLoan] = useState<ConstructionLoan | null>(initialLoan)

  if (!loan) {
    return <EmptyLoanState projectId={projectId} onSave={setLoan} />
  }

  const details = loan.loan_details as Record<string, unknown> | undefined
  const loanNumber = details?.loanNumber as string | undefined
  const portalPlatform = details?.portalPlatform as string | undefined
  const borrowers = (details?.borrowers as string[]) || []
  const largeDepositExplanation = details?.largeDepositExplanation as string | undefined

  return (
    <div className="container max-w-5xl py-8 space-y-6">

      {/* Page Header with Status Banner */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Landmark className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Financing</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {loan.lender_name}
            {loanNumber && <span className="ml-1.5 font-mono text-xs">#{loanNumber}</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant={getStatusBadgeVariant(loan.application_status)}
            className="text-sm px-3 py-1"
          >
            {getStatusLabel(loan.application_status)}
          </Badge>
          <EditLoanDialog loan={loan} projectId={projectId} onSave={setLoan} />
        </div>
      </div>

      {/* Application Progress Stepper */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Application Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ApplicationProgress status={loan.application_status} />
        </CardContent>
      </Card>

      {/* Key Details + Portal Action */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Loan Details — spans 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              Loan Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Loan Type</p>
                <p className="text-sm font-medium mt-0.5">{getLoanTypeLabel(loan.loan_type)}</p>
              </div>
              {loan.loan_amount > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Loan Amount</p>
                  <p className="text-sm font-medium mt-0.5 font-mono tabular-nums">{formatCurrency(loan.loan_amount)}</p>
                </div>
              )}
              {loan.cost_of_construction && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Construction Cost</p>
                  <p className="text-sm font-medium mt-0.5 font-mono tabular-nums">{formatCurrency(loan.cost_of_construction)}</p>
                </div>
              )}
              {loan.lot_value && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Lot Value</p>
                  <p className="text-sm font-medium mt-0.5 font-mono tabular-nums">{formatCurrency(loan.lot_value)}</p>
                </div>
              )}
              {loan.interest_rate && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Interest Rate</p>
                  <p className="text-sm font-medium mt-0.5 font-mono tabular-nums">{loan.interest_rate}%</p>
                </div>
              )}
              {loan.loan_term_months && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Term</p>
                  <p className="text-sm font-medium mt-0.5">{loan.loan_term_months} months</p>
                </div>
              )}
              {loan.ltv_ratio && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">LTV Ratio</p>
                  <p className="text-sm font-medium mt-0.5 font-mono tabular-nums">{loan.ltv_ratio}%</p>
                </div>
              )}
              {borrowers.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Borrowers</p>
                  <p className="text-sm font-medium mt-0.5">{borrowers.join(', ')}</p>
                </div>
              )}
              {portalPlatform && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Portal Platform</p>
                  <p className="text-sm font-medium mt-0.5">{portalPlatform}</p>
                </div>
              )}
            </div>

            {/* Important dates row */}
            {(loan.application_date || loan.approval_date || loan.funding_date || loan.closing_date) && (
              <>
                <Separator className="my-4" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" /> Applied
                    </p>
                    <p className="text-sm font-medium mt-0.5">{formatDate(loan.application_date)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" /> Approved
                    </p>
                    <p className="text-sm font-medium mt-0.5">{formatDate(loan.approval_date)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" /> Funded
                    </p>
                    <p className="text-sm font-medium mt-0.5">{formatDate(loan.funding_date)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" /> Closing
                    </p>
                    <p className="text-sm font-medium mt-0.5">{formatDate(loan.closing_date)}</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions Card */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loan.application_url && (
              <Button variant="default" className="w-full justify-start gap-2" asChild>
                <a href={loan.application_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Open Loan Portal
                </a>
              </Button>
            )}
            {loan.loan_officer_email && (
              <Button variant="outline" className="w-full justify-start gap-2" asChild>
                <a href={`mailto:${loan.loan_officer_email}`}>
                  <Mail className="h-4 w-4" />
                  Email Loan Officer
                </a>
              </Button>
            )}
            {loan.loan_officer_phone && (
              <Button variant="outline" className="w-full justify-start gap-2" asChild>
                <a href={`tel:${loan.loan_officer_phone}`}>
                  <Phone className="h-4 w-4" />
                  Call {loan.loan_officer_name?.split(' ')[0] || 'Loan Officer'}
                </a>
              </Button>
            )}
            {loan.loan_contact_email && (
              <Button variant="outline" className="w-full justify-start gap-2" asChild>
                <a href={`mailto:${loan.loan_contact_email}`}>
                  <Mail className="h-4 w-4" />
                  Email {loan.loan_contact_name?.split(' ')[0] || 'Contact'}
                </a>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Contacts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ContactCard
          icon={Building2}
          title="Loan Officer"
          name={loan.loan_officer_name}
          email={loan.loan_officer_email}
          phone={loan.loan_officer_phone}
        />
        <ContactCard
          icon={User}
          title="Loan Contact"
          name={loan.loan_contact_name}
          email={loan.loan_contact_email}
          phone={loan.loan_contact_phone}
          nmls={loan.loan_contact_nmls}
        />
      </div>

      {/* Documents + Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Documents Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-muted-foreground" />
              Documents
              {details && (
                <span className="text-xs font-normal text-muted-foreground ml-auto">
                  {((details.documentsUploaded as string[]) || []).length} uploaded
                  {((details.pendingTasks as string[]) || []).length > 0 && (
                    <>, {((details.pendingTasks as string[]) || []).length} pending</>
                  )}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DocumentChecklist details={details} />
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-muted-foreground" />
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loan.notes ? (
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{loan.notes}</p>
            ) : (
              <div className="text-center py-6">
                <StickyNote className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No notes yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Large Deposit Explanation — special callout if present */}
      {largeDepositExplanation && (
        <Card className="border-l-4 border-l-construction-orange">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-construction-orange" />
              Large Deposit Explanation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{largeDepositExplanation}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
