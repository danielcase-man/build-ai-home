'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { Progress } from '@/components/ui/progress'
import { CONSTRUCTION_PHASES, type ConstructionPhase, type Trade } from '@/lib/construction-phases'
import type { Bid } from '@/types'
import { Button } from '@/components/ui/button'
import {
  FileText,
  CircleDollarSign,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  HardHat,
  Mail,
  Phone,
  User,
  ChevronDown,
  Download,
} from 'lucide-react'

interface BidsClientProps {
  bids: Bid[]
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'selected': return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    case 'under_review': return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'pending': return 'bg-amber-100 text-amber-800 border-amber-200'
    case 'rejected': return 'bg-gray-100 text-gray-500 border-gray-200'
    case 'expired': return 'bg-gray-100 text-gray-400 border-gray-200'
    default: return 'bg-gray-100 text-gray-600 border-gray-200'
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'selected': return 'Selected'
    case 'under_review': return 'Under Review'
    case 'pending': return 'Pending'
    case 'rejected': return 'Rejected'
    case 'expired': return 'Expired'
    default: return status
  }
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusColor(status)}`}>
      {getStatusLabel(status)}
    </span>
  )
}

function BidCard({ bid }: { bid: Bid }) {
  const isRejected = bid.status === 'rejected'
  const hasContact = bid.vendor_contact || bid.vendor_email || bid.vendor_phone
  const hasDetails = bid.scope_of_work || bid.payment_terms || bid.lead_time_weeks || bid.internal_notes

  return (
    <div className={`rounded-lg border p-3 ${isRejected ? 'opacity-60 bg-gray-50' : 'bg-white'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{bid.vendor_name}</span>
            <StatusBadge status={bid.status} />
          </div>
          {bid.subcategory && (
            <p className="text-xs text-muted-foreground mt-0.5">{bid.subcategory}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{bid.description}</p>
        </div>
        <div className="text-right shrink-0">
          <p className={`font-semibold text-sm ${isRejected ? 'line-through text-gray-400' : ''}`}>
            {formatCurrency(bid.total_amount)}
          </p>
          <div className="flex items-center justify-end gap-2">
            <p className="text-xs text-muted-foreground">{bid.bid_date}</p>
            {bid.lead_time_weeks && (
              <span className="text-xs text-blue-600 font-medium">{bid.lead_time_weeks}wk lead</span>
            )}
          </div>
        </div>
      </div>

      {hasContact && (
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          {bid.vendor_contact && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {bid.vendor_contact}
            </span>
          )}
          {bid.vendor_email && (
            <a href={`mailto:${bid.vendor_email}`} className="flex items-center gap-1 text-primary hover:underline">
              <Mail className="h-3 w-3" />
              {bid.vendor_email}
            </a>
          )}
          {bid.vendor_phone && (
            <a href={`tel:${bid.vendor_phone}`} className="flex items-center gap-1 text-primary hover:underline">
              <Phone className="h-3 w-3" />
              {bid.vendor_phone}
            </a>
          )}
        </div>
      )}

      {(bid.pros || bid.cons) && (
        <div className="mt-2 flex gap-4 text-xs">
          {bid.pros && (
            <div className="flex items-start gap-1 text-emerald-700">
              <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0" />
              <span className="line-clamp-1">{bid.pros}</span>
            </div>
          )}
          {bid.cons && (
            <div className="flex items-start gap-1 text-red-600">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              <span className="line-clamp-1">{bid.cons}</span>
            </div>
          )}
        </div>
      )}

      {hasDetails && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1 mt-3 pt-3 border-t text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown className="h-3.5 w-3.5" />
            Details
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 grid gap-1.5 text-sm text-muted-foreground">
              {bid.scope_of_work && (
                <p><span className="font-medium text-foreground">Scope:</span> {bid.scope_of_work}</p>
              )}
              {bid.payment_terms && (
                <p><span className="font-medium text-foreground">Payment:</span> {bid.payment_terms}</p>
              )}
              {bid.lead_time_weeks && (
                <p><span className="font-medium text-foreground">Lead Time:</span> {bid.lead_time_weeks} weeks</p>
              )}
              {bid.internal_notes && (
                <p><span className="font-medium text-foreground">Notes:</span> {bid.internal_notes}</p>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}

function NeedsBidIndicator({ trade }: { trade: Trade }) {
  return (
    <div className="rounded-lg border border-dashed border-red-300 bg-red-50/50 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <span className="text-sm font-medium text-red-700">Needs Bid</span>
        </div>
        {trade.budgetEstimate && (
          <span className="text-xs text-muted-foreground">
            Est. {formatCurrency(trade.budgetEstimate)}
          </span>
        )}
      </div>
    </div>
  )
}

function PhaseSection({
  phase,
  bidsByCategory,
}: {
  phase: ConstructionPhase
  bidsByCategory: Map<string, Bid[]>
}) {
  const tradesWithBids = phase.trades.filter(t => bidsByCategory.has(t.bidCategory))
  const coverage = `${tradesWithBids.length}/${phase.trades.length}`

  const phaseEstimate = phase.trades.reduce((sum, t) => sum + (t.budgetEstimate || 0), 0)

  return (
    <AccordionItem value={`phase-${phase.phase}`}>
      <AccordionTrigger className="hover:no-underline px-1">
        <div className="flex flex-1 items-center justify-between pr-4">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {phase.phase}
            </span>
            <div className="text-left">
              <span className="font-semibold">{phase.name}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {coverage} trades covered
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {tradesWithBids.length === phase.trades.length ? (
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100">
                All Covered
              </Badge>
            ) : tradesWithBids.length > 0 ? (
              <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">
                Partial
              </Badge>
            ) : (
              <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100">
                No Bids
              </Badge>
            )}
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {formatCurrency(phaseEstimate)}
            </span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-4 pl-10">
          {phase.trades.map((trade) => {
            const tradeBids = bidsByCategory.get(trade.bidCategory) || []
            return (
              <div key={trade.bidCategory}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <HardHat className="h-3.5 w-3.5 text-muted-foreground" />
                    {trade.name}
                    {!trade.required && (
                      <span className="text-xs text-muted-foreground italic">(optional)</span>
                    )}
                  </h4>
                  {trade.budgetEstimate && (
                    <span className="text-xs text-muted-foreground">
                      Budget: {formatCurrency(trade.budgetEstimate)}
                    </span>
                  )}
                </div>
                {tradeBids.length > 0 ? (
                  <div className="space-y-2">
                    {tradeBids.map((bid) => (
                      <BidCard key={bid.id} bid={bid} />
                    ))}
                  </div>
                ) : (
                  <NeedsBidIndicator trade={trade} />
                )}
              </div>
            )
          })}
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}

export default function BidsClient({ bids }: BidsClientProps) {
  const bidsByCategory = useMemo(() => {
    const map = new Map<string, Bid[]>()
    for (const bid of bids) {
      const existing = map.get(bid.category) || []
      existing.push(bid)
      map.set(bid.category, existing)
    }
    return map
  }, [bids])

  // Summary stats
  const totalBids = bids.length
  const allTrades = CONSTRUCTION_PHASES.flatMap(p => p.trades)
  const totalTrades = allTrades.length
  const coveredTrades = allTrades.filter(t => bidsByCategory.has(t.bidCategory)).length
  const needsBids = totalTrades - coveredTrades
  const committedTotal = bids
    .filter(b => b.status === 'selected')
    .reduce((sum, b) => sum + b.total_amount, 0)

  const coveragePercent = Math.round((coveredTrades / totalTrades) * 100)

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bids & Procurement</h1>
          <p className="text-muted-foreground">
            Track vendor bids across all construction trades
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.open('/api/export/bid-comparison', '_blank')} className="flex items-center gap-1.5">
          <Download className="h-3.5 w-3.5" />
          Export Comparison
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Bids Received
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalBids}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Trades Covered
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{coveredTrades} / {totalTrades}</p>
            <Progress value={coveragePercent} className="mt-2 h-1.5" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Still Need Bids
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{needsBids}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CircleDollarSign className="h-4 w-4" />
              Total Committed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(committedTotal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Status Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="text-muted-foreground font-medium">Status:</span>
        <div className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span>Selected</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
          <span>Under Review</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          <span>Pending</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
          <span>Needs Bid</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-gray-400" />
          <span>Rejected</span>
        </div>
      </div>

      {/* Phase Accordion */}
      <Accordion type="multiple" defaultValue={['phase-1', 'phase-5', 'phase-6']}>
        {CONSTRUCTION_PHASES.map((phase) => (
          <PhaseSection
            key={phase.phase}
            phase={phase}
            bidsByCategory={bidsByCategory}
          />
        ))}
      </Accordion>
    </div>
  )
}
