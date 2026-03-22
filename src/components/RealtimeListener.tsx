'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { toast } from 'sonner'

// Client-side Supabase instance for Realtime subscriptions.
// Uses NEXT_PUBLIC_ env vars which are available in the browser.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Guard against missing env vars during build
const supabaseClient = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null

/**
 * RealtimeListener subscribes to Supabase Realtime channels for key tables.
 * When changes are detected, it shows toasts and triggers soft refreshes so
 * Server Components re-fetch fresh data.
 *
 * Mounted once in the AppShell — no props needed.
 */
export default function RealtimeListener() {
  const router = useRouter()
  const lastRefresh = useRef(0)

  // Debounced refresh — don't hammer the server if many changes arrive at once
  const softRefresh = (delay = 1000) => {
    const now = Date.now()
    if (now - lastRefresh.current < delay) return
    lastRefresh.current = now
    router.refresh()
  }

  useEffect(() => {
    if (!supabaseClient) return

    // ── Email channel ───────────────────────────────────────────────
    const emailChannel = supabaseClient
      .channel('realtime-emails')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'emails' },
        (payload) => {
          const subject = payload.new?.subject || 'New email'
          toast.info('New email synced', {
            description: subject,
            duration: 5000,
          })
          softRefresh()
        }
      )
      .subscribe()

    // ── Project status channel ──────────────────────────────────────
    const statusChannel = supabaseClient
      .channel('realtime-project-status')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'project_status' },
        () => {
          toast.info('Project status updated', {
            description: 'A new AI status report has been generated.',
            duration: 5000,
          })
          softRefresh()
        }
      )
      .subscribe()

    // ── Notifications channel ───────────────────────────────────────
    const notifChannel = supabaseClient
      .channel('realtime-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const title = payload.new?.title || 'New notification'
          toast(title, {
            description: payload.new?.message || undefined,
            duration: 6000,
          })
          // Dispatch event so NotificationBell can re-fetch immediately
          window.dispatchEvent(new Event('notification-update'))
          softRefresh()
        }
      )
      .subscribe()

    // ── Tasks channel ───────────────────────────────────────────────
    const taskChannel = supabaseClient
      .channel('realtime-tasks')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        () => {
          softRefresh(2000) // Quieter — no toast, just refresh
        }
      )
      .subscribe()

    // ── Budget items channel ────────────────────────────────────────
    const budgetChannel = supabaseClient
      .channel('realtime-budget')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budget_items' },
        () => {
          softRefresh(2000)
        }
      )
      .subscribe()

    // ── Communications channel (JobTread syncs, daily logs) ─────────
    const commsChannel = supabaseClient
      .channel('realtime-communications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'communications' },
        (payload) => {
          const type = payload.new?.type
          if (type === 'daily_log' || type === 'jobtread_comment') {
            toast.info('JobTread sync', {
              description: 'New data synced from JobTread.',
              duration: 4000,
            })
          }
          softRefresh()
        }
      )
      .subscribe()

    return () => {
      supabaseClient.removeChannel(emailChannel)
      supabaseClient.removeChannel(statusChannel)
      supabaseClient.removeChannel(notifChannel)
      supabaseClient.removeChannel(taskChannel)
      supabaseClient.removeChannel(budgetChannel)
      supabaseClient.removeChannel(commsChannel)
    }
  }, [router])

  return null
}
