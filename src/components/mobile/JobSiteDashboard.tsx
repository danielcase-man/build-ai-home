"use client"

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  ClipboardCheck,
  Camera,
  FileText,
  ListTodo,
  Plus,
  AlertTriangle,
  Shield,
  Wrench,
  Eye,
  CheckCircle2,
  Clock,
  MapPin,
  Calendar,
  Sun,
  Loader2,
  X,
  ChevronDown,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn, formatCurrency, formatRelativeTime, storage } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import type { ProjectStatusData } from '@/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PunchListStats {
  total: number
  bySeverity: Record<string, number>
  byStatus: Record<string, number>
  byRoom: Record<string, number>
  completionRate: number
}

interface ChangeOrderSummary {
  total: number
  approved: number
  pending: number
  total_cost_impact: number
  total_schedule_impact_days: number
}

interface TaskRecord {
  id: string
  title: string
  status: string
  priority?: string
  due_date?: string
  notes?: string
  milestone_id?: string
  created_at?: string
}

interface CommunicationRecord {
  id: string
  summary: string
  type?: string
  created_at?: string
}

interface PunchListItem {
  id: string
  description: string
  severity: string
  status: string
  room?: string
  created_at?: string
}

type BottomSheetType = 'punch' | 'photo' | 'daily-log' | 'tasks' | null

type PunchSeverity = 'safety' | 'structural' | 'functional' | 'cosmetic'

// Rooms for the 708 Purple Salvia Cove project
const ROOMS = [
  'Living Room', 'Kitchen', 'Master Bedroom', 'Master Bathroom',
  'Bedroom 2', 'Bedroom 3', 'Bedroom 4', 'Bathroom 2', 'Bathroom 3',
  'Garage', 'Laundry', 'Dining Room', 'Study / Office', 'Media Room',
  'Foyer / Entry', 'Hallway', 'Patio / Porch', 'Exterior', 'General',
]

const SEVERITY_CONFIG: Record<PunchSeverity, {
  label: string
  description: string
  icon: React.ReactNode
  color: string
  activeColor: string
}> = {
  safety: {
    label: 'Safety',
    description: 'Hazard or code violation \u2014 blocks CO',
    icon: <Shield className="w-5 h-5" />,
    color: 'border-red-300 bg-red-50 text-red-800',
    activeColor: 'border-red-500 bg-red-500 text-white ring-2 ring-red-300',
  },
  structural: {
    label: 'Structural',
    description: 'Affects structural integrity',
    icon: <AlertTriangle className="w-5 h-5" />,
    color: 'border-orange-300 bg-orange-50 text-orange-800',
    activeColor: 'border-orange-500 bg-orange-500 text-white ring-2 ring-orange-300',
  },
  functional: {
    label: 'Functional',
    description: 'Affects use, not safety',
    icon: <Wrench className="w-5 h-5" />,
    color: 'border-yellow-300 bg-yellow-50 text-yellow-800',
    activeColor: 'border-yellow-500 bg-yellow-500 text-white ring-2 ring-yellow-300',
  },
  cosmetic: {
    label: 'Cosmetic',
    description: 'Appearance only',
    icon: <Eye className="w-5 h-5" />,
    color: 'border-blue-300 bg-blue-50 text-blue-800',
    activeColor: 'border-blue-500 bg-blue-500 text-white ring-2 ring-blue-300',
  },
}

// Phase-aware site visit checklist
const DAILY_CHECKLIST = [
  { id: 'walk', label: 'Walk the full site \u2014 note progress since last visit' },
  { id: 'photos', label: 'Take progress photos (same angles each visit)' },
  { id: 'talk', label: 'Talk to lead worker \u2014 any issues?' },
  { id: 'materials', label: 'Check material deliveries \u2014 correct materials? Stored properly?' },
  { id: 'weather', label: 'Note weather conditions and site cleanliness' },
  { id: 'safety', label: 'Check for safety hazards' },
  { id: 'log', label: 'Log visit notes' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Key for today's checklist state in localStorage */
function checklistKey(): string {
  const d = new Date()
  return `jobsite-checklist-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function todayFormatted(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function budgetBarColor(used: number, total: number): string {
  if (total === 0) return 'bg-muted'
  const pct = used / total
  if (pct < 0.75) return '[&>div]:bg-green-500'
  if (pct < 0.9) return '[&>div]:bg-yellow-500'
  return '[&>div]:bg-red-500'
}

// ---------------------------------------------------------------------------
// Bottom Sheet
// ---------------------------------------------------------------------------

function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const startY = useRef<number | null>(null)
  const currentY = useRef<number | null>(null)

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (startY.current === null) return
    currentY.current = e.touches[0].clientY
    const delta = currentY.current - startY.current
    // Only allow dragging down
    if (delta > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${delta}px)`
      sheetRef.current.style.transition = 'none'
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (startY.current !== null && currentY.current !== null) {
      const delta = currentY.current - startY.current
      if (delta > 100) {
        onClose()
      }
    }
    if (sheetRef.current) {
      sheetRef.current.style.transform = ''
      sheetRef.current.style.transition = ''
    }
    startY.current = null
    currentY.current = null
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-[70] bg-black/50 transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'fixed inset-x-0 bottom-0 z-[80] bg-white rounded-t-2xl shadow-2xl',
          'max-h-[90vh] flex flex-col',
          'transition-transform duration-300 ease-out',
          open ? 'translate-y-0' : 'translate-y-full'
        )}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <Separator />

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {children}
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const JobSiteDashboard: React.FC = () => {
  const router = useRouter()

  // Data state
  const [status, setStatus] = useState<ProjectStatusData | null>(null)
  const [punchStats, setPunchStats] = useState<PunchListStats | null>(null)
  const [coSummary, setCoSummary] = useState<ChangeOrderSummary | null>(null)
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [recentPunch, setRecentPunch] = useState<PunchListItem[]>([])
  const [recentComms, setRecentComms] = useState<CommunicationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Checklist state (localStorage, keyed by date)
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})

  // Bottom sheet state
  const [activeSheet, setActiveSheet] = useState<BottomSheetType>(null)

  // Punch form state
  const [punchDescription, setPunchDescription] = useState('')
  const [punchRoom, setPunchRoom] = useState('')
  const [punchSeverity, setPunchSeverity] = useState<PunchSeverity>('functional')
  const [punchNotes, setPunchNotes] = useState('')
  const [punchSubmitting, setPunchSubmitting] = useState(false)
  const [punchSuccess, setPunchSuccess] = useState(false)

  // Photo state
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoSuccess, setPhotoSuccess] = useState(false)

  // Daily log state
  const [dailyLogText, setDailyLogText] = useState('')
  const [dailyLogSubmitting, setDailyLogSubmitting] = useState(false)
  const [dailyLogSuccess, setDailyLogSuccess] = useState(false)

  // -------------------------------------------------------------------
  // Data Fetching
  // -------------------------------------------------------------------

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        const [statusRes, punchStatsRes, coRes, tasksRes, punchRecentRes] = await Promise.all([
          fetch('/api/project-status').then(r => r.json()),
          fetch('/api/punch-list?view=stats').then(r => r.json()),
          fetch('/api/change-orders?view=summary').then(r => r.json()),
          fetch('/api/tasks').then(r => r.json()),
          fetch('/api/punch-list?status=identified&status=assigned&status=in_progress').then(r => r.json()),
        ])

        if (statusRes.success && statusRes.data?.status) {
          setStatus(statusRes.data.status)
        }
        if (punchStatsRes.success) {
          setPunchStats(punchStatsRes.data)
        }
        if (coRes.success) {
          setCoSummary(coRes.data)
        }
        if (tasksRes.success && tasksRes.data?.tasks) {
          setTasks(tasksRes.data.tasks)
        }
        if (punchRecentRes.success && punchRecentRes.data?.items) {
          setRecentPunch(punchRecentRes.data.items.slice(0, 3))
        }
      } catch (err) {
        console.error('JobSiteDashboard: fetch error', err)
        setError('Could not load site data. Check your connection and try again.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Load checklist from localStorage on mount
  useEffect(() => {
    const saved = storage.get<Record<string, boolean>>(checklistKey(), {})
    setCheckedItems(saved)
  }, [])

  // -------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------

  function toggleChecklist(id: string) {
    setCheckedItems(prev => {
      const next = { ...prev, [id]: !prev[id] }
      storage.set(checklistKey(), next)
      return next
    })
  }

  async function submitPunchItem() {
    if (!punchDescription.trim()) return
    setPunchSubmitting(true)
    try {
      const res = await fetch('/api/punch-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: punchDescription.trim(),
          room: punchRoom || null,
          severity: punchSeverity,
          notes: punchNotes.trim() || null,
          source: 'owner',
        }),
      })
      const json = await res.json()
      if (json.success) {
        setPunchSuccess(true)
        setPunchDescription('')
        setPunchRoom('')
        setPunchSeverity('functional')
        setPunchNotes('')
        setTimeout(() => {
          setPunchSuccess(false)
          setActiveSheet(null)
          router.refresh()
        }, 1200)
      }
    } catch (err) {
      console.error('Punch item submit failed', err)
    } finally {
      setPunchSubmitting(false)
    }
  }

  async function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setPhotoUploading(true)
    try {
      const formData = new FormData()
      formData.append('photo', file)
      formData.append('type', 'progress')
      formData.append('caption', `Site visit photo ${new Date().toLocaleDateString()}`)

      const res = await fetch('/api/photos', {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()
      if (json.success) {
        setPhotoSuccess(true)
        setTimeout(() => {
          setPhotoSuccess(false)
          setActiveSheet(null)
          router.refresh()
        }, 1200)
      }
    } catch (err) {
      console.error('Photo upload failed', err)
    } finally {
      setPhotoUploading(false)
      // Reset the input so the same file can be re-selected
      if (photoInputRef.current) photoInputRef.current.value = ''
    }
  }

  async function submitDailyLog() {
    if (!dailyLogText.trim()) return
    setDailyLogSubmitting(true)
    try {
      // Try JobTread push first
      const res = await fetch('/api/jobtread/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'create_daily_log',
          label: `Daily log ${new Date().toLocaleDateString()}`,
          data: {
            date: new Date().toISOString().split('T')[0],
            notes: dailyLogText.trim(),
          },
        }),
      })
      const json = await res.json()

      if (json.success) {
        setDailyLogSuccess(true)
      } else {
        // Fallback: save to localStorage
        const existing = storage.get<string[]>('daily-logs-offline', [])
        existing.push(JSON.stringify({
          date: new Date().toISOString(),
          notes: dailyLogText.trim(),
        }))
        storage.set('daily-logs-offline', existing)
        setDailyLogSuccess(true)
      }

      setDailyLogText('')
      setTimeout(() => {
        setDailyLogSuccess(false)
        setActiveSheet(null)
      }, 1200)
    } catch {
      // Offline fallback
      const existing = storage.get<string[]>('daily-logs-offline', [])
      existing.push(JSON.stringify({
        date: new Date().toISOString(),
        notes: dailyLogText.trim(),
      }))
      storage.set('daily-logs-offline', existing)
      setDailyLogSuccess(true)
      setDailyLogText('')
      setTimeout(() => {
        setDailyLogSuccess(false)
        setActiveSheet(null)
      }, 1200)
    } finally {
      setDailyLogSubmitting(false)
    }
  }

  // -------------------------------------------------------------------
  // Derived
  // -------------------------------------------------------------------

  const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress')
  const checkedCount = DAILY_CHECKLIST.filter(c => checkedItems[c.id]).length
  const phase = status?.phase ?? 'Planning'
  const stepPct = status?.progressPercentage ?? 0
  const budgetUsed = status?.budgetUsed ?? 0
  const budgetTotal = status?.budgetTotal ?? 0

  // -------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6">
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
        <p className="text-base text-muted-foreground font-medium">Loading site data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <AlertTriangle className="w-10 h-10 text-destructive mb-4" />
        <p className="text-base font-semibold text-foreground mb-2">Something went wrong</p>
        <p className="text-sm text-muted-foreground mb-6">{error}</p>
        <Button onClick={() => window.location.reload()} size="lg" className="min-h-[48px]">
          Try Again
        </Button>
      </div>
    )
  }

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------

  return (
    <div className="pb-4">

      {/* =============================================================== */}
      {/* QUICK STATUS SECTION                                            */}
      {/* =============================================================== */}
      <section className="bg-gradient-to-b from-orange-600 to-orange-700 text-white px-5 pt-4 pb-5 -mt-1">
        {/* Address & Date */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-1.5 text-orange-200 text-sm mb-0.5">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>708 Purple Salvia Cove</span>
            </div>
            <div className="flex items-center gap-1.5 text-orange-200 text-sm">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span suppressHydrationWarning>{todayFormatted()}</span>
            </div>
          </div>
          {/* Weather placeholder */}
          <div className="flex items-center gap-1.5 bg-white/15 rounded-lg px-3 py-2">
            <Sun className="w-5 h-5 text-yellow-300" />
            <span className="text-sm font-semibold">Central TX</span>
          </div>
        </div>

        {/* Phase & Step */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-semibold text-orange-100">
              {phase}{status?.currentStep ? ` \u2014 ${status.currentStep}` : ''}
            </span>
            <span className="text-sm font-mono text-orange-200">
              {status?.stepNumber ?? 0}/{status?.totalSteps ?? 6}
            </span>
          </div>
          <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500 ease-out"
              style={{ width: `${stepPct}%` }}
            />
          </div>
        </div>

        {/* Budget bar */}
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-sm text-orange-100">Budget</span>
            <span className="text-sm font-mono">
              <span className={cn(
                'font-semibold',
                budgetUsed / (budgetTotal || 1) >= 0.9 ? 'text-red-300' : 'text-white'
              )}>
                {formatCurrency(budgetUsed)}
              </span>
              <span className="text-orange-200"> / {formatCurrency(budgetTotal)}</span>
            </span>
          </div>
          <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500 ease-out',
                budgetUsed / (budgetTotal || 1) < 0.75 ? 'bg-green-400'
                  : budgetUsed / (budgetTotal || 1) < 0.9 ? 'bg-yellow-400'
                    : 'bg-red-400'
              )}
              style={{ width: `${Math.min(100, budgetTotal > 0 ? (budgetUsed / budgetTotal) * 100 : 0)}%` }}
            />
          </div>
        </div>

        {/* Stat pills */}
        <div className="flex gap-2 mt-4">
          {punchStats && punchStats.total > 0 && (
            <div className="bg-white/15 rounded-lg px-3 py-1.5 text-center flex-1">
              <div className="text-lg font-bold leading-tight">{punchStats.total}</div>
              <div className="text-[11px] text-orange-200 leading-tight">Punch Items</div>
            </div>
          )}
          {coSummary && coSummary.pending > 0 && (
            <div className="bg-white/15 rounded-lg px-3 py-1.5 text-center flex-1">
              <div className="text-lg font-bold leading-tight">{coSummary.pending}</div>
              <div className="text-[11px] text-orange-200 leading-tight">Pending COs</div>
            </div>
          )}
          <div className="bg-white/15 rounded-lg px-3 py-1.5 text-center flex-1">
            <div className="text-lg font-bold leading-tight">{pendingTasks.length}</div>
            <div className="text-[11px] text-orange-200 leading-tight">Open Tasks</div>
          </div>
          <div className="bg-white/15 rounded-lg px-3 py-1.5 text-center flex-1">
            <div className="text-lg font-bold leading-tight">{checkedCount}/{DAILY_CHECKLIST.length}</div>
            <div className="text-[11px] text-orange-200 leading-tight">Checklist</div>
          </div>
        </div>
      </section>

      <div className="px-4 pt-4 space-y-5">

        {/* ============================================================= */}
        {/* QUICK ACTIONS GRID (2x2)                                       */}
        {/* ============================================================= */}
        <section aria-label="Quick Actions">
          <div className="grid grid-cols-2 gap-3">
            {/* Add Punch Item */}
            <button
              onClick={() => setActiveSheet('punch')}
              className={cn(
                'flex flex-col items-center justify-center gap-2 rounded-xl border-2',
                'bg-red-50 border-red-200 text-red-700',
                'min-h-[80px] p-4',
                'active:scale-[0.97] transition-transform duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2',
              )}
            >
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <ClipboardCheck className="w-5 h-5" />
              </div>
              <span className="text-sm font-semibold">Add Punch Item</span>
            </button>

            {/* Take Photo */}
            <button
              onClick={() => setActiveSheet('photo')}
              className={cn(
                'flex flex-col items-center justify-center gap-2 rounded-xl border-2',
                'bg-blue-50 border-blue-200 text-blue-700',
                'min-h-[80px] p-4',
                'active:scale-[0.97] transition-transform duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
              )}
            >
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Camera className="w-5 h-5" />
              </div>
              <span className="text-sm font-semibold">Take Photo</span>
            </button>

            {/* Daily Log */}
            <button
              onClick={() => setActiveSheet('daily-log')}
              className={cn(
                'flex flex-col items-center justify-center gap-2 rounded-xl border-2',
                'bg-green-50 border-green-200 text-green-700',
                'min-h-[80px] p-4',
                'active:scale-[0.97] transition-transform duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2',
              )}
            >
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <span className="text-sm font-semibold">Daily Log</span>
            </button>

            {/* View Tasks */}
            <button
              onClick={() => setActiveSheet('tasks')}
              className={cn(
                'flex flex-col items-center justify-center gap-2 rounded-xl border-2 relative',
                'bg-purple-50 border-purple-200 text-purple-700',
                'min-h-[80px] p-4',
                'active:scale-[0.97] transition-transform duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2',
              )}
            >
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <ListTodo className="w-5 h-5" />
              </div>
              <span className="text-sm font-semibold">View Tasks</span>
              {pendingTasks.length > 0 && (
                <span className="absolute top-2 right-2 min-w-[22px] h-[22px] rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center px-1">
                  {pendingTasks.length > 99 ? '99+' : pendingTasks.length}
                </span>
              )}
            </button>
          </div>
        </section>

        {/* ============================================================= */}
        {/* TODAY'S CHECKLIST                                               */}
        {/* ============================================================= */}
        <section>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  Today&apos;s Site Visit Checklist
                </span>
                <span className="text-sm font-mono text-muted-foreground">
                  {checkedCount}/{DAILY_CHECKLIST.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {/* Progress bar for checklist */}
              <Progress
                value={(checkedCount / DAILY_CHECKLIST.length) * 100}
                className={cn('h-1.5 mb-4', budgetBarColor(0, 1))}
              />

              <ul className="space-y-1" role="list">
                {DAILY_CHECKLIST.map(item => {
                  const checked = !!checkedItems[item.id]
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => toggleChecklist(item.id)}
                        className={cn(
                          'w-full flex items-start gap-3 rounded-lg px-3 py-2.5 text-left',
                          'min-h-[44px] transition-colors duration-150',
                          'active:bg-muted/80',
                          checked ? 'bg-green-50/60' : 'hover:bg-muted/50',
                        )}
                        role="checkbox"
                        aria-checked={checked}
                      >
                        <div className={cn(
                          'mt-0.5 w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center transition-all duration-200',
                          checked
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-gray-300 bg-white'
                        )}>
                          {checked && (
                            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <span className={cn(
                          'text-sm leading-snug transition-colors',
                          checked ? 'text-muted-foreground line-through' : 'text-foreground'
                        )}>
                          {item.label}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
        </section>

        {/* ============================================================= */}
        {/* RECENT ACTIVITY                                                */}
        {/* ============================================================= */}
        <section>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              {/* Punch items */}
              {recentPunch.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Punch List
                  </h4>
                  <div className="space-y-2">
                    {recentPunch.map(item => (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 rounded-lg border px-3 py-2.5"
                      >
                        <div className={cn(
                          'mt-0.5 w-2 h-2 rounded-full shrink-0',
                          item.severity === 'safety' ? 'bg-red-500'
                            : item.severity === 'structural' ? 'bg-orange-500'
                              : item.severity === 'functional' ? 'bg-yellow-500'
                                : 'bg-blue-500'
                        )} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground leading-snug truncate">
                            {item.description}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {item.severity}
                            </Badge>
                            {item.room && (
                              <span className="text-[11px] text-muted-foreground">{item.room}</span>
                            )}
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          {item.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tasks (recent 3) */}
              {pendingTasks.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Open Tasks
                  </h4>
                  <div className="space-y-2">
                    {pendingTasks.slice(0, 3).map(task => (
                      <div
                        key={task.id}
                        className="flex items-start gap-3 rounded-lg border px-3 py-2.5"
                      >
                        <div className={cn(
                          'mt-0.5 w-2 h-2 rounded-full shrink-0',
                          task.status === 'in_progress' ? 'bg-blue-500' : 'bg-yellow-500'
                        )} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground leading-snug truncate">{task.title}</p>
                          {task.due_date && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              Due {formatRelativeTime(task.due_date)}
                            </p>
                          )}
                        </div>
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          {task.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {recentPunch.length === 0 && pendingTasks.length === 0 && (
                <div className="text-center py-6">
                  <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">All clear. No open items right now.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      {/* =============================================================== */}
      {/* BOTTOM SHEETS                                                    */}
      {/* =============================================================== */}

      {/* --- Add Punch Item --- */}
      <BottomSheet
        open={activeSheet === 'punch'}
        onClose={() => setActiveSheet(null)}
        title="Add Punch Item"
      >
        {punchSuccess ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mb-3 animate-in zoom-in-50 duration-300">
              <CheckCircle2 className="w-7 h-7 text-green-600" />
            </div>
            <p className="text-base font-semibold text-foreground">Punch item saved</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Description (required) */}
            <div>
              <Label htmlFor="punch-desc" className="text-sm font-semibold mb-1.5 block">
                Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="punch-desc"
                value={punchDescription}
                onChange={e => setPunchDescription(e.target.value)}
                placeholder="Describe the issue..."
                className="min-h-[80px] text-base"
                autoFocus
              />
            </div>

            {/* Room */}
            <div>
              <Label htmlFor="punch-room" className="text-sm font-semibold mb-1.5 block">
                Room
              </Label>
              <div className="relative">
                <select
                  id="punch-room"
                  value={punchRoom}
                  onChange={e => setPunchRoom(e.target.value)}
                  className={cn(
                    'w-full appearance-none rounded-md border border-input bg-background',
                    'px-3 py-3 text-base pr-10',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    'min-h-[48px]',
                  )}
                >
                  <option value="">Select room (optional)</option>
                  {ROOMS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Severity (4 buttons) */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">Severity</Label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(SEVERITY_CONFIG) as PunchSeverity[]).map(sev => {
                  const cfg = SEVERITY_CONFIG[sev]
                  const isActive = punchSeverity === sev
                  return (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setPunchSeverity(sev)}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border-2 px-3 py-3',
                        'min-h-[48px] text-left transition-all duration-150',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        isActive ? cfg.activeColor : cfg.color,
                      )}
                    >
                      {cfg.icon}
                      <div className="min-w-0">
                        <div className="text-sm font-semibold leading-tight">{cfg.label}</div>
                        <div className={cn(
                          'text-[10px] leading-tight mt-0.5 truncate',
                          isActive ? 'text-white/80' : 'opacity-70'
                        )}>
                          {cfg.description}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="punch-notes" className="text-sm font-semibold mb-1.5 block">
                Notes
              </Label>
              <Textarea
                id="punch-notes"
                value={punchNotes}
                onChange={e => setPunchNotes(e.target.value)}
                placeholder="Additional notes (optional)"
                className="min-h-[60px] text-base"
              />
            </div>

            {/* Submit */}
            <Button
              onClick={submitPunchItem}
              disabled={!punchDescription.trim() || punchSubmitting}
              className="w-full min-h-[48px] text-base font-semibold"
              size="lg"
            >
              {punchSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Save Punch Item
                </>
              )}
            </Button>
          </div>
        )}
      </BottomSheet>

      {/* --- Take Photo --- */}
      <BottomSheet
        open={activeSheet === 'photo'}
        onClose={() => setActiveSheet(null)}
        title="Take Photo"
      >
        {photoSuccess ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mb-3 animate-in zoom-in-50 duration-300">
              <CheckCircle2 className="w-7 h-7 text-green-600" />
            </div>
            <p className="text-base font-semibold text-foreground">Photo uploaded</p>
          </div>
        ) : (
          <div className="flex flex-col items-center py-4 space-y-5">
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
              <Camera className="w-10 h-10 text-blue-600" />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-foreground mb-1">
                Progress Photo
              </p>
              <p className="text-sm text-muted-foreground max-w-[280px]">
                Open the camera to capture a progress photo.
                Use the same angles each visit for comparison.
              </p>
            </div>

            {/* Hidden file input that opens the native camera */}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoCapture}
              className="hidden"
              aria-label="Capture photo"
            />

            <Button
              onClick={() => photoInputRef.current?.click()}
              disabled={photoUploading}
              size="lg"
              className="w-full min-h-[52px] text-base font-semibold"
            >
              {photoUploading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Camera className="w-5 h-5 mr-2" />
                  Open Camera
                </>
              )}
            </Button>
          </div>
        )}
      </BottomSheet>

      {/* --- Daily Log --- */}
      <BottomSheet
        open={activeSheet === 'daily-log'}
        onClose={() => setActiveSheet(null)}
        title="Daily Log"
      >
        {dailyLogSuccess ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mb-3 animate-in zoom-in-50 duration-300">
              <CheckCircle2 className="w-7 h-7 text-green-600" />
            </div>
            <p className="text-base font-semibold text-foreground">Daily log saved</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <Label htmlFor="daily-log-text" className="text-sm font-semibold mb-1.5 block">
                Visit Notes
              </Label>
              <Textarea
                id="daily-log-text"
                value={dailyLogText}
                onChange={e => setDailyLogText(e.target.value)}
                placeholder="What happened on site today? Progress, issues, conversations with trades, material deliveries..."
                className="min-h-[140px] text-base"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Syncs to JobTread. If offline, saved locally and synced later.
              </p>
            </div>

            <Button
              onClick={submitDailyLog}
              disabled={!dailyLogText.trim() || dailyLogSubmitting}
              className="w-full min-h-[48px] text-base font-semibold"
              size="lg"
            >
              {dailyLogSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Save Daily Log
                </>
              )}
            </Button>
          </div>
        )}
      </BottomSheet>

      {/* --- View Tasks --- */}
      <BottomSheet
        open={activeSheet === 'tasks'}
        onClose={() => setActiveSheet(null)}
        title={`Tasks (${pendingTasks.length} open)`}
      >
        {pendingTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle2 className="w-10 h-10 text-green-500 mb-3" />
            <p className="text-base font-semibold text-foreground">No pending tasks</p>
            <p className="text-sm text-muted-foreground mt-1">Everything is on track.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pendingTasks.map(task => (
              <div
                key={task.id}
                className={cn(
                  'rounded-lg border px-4 py-3',
                  task.priority === 'high' || task.priority === 'urgent'
                    ? 'border-l-4 border-l-red-500'
                    : task.priority === 'medium'
                      ? 'border-l-4 border-l-yellow-500'
                      : '',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground leading-snug flex-1">
                    {task.title}
                  </p>
                  <Badge
                    variant={task.status === 'in_progress' ? 'default' : 'secondary'}
                    className="text-[10px] shrink-0"
                  >
                    {task.status.replace('_', ' ')}
                  </Badge>
                </div>
                {task.due_date && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Due {formatRelativeTime(task.due_date)}
                  </p>
                )}
                {task.notes && (
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                    {task.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </BottomSheet>
    </div>
  )
}

export default JobSiteDashboard
