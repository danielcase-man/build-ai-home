'use client'

import * as React from 'react'
import { DayPicker, type DateRange } from 'react-day-picker'
import { format, isAfter, isBefore, isWeekend, addDays, subDays } from 'date-fns'
import Holidays from 'date-holidays'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Calendar, AlertTriangle, Clock } from 'lucide-react'

export interface ConstructionDatePickerProps {
  selected?: Date | DateRange
  onSelect?: (date: Date | DateRange | undefined) => void
  mode?: 'single' | 'range'
  placeholder?: string
  disabled?: boolean
  className?: string
  excludeWeekends?: boolean
  excludeHolidays?: boolean
  workDaysOnly?: boolean
  country?: string
  minDate?: Date
  maxDate?: Date
  blockedDates?: Date[]
  weatherRestrictionDates?: Date[]
  projectStartDate?: Date
  projectEndDate?: Date
  criticalPath?: boolean
  ariaLabel?: string
  ariaDescription?: string
}

const holidayManager = new Holidays('US')

export const constructionDateUtils = {
  isWorkDay(date: Date, excludeWeekends = true, excludeHolidays = true): boolean {
    if (excludeWeekends && isWeekend(date)) return false
    if (excludeHolidays && holidayManager.isHoliday(date)) return false
    return true
  },

  getNextWorkDay(date: Date, excludeWeekends = true, excludeHolidays = true): Date {
    let nextDay = addDays(date, 1)
    while (!constructionDateUtils.isWorkDay(nextDay, excludeWeekends, excludeHolidays)) {
      nextDay = addDays(nextDay, 1)
    }
    return nextDay
  },

  getPreviousWorkDay(date: Date, excludeWeekends = true, excludeHolidays = true): Date {
    let prevDay = subDays(date, 1)
    while (!constructionDateUtils.isWorkDay(prevDay, excludeWeekends, excludeHolidays)) {
      prevDay = subDays(prevDay, 1)
    }
    return prevDay
  },

  getWorkDaysInRange(startDate: Date, endDate: Date, excludeWeekends = true, excludeHolidays = true): Date[] {
    const workDays: Date[] = []
    let currentDate = new Date(startDate)
    while (currentDate <= endDate) {
      if (constructionDateUtils.isWorkDay(currentDate, excludeWeekends, excludeHolidays)) {
        workDays.push(new Date(currentDate))
      }
      currentDate = addDays(currentDate, 1)
    }
    return workDays
  },
}

export const constructionDatePresets = {
  standard: { excludeWeekends: true, excludeHolidays: true, workDaysOnly: true, country: 'US' },
  emergency: { excludeWeekends: false, excludeHolidays: false, workDaysOnly: false, country: 'US' },
  weatherSensitive: { excludeWeekends: true, excludeHolidays: true, workDaysOnly: true, country: 'US' },
  inspection: { excludeWeekends: true, excludeHolidays: true, workDaysOnly: true, country: 'US' },
}

export const ConstructionDatePicker = React.forwardRef<HTMLDivElement, ConstructionDatePickerProps>(
  (
    {
      selected,
      onSelect,
      mode = 'single',
      placeholder = 'Select date',
      disabled = false,
      className,
      excludeWeekends = true,
      excludeHolidays = true,
      workDaysOnly = false,
      country = 'US',
      minDate,
      maxDate,
      blockedDates = [],
      weatherRestrictionDates = [],
      projectStartDate,
      projectEndDate,
      criticalPath = false,
      ariaLabel,
      ariaDescription,
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = React.useState(false)
    const [monthsShown, setMonthsShown] = React.useState(1)

    React.useEffect(() => {
      holidayManager.init(country)
    }, [country])

    // Custom modifiers
    const modifiers = React.useMemo(() => {
      const mods: Record<string, ((date: Date) => boolean) | Date[]> = {}

      if (workDaysOnly || excludeWeekends) {
        mods.weekend = (date: Date) => isWeekend(date)
      }
      if (excludeHolidays) {
        mods.holiday = (date: Date) => !!holidayManager.isHoliday(date)
      }
      if (blockedDates.length > 0) {
        mods.blocked = blockedDates
      }
      if (weatherRestrictionDates.length > 0) {
        mods.weatherRestricted = weatherRestrictionDates
      }
      if (projectStartDate && projectEndDate) {
        mods.outsideProject = (date: Date) =>
          isBefore(date, projectStartDate) || isAfter(date, projectEndDate)
      }

      return mods
    }, [
      workDaysOnly,
      excludeWeekends,
      excludeHolidays,
      blockedDates,
      weatherRestrictionDates,
      projectStartDate,
      projectEndDate,
    ])

    const modifiersStyles: Record<string, React.CSSProperties> = {
      weekend: { color: '#9CA3AF', textDecoration: 'line-through' },
      holiday: { backgroundColor: '#FEF3C7', color: '#D97706', fontWeight: 'bold' },
      blocked: { backgroundColor: '#FEE2E2', color: '#DC2626' },
      weatherRestricted: { backgroundColor: '#DBEAFE', color: '#2563EB', fontStyle: 'italic' },
      outsideProject: { opacity: 0.3, pointerEvents: 'none' },
    }

    const disableDate = React.useCallback(
      (date: Date) => {
        if (minDate && isBefore(date, minDate)) return true
        if (maxDate && isAfter(date, maxDate)) return true
        if (
          workDaysOnly &&
          !constructionDateUtils.isWorkDay(date, excludeWeekends, excludeHolidays)
        ) {
          return true
        }
        if (blockedDates.some((blocked) => blocked.getTime() === date.getTime())) {
          return true
        }
        if (projectStartDate && projectEndDate) {
          if (isBefore(date, projectStartDate) || isAfter(date, projectEndDate)) return true
        }
        return false
      },
      [minDate, maxDate, workDaysOnly, excludeWeekends, excludeHolidays, blockedDates, projectStartDate, projectEndDate]
    )

    const getDisplayText = () => {
      if (mode === 'single') {
        return selected instanceof Date ? format(selected, 'PPP') : placeholder
      }
      if (selected && typeof selected === 'object' && 'from' in selected) {
        const range = selected as DateRange
        if (range.from && range.to) {
          return `${format(range.from, 'MMM d')} - ${format(range.to, 'MMM d, yyyy')}`
        }
        if (range.from) {
          return `${format(range.from, 'PPP')} - Select end date`
        }
      }
      return placeholder
    }

    const getWorkDaysCount = () => {
      if (mode === 'range' && selected && typeof selected === 'object' && 'from' in selected) {
        const range = selected as DateRange
        if (range.from && range.to) {
          return constructionDateUtils.getWorkDaysInRange(
            range.from,
            range.to,
            excludeWeekends,
            excludeHolidays
          ).length
        }
      }
      return null
    }

    const workDaysCount = getWorkDaysCount()

    return (
      <div ref={ref} className={cn('construction-date-picker', className)}>
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              disabled={disabled}
              className={cn(
                'w-full justify-start text-left font-normal',
                !selected && 'text-muted-foreground',
                criticalPath && 'border-yellow-400 bg-yellow-50'
              )}
              aria-label={ariaLabel}
              aria-description={ariaDescription}
            >
              <Calendar className="mr-2 h-4 w-4" />
              {getDisplayText()}
              {workDaysCount !== null && (
                <Badge variant="secondary" className="ml-auto">
                  {workDaysCount} work days
                </Badge>
              )}
            </Button>
          </PopoverTrigger>

          <PopoverContent className="w-auto p-0" align="start">
            <div className="p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm">
                    {mode === 'single' ? 'Select Date' : 'Select Date Range'}
                  </h3>
                  {criticalPath && (
                    <Badge variant="destructive" className="text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Critical Path
                    </Badge>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMonthsShown(monthsShown === 1 ? 2 : 1)}
                  className="text-xs"
                >
                  {monthsShown === 1 ? '2 Months' : '1 Month'}
                </Button>
              </div>

              {/* Day Picker */}
              {mode === 'range' ? (
                <DayPicker
                  mode="range"
                  selected={selected as DateRange | undefined}
                  onSelect={onSelect as (date: DateRange | undefined) => void}
                  numberOfMonths={monthsShown}
                  modifiers={modifiers}
                  modifiersStyles={modifiersStyles}
                  disabled={disableDate}
                  className="construction-calendar"
                />
              ) : (
                <DayPicker
                  mode="single"
                  selected={selected as Date | undefined}
                  onSelect={onSelect as (date: Date | undefined) => void}
                  numberOfMonths={monthsShown}
                  modifiers={modifiers}
                  modifiersStyles={modifiersStyles}
                  disabled={disableDate}
                  className="construction-calendar"
                />
              )}

              {/* Legend */}
              <div className="mt-4 pt-4 border-t">
                <h4 className="font-medium text-sm mb-2">Legend:</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {excludeWeekends && (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-gray-200 rounded" />
                      <span>Weekends</span>
                    </div>
                  )}
                  {excludeHolidays && (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-yellow-200 rounded" />
                      <span>Holidays</span>
                    </div>
                  )}
                  {blockedDates.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-200 rounded" />
                      <span>Blocked</span>
                    </div>
                  )}
                  {weatherRestrictionDates.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-200 rounded" />
                      <span>Weather Risk</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="mt-4 pt-4 border-t">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const tomorrow = addDays(new Date(), 1)
                      const nextWorkDay = constructionDateUtils.getNextWorkDay(
                        tomorrow,
                        excludeWeekends,
                        excludeHolidays
                      )
                      onSelect?.(
                        mode === 'single'
                          ? nextWorkDay
                          : { from: nextWorkDay, to: undefined }
                      )
                    }}
                    className="text-xs"
                  >
                    <Clock className="h-3 w-3 mr-1" />
                    Next Work Day
                  </Button>
                  {mode === 'range' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const startDate = addDays(new Date(), 1)
                        const endDate = addDays(startDate, 6)
                        onSelect?.({ from: startDate, to: endDate })
                      }}
                      className="text-xs"
                    >
                      Next Week
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    )
  }
)

ConstructionDatePicker.displayName = 'ConstructionDatePicker'
