'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDistanceToNow } from 'date-fns'

interface Notification {
  id: string
  type: string
  priority: string
  title: string
  message: string | null
  created_at: string
  read_at: string | null
}

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/count')
      if (res.ok) {
        const json = await res.json()
        setUnreadCount(json.data?.unreadCount ?? 0)
      }
    } catch {
      // silent fail
    }
  }, [])

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) {
        const json = await res.json()
        setNotifications(json.data?.notifications ?? [])
      }
    } catch {
      // silent fail
    }
  }, [])

  // Poll count every 60 seconds
  useEffect(() => {
    fetchCount()
    const interval = setInterval(fetchCount, 60_000)
    return () => clearInterval(interval)
  }, [fetchCount])

  // Fetch full list when dropdown opens
  useEffect(() => {
    if (open) {
      fetchNotifications()
    }
  }, [open, fetchNotifications])

  const markAllRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      })
      setUnreadCount(0)
      setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })))
    } catch {
      // silent fail
    }
  }

  const markOneRead = async (id: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id }),
      })
      setUnreadCount(prev => Math.max(0, prev - 1))
      setNotifications(prev => prev.map(n =>
        n.id === id ? { ...n, read_at: new Date().toISOString() } : n
      ))
    } catch {
      // silent fail
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'border-l-red-500'
      case 'high': return 'border-l-orange-500'
      case 'medium': return 'border-l-blue-500'
      default: return 'border-l-gray-300'
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
          <span className="sr-only">
            {unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            No notifications yet
          </div>
        ) : (
          notifications.slice(0, 15).map((n) => (
            <DropdownMenuItem
              key={n.id}
              className={`flex flex-col items-start gap-1 px-3 py-2 border-l-2 cursor-pointer ${getPriorityColor(n.priority)} ${!n.read_at ? 'bg-blue-50/50' : ''}`}
              onClick={() => {
                if (!n.read_at) markOneRead(n.id)
              }}
            >
              <div className="flex items-center gap-2 w-full">
                <span className={`text-sm font-medium ${!n.read_at ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {n.title}
                </span>
                {!n.read_at && (
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                )}
              </div>
              {n.message && (
                <span className="text-xs text-muted-foreground line-clamp-2">{n.message}</span>
              )}
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
