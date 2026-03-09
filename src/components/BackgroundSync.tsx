'use client'

import { useEffect } from 'react'

const SYNC_INTERVAL_MS = 15 * 60 * 1000 // 15 minutes
const SESSION_KEY = 'bg-sync-last'

export default function BackgroundSync() {
  useEffect(() => {
    const lastSync = sessionStorage.getItem(SESSION_KEY)
    const now = Date.now()

    // Skip if we already triggered a sync recently in this session
    if (lastSync && now - Number(lastSync) < SYNC_INTERVAL_MS) {
      return
    }

    sessionStorage.setItem(SESSION_KEY, String(now))

    // Fire-and-forget — don't await, don't block rendering
    fetch('/api/emails/background-sync', { method: 'POST' }).catch(() => {
      // Silently ignore — background sync is best-effort
    })
  }, [])

  return null
}
