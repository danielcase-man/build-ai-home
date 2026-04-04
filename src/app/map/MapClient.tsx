'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Mail, FolderSync, Brain, Database, Clock, Bot,
  ChevronDown, ChevronRight, ArrowRight, ExternalLink,
  LayoutDashboard, DollarSign, Users,
  Settings, Map, FileText, Zap, Server,
  CreditCard, Gavel, Shield, Wrench, ClipboardList,
  MessageSquare, BarChart3, CheckSquare, Upload,
  Activity, Landmark, Eye, Package,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ── Data Flow Pipeline ──────────────────────────────────────────────────────

interface PipelineSource {
  label: string
  icon: React.ReactNode
  color: string
  steps: string[]
}

const pipelines: PipelineSource[] = [
  {
    label: 'Gmail',
    icon: <Mail className="h-4 w-4" />,
    color: 'bg-red-500/10 text-red-400 border-red-500/30',
    steps: ['Email Sync', 'AI Analysis', 'Project Status'],
  },
  {
    label: 'Dropbox',
    icon: <FolderSync className="h-4 w-4" />,
    color: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    steps: ['File Watcher', 'Agent Router', 'Bid Extraction'],
  },
  {
    label: 'JobTread',
    icon: <Landmark className="h-4 w-4" />,
    color: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    steps: ['Pave Sync', 'Budget + Tasks'],
  },
  {
    label: 'Manual',
    icon: <Upload className="h-4 w-4" />,
    color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    steps: ['Upload', 'Intelligence Engine'],
  },
]

// ── Page Registry ───────────────────────────────────────────────────────────

interface PageEntry {
  path: string
  name: string
  description: string
  reads?: string
  calls?: string
  icon: React.ReactNode
}

interface PageGroup {
  title: string
  accent: string       // Tailwind border/bg color token
  accentDot: string    // dot color
  pages: PageEntry[]
}

const pageGroups: PageGroup[] = [
  {
    title: 'Command Center',
    accent: 'border-green-500/40 bg-green-500/5',
    accentDot: 'bg-green-500',
    pages: [
      {
        path: '/',
        name: 'Dashboard',
        description: 'Unified attention feed, quick stats, AI summary',
        reads: '11 data sources (milestones, budget, emails, tasks, bids, selections, vendors, permits, documents, communications, project_status)',
        calls: '/api/emails/*, /api/health, /api/project-status',
        icon: <LayoutDashboard className="h-4 w-4" />,
      },
      {
        path: '/project-status',
        name: 'Status Report',
        description: 'AI daily report, hot topics, action items',
        reads: 'project_status, milestones, budget, emails',
        calls: '/api/project-status/generate, /api/emails/send',
        icon: <BarChart3 className="h-4 w-4" />,
      },
      {
        path: '/assistant',
        name: 'AI Assistant',
        description: 'Chat with Claude about your project',
        calls: '/api/assistant/chat (SSE streaming)',
        icon: <Brain className="h-4 w-4" />,
      },
    ],
  },
  {
    title: 'Financial',
    accent: 'border-blue-500/40 bg-blue-500/5',
    accentDot: 'bg-blue-500',
    pages: [
      {
        path: '/budget',
        name: 'Budget',
        description: 'One row per trade: estimate, best bid, selected, actual',
        reads: 'budget_items, bids, selections',
        icon: <DollarSign className="h-4 w-4" />,
      },
      {
        path: '/bids',
        name: 'Bids',
        description: 'All vendor bids from PDFs and emails',
        calls: '/api/bids/upload, select-vendor, compare',
        icon: <Gavel className="h-4 w-4" />,
      },
      {
        path: '/selections',
        name: 'Selections',
        description: 'Three-zone decision queue (Decide, Locked, Future)',
        calls: '/api/selections/decision-queue, /api/bids/select-vendor',
        icon: <CheckSquare className="h-4 w-4" />,
      },
      {
        path: '/decisions',
        name: 'Decisions',
        description: 'Record decisions with cascading task/bid updates',
        calls: '/api/decisions',
        icon: <ClipboardList className="h-4 w-4" />,
      },
      {
        path: '/coverage',
        name: 'Coverage',
        description: 'Which trades have bids vs gaps',
        reads: 'bids, budget_items, selections',
        icon: <Eye className="h-4 w-4" />,
      },
      {
        path: '/financing',
        name: 'Financing',
        description: 'Construction loan tracking',
        reads: 'construction_loan',
        icon: <Landmark className="h-4 w-4" />,
      },
      {
        path: '/payments',
        name: 'Payments',
        description: 'Invoices, Plaid bank connections',
        calls: '/api/plaid/*, /api/transactions/*',
        icon: <CreditCard className="h-4 w-4" />,
      },
    ],
  },
  {
    title: 'Vendors & Communication',
    accent: 'border-purple-500/40 bg-purple-500/5',
    accentDot: 'bg-purple-500',
    pages: [
      {
        path: '/vendors',
        name: 'Vendors',
        description: 'Directory + communication timeline',
        reads: 'vendors, vendor_threads, follow_ups, bids',
        icon: <Users className="h-4 w-4" />,
      },
      {
        path: '/emails',
        name: 'Emails',
        description: 'Synced Gmail with AI summaries',
        calls: '/api/emails/fetch, /api/emails/send',
        icon: <MessageSquare className="h-4 w-4" />,
      },
    ],
  },
  {
    title: 'Construction',
    accent: 'border-orange-500/40 bg-orange-500/5',
    accentDot: 'bg-orange-500',
    pages: [
      {
        path: '/timeline',
        name: 'Timeline',
        description: 'Milestone Gantt chart',
        reads: 'milestones, tasks',
        icon: <Activity className="h-4 w-4" />,
      },
      {
        path: '/workflow',
        name: 'Workflow',
        description: 'UBuildIt 6-step planning phase',
        calls: '/api/workflow/update-item',
        icon: <Package className="h-4 w-4" />,
      },
      {
        path: '/documents',
        name: 'Documents',
        description: 'Plans, contracts, uploads',
        calls: '/api/upload, /api/documents/analyze',
        icon: <FileText className="h-4 w-4" />,
      },
      {
        path: '/punch-list',
        name: 'Punch List',
        description: 'Deficiency tracking',
        icon: <ClipboardList className="h-4 w-4" />,
      },
      {
        path: '/warranties',
        name: 'Warranties',
        description: 'Warranty & compliance tracking',
        icon: <Shield className="h-4 w-4" />,
      },
      {
        path: '/change-orders',
        name: 'Change Orders',
        description: 'Scope changes with cost impact',
        icon: <Wrench className="h-4 w-4" />,
      },
    ],
  },
  {
    title: 'System',
    accent: 'border-gray-500/40 bg-gray-500/5',
    accentDot: 'bg-gray-400',
    pages: [
      {
        path: '/audit',
        name: 'Audit Trail',
        description: 'Activity log across all modules',
        icon: <Settings className="h-4 w-4" />,
      },
      {
        path: '/map',
        name: 'Architecture Map',
        description: 'You are here',
        icon: <Map className="h-4 w-4" />,
      },
    ],
  },
]

// ── Cron + Agents Data ──────────────────────────────────────────────────────

const cronSchedule = [
  { time: '7:00 AM', label: 'Orchestrator', desc: 'Triggers intelligence pipeline' },
  { time: '7:55 AM', label: 'JobTread Sync', desc: 'Budget, tasks, docs from Pave API' },
  { time: '8:00 AM', label: 'Email Sync', desc: 'Gmail fetch + AI summarization' },
  { time: '8:30 AM', label: 'Intelligence', desc: 'Agent router + domain processing' },
  { time: '5:00 PM', label: 'Daily Status', desc: 'AI project status snapshot' },
]

const agents = [
  'Bid Analysis', 'Takeoff', 'Financial', 'Contract',
  'Scheduling', 'Follow-up', 'Data Integrity',
]

// ── Subcomponents ───────────────────────────────────────────────────────────

function PipelineRow({ source }: { source: PipelineSource }) {
  return (
    <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
      {/* Source node */}
      <div className={cn(
        'flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium shrink-0',
        source.color
      )}>
        {source.icon}
        {source.label}
      </div>

      {/* Steps with arrows */}
      {source.steps.map((step, i) => (
        <div key={step} className="flex items-center gap-2 sm:gap-3">
          <ArrowRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
          <div className={cn(
            'rounded-md border border-border/60 bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground shrink-0',
            i === source.steps.length - 1 && 'font-medium text-foreground/80'
          )}>
            {step}
          </div>
        </div>
      ))}
    </div>
  )
}

function PageCard({ page, accentDot }: { page: PageEntry; accentDot: string }) {
  const [open, setOpen] = useState(false)
  const isHere = page.path === '/map'

  return (
    <button
      onClick={() => setOpen(!open)}
      className={cn(
        'w-full text-left rounded-lg border border-border/50 px-3 py-2.5 transition-colors',
        'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        open && 'bg-muted/30',
        isHere && 'ring-1 ring-primary/40'
      )}
      aria-expanded={open}
    >
      {/* Collapsed row */}
      <div className="flex items-center gap-2.5">
        <span className={cn('h-2 w-2 rounded-full shrink-0', accentDot)} />
        <span className="text-muted-foreground">{page.icon}</span>
        <span className="font-medium text-sm">{page.name}</span>
        <span className="text-xs text-muted-foreground hidden sm:inline">
          -- {page.description}
        </span>
        {isHere && (
          <Badge variant="outline" className="ml-auto text-[10px] py-0 border-primary/40 text-primary">
            You are here
          </Badge>
        )}
        <span className="ml-auto sm:ml-0">
          {open
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        </span>
      </div>

      {/* Mobile description (visible on small screens only when collapsed) */}
      {!open && (
        <p className="text-xs text-muted-foreground mt-1 sm:hidden">{page.description}</p>
      )}

      {/* Expanded detail */}
      {open && (
        <div className="mt-2.5 pl-[18px] space-y-1.5 text-xs" onClick={(e) => e.stopPropagation()}>
          <p className="text-muted-foreground sm:hidden">{page.description}</p>
          {page.reads && (
            <p>
              <span className="font-medium text-muted-foreground">Reads: </span>
              <span className="font-mono text-[11px] text-foreground/70">{page.reads}</span>
            </p>
          )}
          {page.calls && (
            <p>
              <span className="font-medium text-muted-foreground">Calls: </span>
              <span className="font-mono text-[11px] text-foreground/70">{page.calls}</span>
            </p>
          )}
          {!isHere && (
            <Link
              href={page.path}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline mt-1"
            >
              Go <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
      )}
    </button>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function MapClient() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-secondary text-secondary-foreground">
        <div className="container max-w-6xl mx-auto px-4 py-5 sm:py-6">
          <div className="flex items-center gap-3">
            <Map className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-lg sm:text-xl font-semibold tracking-tight">
                FrameWork Architecture Map
              </h1>
              <p className="text-xs sm:text-sm text-secondary-foreground/60 mt-0.5">
                How data flows through your build management system
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl mx-auto px-4 py-6 sm:py-8 space-y-8 sm:space-y-10">

        {/* ── Section 1: Data Flow Pipeline ────────────────────────────── */}
        <section aria-labelledby="pipeline-heading">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-primary" />
            <h2 id="pipeline-heading" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Data Flow Pipeline
            </h2>
          </div>

          <Card>
            <CardContent className="p-4 sm:p-5 space-y-3">
              {pipelines.map((p) => (
                <PipelineRow key={p.label} source={p} />
              ))}
            </CardContent>
          </Card>
        </section>

        {/* ── Section 2: App Pages ─────────────────────────────────────── */}
        <section aria-labelledby="pages-heading">
          <div className="flex items-center gap-2 mb-4">
            <LayoutDashboard className="h-4 w-4 text-primary" />
            <h2 id="pages-heading" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              App Pages
            </h2>
            <Badge variant="outline" className="text-[10px] ml-1">
              {pageGroups.reduce((sum, g) => sum + g.pages.length, 0)} pages
            </Badge>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {pageGroups.map((group) => (
              <Card key={group.title} className={cn('border', group.accent)}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={cn('h-2.5 w-2.5 rounded-full', group.accentDot)} />
                    <h3 className="text-sm font-semibold">{group.title}</h3>
                    <span className="text-xs text-muted-foreground">
                      ({group.pages.length})
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {group.pages.map((page) => (
                      <PageCard
                        key={page.path}
                        page={page}
                        accentDot={group.accentDot}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* ── Section 3: Behind the Scenes ─────────────────────────────── */}
        <section aria-labelledby="system-heading">
          <div className="flex items-center gap-2 mb-4">
            <Server className="h-4 w-4 text-primary" />
            <h2 id="system-heading" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Behind the Scenes
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Cron Schedule */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Daily Cron</h3>
                </div>
                <div className="space-y-2">
                  {cronSchedule.map((job) => (
                    <div key={job.time} className="flex gap-2.5 text-xs">
                      <span className="font-mono text-muted-foreground w-16 shrink-0 tabular-nums">
                        {job.time}
                      </span>
                      <div>
                        <span className="font-medium">{job.label}</span>
                        <span className="text-muted-foreground"> -- {job.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Intelligence Agents */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Bot className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Intelligence Agents</h3>
                  <Badge variant="outline" className="text-[10px]">7</Badge>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {agents.map((a) => (
                    <span
                      key={a}
                      className="rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-xs text-muted-foreground"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* System Stats */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">System Scale</h3>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">API Endpoints</span>
                    <span className="font-mono font-medium tabular-nums">97 across 44 domains</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Database Tables</span>
                    <span className="font-mono font-medium tabular-nums">20+ Supabase</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">AI Model</span>
                    <span className="font-mono font-medium tabular-nums">Claude Sonnet 4.6</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Integrations</span>
                    <span className="font-mono font-medium tabular-nums">Gmail, Dropbox, JobTread, Plaid</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Footer nav */}
        <div className="flex justify-center pb-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/" className="gap-1.5">
              <LayoutDashboard className="h-3.5 w-3.5" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
      </main>
    </div>
  )
}
