"use client"

import React, { useState, useEffect } from 'react'
import {
  Home,
  CheckSquare,
  Users,
  MessageSquare,
  Settings,
  ArrowLeft,
  Menu,
  Wifi,
  WifiOff,
  Battery,
  AlertTriangle
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface MobileLayoutProps {
  children: React.ReactNode
  title?: string
  showBackButton?: boolean
  onBack?: () => void
}

const MobileLayout: React.FC<MobileLayoutProps> = ({
  children,
  title = "Job Site",
  showBackButton = false,
  onBack,
}) => {
  const pathname = usePathname()
  const [isOnline, setIsOnline] = useState(true)
  const [batteryLevel, setBatteryLevel] = useState(85)
  const [signalStrength, setSignalStrength] = useState(3)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showOfflineMessage, setShowOfflineMessage] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)

    const handleOnline = () => {
      setIsOnline(true)
      setShowOfflineMessage(false)
    }

    const handleOffline = () => {
      setIsOnline(false)
      setShowOfflineMessage(true)
      setTimeout(() => setShowOfflineMessage(false), 3000)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      clearInterval(timer)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const navigationItems = [
    { id: 'home', icon: Home, label: 'Home', path: '/mobile' },
    { id: 'tasks', icon: CheckSquare, label: 'Tasks', path: '/mobile/tasks' },
    { id: 'crew', icon: Users, label: 'Crew', path: '/mobile' },
    { id: 'messages', icon: MessageSquare, label: 'Messages', path: '/mobile' },
    { id: 'settings', icon: Settings, label: 'Settings', path: '/mobile' },
  ]

  const activeTab = pathname === '/mobile/tasks' ? 'tasks' : 'home'

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-100 overflow-hidden mobile-layout">
      {/* Status Bar */}
      <div className="bg-black text-white px-4 py-2 flex justify-between items-center text-sm shrink-0">
        <div className="flex items-center space-x-2">
          <span className="font-mono text-xs">{currentTime.toLocaleTimeString()}</span>
          <span className="text-xs bg-gray-800 px-2 py-0.5 rounded">
            {title}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          {/* Signal Strength */}
          <div className="flex items-end space-x-0.5">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className={`w-1 rounded-sm ${
                  i < signalStrength ? 'bg-white' : 'bg-gray-600'
                }`}
                style={{ height: `${(i + 1) * 3 + 4}px` }}
              />
            ))}
          </div>

          {/* WiFi Status */}
          {isOnline ? (
            <Wifi className="w-4 h-4" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-400" />
          )}

          {/* Battery */}
          <div className="flex items-center">
            <Battery className="w-4 h-4 mr-1" />
            <span className={`text-xs ${batteryLevel < 20 ? 'text-red-400' : ''}`}>
              {batteryLevel}%
            </span>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="bg-orange-600 text-white px-4 py-4 shrink-0">
        <div className="flex items-center justify-between">
          {showBackButton ? (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onBack}
              className="p-2 hover:bg-orange-700 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <ArrowLeft className="w-6 h-6" />
            </motion.button>
          ) : (
            <div className="w-10" />
          )}

          <h1 className="text-lg font-bold text-center flex-1">{title}</h1>

          <motion.button
            whileTap={{ scale: 0.95 }}
            className="p-2 hover:bg-orange-700 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <Menu className="w-6 h-6" />
          </motion.button>
        </div>
      </div>

      {/* Offline Message */}
      <AnimatePresence>
        {showOfflineMessage && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-red-500 text-white px-4 py-3 text-center text-sm font-semibold shrink-0 overflow-hidden"
          >
            <div className="flex items-center justify-center space-x-2">
              <WifiOff className="w-4 h-4" />
              <span>Working offline - changes will sync when connected</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content Area - scrollable */}
      <main className="flex-1 overflow-y-auto pb-4">
        {children}
      </main>

      {/* Emergency Button */}
      <div className="px-4 pb-2 shrink-0">
        <motion.button
          whileTap={{ scale: 0.95 }}
          className="w-full bg-red-600 text-white py-3 px-6 rounded-xl font-bold text-base shadow-lg flex items-center justify-center min-h-[44px]"
          style={{
            boxShadow: '0 8px 32px rgba(220, 38, 38, 0.3)',
            background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)'
          }}
        >
          <AlertTriangle className="w-5 h-5 mr-2" />
          EMERGENCY STOP
        </motion.button>
      </div>

      {/* Bottom Navigation */}
      <div className="bg-white border-t border-gray-200 px-2 py-2 shrink-0">
        <div className="flex justify-around">
          {navigationItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id

            return (
              <Link
                key={item.id}
                href={item.path}
                className={`
                  flex flex-col items-center justify-center py-2 px-3 rounded-lg
                  transition-all duration-200 min-w-[60px] min-h-[44px]
                  ${isActive
                    ? 'bg-blue-100 text-blue-600'
                    : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                  }
                `}
              >
                <Icon className="w-5 h-5 mb-1" />
                <span className="text-xs font-semibold">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Offline Indicator - persistent floating badge */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="fixed top-20 right-4 bg-orange-500 text-white p-3 rounded-full shadow-lg z-[60]"
          >
            <WifiOff className="w-5 h-5" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default MobileLayout
