'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function StatusGenerateButton() {
  const [generating, setGenerating] = useState(false)
  const router = useRouter()

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const response = await fetch('/api/project-status/generate', { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to generate status')
      toast.success('Status report updated')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate status')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Button
      onClick={handleGenerate}
      disabled={generating}
      size="sm"
    >
      {generating ? (
        <>
          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          Analyzing emails...
        </>
      ) : (
        <>
          <Sparkles className="h-4 w-4 mr-1.5" />
          Generate AI Report
        </>
      )}
    </Button>
  )
}
