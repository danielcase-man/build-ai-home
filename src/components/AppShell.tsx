'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Navigation from '@/components/Navigation'
import { SIDEBAR_WIDTH_EXPANDED, SIDEBAR_WIDTH_COLLAPSED } from '@/components/Navigation'
import RealtimeListener from '@/components/RealtimeListener'
import KeyboardShortcuts from '@/components/KeyboardShortcuts'
import BackgroundSync from '@/components/BackgroundSync'

// Routes that render WITHOUT the app shell (no sidebar, no nav)
const SHELL_EXCLUDED_ROUTES = ['/login', '/register', '/invite/']

function isShellExcluded(pathname: string): boolean {
  return SHELL_EXCLUDED_ROUTES.some(route => pathname.startsWith(route))
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('framework-sidebar-collapsed') === 'true')
    } catch {
      // silent
    }
    setMounted(true)

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'framework-sidebar-collapsed') {
        setCollapsed(e.newValue === 'true')
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

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

  // Public pages (login, register, invite) render without the shell
  if (isShellExcluded(pathname)) {
    return <>{children}</>
  }

  const sidebarWidth = mounted
    ? collapsed
      ? SIDEBAR_WIDTH_COLLAPSED
      : SIDEBAR_WIDTH_EXPANDED
    : SIDEBAR_WIDTH_EXPANDED

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <RealtimeListener />
      <KeyboardShortcuts />
      <BackgroundSync />
      <main
        className="flex-1 transition-[margin-left] duration-200 ease-in-out md:ml-[var(--sidebar-w)]"
        style={{ '--sidebar-w': `${sidebarWidth}px` } as React.CSSProperties}
      >
        {children}
      </main>
    </div>
  )
}
