'use client'

import { useState, useEffect } from 'react'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { History, ChevronDown } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface AuditEntry {
  id: string
  action: string
  field_name: string | null
  old_value: string | null
  new_value: string | null
  actor: string
  created_at: string
}

interface AuditHistoryProps {
  entityType: string
  entityId: string
}

export default function AuditHistory({ entityType, entityId }: AuditHistoryProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open || entries.length > 0) return

    setLoading(true)
    fetch(`/api/audit?entityType=${entityType}&entityId=${entityId}`)
      .then(res => res.json())
      .then(json => setEntries(json.data?.entries ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open, entityType, entityId, entries.length])

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <History className="h-3 w-3" />
        <span>History</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 space-y-1.5">
          {loading && (
            <p className="text-xs text-muted-foreground">Loading...</p>
          )}
          {!loading && entries.length === 0 && (
            <p className="text-xs text-muted-foreground">No changes recorded yet</p>
          )}
          {entries.map(entry => (
            <div key={entry.id} className="flex items-start gap-2 text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
              <div>
                <span className="font-medium">{entry.action}</span>
                {entry.field_name && (
                  <span className="text-muted-foreground">
                    {' '}{entry.field_name}: {entry.old_value ?? '(empty)'} → {entry.new_value ?? '(empty)'}
                  </span>
                )}
                <span className="text-muted-foreground block">
                  {entry.actor} · {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
