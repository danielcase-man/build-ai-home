'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import {
  Menu,
  Home,
  Mail,
  BarChart3,
  ClipboardList,
  DollarSign,
  Gavel,
  MessageSquare,
  Grid3X3,
  Calendar,
  Landmark,
  ListChecks,
  Users,
  FileText,
  Receipt,
  ClipboardCheck,
  Shield,
  FolderOpen,
  PanelLeftClose,
  PanelLeft,
  History,
  LogOut,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useState, useEffect, useCallback, useMemo } from 'react'
import type { LucideIcon } from 'lucide-react'
import NotificationBell from '@/components/NotificationBell'
import GlobalSearch from '@/components/GlobalSearch'
import { useUserRole, type UserRole } from '@/components/UserRoleProvider'

// ─── Layout Constants ──────────────────────────────────────────────────────────
// Exported so layout.tsx can apply matching left margin to <main>
export const SIDEBAR_WIDTH_EXPANDED = 240
export const SIDEBAR_WIDTH_COLLAPSED = 64
export const TOPBAR_HEIGHT = 56

// ─── Nav Structure ─────────────────────────────────────────────────────────────

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  /** Roles that can see this item. If omitted, visible to all. */
  roles?: UserRole[]
}

interface NavSection {
  title: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { href: '/', label: 'Dashboard', icon: Home },
    ],
  },
  {
    title: 'Project',
    items: [
      { href: '/project-status', label: 'Project Status', icon: BarChart3, roles: ['owner', 'consultant'] },
      { href: '/assistant', label: 'Assistant', icon: MessageSquare, roles: ['owner', 'consultant'] },
      { href: '/timeline', label: 'Timeline', icon: Calendar, roles: ['owner', 'consultant'] },
      { href: '/emails', label: 'Emails', icon: Mail, roles: ['owner', 'consultant'] },
    ],
  },
  {
    title: 'Financial',
    items: [
      { href: '/budget', label: 'Budget', icon: DollarSign, roles: ['owner'] },
      { href: '/bids', label: 'Bids', icon: Gavel },
      { href: '/selections', label: 'Selections', icon: ClipboardList, roles: ['owner', 'consultant'] },
      { href: '/coverage', label: 'Coverage', icon: Grid3X3, roles: ['owner', 'consultant'] },
      { href: '/financing', label: 'Financing', icon: Landmark, roles: ['owner'] },
    ],
  },
  {
    title: 'Construction',
    items: [
      { href: '/vendors', label: 'Vendors', icon: Users, roles: ['owner', 'consultant'] },
      { href: '/documents', label: 'Documents', icon: FolderOpen },
      { href: '/change-orders', label: 'Change Orders', icon: FileText },
    ],
  },
]

/** Filter nav sections by user role */
function filterNavByRole(sections: NavSection[], role: UserRole | undefined): NavSection[] {
  if (!role) return sections // not loaded yet, show all (middleware will block)
  return sections
    .map(section => ({
      ...section,
      items: section.items.filter(item => !item.roles || item.roles.includes(role)),
    }))
    .filter(section => section.items.length > 0)
}

// Flat list — use filterNavByRole() for role-aware rendering
const allNavLinks = navSections.flatMap((s) => s.items)

// ─── localStorage key for collapsed state ──────────────────────────────────────
const STORAGE_KEY = 'framework-sidebar-collapsed'

function readCollapsed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function writeCollapsed(value: boolean): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, String(value))
  } catch {
    // silent
  }
}

// ─── Sidebar Nav Link ──────────────────────────────────────────────────────────

function SidebarLink({
  item,
  isActive,
  collapsed,
}: {
  item: NavItem
  isActive: boolean
  collapsed: boolean
}) {
  const Icon = item.icon

  const linkContent = (
    <Link
      href={item.href}
      className={cn(
        'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        isActive
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        collapsed && 'justify-center px-0'
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', isActive && 'text-primary')} />
      {!collapsed && (
        <span className="truncate">{item.label}</span>
      )}
    </Link>
  )

  // When collapsed, wrap each link in a tooltip so the label is visible on hover
  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          {linkContent}
        </TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          {item.label}
        </TooltipContent>
      </Tooltip>
    )
  }

  return linkContent
}

// ─── Desktop Sidebar ───────────────────────────────────────────────────────────

function DesktopSidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  const pathname = usePathname()
  const { user } = useUserRole()
  const filteredSections = useMemo(
    () => filterNavByRole(navSections, user?.role),
    [user?.role]
  )

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 hidden h-screen flex-col border-r bg-background md:flex',
        'transition-[width] duration-200 ease-in-out'
      )}
      style={{ width: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED }}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Brand area — vertically aligned with the top bar */}
      <div
        className="flex shrink-0 items-center border-b px-4"
        style={{ height: TOPBAR_HEIGHT }}
      >
        <Link href="/" className="flex items-center gap-2 overflow-hidden">
          <Image
            src="/favicon-32x32.png"
            alt="FrameWork"
            width={28}
            height={28}
            className="shrink-0 rounded"
          />
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight">
                <span className="text-orange-500">Frame</span>
                <span>Work</span>
              </p>
              <p className="truncate text-[11px] text-muted-foreground leading-tight">
                708 Purple Salvia Cove
              </p>
            </div>
          )}
        </Link>
      </div>

      {/* Scrollable nav sections */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        <TooltipProvider disableHoverableContent>
          {filteredSections.map((section, idx) => (
            <div key={section.title} className={cn(idx > 0 && 'mt-6')}>
              {/* Section header — hidden when collapsed, but keeps spacing */}
              {!collapsed ? (
                <h3 className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {section.title}
                </h3>
              ) : (
                // Thin divider line in collapsed mode (skip first section)
                idx > 0 && (
                  <div className="mx-auto mb-2 w-6 border-t border-border" />
                )
              )}
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => (
                  <SidebarLink
                    key={item.href}
                    item={item}
                    isActive={
                      item.href === '/'
                        ? pathname === '/'
                        : pathname.startsWith(item.href)
                    }
                    collapsed={collapsed}
                  />
                ))}
              </div>
            </div>
          ))}
        </TooltipProvider>
      </nav>

      {/* User info + sign out + collapse toggle */}
      <div className="shrink-0 border-t p-3 space-y-1">
        {/* Role badge */}
        {user && !collapsed && (
          <div className="flex items-center gap-2 px-3 py-1.5 mb-1">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{user.display_name}</p>
              <p className="truncate text-[10px] text-muted-foreground capitalize">{user.role}</p>
            </div>
          </div>
        )}
        <TooltipProvider disableHoverableContent>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'w-full justify-center text-muted-foreground hover:text-red-600',
                  !collapsed && 'justify-start gap-3 px-3'
                )}
                onClick={async () => {
                  await fetch('/api/auth/signout', { method: 'POST' })
                  window.location.href = '/login'
                }}
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
                {!collapsed && <span className="text-sm">Sign Out</span>}
              </Button>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent side="right">Sign Out</TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider disableHoverableContent>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'w-full justify-center text-muted-foreground hover:text-foreground',
                  !collapsed && 'justify-start gap-3 px-3'
                )}
                onClick={onToggle}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {collapsed ? (
                  <PanelLeft className="h-4 w-4" />
                ) : (
                  <>
                    <PanelLeftClose className="h-4 w-4" />
                    <span className="text-sm">Collapse</span>
                  </>
                )}
              </Button>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent side="right">Expand sidebar</TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>
    </aside>
  )
}

// ─── Top Bar ───────────────────────────────────────────────────────────────────
// Slim bar that sits above the main content area on desktop.
// Contains search + notifications. On mobile it also has the hamburger.

function TopBar({ sidebarWidth }: { sidebarWidth: number }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const { user } = useUserRole()
  const filteredSections = useMemo(
    () => filterNavByRole(navSections, user?.role),
    [user?.role]
  )

  return (
    <header
      className={cn(
        'sticky top-0 z-50 flex h-14 items-center border-b bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/60',
        'transition-[padding-left] duration-200 ease-in-out md:pl-[var(--sidebar-w)]'
      )}
      style={{ '--sidebar-w': `${sidebarWidth}px` } as React.CSSProperties}
    >
      <div className="flex w-full items-center justify-between px-4 md:px-6">
        {/* Mobile: brand + hamburger */}
        <div className="flex items-center gap-2 md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open navigation menu">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="border-b px-4 py-3">
                <SheetTitle className="flex items-center gap-2">
                  <Image
                    src="/favicon-32x32.png"
                    alt="FrameWork"
                    width={24}
                    height={24}
                    className="rounded"
                  />
                  <span>
                    <span className="text-orange-500">Frame</span>Work
                  </span>
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Main navigation menu
                </SheetDescription>
              </SheetHeader>
              <nav className="overflow-y-auto px-3 py-4">
                {filteredSections.map((section, idx) => (
                  <div key={section.title} className={cn(idx > 0 && 'mt-5')}>
                    <h3 className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      {section.title}
                    </h3>
                    <div className="flex flex-col gap-0.5">
                      {section.items.map((item) => {
                        const isActive =
                          item.href === '/'
                            ? pathname === '/'
                            : pathname.startsWith(item.href)
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                              'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              isActive
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                            )}
                          >
                            <item.icon className="h-4 w-4 shrink-0" />
                            {item.label}
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/favicon-32x32.png"
              alt="FrameWork"
              width={24}
              height={24}
              className="rounded"
            />
            <p className="text-sm font-bold leading-tight">
              <span className="text-orange-500">Frame</span>
              <span>Work</span>
            </p>
          </Link>
        </div>

        {/* Desktop: empty left side (brand is in sidebar) */}
        <div className="hidden md:block" />

        {/* Right: search + notifications */}
        <div className="flex items-center gap-1">
          <GlobalSearch />
          <NotificationBell />
        </div>
      </div>
    </header>
  )
}

// ─── Combined Navigation Export ────────────────────────────────────────────────

export default function Navigation() {
  // Hydration-safe: start collapsed=false, then read from localStorage after mount
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setCollapsed(readCollapsed())
    setMounted(true)
  }, [])

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      writeCollapsed(next)
      // Dispatch custom event so AppShell can sync its margin
      window.dispatchEvent(new Event('sidebar-toggle'))
      return next
    })
  }, [])

  // During SSR and first render, use the expanded width to avoid layout flash.
  // Once mounted, use the actual persisted value.
  const sidebarWidth = mounted
    ? collapsed
      ? SIDEBAR_WIDTH_COLLAPSED
      : SIDEBAR_WIDTH_EXPANDED
    : SIDEBAR_WIDTH_EXPANDED

  return (
    <>
      <DesktopSidebar collapsed={collapsed} onToggle={toggleCollapsed} />
      <TopBar sidebarWidth={sidebarWidth} />
    </>
  )
}

// Re-export for layout to use
export { navSections, allNavLinks }
export type { NavItem, NavSection }
