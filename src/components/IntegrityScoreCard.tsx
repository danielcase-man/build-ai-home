'use client'

import { ShieldCheck, ShieldAlert, AlertTriangle, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface IntegrityScoreProps {
  score: number | null
  issueCount: number
  criticalCount: number
  highCount: number
  lastRunAt?: string | null
}

function getScoreColor(score: number): string {
  if (score >= 85) return 'text-green-600'
  if (score >= 65) return 'text-yellow-600'
  return 'text-red-600'
}

function getScoreBg(score: number): string {
  if (score >= 85) return 'bg-green-50 border-green-200'
  if (score >= 65) return 'bg-yellow-50 border-yellow-200'
  return 'bg-red-50 border-red-200'
}

function getScoreLabel(score: number): string {
  if (score >= 85) return 'Healthy'
  if (score >= 65) return 'Needs Attention'
  return 'Issues Found'
}

function formatAge(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function IntegrityScoreCard({ score, issueCount, criticalCount, highCount, lastRunAt }: IntegrityScoreProps) {
  if (score === null) return null

  const Icon = score >= 85 ? ShieldCheck : score >= 65 ? AlertTriangle : ShieldAlert

  return (
    <Card className={cn('border', getScoreBg(score))}>
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('flex items-center justify-center w-10 h-10 rounded-full', score >= 85 ? 'bg-green-100' : score >= 65 ? 'bg-yellow-100' : 'bg-red-100')}>
              <Icon className={cn('w-5 h-5', getScoreColor(score))} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={cn('text-2xl font-bold tabular-nums', getScoreColor(score))}>{score}</span>
                <span className="text-xs text-muted-foreground">/ 100</span>
                <Badge variant="outline" className={cn('text-xs', score >= 85 ? 'border-green-300 text-green-700' : score >= 65 ? 'border-yellow-300 text-yellow-700' : 'border-red-300 text-red-700')}>
                  {getScoreLabel(score)}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Data Integrity
                {issueCount > 0 && <> &middot; {issueCount} issue{issueCount !== 1 ? 's' : ''}</>}
                {criticalCount > 0 && <> &middot; <span className="text-red-600 font-medium">{criticalCount} critical</span></>}
                {highCount > 0 && criticalCount === 0 && <> &middot; <span className="text-orange-600 font-medium">{highCount} high</span></>}
                {lastRunAt && <> &middot; {formatAge(lastRunAt)}</>}
              </p>
            </div>
          </div>
          <Link href="/api/integrity" className="text-muted-foreground hover:text-foreground transition-colors">
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
