'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function StatusGenerateButton() {
  const [running, setRunning] = useState(false)
  const router = useRouter()

  const handleRun = async (processBacklog = false) => {
    setRunning(true)
    try {
      const params = new URLSearchParams()
      params.set('force', 'true')
      if (processBacklog) params.set('backlog', 'true')

      const response = await fetch(`/api/intelligence/run?${params}`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Intelligence engine failed')

      const result = data.data
      const changes = result.changes_detected || 0
      const agents = result.agents_invoked?.length || 0
      const created = result.results?.reduce((sum: number, r: { records_created: number }) => sum + r.records_created, 0) || 0

      if (changes > 0) {
        toast.success(`Intelligence scan: ${changes} changes found, ${agents} agent(s) ran, ${created} records created`)
      } else {
        toast.info('No new changes detected — dashboard is current')
      }
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Intelligence engine failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button
        onClick={() => handleRun(false)}
        disabled={running}
        size="sm"
        variant="outline"
        title="Quick scan — check for new data since last run"
      >
        {running ? (
          <>
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            Scanning...
          </>
        ) : (
          <>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </>
        )}
      </Button>
      <Button
        onClick={() => handleRun(true)}
        disabled={running}
        size="sm"
        title="Full intelligence run — scan all sources + process backlog"
      >
        {running ? (
          <>
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Zap className="h-4 w-4 mr-1.5" />
            Run Intelligence
          </>
        )}
      </Button>
    </div>
  )
}
