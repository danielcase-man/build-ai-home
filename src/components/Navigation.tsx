'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { Menu, Home, Mail, BarChart3, ClipboardList, DollarSign, Gavel, MessageSquare, Grid3X3, Calendar, Landmark, ListChecks, Users, FileText, Receipt, ClipboardCheck, Shield, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import NotificationBell from '@/components/NotificationBell'
import GlobalSearch from '@/components/GlobalSearch'

const navLinks = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/emails', label: 'Emails', icon: Mail },
  { href: '/budget', label: 'Budget', icon: DollarSign },
  { href: '/bids', label: 'Bids', icon: Gavel },
  { href: '/selections', label: 'Selections', icon: ClipboardList },
  { href: '/coverage', label: 'Coverage', icon: Grid3X3 },
  { href: '/timeline', label: 'Timeline', icon: Calendar },
  { href: '/workflow', label: 'Workflow', icon: ListChecks },
  { href: '/vendors', label: 'Vendors', icon: Users },
  { href: '/change-orders', label: 'Change Orders', icon: FileText },
  { href: '/documents', label: 'Documents', icon: FolderOpen },
  { href: '/financing', label: 'Financing', icon: Landmark },
  { href: '/payments', label: 'Payments', icon: Receipt },
  { href: '/punch-list', label: 'Punch List', icon: ClipboardCheck },
  { href: '/warranties', label: 'Warranties', icon: Shield },
  { href: '/project-status', label: 'Project Status', icon: BarChart3 },
  { href: '/assistant', label: 'Assistant', icon: MessageSquare },
]

export default function Navigation() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur-sm supports-[backdrop-filter]:bg-white/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Branding */}
        <Link href="/" className="flex items-center gap-2">
          <Image src="/favicon-32x32.png" alt="FrameWork" width={28} height={28} className="rounded" />
          <div className="hidden sm:block">
            <p className="text-sm font-bold leading-tight"><span className="text-orange-500">Frame</span><span>Work</span></p>
            <p className="text-xs text-muted-foreground leading-tight">708 Purple Salvia Cove</p>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  isActive
                    ? 'text-primary bg-primary/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            )
          })}
        </nav>

        {/* Search + Notifications + Mobile Nav */}
        <div className="flex items-center gap-1">
          <GlobalSearch />
          <NotificationBell />
          <div className="md:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open navigation menu">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <Image src="/favicon-32x32.png" alt="FrameWork" width={24} height={24} className="rounded" />
                    <span><span className="text-orange-500">Frame</span>Work</span>
                  </SheetTitle>
                  <SheetDescription className="sr-only">
                    Main navigation menu
                  </SheetDescription>
                </SheetHeader>
                <nav className="flex flex-col gap-1 mt-6">
                  {navLinks.map((link) => {
                    const isActive = pathname === link.href
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors',
                          isActive
                            ? 'text-primary bg-primary/10'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                        )}
                      >
                        <link.icon className="h-4 w-4" />
                        {link.label}
                      </Link>
                    )
                  })}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  )
}
