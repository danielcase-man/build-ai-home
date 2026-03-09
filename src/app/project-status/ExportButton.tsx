'use client'

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ExportButtonProps {
  href: string
  label: string
}

export default function ExportButton({ href, label }: ExportButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => window.open(href, '_blank')}
      className="flex items-center gap-1.5"
    >
      <Download className="h-3.5 w-3.5" />
      {label}
    </Button>
  )
}
