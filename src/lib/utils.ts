import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

// ─── Core Utilities (existing) ───────────────────────────────────────────────

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

export function formatDate(
  date: Date | string,
  format: 'short' | 'medium' | 'long' | 'relative' = 'long'
): string {
  const d = new Date(date)

  if (format === 'relative') {
    return formatRelativeTime(d)
  }

  const options: Record<string, Intl.DateTimeFormatOptions> = {
    short: { month: 'numeric', day: 'numeric', year: '2-digit' },
    medium: { month: 'short', day: 'numeric', year: 'numeric' },
    long: { month: 'long', day: 'numeric', year: 'numeric' },
  }

  return new Intl.DateTimeFormat('en-US', options[format]).format(d)
}

export function getDaysRemaining(startDate: Date, totalDays: number): number {
  const today = new Date()
  const start = new Date(startDate)
  const daysElapsed = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(0, totalDays - daysElapsed)
}

export function getProgressPercentage(current: number, total: number): number {
  return Math.round((current / total) * 100)
}

// ─── Accessibility (a11y) Namespace ──────────────────────────────────────────

export const a11y = {
  announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    if (typeof document === 'undefined') return

    const id = `aria-live-${priority}`
    let el = document.getElementById(id)

    if (!el) {
      el = document.createElement('div')
      el.id = id
      el.setAttribute('aria-live', priority)
      el.setAttribute('aria-atomic', 'true')
      el.setAttribute('role', priority === 'assertive' ? 'alert' : 'status')
      Object.assign(el.style, {
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: '0',
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: '0',
      })
      document.body.appendChild(el)
    }

    // Clear then set to trigger re-announcement
    el.textContent = ''
    requestAnimationFrame(() => {
      el!.textContent = message
    })
  },

  getAriaLabel(context: string, value: string | number, unit?: string): string {
    return unit ? `${context}: ${value} ${unit}` : `${context}: ${value}`
  },

  trapFocus(container: HTMLElement): () => void {
    const focusableSelectors = [
      'a[href]', 'button:not([disabled])', 'textarea:not([disabled])',
      'input:not([disabled])', 'select:not([disabled])', '[tabindex]:not([tabindex="-1"])',
    ]
    const focusableElements = container.querySelectorAll<HTMLElement>(focusableSelectors.join(', '))
    const firstFocusable = focusableElements[0]
    const lastFocusable = focusableElements[focusableElements.length - 1]

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          lastFocusable?.focus()
          e.preventDefault()
        }
      } else {
        if (document.activeElement === lastFocusable) {
          firstFocusable?.focus()
          e.preventDefault()
        }
      }
    }

    container.addEventListener('keydown', handleKeyDown)
    firstFocusable?.focus()

    return () => container.removeEventListener('keydown', handleKeyDown)
  },

  checkContrast(foreground: string, background: string): {
    ratio: number
    aa: boolean
    aaa: boolean
    aaLarge: boolean
  } {
    const getLuminance = (hex: string): number => {
      const rgb = hex.replace('#', '').match(/.{2}/g)?.map(c => {
        const val = parseInt(c, 16) / 255
        return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4)
      }) ?? [0, 0, 0]
      return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
    }

    const l1 = getLuminance(foreground)
    const l2 = getLuminance(background)
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)

    return {
      ratio: Math.round(ratio * 100) / 100,
      aa: ratio >= 4.5,
      aaa: ratio >= 7,
      aaLarge: ratio >= 3,
    }
  },

  getReducedMotion(): boolean {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  },

  getPreferredColorScheme(): 'light' | 'dark' {
    if (typeof window === 'undefined') return 'light'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  },

  generateId(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
  },
}

// ─── Construction Namespace ──────────────────────────────────────────────────

export const construction = {
  getStatusColor(
    status: string,
    highContrast = false
  ): { bg: string; text: string; border: string; dot: string } {
    const colors: Record<string, { bg: string; text: string; border: string; dot: string }> = {
      completed: {
        bg: highContrast ? 'bg-green-100 dark:bg-green-950' : 'bg-green-50 dark:bg-green-950/50',
        text: 'text-green-800 dark:text-green-200',
        border: 'border-green-300 dark:border-green-700',
        dot: 'bg-green-500',
      },
      'in-progress': {
        bg: highContrast ? 'bg-blue-100 dark:bg-blue-950' : 'bg-blue-50 dark:bg-blue-950/50',
        text: 'text-blue-800 dark:text-blue-200',
        border: 'border-blue-300 dark:border-blue-700',
        dot: 'bg-blue-500',
      },
      in_progress: {
        bg: highContrast ? 'bg-blue-100 dark:bg-blue-950' : 'bg-blue-50 dark:bg-blue-950/50',
        text: 'text-blue-800 dark:text-blue-200',
        border: 'border-blue-300 dark:border-blue-700',
        dot: 'bg-blue-500',
      },
      pending: {
        bg: highContrast ? 'bg-yellow-100 dark:bg-yellow-950' : 'bg-yellow-50 dark:bg-yellow-950/50',
        text: 'text-yellow-800 dark:text-yellow-200',
        border: 'border-yellow-300 dark:border-yellow-700',
        dot: 'bg-yellow-500',
      },
      delayed: {
        bg: highContrast ? 'bg-red-100 dark:bg-red-950' : 'bg-red-50 dark:bg-red-950/50',
        text: 'text-red-800 dark:text-red-200',
        border: 'border-red-300 dark:border-red-700',
        dot: 'bg-red-500',
      },
      blocked: {
        bg: highContrast ? 'bg-red-100 dark:bg-red-950' : 'bg-red-50 dark:bg-red-950/50',
        text: 'text-red-800 dark:text-red-200',
        border: 'border-red-300 dark:border-red-700',
        dot: 'bg-red-600',
      },
      'not-started': {
        bg: highContrast ? 'bg-gray-100 dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-900/50',
        text: 'text-gray-600 dark:text-gray-400',
        border: 'border-gray-300 dark:border-gray-700',
        dot: 'bg-gray-400',
      },
      not_started: {
        bg: highContrast ? 'bg-gray-100 dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-900/50',
        text: 'text-gray-600 dark:text-gray-400',
        border: 'border-gray-300 dark:border-gray-700',
        dot: 'bg-gray-400',
      },
    }

    return colors[status.toLowerCase()] ?? colors['not-started']
  },

  getPhaseIcon(phase: string): string {
    const icons: Record<string, string> = {
      planning: '📋',
      'site-prep': '🏗️',
      foundation: '🧱',
      framing: '🪵',
      roofing: '🏠',
      mechanical: '⚡',
      insulation: '🧤',
      drywall: '🪨',
      interior: '🎨',
      exterior: '🏡',
      landscaping: '🌳',
      'final-inspection': '✅',
    }
    return icons[phase.toLowerCase()] ?? '📌'
  },

  getPhaseLabel(phase: string): string {
    const labels: Record<string, string> = {
      planning: 'Planning & Design',
      'site-prep': 'Site Preparation',
      foundation: 'Foundation',
      framing: 'Framing',
      roofing: 'Roofing',
      mechanical: 'Mechanical (HVAC/Plumbing/Electrical)',
      insulation: 'Insulation',
      drywall: 'Drywall',
      interior: 'Interior Finishes',
      exterior: 'Exterior Finishes',
      landscaping: 'Landscaping',
      'final-inspection': 'Final Inspection',
    }
    return labels[phase.toLowerCase()] ?? phase
  },

  formatCurrency(amount: number, screenReader = false): string {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)

    if (screenReader) {
      const abs = Math.abs(amount)
      const dollars = Math.floor(abs)
      return `${amount < 0 ? 'negative ' : ''}${dollars} dollars`
    }
    return formatted
  },

  validateField(
    value: string,
    rules: { required?: boolean; minLength?: number; maxLength?: number; pattern?: RegExp }
  ): { valid: boolean; error?: string } {
    if (rules.required && !value.trim()) {
      return { valid: false, error: 'This field is required' }
    }
    if (rules.minLength && value.length < rules.minLength) {
      return { valid: false, error: `Minimum ${rules.minLength} characters required` }
    }
    if (rules.maxLength && value.length > rules.maxLength) {
      return { valid: false, error: `Maximum ${rules.maxLength} characters allowed` }
    }
    if (rules.pattern && !rules.pattern.test(value)) {
      return { valid: false, error: 'Invalid format' }
    }
    return { valid: true }
  },
}

// ─── Standalone Utility Functions ────────────────────────────────────────────

export function formatRelativeTime(date: Date | string): string {
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)
  const diffWeek = Math.floor(diffDay / 7)
  const diffMonth = Math.floor(diffDay / 30)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`
  if (diffDay < 7) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`
  if (diffWeek < 4) return `${diffWeek} week${diffWeek !== 1 ? 's' : ''} ago`
  return `${diffMonth} month${diffMonth !== 1 ? 's' : ''} ago`
}

export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0
  return Math.min(100, Math.max(0, (value / total) * 100))
}

export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function generateColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash % 360)
  return `hsl(${hue}, 65%, 45%)`
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args)
      inThrottle = true
      setTimeout(() => { inThrottle = false }, limit)
    }
  }
}

export function deepClone<T>(obj: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(obj)
  }
  return JSON.parse(JSON.stringify(obj))
}

export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  return digits.length === 10 || digits.length === 11
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11) {
    return `+${digits[0]} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return phone
}

export function calculateBusinessDays(startDate: Date, endDate: Date): number {
  let count = 0
  const current = new Date(startDate)
  while (current <= endDate) {
    const dayOfWeek = current.getDay()
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++
    }
    current.setDate(current.getDate() + 1)
  }
  return count
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    completed: 'text-green-600',
    'in-progress': 'text-blue-600',
    in_progress: 'text-blue-600',
    pending: 'text-yellow-600',
    delayed: 'text-red-600',
    blocked: 'text-red-700',
    cancelled: 'text-gray-500',
    'not-started': 'text-gray-400',
    not_started: 'text-gray-400',
  }
  return colors[status.toLowerCase()] ?? 'text-gray-500'
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + '...'
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function isEmpty(value: unknown): boolean {
  if (value == null) return true
  if (typeof value === 'string') return value.trim().length === 0
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value).length === 0
  return false
}

export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}

export function downloadFile(content: string | Blob, filename: string, mimeType = 'text/plain'): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      document.execCommand('copy')
      return true
    } catch {
      return false
    } finally {
      document.body.removeChild(textarea)
    }
  }
}

// ─── Performance Timer (dev/debug) ───────────────────────────────────────────

export class PerformanceTimer {
  private marks = new Map<string, number>()

  start(label: string): void {
    this.marks.set(label, performance.now())
  }

  end(label: string): number {
    const start = this.marks.get(label)
    if (!start) return 0
    const duration = performance.now() - start
    this.marks.delete(label)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Timer] ${label}: ${duration.toFixed(2)}ms`)
    }
    return duration
  }
}

// ─── Storage Namespace ───────────────────────────────────────────────────────

export const storage = {
  get<T>(key: string, fallback: T): T {
    if (typeof window === 'undefined') return fallback
    try {
      const item = localStorage.getItem(key)
      return item ? (JSON.parse(item) as T) : fallback
    } catch {
      return fallback
    }
  },

  set(key: string, value: unknown): void {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      console.warn(`[storage] Failed to set "${key}"`)
    }
  },

  remove(key: string): void {
    if (typeof window === 'undefined') return
    try {
      localStorage.removeItem(key)
    } catch {
      console.warn(`[storage] Failed to remove "${key}"`)
    }
  },

  clear(): void {
    if (typeof window === 'undefined') return
    try {
      localStorage.clear()
    } catch {
      console.warn('[storage] Failed to clear')
    }
  },
}
