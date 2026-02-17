'use client'

import * as React from 'react'
import { cn, a11y, construction } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  Users,
  AlertTriangle,
} from 'lucide-react'
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
  isSameDay,
  isWeekend,
} from 'date-fns'

export interface TimelineTask {
  id: string
  name: string
  description?: string
  startDate: Date
  endDate: Date
  progress: number
  status: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING' | 'DELAYED' | 'ON_HOLD'
  assignedTo?: string[]
  dependencies?: string[]
  phase: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  estimatedHours?: number
  actualHours?: number
  materials?: string[]
  inspectionRequired?: boolean
}

export interface TimelineChartProps {
  tasks: TimelineTask[]
  currentDate?: Date
  viewMode?: 'week' | 'month' | 'quarter'
  showWeekends?: boolean
  fieldOptimized?: boolean
  highContrast?: boolean
  mobile?: boolean
  onTaskClick?: (task: TimelineTask) => void
  onDateRangeChange?: (startDate: Date, endDate: Date) => void
}

const STATUS_BAR_COLOR: Record<string, string> = {
  COMPLETED: 'bg-construction-green text-white',
  IN_PROGRESS: 'bg-construction-blue text-white',
  PENDING: 'bg-construction-yellow text-black',
  DELAYED: 'bg-construction-red text-white',
  ON_HOLD: 'bg-construction-slate text-white',
}

const STATUS_BADGE_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
  COMPLETED: 'success',
  IN_PROGRESS: 'default',
  PENDING: 'warning',
  DELAYED: 'destructive',
  ON_HOLD: 'secondary',
}

export function TimelineChart({
  tasks = [],
  currentDate = new Date(),
  viewMode = 'week',
  showWeekends = false,
  fieldOptimized = false,
  highContrast = false,
  mobile = false,
  onTaskClick,
  onDateRangeChange,
}: TimelineChartProps) {
  const [focusDate, setFocusDate] = React.useState(currentDate)
  const [selectedTask, setSelectedTask] = React.useState<string | null>(null)

  const timelineId = React.useId()

  // Calculate date range based on view mode
  const dateRange = React.useMemo(() => {
    const start = startOfWeek(focusDate, { weekStartsOn: 1 })
    let end: Date

    switch (viewMode) {
      case 'month':
        end = endOfWeek(addWeeks(start, 3), { weekStartsOn: 1 })
        break
      case 'quarter':
        end = endOfWeek(addWeeks(start, 11), { weekStartsOn: 1 })
        break
      default:
        end = endOfWeek(start, { weekStartsOn: 1 })
        break
    }

    return { start, end }
  }, [focusDate, viewMode])

  // Generate date columns
  const dateColumns = React.useMemo(() => {
    const days = eachDayOfInterval(dateRange)
    return showWeekends ? days : days.filter((day) => !isWeekend(day))
  }, [dateRange, showWeekends])

  // Group tasks by phase
  const tasksByPhase = React.useMemo(() => {
    const phases = new Map<string, TimelineTask[]>()
    tasks.forEach((task) => {
      if (!phases.has(task.phase)) {
        phases.set(task.phase, [])
      }
      phases.get(task.phase)!.push(task)
    })
    return phases
  }, [tasks])

  // Calculate task position and width
  const getTaskPosition = React.useCallback(
    (task: TimelineTask) => {
      const totalDays = dateColumns.length
      const startIndex = dateColumns.findIndex(
        (date) => isSameDay(date, task.startDate) || date >= task.startDate
      )
      const endIndex = dateColumns.findIndex(
        (date) => isSameDay(date, task.endDate) || date >= task.endDate
      )

      if (startIndex === -1) return { left: 0, width: 0, visible: false }

      const left = (startIndex / totalDays) * 100
      const width = Math.max(((endIndex - startIndex + 1) / totalDays) * 100, 2)

      return { left, width, visible: true }
    },
    [dateColumns]
  )

  // Navigation
  const navigate = React.useCallback(
    (direction: 'prev' | 'next' | 'today') => {
      const weeks = viewMode === 'quarter' ? 12 : viewMode === 'month' ? 4 : 1
      let newDate: Date

      if (direction === 'today') {
        newDate = new Date()
      } else if (direction === 'prev') {
        newDate = subWeeks(focusDate, weeks)
      } else {
        newDate = addWeeks(focusDate, weeks)
      }

      setFocusDate(newDate)
      onDateRangeChange?.(
        startOfWeek(newDate, { weekStartsOn: 1 }),
        endOfWeek(
          direction === 'today' ? newDate : addWeeks(newDate, weeks - 1),
          { weekStartsOn: 1 }
        )
      )
    },
    [focusDate, viewMode, onDateRangeChange]
  )

  const handleTaskClick = React.useCallback(
    (task: TimelineTask) => {
      setSelectedTask(task.id)
      onTaskClick?.(task)
      a11y.announce(`Selected task: ${task.name}`, 'polite')
    },
    [onTaskClick]
  )

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent, task: TimelineTask) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleTaskClick(task)
      }
    },
    [handleTaskClick]
  )

  return (
    <Card
      className={cn(
        'w-full',
        fieldOptimized && 'shadow-xl border-2',
        highContrast && 'border-foreground'
      )}
    >
      <CardHeader className={cn('pb-4', fieldOptimized && 'pb-6')}>
        <div className="flex items-center justify-between">
          <CardTitle
            className={cn(
              'flex items-center gap-2',
              fieldOptimized ? 'text-xl' : 'text-lg'
            )}
          >
            <Calendar
              className={cn(
                'text-primary',
                fieldOptimized ? 'h-6 w-6' : 'h-5 w-5'
              )}
            />
            Project Timeline
          </CardTitle>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size={mobile ? 'sm' : 'default'}
              onClick={() => navigate('prev')}
              aria-label="Previous period"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size={mobile ? 'sm' : 'default'}
              onClick={() => navigate('today')}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size={mobile ? 'sm' : 'default'}
              onClick={() => navigate('next')}
              aria-label="Next period"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className={cn('text-sm font-medium', fieldOptimized && 'text-base')}>
            {format(dateRange.start, 'MMM d')} - {format(dateRange.end, 'MMM d, yyyy')}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div
          className="relative overflow-x-auto"
          role="grid"
          aria-label="Project timeline chart"
          id={timelineId}
        >
          {/* Header Row */}
          <div
            className={cn(
              'sticky top-0 bg-background border-b flex min-w-max',
              fieldOptimized && 'min-h-[60px]'
            )}
          >
            <div
              className={cn(
                'flex-shrink-0 w-48 p-3 border-r bg-muted/50 font-semibold',
                fieldOptimized && 'w-64 p-4 text-base',
                mobile && 'w-40 p-2 text-sm'
              )}
            >
              Construction Phase
            </div>

            {dateColumns.map((date, index) => (
              <div
                key={index}
                className={cn(
                  'flex-shrink-0 p-2 border-r text-center text-xs font-medium',
                  fieldOptimized ? 'w-20 p-3 text-sm' : 'w-16',
                  mobile && 'w-12 p-1 text-xs',
                  isSameDay(date, new Date()) && 'bg-primary/10',
                  isWeekend(date) && 'bg-muted/30'
                )}
                role="columnheader"
              >
                <div>{format(date, 'EEE')}</div>
                <div
                  className={cn(
                    'font-bold',
                    isSameDay(date, new Date()) && 'text-primary'
                  )}
                >
                  {format(date, 'd')}
                </div>
              </div>
            ))}
          </div>

          {/* Task Rows */}
          {Array.from(tasksByPhase.entries()).map(([phase, phaseTasks]) => (
            <div key={phase} className="border-b">
              {/* Phase Header */}
              <div
                className={cn(
                  'flex min-w-max bg-muted/30',
                  fieldOptimized && 'min-h-[50px]'
                )}
              >
                <div
                  className={cn(
                    'flex-shrink-0 w-48 p-3 border-r font-semibold text-primary',
                    fieldOptimized && 'w-64 p-4 text-base',
                    mobile && 'w-40 p-2 text-sm'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span>{construction.getPhaseIcon(phase)}</span>
                    {construction.getPhaseLabel(phase)}
                  </div>
                </div>
                <div className="flex-1" />
              </div>

              {/* Phase Tasks */}
              {phaseTasks.map((task) => {
                const position = getTaskPosition(task)
                const isSelected = selectedTask === task.id

                return (
                  <div
                    key={task.id}
                    className={cn(
                      'flex min-w-max hover:bg-muted/50 transition-colors',
                      isSelected && 'bg-primary/10',
                      fieldOptimized && 'min-h-[60px]'
                    )}
                    role="row"
                  >
                    {/* Task Info Column */}
                    <div
                      className={cn(
                        'flex-shrink-0 w-48 p-3 border-r',
                        fieldOptimized && 'w-64 p-4',
                        mobile && 'w-40 p-2'
                      )}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <h4
                            className={cn(
                              'font-medium truncate',
                              fieldOptimized ? 'text-sm' : 'text-xs',
                              mobile && 'text-xs'
                            )}
                          >
                            {task.name}
                          </h4>
                          <Badge
                            variant={STATUS_BADGE_VARIANT[task.status] ?? 'secondary'}
                            className="text-[10px] px-1.5 py-0"
                          >
                            {task.status.replace(/_/g, ' ')}
                          </Badge>
                        </div>

                        {task.progress > 0 && (
                          <Progress value={task.progress} className="h-1" />
                        )}

                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          {task.assignedTo && task.assignedTo.length > 0 && (
                            <div className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              <span>{task.assignedTo.length}</span>
                            </div>
                          )}
                          {task.inspectionRequired && (
                            <AlertTriangle className="h-3 w-3 text-orange-500" />
                          )}
                          {(task.priority === 'HIGH' || task.priority === 'URGENT') && (
                            <div
                              className={cn(
                                'w-2 h-2 rounded-full',
                                task.priority === 'URGENT'
                                  ? 'bg-red-500'
                                  : 'bg-orange-500'
                              )}
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Timeline Bar */}
                    <div className="relative flex-1 p-2">
                      {position.visible && (
                        <button
                          className={cn(
                            'absolute top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-medium transition-all',
                            'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1',
                            STATUS_BAR_COLOR[task.status],
                            isSelected && 'ring-2 ring-primary ring-offset-1',
                            fieldOptimized && 'px-3 py-2 text-sm min-h-[32px]'
                          )}
                          style={{
                            left: `${position.left}%`,
                            width: `${position.width}%`,
                            minWidth: fieldOptimized ? '80px' : '60px',
                          }}
                          onClick={() => handleTaskClick(task)}
                          onKeyDown={(e) => handleKeyDown(e, task)}
                          aria-label={`${task.name}: ${task.progress}% complete`}
                          role="gridcell"
                          tabIndex={0}
                        >
                          <div className="truncate">
                            {mobile ? task.name.slice(0, 10) + '...' : task.name}
                          </div>
                          {task.progress > 0 && (
                            <div className="text-xs opacity-75">{task.progress}%</div>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className={cn('p-4 border-t bg-muted/20', fieldOptimized && 'p-6')}>
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-construction-green rounded" />
              <span>Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-construction-blue rounded" />
              <span>In Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-construction-yellow rounded" />
              <span>Pending</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-construction-red rounded" />
              <span>Delayed</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-3 w-3 text-orange-500" />
              <span>Inspection Required</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
