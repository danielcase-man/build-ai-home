'use client'

import { useState, useEffect } from 'react'
import { Home, ClipboardCheck, ArrowLeft, Menu, WifiOff, X } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface MobileLayoutProps {
  children: React.ReactNode
  title?: string
  showBackButton?: boolean
  onBack?: () => void
}

const navItems = [
  { id: 'home', icon: Home, label: 'Site', path: '/mobile' },
  { id: 'tasks', icon: ClipboardCheck, label: 'Punch List', path: '/mobile/punch-list' },
]

export default function MobileLayout({
  children,
  title = 'Job Site',
  showBackButton = false,
  onBack,
}: MobileLayoutProps) {
  const pathname = usePathname()
  const [isOnline, setIsOnline] = useState(true)
  const [showOfflineBanner, setShowOfflineBanner] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setShowOfflineBanner(false)
    }
    const handleOffline = () => {
      setIsOnline(false)
      setShowOfflineBanner(true)
      setTimeout(() => setShowOfflineBanner(false), 5000)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="bg-orange-600 text-white px-4 py-3 shrink-0 safe-area-top">
        <div className="flex items-center justify-between">
          {showBackButton ? (
            <button
              onClick={onBack}
              className="p-2 -ml-2 rounded-lg active:bg-orange-700 min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <Link href="/" className="flex items-center gap-2">
              <Image src="/favicon-32x32.png" alt="FrameWork" width={24} height={24} className="rounded" />
              <span className="text-sm font-bold">
                <span className="text-orange-200">Frame</span>Work
              </span>
            </Link>
          )}
          <h1 className="text-base font-semibold">{title}</h1>
          <Link
            href="/"
            className="p-2 -mr-2 rounded-lg active:bg-orange-700 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <Menu className="h-5 w-5" />
          </Link>
        </div>
      </div>

      {/* Offline banner */}
      {showOfflineBanner && (
        <div className="bg-red-500 text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2 shrink-0 transition-all">
          <WifiOff className="h-4 w-4" />
          Working offline — changes will sync when connected
          <button onClick={() => setShowOfflineBanner(false)} className="ml-2">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Persistent offline indicator */}
      {!isOnline && !showOfflineBanner && (
        <div className="fixed top-16 right-3 bg-orange-500 text-white p-2 rounded-full shadow-lg z-[60]">
          <WifiOff className="h-4 w-4" />
        </div>
      )}

      {/* Content */}
      <main className="flex-1 overflow-y-auto overscroll-contain">
        {children}
      </main>

      {/* Bottom nav */}
      <div className="bg-white border-t px-4 py-2 shrink-0 safe-area-bottom">
        <div className="flex justify-around">
          {navItems.map((item) => {
            const isActive = pathname === item.path
            return (
              <Link
                key={item.id}
                href={item.path}
                className={cn(
                  'flex flex-col items-center justify-center py-2 px-6 rounded-lg min-h-[44px] transition-colors',
                  isActive
                    ? 'bg-orange-50 text-orange-600'
                    : 'text-gray-500 active:bg-gray-100'
                )}
              >
                <item.icon className="h-5 w-5 mb-0.5" />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
