'use client'

import * as React from 'react'
import Image from 'next/image'
import { Button, type ButtonProps } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn, construction } from '@/lib/utils'
import { type LucideIcon } from 'lucide-react'
import { type StatusType } from './status-indicator'

const STATUS_BADGE_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
  COMPLETED: 'success',
  IN_PROGRESS: 'default',
  PENDING: 'warning',
  DELAYED: 'destructive',
  ON_HOLD: 'secondary',
}

const STATUS_LINE_COLOR: Record<string, string> = {
  COMPLETED: 'bg-construction-green',
  IN_PROGRESS: 'bg-construction-blue',
  PENDING: 'bg-construction-yellow',
  DELAYED: 'bg-construction-red',
  ON_HOLD: 'bg-construction-slate',
}

export interface ProjectButtonProps extends Omit<ButtonProps, 'children'> {
  title: string
  description?: string
  status?: StatusType
  progress?: number
  budget?: { spent: number; total: number }
  icon?: LucideIcon
  image?: string
  compact?: boolean
  showProgress?: boolean
  showBudget?: boolean
  fieldOptimized?: boolean
  highContrast?: boolean
}

const ProjectButton = React.forwardRef<HTMLButtonElement, ProjectButtonProps>(
  (
    {
      title,
      description,
      status,
      progress = 0,
      budget,
      icon: Icon,
      image,
      compact = false,
      showProgress = true,
      showBudget = false,
      fieldOptimized = false,
      highContrast = false,
      className,
      ...props
    },
    ref
  ) => {
    const accessibilityLabel = React.useMemo(() => {
      let label = `Project: ${title}`
      if (status) label += `, Status: ${status.replace(/_/g, ' ').toLowerCase()}`
      if (progress) label += `, ${progress}% complete`
      if (budget) {
        const pct = Math.round((budget.spent / budget.total) * 100)
        label += `, Budget: ${pct}% used`
      }
      return label
    }, [title, status, progress, budget])

    return (
      <Button
        ref={ref}
        variant={props.variant ?? 'outline'}
        size={props.size ?? (compact ? 'default' : 'lg')}
        aria-label={accessibilityLabel}
        className={cn(
          'relative overflow-hidden text-left justify-start p-0 h-auto',
          compact ? 'min-h-[60px]' : 'min-h-[100px]',
          fieldOptimized && 'min-h-[120px] shadow-xl',
          highContrast && 'border-2 font-bold',
          className
        )}
        {...props}
      >
        <div className={cn('flex w-full', compact ? 'p-3' : 'p-4', fieldOptimized && 'p-6')}>
          {/* Icon or Image */}
          <div className={cn('flex-shrink-0', compact ? 'mr-3' : 'mr-4')}>
            {image ? (
              <div
                className={cn(
                  'relative rounded-md bg-muted overflow-hidden',
                  compact ? 'h-12 w-12' : 'h-16 w-16',
                  fieldOptimized && 'h-20 w-20'
                )}
              >
                <Image
                  src={image}
                  alt={`${title} project thumbnail`}
                  className="h-full w-full object-cover"
                  fill
                  sizes="(max-width: 80px) 100vw, 80px"
                />
              </div>
            ) : Icon ? (
              <div
                className={cn(
                  'rounded-md bg-primary/10 flex items-center justify-center',
                  compact ? 'h-12 w-12' : 'h-16 w-16',
                  fieldOptimized && 'h-20 w-20'
                )}
              >
                <Icon
                  className={cn(
                    'text-primary',
                    compact ? 'h-6 w-6' : 'h-8 w-8',
                    fieldOptimized && 'h-10 w-10'
                  )}
                  aria-hidden="true"
                />
              </div>
            ) : (
              <div
                className={cn(
                  'rounded-md bg-muted flex items-center justify-center',
                  compact ? 'h-12 w-12' : 'h-16 w-16',
                  fieldOptimized && 'h-20 w-20'
                )}
              >
                <span
                  className={cn(
                    'font-bold text-muted-foreground',
                    compact ? 'text-lg' : 'text-xl',
                    fieldOptimized && 'text-2xl'
                  )}
                >
                  {title.charAt(0)}
                </span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-1">
              <h3
                className={cn(
                  'font-semibold text-foreground truncate',
                  compact ? 'text-sm' : 'text-base',
                  fieldOptimized && 'text-lg',
                  highContrast && 'font-bold'
                )}
              >
                {title}
              </h3>
              {status && (
                <Badge
                  variant={STATUS_BADGE_VARIANT[status] ?? 'secondary'}
                  className="ml-2 flex-shrink-0"
                >
                  {status.replace(/_/g, ' ')}
                </Badge>
              )}
            </div>

            {description && !compact && (
              <p
                className={cn(
                  'text-muted-foreground text-sm mb-2 line-clamp-2',
                  fieldOptimized && 'text-base'
                )}
              >
                {description}
              </p>
            )}

            {/* Progress Bar */}
            {showProgress && progress > 0 && (
              <div className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className={cn('text-xs text-muted-foreground', fieldOptimized && 'text-sm')}>
                    Progress
                  </span>
                  <span className={cn('text-xs font-medium', fieldOptimized && 'text-sm')}>
                    {progress}%
                  </span>
                </div>
                <div className={cn('w-full bg-muted rounded-full', compact ? 'h-1' : 'h-2')}>
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Project progress: ${progress}% complete`}
                  />
                </div>
              </div>
            )}

            {/* Budget Info */}
            {showBudget && budget && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Budget</span>
                <span
                  className={cn(
                    budget.spent > budget.total && 'text-red-600 font-semibold',
                    fieldOptimized && 'text-sm'
                  )}
                >
                  {construction.formatCurrency(budget.spent)} /{' '}
                  {construction.formatCurrency(budget.total)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Status indicator line */}
        {status && (
          <div
            className={cn('absolute left-0 top-0 bottom-0 w-1', STATUS_LINE_COLOR[status])}
            aria-hidden="true"
          />
        )}
      </Button>
    )
  }
)
ProjectButton.displayName = 'ProjectButton'

export { ProjectButton }
