import { Loader2 } from 'lucide-react'

export default function Loading() {
  return (
    <div className="container py-8">
      <div className="flex items-center gap-2 mb-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="text-muted-foreground">Loading payments...</span>
      </div>
    </div>
  )
}
