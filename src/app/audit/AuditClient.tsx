'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  History,
  Search,
  Plus,
  Pencil,
  Trash2,
  Upload,
  ArrowRight,
  Filter,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'

interface AuditEntry {
  id: string
  project_id: string
  entity_type: string
  entity_id: string
  action: string
  field_name: string | null
  old_value: string | null
  new_value: string | null
  actor: string
  created_at: string
  // New columns from migration 002
  entity_name?: string | null
  changes?: Record<string, { old: unknown; new: unknown }> | null
  metadata?: Record<string, unknown> | null
}

interface AuditClientProps {
  entries: AuditEntry[]
}

const ACTION_CONFIG: Record<string, { icon: typeof Plus; color: string; label: string }> = {
  create: { icon: Plus, color: 'text-emerald-600 bg-emerald-50', label: 'Created' },
  update: { icon: Pencil, color: 'text-blue-600 bg-blue-50', label: 'Updated' },
  delete: { icon: Trash2, color: 'text-red-600 bg-red-50', label: 'Deleted' },
  upload: { icon: Upload, color: 'text-violet-600 bg-violet-50', label: 'Uploaded' },
  status_change: { icon: ArrowRight, color: 'text-amber-600 bg-amber-50', label: 'Status Changed' },
}

const ENTITY_LABELS: Record<string, string> = {
  bid: 'Bid',
  budget_item: 'Budget Item',
  selection: 'Selection',
  task: 'Task',
  milestone: 'Milestone',
  document: 'Document',
  contact: 'Contact',
  vendor: 'Vendor',
  change_order: 'Change Order',
  punch_item: 'Punch Item',
  inspection: 'Inspection',
  warranty: 'Warranty',
  permit: 'Permit',
  communication: 'Communication',
}

function getEntityLabel(type: string): string {
  return ENTITY_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export default function AuditClient({ entries }: AuditClientProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterEntity, setFilterEntity] = useState<string | null>(null)
  const [filterAction, setFilterAction] = useState<string | null>(null)

  const entityTypes = useMemo(() => {
    const types = new Set(entries.map(e => e.entity_type))
    return Array.from(types).sort()
  }, [entries])

  const filtered = useMemo(() => {
    let result = entries

    if (filterEntity) {
      result = result.filter(e => e.entity_type === filterEntity)
    }
    if (filterAction) {
      result = result.filter(e => e.action === filterAction)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(e =>
        e.entity_type.toLowerCase().includes(q) ||
        (e.field_name && e.field_name.toLowerCase().includes(q)) ||
        (e.old_value && e.old_value.toLowerCase().includes(q)) ||
        (e.new_value && e.new_value.toLowerCase().includes(q)) ||
        (e.entity_name && e.entity_name.toLowerCase().includes(q)) ||
        e.actor.toLowerCase().includes(q)
      )
    }

    return result
  }, [entries, filterEntity, filterAction, searchQuery])

  // Group by date
  const groupedByDate = useMemo(() => {
    const groups: Record<string, AuditEntry[]> = {}
    for (const entry of filtered) {
      const date = new Date(entry.created_at).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
      if (!groups[date]) groups[date] = []
      groups[date].push(entry)
    }
    return groups
  }, [filtered])

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Trail</h1>
        <p className="text-muted-foreground">
          Change history across all project data — {entries.length} entries
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search changes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <button
            onClick={() => setFilterEntity(null)}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
              !filterEntity ? 'bg-primary text-primary-foreground' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            All
          </button>
          {entityTypes.map(type => (
            <button
              key={type}
              onClick={() => setFilterEntity(filterEntity === type ? null : type)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                filterEntity === type ? 'bg-primary text-primary-foreground' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {getEntityLabel(type)}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      {Object.keys(groupedByDate).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <History className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold mb-1">No audit entries</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Changes to project data will appear here as they happen.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByDate).map(([date, dateEntries]) => (
            <div key={date}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 sticky top-14 bg-background/95 backdrop-blur-sm py-1 z-10">
                {date}
              </h3>
              <div className="space-y-1.5">
                {dateEntries.map(entry => {
                  const config = ACTION_CONFIG[entry.action] || ACTION_CONFIG.update
                  const Icon = config.icon

                  return (
                    <div key={entry.id} className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-accent/50 transition-colors">
                      <div className={cn('p-1.5 rounded-md shrink-0 mt-0.5', config.color)}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[11px]">
                            {getEntityLabel(entry.entity_type)}
                          </Badge>
                          <span className="text-sm font-medium">{config.label}</span>
                          {entry.entity_name && (
                            <span className="text-sm text-muted-foreground truncate">
                              — {entry.entity_name}
                            </span>
                          )}
                        </div>
                        {entry.field_name && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            <span className="font-medium">{entry.field_name}</span>:
                            {' '}<span className="line-through text-red-500/70">{entry.old_value || '(empty)'}</span>
                            {' '}<ArrowRight className="inline h-3 w-3" />
                            {' '}<span className="text-emerald-600">{entry.new_value || '(empty)'}</span>
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {entry.actor} · {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
