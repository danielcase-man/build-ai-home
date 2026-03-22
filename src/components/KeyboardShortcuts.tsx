'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/**
 * Keyboard shortcut system for power-user navigation.
 *
 * Shortcuts:
 *   Cmd+K    → Global search (handled by GlobalSearch component)
 *   ?        → Show this help dialog
 *   G then D → Dashboard
 *   G then E → Emails
 *   G then B → Budget
 *   G then I → Bids
 *   G then S → Selections
 *   G then T → Timeline
 *   G then W → Workflow
 *   G then V → Vendors
 *   G then C → Change Orders
 *   G then F → Financing
 *   G then P → Payments
 *   G then L → Punch List
 *   G then R → Warranties
 *   G then O → Documents
 *   G then A → Assistant
 *   G then X → Project Status
 */

interface ShortcutGroup {
  title: string
  shortcuts: { keys: string; description: string }[]
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Global',
    shortcuts: [
      { keys: '⌘ K', description: 'Search' },
      { keys: '?', description: 'Keyboard shortcuts' },
      { keys: 'Esc', description: 'Close dialog' },
    ],
  },
  {
    title: 'Navigation (G then ...)',
    shortcuts: [
      { keys: 'G D', description: 'Dashboard' },
      { keys: 'G E', description: 'Emails' },
      { keys: 'G B', description: 'Budget' },
      { keys: 'G I', description: 'Bids' },
      { keys: 'G S', description: 'Selections' },
      { keys: 'G T', description: 'Timeline' },
      { keys: 'G W', description: 'Workflow' },
      { keys: 'G V', description: 'Vendors' },
      { keys: 'G C', description: 'Change Orders' },
      { keys: 'G O', description: 'Documents' },
      { keys: 'G F', description: 'Financing' },
      { keys: 'G P', description: 'Payments' },
      { keys: 'G L', description: 'Punch List' },
      { keys: 'G R', description: 'Warranties' },
      { keys: 'G X', description: 'Project Status' },
      { keys: 'G A', description: 'Assistant' },
    ],
  },
]

const GO_ROUTES: Record<string, string> = {
  d: '/',
  e: '/emails',
  b: '/budget',
  i: '/bids',
  s: '/selections',
  t: '/timeline',
  w: '/workflow',
  v: '/vendors',
  c: '/change-orders',
  o: '/documents',
  f: '/financing',
  p: '/payments',
  l: '/punch-list',
  r: '/warranties',
  x: '/project-status',
  a: '/assistant',
}

export default function KeyboardShortcuts() {
  const router = useRouter()
  const [helpOpen, setHelpOpen] = useState(false)
  const [waitingForGo, setWaitingForGo] = useState(false)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs, textareas, or contenteditable
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return
      }

      // ? → show help
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setHelpOpen(true)
        return
      }

      // G → start "go to" mode
      if (e.key === 'g' && !e.metaKey && !e.ctrlKey && !waitingForGo) {
        setWaitingForGo(true)
        // Auto-cancel after 1.5 seconds
        setTimeout(() => setWaitingForGo(false), 1500)
        return
      }

      // If in "go to" mode, check for destination key
      if (waitingForGo) {
        setWaitingForGo(false)
        const route = GO_ROUTES[e.key.toLowerCase()]
        if (route) {
          e.preventDefault()
          router.push(route)
        }
      }
    },
    [router, waitingForGo]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <>
      {/* "Go to" mode indicator */}
      {waitingForGo && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="bg-foreground text-background rounded-lg px-4 py-2 text-sm font-medium shadow-lg flex items-center gap-2">
            <kbd className="inline-flex h-5 items-center rounded border border-background/20 bg-background/10 px-1.5 text-xs font-mono">
              G
            </kbd>
            <span>Go to...</span>
            <span className="text-background/60 text-xs ml-1">press a letter</span>
          </div>
        </div>
      )}

      {/* Help dialog */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Keyboard Shortcuts</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 mt-2">
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.title}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {group.title}
                </h3>
                <div className="space-y-1.5">
                  {group.shortcuts.map((s) => (
                    <div
                      key={s.keys}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-muted-foreground">
                        {s.description}
                      </span>
                      <div className="flex items-center gap-1">
                        {s.keys.split(' ').map((key, i) => (
                          <span key={i}>
                            {i > 0 && (
                              <span className="text-muted-foreground/40 mx-0.5 text-xs">
                                then
                              </span>
                            )}
                            <kbd className="inline-flex h-6 min-w-[24px] items-center justify-center rounded border bg-muted px-1.5 text-xs font-mono font-medium">
                              {key}
                            </kbd>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4 pt-3 border-t">
            Press <kbd className="inline-flex h-5 items-center rounded border bg-muted px-1 text-[10px] font-mono mx-0.5">?</kbd> anywhere to show this help
          </p>
        </DialogContent>
      </Dialog>
    </>
  )
}
