'use client'

import { useState, useEffect } from 'react'
import Navigation from '@/components/Navigation'
import { SIDEBAR_WIDTH_EXPANDED, SIDEBAR_WIDTH_COLLAPSED } from '@/components/Navigation'
import RealtimeListener from '@/components/RealtimeListener'

/**
 * AppShell wraps the sidebar + top bar + main content area.
 * It lives in the root layout and manages the sidebar collapsed state
 * so that <main> shifts its left margin in sync with the sidebar width.
 *
 * Children (server components) are passed through as props and remain
 * server-rendered -- wrapping them in a client component boundary is fine
 * because React serializes them as an opaque slot.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Read persisted sidebar state
    try {
      setCollapsed(localStorage.getItem('framework-sidebar-collapsed') === 'true')
    } catch {
      // silent
    }
    setMounted(true)

    // Listen for storage changes from the Navigation component
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'framework-sidebar-collapsed') {
        setCollapsed(e.newValue === 'true')
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Listen for custom event dispatched by Navigation toggle (same-tab)
  useEffect(() => {
    const handler = () => {
      try {
        setCollapsed(localStorage.getItem('framework-sidebar-collapsed') === 'true')
      } catch {
        // silent
      }
    }
    window.addEventListener('sidebar-toggle', handler)
    return () => window.removeEventListener('sidebar-toggle', handler)
  }, [])

  // Default to expanded width during SSR to match the Navigation default
  const sidebarWidth = mounted
    ? collapsed
      ? SIDEBAR_WIDTH_COLLAPSED
      : SIDEBAR_WIDTH_EXPANDED
    : SIDEBAR_WIDTH_EXPANDED

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <RealtimeListener />
      <main
        className="flex-1 transition-[margin-left] duration-200 ease-in-out md:ml-[var(--sidebar-w)]"
        style={{ '--sidebar-w': `${sidebarWidth}px` } as React.CSSProperties}
      >
        {children}
      </main>
    </div>
  )
}
