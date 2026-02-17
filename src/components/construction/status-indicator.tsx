'use client'

import * as React from 'react'
import { cn, a11y } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  Pause,
  Activity,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'

export type StatusType = 'COMPLETED' | 'IN_PROGRESS' | 'PENDING' | 'DELAYED' | 'ON_HOLD' | 'CANCELLED'

export interface StatusIndicatorProps {
  status: StatusType
  progress?: number
  label?: string
  size?: 'sm' | 'default' | 'lg'
  showProgress?: boolean
  showIcon?: boolean
  showTrend?: boolean
  trend?: 'up' | 'down' | 'stable'
  highContrast?: boolean
  fieldOptimized?: boolean
  variant?: 'badge' | 'card' | 'inline' | 'compact'
  lastUpdated?: Date
  context?: string
  onClick?: () => void
  ariaLabel?: string
}

const STATUS_CONFIG = {
  COMPLETED: {
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    label: 'Completed',
    badgeVariant: 'success' as const,
  },
  IN_PROGRESS: {
    icon: Activity,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    label: 'In Progress',
    badgeVariant: 'default' as const,
  },
  PENDING: {
    icon: Clock,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    label: 'Pending',
    badgeVariant: 'warning' as const,
  },
  DELAYED: {
    icon: AlertTriangle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    label: 'Delayed',
    badgeVariant: 'destructive' as const,
  },
  ON_HOLD: {
    icon: Pause,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    label: 'On Hold',
    badgeVariant: 'secondary' as const,
  },
  CANCELLED: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    label: 'Cancelled',
    badgeVariant: 'destructive' as const,
  },
}

const SIZE_CLASSES = {
  sm: { container: 'text-xs', icon: 'h-3 w-3', padding: 'p-1' },
  default: { container: 'text-sm', icon: 'h-4 w-4', padding: 'p-2' },
  lg: { container: 'text-base', icon: 'h-5 w-5', padding: 'p-3' },
}

const FIELD_SIZE = { container: 'text-lg font-bold', icon: 'h-6 w-6', padding: 'p-4' }

export function StatusIndicator({
  status,
  progress,
  label,
  size = 'default',
  showProgress = false,
  showIcon = true,
  showTrend = false,
  trend = 'stable',
  highContrast = false,
  fieldOptimized = false,
  variant = 'badge',
  lastUpdated,
  context,
  onClick,
  ariaLabel,
}: StatusIndicatorProps) {
  const config = STATUS_CONFIG[status]
  const sizeClasses = fieldOptimized ? FIELD_SIZE : SIZE_CLASSES[size]
  const Icon = config.icon
  const displayLabel = label || config.label

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : null

  const accessibilityLabel = React.useMemo(() => {
    if (ariaLabel) return ariaLabel
    let result = `Status: ${config.label}`
    if (progress !== undefined) result += `, ${progress}% complete`
    if (context) result += `, ${context}`
    if (lastUpdated) result += `, last updated ${lastUpdated.toLocaleDateString()}`
    return result
  }, [ariaLabel, config.label, progress, context, lastUpdated])

  const trendElement = showTrend && TrendIcon && (
    <TrendIcon
      className={cn(
        sizeClasses.icon,
        'ml-1',
        trend === 'up' && 'text-green-600',
        trend === 'down' && 'text-red-600'
      )}
    />
  )

  if (variant === 'badge') {
    return (
      <Badge
        variant={config.badgeVariant}
        className={cn(
          'gap-1',
          highContrast && 'border-2 font-bold',
          onClick && 'cursor-pointer'
        )}
        onClick={onClick}
        role={onClick ? 'button' : 'status'}
        tabIndex={onClick ? 0 : undefined}
        aria-label={accessibilityLabel}
      >
        {showIcon && <Icon className={sizeClasses.icon} />}
        {displayLabel}
        {trendElement}
      </Badge>
    )
  }

  if (variant === 'card') {
    return (
      <div
        className={cn(
          'rounded-lg border p-4 space-y-3',
          config.bgColor,
          config.borderColor,
          highContrast && 'border-2 font-bold',
          fieldOptimized && 'p-6 shadow-lg',
          onClick && 'cursor-pointer hover:shadow-md transition-shadow'
        )}
        onClick={onClick}
        role={onClick ? 'button' : 'region'}
        tabIndex={onClick ? 0 : undefined}
        aria-label={accessibilityLabel}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {showIcon && <Icon className={cn(sizeClasses.icon, config.color)} />}
            <span className={cn('font-semibold', sizeClasses.container, config.color)}>
              {displayLabel}
            </span>
            {trendElement}
          </div>
          {progress !== undefined && (
            <span className={cn('font-mono font-bold', sizeClasses.container)}>
              {progress}%
            </span>
          )}
        </div>

        {context && (
          <p className={cn('text-muted-foreground', sizeClasses.container)}>{context}</p>
        )}

        {showProgress && progress !== undefined && (
          <Progress value={progress} className={fieldOptimized ? 'h-3' : 'h-2'} />
        )}

        {lastUpdated && (
          <div
            className={cn(
              'text-xs text-muted-foreground flex items-center gap-1',
              fieldOptimized && 'text-sm'
            )}
          >
            <Clock className="h-3 w-3" />
            Updated {lastUpdated.toLocaleDateString()}
          </div>
        )}
      </div>
    )
  }

  if (variant === 'inline') {
    return (
      <div
        className={cn('inline-flex items-center gap-2', onClick && 'cursor-pointer')}
        onClick={onClick}
        role={onClick ? 'button' : 'status'}
        tabIndex={onClick ? 0 : undefined}
        aria-label={accessibilityLabel}
      >
        {showIcon && <Icon className={cn(sizeClasses.icon, config.color)} />}
        <span className={cn('font-medium', sizeClasses.container, config.color)}>
          {displayLabel}
        </span>
        {progress !== undefined && (
          <span className={cn('font-mono text-muted-foreground', sizeClasses.container)}>
            ({progress}%)
          </span>
        )}
        {trendElement}
      </div>
    )
  }

  // compact
  return (
    <div
      className={cn('flex items-center gap-1', onClick && 'cursor-pointer')}
      onClick={onClick}
      role={onClick ? 'button' : 'status'}
      tabIndex={onClick ? 0 : undefined}
      aria-label={accessibilityLabel}
    >
      {showIcon && <Icon className={cn('h-3 w-3', config.color)} />}
      <span className={cn('text-xs font-medium truncate max-w-20', config.color)}>
        {displayLabel}
      </span>
      {progress !== undefined && (
        <span className="text-xs font-mono text-muted-foreground">{progress}%</span>
      )}
    </div>
  )
}
