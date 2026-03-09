'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Info, AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import EmailDashboard from '@/components/EmailDashboard'
import GmailConnect from '@/components/GmailConnect'
import type { EmailRecord } from '@/types'

interface EmailsClientProps {
  initialEmails: EmailRecord[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialStatus: any
  gmailConfigured: boolean
}

function EmailsContent({ initialEmails, initialStatus, gmailConfigured }: EmailsClientProps) {
  const searchParams = useSearchParams()
  const justConnected = searchParams.get('success') === 'connected'
  const isConnected = gmailConfigured || justConnected

  if (!isConnected) {
    return (
      <div className="container py-8 space-y-6">
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Gmail is not connected. Connect your account to view and analyze project-related emails from your team and vendors.
          </AlertDescription>
        </Alert>
        <GmailConnect />
      </div>
    )
  }

  return (
    <div className="container py-8 space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>AI Construction Intelligence:</strong> Claude AI automatically extracts action items, questions needing answers, next steps, and key data points from your project emails. Urgent matters are flagged for immediate attention.
        </AlertDescription>
      </Alert>
      <EmailDashboard initialEmails={initialEmails} initialStatus={initialStatus} />
    </div>
  )
}

export default function EmailsClient(props: EmailsClientProps) {
  return (
    <Suspense fallback={
      <div className="container py-8">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      </div>
    }>
      <EmailsContent {...props} />
    </Suspense>
  )
}
