'use client'

import { useState } from 'react'
import { CheckCircle, Square, Timer, Mail, Send, Edit3, X, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import type { ProjectStatusData, DraftEmail } from '@/types'

type ActionItem = ProjectStatusData['actionItems'][0]

export default function StatusActionItems({ items }: { items: ActionItem[] }) {
  const [generatingDraftFor, setGeneratingDraftFor] = useState<number | null>(null)
  const [activeDraft, setActiveDraft] = useState<DraftEmail | null>(null)
  const [editingDraft, setEditingDraft] = useState<DraftEmail | null>(null)
  const [sendingDraft, setSendingDraft] = useState(false)

  const handleGenerateDraft = async (index: number, item: ActionItem) => {
    setGeneratingDraftFor(index)
    try {
      const response = await fetch('/api/emails/drafts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: item.action_context?.to,
          toName: item.action_context?.to_name,
          subjectHint: item.action_context?.subject_hint,
          context: item.action_context?.context || item.text
        })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to generate draft')
      setActiveDraft(data.data.draft)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate draft')
    } finally {
      setGeneratingDraftFor(null)
    }
  }

  const handleSendDraft = async (draft: DraftEmail) => {
    setSendingDraft(true)
    try {
      const response = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: draft.to, subject: draft.subject, body: draft.body })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to send email')
      toast.success(`Email sent to ${draft.toName || draft.to}`)
      setActiveDraft(null)
      setEditingDraft(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send email')
    } finally {
      setSendingDraft(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-construction-green" />
      case 'in-progress': return <Timer className="h-4 w-4 text-construction-orange" />
      default: return <Square className="h-4 w-4 text-muted-foreground" />
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-construction-blue" />
            Next Steps
          </CardTitle>
        </CardHeader>
        <CardContent>
          {items.length > 0 ? (
            <ul className="space-y-2">
              {items.map((item, index) => (
                <li key={index} className="flex items-center gap-2">
                  {getStatusIcon(item.status)}
                  <span className={`text-sm flex-1 ${item.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                    {item.text}
                  </span>
                  {item.action_type === 'draft_email' && item.status !== 'completed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      disabled={generatingDraftFor === index}
                      onClick={() => handleGenerateDraft(index, item)}
                    >
                      {generatingDraftFor === index ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Mail className="h-3 w-3 mr-1" />
                      )}
                      Draft Email
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No action items yet. Generate an AI report to get suggested next steps.</p>
          )}
        </CardContent>
      </Card>

      {/* Draft Review Dialog */}
      <Dialog open={!!activeDraft && !editingDraft} onOpenChange={(open) => { if (!open) setActiveDraft(null) }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Review Draft Email
            </DialogTitle>
            <DialogDescription>AI-generated draft for your review</DialogDescription>
          </DialogHeader>
          {activeDraft && (
            <div className="space-y-3">
              <div className="text-sm"><span className="text-muted-foreground">To: </span>{activeDraft.toName ? `${activeDraft.toName} <${activeDraft.to}>` : activeDraft.to}</div>
              <div className="text-sm"><span className="text-muted-foreground">Subject: </span>{activeDraft.subject}</div>
              {activeDraft.reason && <div className="text-xs text-primary/80 italic">{activeDraft.reason}</div>}
              <div className="border rounded p-3 bg-white text-sm max-h-64 overflow-y-auto">
                <div dangerouslySetInnerHTML={{ __html: activeDraft.body }} />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setActiveDraft(null)}><X className="h-3 w-3 mr-1" />Dismiss</Button>
            <Button variant="outline" onClick={() => setEditingDraft(activeDraft)}><Edit3 className="h-3 w-3 mr-1" />Edit</Button>
            <Button onClick={() => activeDraft && handleSendDraft(activeDraft)} disabled={sendingDraft}>
              {sendingDraft ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingDraft} onOpenChange={(open) => { if (!open) setEditingDraft(null) }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Edit3 className="h-5 w-5" />Edit Draft Email</DialogTitle>
            <DialogDescription>Modify before sending</DialogDescription>
          </DialogHeader>
          {editingDraft && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="draft-to">To</Label>
                <Input id="draft-to" value={editingDraft.to} onChange={e => setEditingDraft({ ...editingDraft, to: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="draft-subject">Subject</Label>
                <Input id="draft-subject" value={editingDraft.subject} onChange={e => setEditingDraft({ ...editingDraft, subject: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="draft-body">Body (HTML)</Label>
                <Textarea id="draft-body" value={editingDraft.body} onChange={e => setEditingDraft({ ...editingDraft, body: e.target.value })} rows={12} className="font-mono text-xs" />
              </div>
              <div>
                <Label>Preview</Label>
                <div className="mt-1 border rounded p-3 bg-white text-sm max-h-48 overflow-y-auto">
                  <div dangerouslySetInnerHTML={{ __html: editingDraft.body }} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingDraft(null)}>Cancel</Button>
            <Button onClick={() => editingDraft && handleSendDraft(editingDraft)} disabled={sendingDraft}>
              {sendingDraft ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
