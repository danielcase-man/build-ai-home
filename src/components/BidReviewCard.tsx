/**
 * BidReviewCard Component
 *
 * Displays a single bid with options to review, compare, select, and finalize
 */

'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, Eye, GitCompare, DollarSign, Calendar, AlertCircle, Info } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { Bid } from '@/types'

interface BidReviewCardProps {
  bid: Bid
  onSelect?: (bidId: string) => void
  onReject?: (bidId: string) => void
  onCompare?: (bidId: string) => void
  onFinalize?: (bidId: string) => void
  competingBidsCount?: number
}

export default function BidReviewCard({
  bid,
  onSelect,
  onReject,
  onCompare,
  onFinalize,
  competingBidsCount = 0
}: BidReviewCardProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [notes, setNotes] = useState(bid.selection_notes || '')

  const getStatusVariant = (): 'success' | 'destructive' | 'warning' | 'secondary' => {
    switch (bid.status) {
      case 'selected': return 'success'
      case 'rejected': return 'destructive'
      case 'under_review': return 'warning'
      default: return 'secondary'
    }
  }

  const getStatusIcon = () => {
    switch (bid.status) {
      case 'selected': return <CheckCircle className="h-3 w-3" />
      case 'rejected': return <XCircle className="h-3 w-3" />
      default: return <AlertCircle className="h-3 w-3" />
    }
  }

  const isExpired = bid.valid_until && new Date(bid.valid_until) < new Date()
  const daysUntilExpiration = bid.valid_until
    ? Math.ceil((new Date(bid.valid_until).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <Card>
      {/* Header */}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="text-lg font-semibold">{bid.vendor_name}</h3>
              <Badge variant={getStatusVariant()} className="flex items-center gap-1">
                {getStatusIcon()}
                {bid.status.replace('_', ' ').toUpperCase()}
              </Badge>
              {bid.needs_review && (
                <Badge variant="warning">NEEDS REVIEW</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{bid.category}{bid.subcategory && ` • ${bid.subcategory}`}</p>
            <p className="text-sm text-muted-foreground mt-1">{bid.description}</p>
          </div>
          <div className="text-right ml-4">
            <div className="text-2xl font-bold">
              ${bid.total_amount.toLocaleString()}
            </div>
            {bid.ai_extracted && (
              <div className="text-xs text-muted-foreground mt-1">
                AI: {Math.round((bid.ai_confidence || 0) * 100)}% confident
              </div>
            )}
          </div>
        </div>

        {/* Quick Info */}
        <div className="flex gap-4 mt-3 text-sm text-muted-foreground flex-wrap">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>Received: {new Date(bid.received_date).toLocaleDateString()}</span>
          </div>
          {bid.lead_time_weeks && (
            <div className="flex items-center gap-1">
              <DollarSign className="h-4 w-4" />
              <span>Lead time: {bid.lead_time_weeks} weeks</span>
            </div>
          )}
          {bid.valid_until && (
            <div className={`flex items-center gap-1 ${isExpired ? 'text-destructive' : daysUntilExpiration && daysUntilExpiration < 7 ? 'text-construction-orange' : ''}`}>
              <Calendar className="h-4 w-4" />
              <span>
                Valid until: {new Date(bid.valid_until).toLocaleDateString()}
                {daysUntilExpiration && daysUntilExpiration > 0 && ` (${daysUntilExpiration}d)`}
              </span>
            </div>
          )}
        </div>

        {/* Competing Bids Alert */}
        {competingBidsCount > 0 && bid.status === 'pending' && (
          <Alert className="mt-2">
            <Info className="h-4 w-4" />
            <AlertDescription>
              {competingBidsCount} other bid{competingBidsCount > 1 ? 's' : ''} for {bid.category}
            </AlertDescription>
          </Alert>
        )}
      </CardHeader>

      {/* Details (Collapsible) */}
      <Collapsible open={showDetails} onOpenChange={setShowDetails}>
        <CollapsibleContent>
          <div className="px-6 pb-4 bg-muted/30 border-t space-y-4">
            {/* Line Items */}
            {bid.line_items && bid.line_items.length > 0 && (
              <div className="pt-4">
                <h4 className="font-semibold mb-2">Line Items:</h4>
                <div className="space-y-1">
                  {bid.line_items.map((item, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {item.item}
                        {item.quantity && item.quantity > 1 && ` (${item.quantity} @ $${item.unit_price?.toLocaleString()})`}
                      </span>
                      <span className="font-medium">${item.total.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Scope */}
            {bid.scope_of_work && (
              <div>
                <h4 className="font-semibold mb-2">Scope of Work:</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{bid.scope_of_work}</p>
              </div>
            )}

            {/* Inclusions */}
            {bid.inclusions && bid.inclusions.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-1">
                  <CheckCircle className="h-4 w-4 text-construction-green" />
                  Included:
                </h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {bid.inclusions.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Exclusions */}
            {bid.exclusions && bid.exclusions.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-1">
                  <XCircle className="h-4 w-4 text-destructive" />
                  Not Included:
                </h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {bid.exclusions.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Terms */}
            <div className="grid grid-cols-2 gap-4">
              {bid.payment_terms && (
                <div>
                  <h4 className="font-semibold mb-1 text-sm">Payment Terms:</h4>
                  <p className="text-sm text-muted-foreground">{bid.payment_terms}</p>
                </div>
              )}
              {bid.warranty_terms && (
                <div>
                  <h4 className="font-semibold mb-1 text-sm">Warranty:</h4>
                  <p className="text-sm text-muted-foreground">{bid.warranty_terms}</p>
                </div>
              )}
            </div>

            {/* AI Notes */}
            {bid.ai_extraction_notes && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>AI Notes:</strong> {bid.ai_extraction_notes}
                </AlertDescription>
              </Alert>
            )}

            {/* Pros/Cons */}
            {(bid.pros || bid.cons) && (
              <div className="grid grid-cols-2 gap-4">
                {bid.pros && (
                  <div className="p-3 bg-construction-green/10 rounded-lg">
                    <h4 className="font-semibold text-sm mb-1">Pros:</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">{bid.pros}</p>
                  </div>
                )}
                {bid.cons && (
                  <div className="p-3 bg-destructive/10 rounded-lg">
                    <h4 className="font-semibold text-sm mb-1">Cons:</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">{bid.cons}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>

        {/* Actions */}
        <CardContent className="pt-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Left side actions */}
            <div className="flex gap-2">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Eye className="h-4 w-4 mr-1" />
                  {showDetails ? 'Hide' : 'Show'} Details
                </Button>
              </CollapsibleTrigger>

              {competingBidsCount > 0 && onCompare && bid.status === 'pending' && (
                <Button variant="ghost" size="sm" onClick={() => onCompare(bid.id)}>
                  <GitCompare className="h-4 w-4 mr-1" />
                  Compare ({competingBidsCount + 1})
                </Button>
              )}
            </div>

            {/* Right side actions */}
            <div className="flex gap-2">
              {bid.status === 'pending' && (
                <>
                  {onReject && (
                    <Button variant="destructive" size="sm" onClick={() => onReject(bid.id)}>
                      Reject
                    </Button>
                  )}
                  {onSelect && (
                    <Button variant="success" size="sm" onClick={() => onSelect(bid.id)}>
                      Select Bid
                    </Button>
                  )}
                </>
              )}

              {bid.status === 'selected' && onFinalize && (
                <Button size="sm" onClick={() => onFinalize(bid.id)}>
                  Finalize to Budget
                </Button>
              )}
            </div>
          </div>

          {/* Notes input (for selected bids) */}
          {bid.status === 'selected' && (
            <div className="mt-3 pt-3 border-t space-y-2">
              <Label>Selection Notes:</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Why did you select this bid?"
                rows={2}
              />
            </div>
          )}
        </CardContent>
      </Collapsible>
    </Card>
  )
}
