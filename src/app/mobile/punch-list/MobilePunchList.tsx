'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, AlertTriangle, Shield, Wrench, Eye, CheckCircle2, Clock, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PunchListItem } from '@/lib/punch-list-service'

const SEVERITY_CONFIG = {
  safety: { label: 'Safety', color: 'bg-red-500', textColor: 'text-red-700', icon: Shield, hint: 'Hazard or code violation' },
  structural: { label: 'Structural', color: 'bg-orange-500', textColor: 'text-orange-700', icon: AlertTriangle, hint: 'Affects structural integrity' },
  functional: { label: 'Functional', color: 'bg-amber-500', textColor: 'text-amber-700', icon: Wrench, hint: 'Affects use, not safety' },
  cosmetic: { label: 'Cosmetic', color: 'bg-slate-400', textColor: 'text-slate-600', icon: Eye, hint: 'Appearance only' },
} as const

const STATUS_CONFIG = {
  identified: { label: 'Open', color: 'bg-gray-100 text-gray-700' },
  assigned: { label: 'Assigned', color: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Done', color: 'bg-emerald-100 text-emerald-700' },
  verified: { label: 'Verified', color: 'bg-green-100 text-green-800' },
} as const

const ROOMS = [
  'Kitchen', 'Master Bedroom', 'Master Bathroom', 'Living Room', 'Dining Room',
  'Family Room', 'Office', 'Laundry', 'Garage', 'Entry', 'Hallway',
  'Bedroom 2', 'Bedroom 3', 'Bathroom 2', 'Bathroom 3', 'Pantry',
  'Exterior Front', 'Exterior Back', 'Exterior Side',
]

interface MobilePunchListProps {
  items: PunchListItem[]
  projectId: string
}

export default function MobilePunchList({ items, projectId }: MobilePunchListProps) {
  const router = useRouter()
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState<'all' | 'open' | 'done'>('open')
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [description, setDescription] = useState('')
  const [room, setRoom] = useState('')
  const [severity, setSeverity] = useState<keyof typeof SEVERITY_CONFIG>('functional')
  const [notes, setNotes] = useState('')

  const filteredItems = items.filter(item => {
    if (filter === 'open') return !['completed', 'verified'].includes(item.status)
    if (filter === 'done') return ['completed', 'verified'].includes(item.status)
    return true
  })

  const openCount = items.filter(i => !['completed', 'verified'].includes(i.status)).length
  const doneCount = items.filter(i => ['completed', 'verified'].includes(i.status)).length

  const handleSubmit = async () => {
    if (!description.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/punch-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          room: room || null,
          severity,
          notes: notes.trim() || null,
          source: 'owner',
        }),
      })
      if (res.ok) {
        setDescription('')
        setRoom('')
        setSeverity('functional')
        setNotes('')
        setShowAdd(false)
        router.refresh()
      }
    } catch {
      // Show error inline
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    await fetch('/api/punch-list', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus }),
    })
    router.refresh()
  }

  return (
    <div className="pb-4">
      {/* Stats bar */}
      <div className="bg-white px-4 py-3 border-b flex items-center justify-between">
        <div className="flex gap-2">
          {(['all', 'open', 'done'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium transition-colors min-h-[36px]',
                filter === f ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600 active:bg-gray-200'
              )}
            >
              {f === 'all' ? `All (${items.length})` : f === 'open' ? `Open (${openCount})` : `Done (${doneCount})`}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-orange-600 text-white p-2 rounded-full shadow-md active:scale-95 transition-transform min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {/* Items */}
      <div className="px-4 pt-3 space-y-2">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-2" />
            <p className="text-base font-medium">{filter === 'open' ? 'No open items' : 'No items'}</p>
          </div>
        ) : (
          filteredItems.map(item => {
            const sev = SEVERITY_CONFIG[item.severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.functional
            const stat = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.identified
            const SevIcon = sev.icon
            const isOpen = !['completed', 'verified'].includes(item.status)

            return (
              <div
                key={item.id}
                className={cn(
                  'bg-white rounded-lg border p-3 transition-opacity',
                  !isOpen && 'opacity-60'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn('mt-0.5 p-1.5 rounded', sev.color, 'text-white')}>
                    <SevIcon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-medium', !isOpen && 'line-through')}>{item.description}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {item.room && <span className="text-xs text-gray-500">{item.room}</span>}
                      <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', stat.color)}>{stat.label}</span>
                    </div>
                  </div>
                  {isOpen && (
                    <button
                      onClick={() => handleStatusUpdate(item.id!, item.status === 'identified' ? 'in_progress' : 'completed')}
                      className="text-xs bg-gray-100 px-2 py-1.5 rounded font-medium active:bg-gray-200 min-h-[36px]"
                    >
                      {item.status === 'identified' ? 'Start' : 'Done'}
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Add item bottom sheet */}
      {showAdd && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[60]" onClick={() => setShowAdd(false)} />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-[61] max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-200 safe-area-bottom">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>
            <div className="px-4 pb-6 space-y-4">
              <h2 className="text-lg font-bold">New Punch Item</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="What's the issue?"
                  className="w-full p-3 border rounded-lg text-base min-h-[80px] resize-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room</label>
                <select
                  value={room}
                  onChange={e => setRoom(e.target.value)}
                  className="w-full p-3 border rounded-lg text-base bg-white min-h-[48px]"
                >
                  <option value="">Select room...</option>
                  {ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Severity</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(SEVERITY_CONFIG) as [keyof typeof SEVERITY_CONFIG, typeof SEVERITY_CONFIG[keyof typeof SEVERITY_CONFIG]][]).map(([key, cfg]) => {
                    const Icon = cfg.icon
                    return (
                      <button
                        key={key}
                        onClick={() => setSeverity(key)}
                        className={cn(
                          'flex items-center gap-2 p-3 rounded-lg border text-left min-h-[48px] transition-colors',
                          severity === key ? `border-2 ${cfg.textColor} bg-white` : 'border-gray-200 text-gray-600'
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <div>
                          <p className="text-sm font-medium">{cfg.label}</p>
                          <p className="text-[11px] text-gray-400">{cfg.hint}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Additional details..."
                  className="w-full p-3 border rounded-lg text-base min-h-[60px] resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowAdd(false)}
                  className="flex-1 py-3 px-4 rounded-lg border font-medium text-gray-700 active:bg-gray-50 min-h-[48px]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!description.trim() || submitting}
                  className="flex-1 py-3 px-4 rounded-lg bg-orange-600 text-white font-medium disabled:opacity-50 active:bg-orange-700 min-h-[48px] flex items-center justify-center"
                >
                  {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Add Item'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
