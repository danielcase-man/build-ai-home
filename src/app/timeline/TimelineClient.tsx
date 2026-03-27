'use client'

import { useState } from 'react'
import { TimelineChart, type TimelineTask } from '@/components/construction/timeline-chart'

interface TimelineClientProps {
  tasks: TimelineTask[]
}

export default function TimelineClient({ tasks }: TimelineClientProps) {
  const [viewMode, setViewMode] = useState<'week' | 'month' | 'quarter'>('month')

  return (
    <div className="container max-w-7xl py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Project Timeline</h1>
          <p className="text-muted-foreground">
            Milestones and tasks on a Gantt chart
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border p-1">
          {(['week', 'month', 'quarter'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === mode
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span>{tasks.filter(t => t.phase === 'Milestones').length} milestones</span>
        <span>{tasks.filter(t => t.phase === 'Tasks').length} tasks</span>
        <span>{tasks.filter(t => t.status === 'COMPLETED').length} completed</span>
        <span>{tasks.filter(t => t.status === 'IN_PROGRESS').length} in progress</span>
      </div>

      {/* Timeline Chart */}
      {tasks.length > 0 ? (
        <TimelineChart
          tasks={tasks}
          viewMode={viewMode}
          showWeekends={false}
        />
      ) : (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <p className="text-lg font-medium">No scheduled items yet</p>
          <p className="text-sm mt-1 max-w-md mx-auto">
            The timeline shows milestones and tasks that have scheduled dates.
            As you finalize your construction schedule with Aaron, dates will populate here automatically.
          </p>
        </div>
      )}
    </div>
  )
}
