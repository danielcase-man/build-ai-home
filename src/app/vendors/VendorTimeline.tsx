'use client'

import { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Clock,
  Mail,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { VendorThread, FollowUpNeeded } from '@/lib/vendor-thread-service'
import type { Bid } from '@/types'

// ── Types ──

interface VendorTimelineRow {
  vendorName: string
  vendorEmail: string | null
  category: string | null
  status: VendorThread['status']
  lastActivity: string | null
  daysSince: number
  bidStatus: 'none' | 'requested' | 'received' | 'selected'
  bidAmount: number | null
  bidVendorCount: number
  followUpReason: string | null
  isOverdue: boolean
}

interface VendorTimelineProps {
  threads: VendorThread[]
  followUps: FollowUpNeeded[]
  bids: Bid[]
}

// ── Helpers ──

function formatDaysAgo(days: number): string {
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getUrgencyColor(days: number, isOverdue: boolean): string {
  if (isOverdue || days >= 14) return 'text-red-600'
  if (days >= 7) return 'text-orange-500'
  if (days >= 3) return 'text-yellow-600'
  return 'text-green-600'
}

function getUrgencyBg(days: number, isOverdue: boolean): string {
  if (isOverdue || days >= 14) return 'bg-red-50 border-red-200'
  if (days >= 7) return 'bg-orange-50 border-orange-200'
  return ''
}

// ── Component ──

export default function VendorTimeline({ threads, followUps, bids }: VendorTimelineProps) {
  // Build follow-up lookup
  const followUpMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const fu of followUps) {
      if (fu.thread.vendor_name) {
        map.set(fu.thread.vendor_name.toLowerCase(), fu.reason)
      }
    }
    return map
  }, [followUps])

  // Build bid lookup by vendor
  const bidsByVendor = useMemo(() => {
    const map = new Map<string, Bid[]>()
    for (const bid of bids) {
      const key = bid.vendor_name.toLowerCase()
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(bid)
    }
    return map
  }, [bids])

  // Build timeline rows
  const rows = useMemo<VendorTimelineRow[]>(() => {
    return threads.map(thread => {
      const vendorKey = thread.vendor_name.toLowerCase()
      const vendorBids = bidsByVendor.get(vendorKey) || []
      const selectedBid = vendorBids.find(b => b.status === 'selected')
      const hasReceived = vendorBids.some(b => b.status !== 'rejected' && b.status !== 'expired')

      let bidStatus: VendorTimelineRow['bidStatus'] = 'none'
      let bidAmount: number | null = null
      if (selectedBid) {
        bidStatus = 'selected'
        bidAmount = selectedBid.total_amount
      } else if (hasReceived) {
        bidStatus = 'received'
        bidAmount = vendorBids
          .filter(b => b.status !== 'rejected' && b.status !== 'expired')
          .reduce((min, b) => b.total_amount < min ? b.total_amount : min, Infinity)
        if (bidAmount === Infinity) bidAmount = null
      } else if (thread.bid_requested_date) {
        bidStatus = 'requested'
      }

      const followUpReason = followUpMap.get(vendorKey) || null

      return {
        vendorName: thread.vendor_name,
        vendorEmail: thread.vendor_email,
        category: thread.category,
        status: thread.status,
        lastActivity: thread.last_activity,
        daysSince: thread.days_since_contact,
        bidStatus,
        bidAmount,
        bidVendorCount: vendorBids.length,
        followUpReason,
        isOverdue: !!followUpReason,
      }
    })
    // Sort: overdue first, then by days since (most overdue)
    .sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1
      if (!a.isOverdue && b.isOverdue) return 1
      return b.daysSince - a.daysSince
    })
  }, [threads, bidsByVendor, followUpMap])

  const overdueCount = rows.filter(r => r.isOverdue).length
  const waitingCount = rows.filter(r => r.status === 'waiting_response').length
  const activeCount = rows.filter(r => r.daysSince <= 7).length

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Mail className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No vendor communication threads yet.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Threads are auto-created from email sync and bid requests.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Quick stats */}
      <div className="flex flex-wrap gap-3">
        {overdueCount > 0 && (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            {overdueCount} need follow-up
          </Badge>
        )}
        {waitingCount > 0 && (
          <Badge variant="warning" className="gap-1">
            <Clock className="h-3 w-3" />
            {waitingCount} waiting response
          </Badge>
        )}
        <Badge variant="secondary" className="gap-1">
          <CheckCircle2 className="h-3 w-3" />
          {activeCount} active this week
        </Badge>
        <Badge variant="outline" className="gap-1">
          {rows.length} total threads
        </Badge>
      </div>

      {/* Timeline table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3 font-medium">Vendor</th>
                <th className="p-3 font-medium whitespace-nowrap">Last Contact</th>
                <th className="p-3 font-medium whitespace-nowrap">Days Since</th>
                <th className="p-3 font-medium">Bid Status</th>
                <th className="p-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.vendorName + i}
                  className={cn(
                    'border-t transition-colors hover:bg-accent/30',
                    getUrgencyBg(row.daysSince, row.isOverdue),
                  )}
                >
                  {/* Vendor */}
                  <td className="p-3">
                    <div>
                      <p className="font-medium">{row.vendorName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {row.category && (
                          <span className="text-xs text-muted-foreground">{row.category}</span>
                        )}
                        {row.vendorEmail && (
                          <span className="text-xs text-muted-foreground/60 truncate max-w-[180px]">{row.vendorEmail}</span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Last Contact */}
                  <td className="p-3 whitespace-nowrap">
                    {row.lastActivity ? (
                      <span className="text-muted-foreground">{formatDate(row.lastActivity)}</span>
                    ) : (
                      <span className="text-muted-foreground/40">No contact</span>
                    )}
                  </td>

                  {/* Days Since */}
                  <td className="p-3 whitespace-nowrap">
                    <span className={cn('font-medium tabular-nums', getUrgencyColor(row.daysSince, row.isOverdue))}>
                      {row.daysSince < 999 ? formatDaysAgo(row.daysSince) : '—'}
                    </span>
                  </td>

                  {/* Bid Status */}
                  <td className="p-3">
                    {row.bidStatus === 'selected' && (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                        <span className="text-green-700 font-medium">${row.bidAmount?.toLocaleString()}</span>
                      </div>
                    )}
                    {row.bidStatus === 'received' && (
                      <div className="flex items-center gap-1.5">
                        <ArrowDownLeft className="h-3.5 w-3.5 text-blue-500" />
                        <span>{row.bidVendorCount} bid{row.bidVendorCount !== 1 ? 's' : ''}</span>
                        {row.bidAmount && <span className="text-muted-foreground">· ${row.bidAmount.toLocaleString()}</span>}
                      </div>
                    )}
                    {row.bidStatus === 'requested' && (
                      <div className="flex items-center gap-1.5 text-orange-600">
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        <span>Requested</span>
                      </div>
                    )}
                    {row.bidStatus === 'none' && (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>

                  {/* Status / Pending */}
                  <td className="p-3">
                    {row.followUpReason ? (
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                        <span className="text-xs text-red-700 line-clamp-2">{row.followUpReason}</span>
                      </div>
                    ) : row.status === 'waiting_response' ? (
                      <Badge variant="warning" className="text-xs">Waiting</Badge>
                    ) : row.status === 'active' ? (
                      <Badge variant="default" className="text-xs">Active</Badge>
                    ) : row.status === 'closed' ? (
                      <Badge variant="secondary" className="text-xs">Closed</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">{row.status}</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
