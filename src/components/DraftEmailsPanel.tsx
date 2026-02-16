'use client'

import { useState } from 'react'
import {
  Mail, Send, X, Edit3, CheckCircle, Loader2, ChevronDown, Sparkles
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { DraftEmail } from '@/types'

interface DraftEmailsPanelProps {
  drafts: DraftEmail[]
  loading: boolean
}

export default function DraftEmailsPanel({ drafts: initialDrafts, loading }: DraftEmailsPanelProps) {
  const [drafts, setDrafts] = useState<DraftEmail[]>(initialDrafts)
  const [editingDraft, setEditingDraft] = useState<DraftEmail | null>(null)
  const [sendingId, setSendingId] = useState<string | null>(null)

  // Sync when parent passes new drafts
  if (initialDrafts !== drafts && loading === false && initialDrafts.length > 0 && drafts.length === 0) {
    setDrafts(initialDrafts)
  }

  const visibleDrafts = drafts.filter(d => d.status !== 'dismissed')

  const handleEdit = (draft: DraftEmail) => {
    setEditingDraft({ ...draft, status: 'editing' })
  }

  const handleSaveEdit = () => {
    if (!editingDraft) return
    setDrafts(prev => prev.map(d =>
      d.id === editingDraft.id ? { ...editingDraft, status: 'draft' as const } : d
    ))
    setEditingDraft(null)
  }

  const handleDismiss = (draftId: string) => {
    setDrafts(prev => prev.map(d =>
      d.id === draftId ? { ...d, status: 'dismissed' as const } : d
    ))
  }

  const handleSend = async (draft: DraftEmail) => {
    setSendingId(draft.id)
    try {
      const response = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: draft.to,
          subject: draft.subject,
          body: draft.body
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send email')
      }

      setDrafts(prev => prev.map(d =>
        d.id === draft.id ? { ...d, status: 'sent' as const } : d
      ))
      toast.success(`Email sent to ${draft.toName || draft.to}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send email')
    } finally {
      setSendingId(null)
    }
  }

  if (loading) {
    return (
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Recommended Emails
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="space-y-2 p-4 border rounded-lg">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Generating email recommendations...</p>
        </CardContent>
      </Card>
    )
  }

  if (visibleDrafts.length === 0) {
    return null
  }

  const priorityVariant = (p: string) =>
    p === 'high' ? 'destructive' : p === 'medium' ? 'warning' : 'secondary'

  return (
    <>
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-emerald-50">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Recommended Emails ({visibleDrafts.length})
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            AI-suggested responses based on your project communications
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {visibleDrafts.map(draft => (
            <div
              key={draft.id}
              className={cn(
                'border rounded-lg p-4 border-l-4 transition-all',
                draft.status === 'sent'
                  ? 'border-l-green-500 bg-green-50/50'
                  : 'border-l-primary bg-background'
              )}
            >
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={priorityVariant(draft.priority)}>
                      {draft.priority.toUpperCase()}
                    </Badge>
                    {draft.status === 'sent' && (
                      <Badge variant="outline" className="text-green-700 border-green-300">
                        <CheckCircle className="h-3 w-3 mr-1" /> Sent
                      </Badge>
                    )}
                    <span className="text-sm font-semibold truncate">{draft.subject}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    To: {draft.toName ? `${draft.toName} <${draft.to}>` : draft.to}
                  </p>
                  <p className="text-xs text-primary/80 mt-1 italic">
                    {draft.reason}
                  </p>
                  {draft.relatedActionItem && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Re: {draft.relatedActionItem}
                    </p>
                  )}
                </div>

                {draft.status !== 'sent' && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(draft)}
                    >
                      <Edit3 className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSend(draft)}
                      disabled={sendingId === draft.id}
                    >
                      {sendingId === draft.id ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Send className="h-3 w-3 mr-1" />
                      )}
                      Send
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDismiss(draft.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>

              {/* HTML Preview */}
              <div className="mt-3 bg-muted/50 rounded p-3 text-xs max-h-32 overflow-y-auto scrollbar-thin">
                <div dangerouslySetInnerHTML={{ __html: draft.body }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingDraft} onOpenChange={(open) => { if (!open) setEditingDraft(null) }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Edit Draft Email
            </DialogTitle>
            <DialogDescription>
              Review and edit before sending
            </DialogDescription>
          </DialogHeader>

          {editingDraft && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-to">To</Label>
                <Input
                  id="edit-to"
                  value={editingDraft.to}
                  onChange={e => setEditingDraft({ ...editingDraft, to: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-subject">Subject</Label>
                <Input
                  id="edit-subject"
                  value={editingDraft.subject}
                  onChange={e => setEditingDraft({ ...editingDraft, subject: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-body">Body (HTML)</Label>
                <Textarea
                  id="edit-body"
                  value={editingDraft.body}
                  onChange={e => setEditingDraft({ ...editingDraft, body: e.target.value })}
                  rows={12}
                  className="font-mono text-xs"
                />
              </div>

              <div>
                <Label>Preview</Label>
                <div className="mt-1 border rounded p-3 bg-white text-sm max-h-48 overflow-y-auto">
                  <div dangerouslySetInnerHTML={{ __html: editingDraft.body }} />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDraft(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
