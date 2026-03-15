'use client'

import { useState, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { JobTreadPushItem, JobTreadPushItemType } from '@/types'

// ---------------------------------------------------------------------------
// Type grouping config — maps each push-item type to a display section
// ---------------------------------------------------------------------------

interface SectionConfig {
  heading: string
  /** "Push" for creates, "Sync" for updates */
  actionLabel: string
}

const SECTION_CONFIG: Record<JobTreadPushItemType, SectionConfig> = {
  create_task:      { heading: 'New Tasks',         actionLabel: 'Push' },
  update_task:      { heading: 'Task Updates',      actionLabel: 'Sync' },
  create_daily_log: { heading: 'New Daily Logs',    actionLabel: 'Push' },
  create_comment:   { heading: 'New Comments',      actionLabel: 'Push' },
  create_cost_item: { heading: 'New Budget Items',  actionLabel: 'Push' },
  update_cost_item: { heading: 'Budget Updates',    actionLabel: 'Sync' },
}

/** Display order for sections in the panel */
const SECTION_ORDER: JobTreadPushItemType[] = [
  'create_task',
  'update_task',
  'create_cost_item',
  'update_cost_item',
  'create_daily_log',
  'create_comment',
]

// ---------------------------------------------------------------------------
// Item status tracking
// ---------------------------------------------------------------------------

type ItemStatus = 'idle' | 'loading' | 'success' | 'error'

interface ItemState {
  status: ItemStatus
  error?: string
}

// ---------------------------------------------------------------------------
// Inline SVG Icons (no external dependency)
// ---------------------------------------------------------------------------

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" opacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" opacity="1" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function BoxIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface JobTreadPushPanelProps {
  items: JobTreadPushItem[]
}

export default function JobTreadPushPanel({ items: initialItems }: JobTreadPushPanelProps) {
  // Local copy so we can remove items on success
  const [items, setItems] = useState<JobTreadPushItem[]>(initialItems)
  // Track per-item status by a stable key (localId, jobtreadId, or label)
  const [itemStates, setItemStates] = useState<Record<string, ItemState>>({})
  // Refs for success-flash timeouts so we can clean up
  const timeoutRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  /** Stable key for each item — prefer localId, then jobtreadId, fall back to label */
  const getKey = useCallback((item: JobTreadPushItem): string => {
    return item.localId ?? item.jobtreadId ?? item.label
  }, [])

  const getState = useCallback(
    (item: JobTreadPushItem): ItemState => itemStates[getKey(item)] ?? { status: 'idle' },
    [itemStates, getKey]
  )

  const setStateFor = useCallback(
    (item: JobTreadPushItem, state: ItemState) => {
      setItemStates(prev => ({ ...prev, [getKey(item)]: state }))
    },
    [getKey]
  )

  // -------------------------------------------------------------------------
  // Push handler
  // -------------------------------------------------------------------------

  const handlePush = useCallback(
    async (item: JobTreadPushItem) => {
      const key = getKey(item)

      // Clear any pending timeout for this item
      if (timeoutRefs.current[key]) {
        clearTimeout(timeoutRefs.current[key])
      }

      setStateFor(item, { status: 'loading' })

      try {
        const res = await fetch('/api/jobtread/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
          throw new Error(body.error ?? body.message ?? `Request failed (${res.status})`)
        }

        // Show success state briefly, then remove
        setStateFor(item, { status: 'success' })

        timeoutRefs.current[key] = setTimeout(() => {
          setItems(prev => prev.filter(i => getKey(i) !== key))
          setItemStates(prev => {
            const next = { ...prev }
            delete next[key]
            return next
          })
          delete timeoutRefs.current[key]
        }, 900)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An unexpected error occurred'
        setStateFor(item, { status: 'error', error: message })
      }
    },
    [getKey, setStateFor]
  )

  // -------------------------------------------------------------------------
  // Group items by type, respecting SECTION_ORDER
  // -------------------------------------------------------------------------

  const grouped = SECTION_ORDER.reduce<{ type: JobTreadPushItemType; config: SectionConfig; items: JobTreadPushItem[] }[]>(
    (acc, type) => {
      const matching = items.filter(i => i.type === type)
      if (matching.length > 0) {
        acc.push({ type, config: SECTION_CONFIG[type], items: matching })
      }
      return acc
    },
    []
  )

  const allSynced = items.length === 0

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <section
      className="rounded-lg border border-border bg-white shadow-sm"
      aria-label="Push to JobTread"
    >
      {/* Panel Header */}
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
          <UploadIcon />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground leading-tight">
            Push to JobTread
          </h2>
          {!allSynced && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {items.length} item{items.length !== 1 ? 's' : ''} ready to sync
            </p>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        {allSynced ? (
          /* ---- All synced empty state ---- */
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-green-600 mb-2.5">
              <CheckIcon className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-foreground">All synced</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Everything is up to date with JobTread
            </p>
          </div>
        ) : (
          /* ---- Grouped item sections ---- */
          <div className="space-y-4">
            {grouped.map(({ type, config, items: sectionItems }) => (
              <div key={type}>
                {/* Section heading */}
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                  {config.heading}
                </h3>

                <ul className="space-y-1.5" role="list">
                  {sectionItems.map(item => {
                    const key = getKey(item)
                    const state = getState(item)
                    const isLoading = state.status === 'loading'
                    const isSuccess = state.status === 'success'
                    const isError = state.status === 'error'

                    return (
                      <li key={key}>
                        <div
                          className={cn(
                            'flex items-center gap-2 rounded-md border px-3 py-2 transition-colors duration-200',
                            isSuccess
                              ? 'border-green-300 bg-green-50'
                              : isError
                                ? 'border-red-200 bg-red-50/40'
                                : 'border-border bg-muted/30 hover:bg-muted/60'
                          )}
                        >
                          {/* Item icon */}
                          <div
                            className={cn(
                              'flex-shrink-0',
                              isSuccess ? 'text-green-600' : 'text-muted-foreground'
                            )}
                          >
                            {isSuccess ? <CheckIcon /> : <BoxIcon />}
                          </div>

                          {/* Label */}
                          <span
                            className={cn(
                              'min-w-0 flex-1 truncate text-sm',
                              isSuccess
                                ? 'text-green-700 font-medium'
                                : 'text-foreground'
                            )}
                            title={item.label}
                          >
                            {item.label}
                          </span>

                          {/* Action button */}
                          {!isSuccess && (
                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={() => handlePush(item)}
                              className={cn(
                                'inline-flex flex-shrink-0 items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors duration-150',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1',
                                isLoading
                                  ? 'cursor-not-allowed bg-indigo-100 text-indigo-400'
                                  : 'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800'
                              )}
                              aria-label={`${config.actionLabel} ${item.label}`}
                            >
                              {isLoading ? (
                                <>
                                  <SpinnerIcon className="h-3.5 w-3.5" />
                                  <span className="sr-only">Pushing...</span>
                                </>
                              ) : (
                                config.actionLabel
                              )}
                            </button>
                          )}
                        </div>

                        {/* Inline error message */}
                        {isError && state.error && (
                          <p
                            className="mt-1 ml-8 text-xs text-red-600 leading-snug"
                            role="alert"
                          >
                            {state.error}
                          </p>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
