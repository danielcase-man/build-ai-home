'use client'

import EmailDashboard from '@/components/EmailDashboard'
import GmailConnect from '@/components/GmailConnect'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Info, AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

function EmailsContent() {
  const [isConnected, setIsConnected] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const searchParams = useSearchParams()

  useEffect(() => {
    const success = searchParams.get('success')
    if (success === 'connected') {
      setIsConnected(true)
      setCheckingAuth(false)
    } else {
      checkAuth()
    }
  }, [searchParams])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/emails/fetch')
      if (response.status !== 401) {
        setIsConnected(true)
      }
    } catch (error) {
      console.error('Error checking auth:', error)
    } finally {
      setCheckingAuth(false)
    }
  }

  return (
    <div className="container py-8 space-y-6">
      {checkingAuth ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      ) : isConnected ? (
        <div className="space-y-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>AI Construction Intelligence:</strong> Claude AI automatically extracts action items, questions needing answers, next steps, and key data points from your project emails. Urgent matters are flagged for immediate attention.
            </AlertDescription>
          </Alert>

          <EmailDashboard />
        </div>
      ) : (
        <div className="space-y-6">
          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Gmail is not connected. Connect your account to view and analyze project-related emails from your team and vendors.
            </AlertDescription>
          </Alert>

          <GmailConnect />
        </div>
      )}
    </div>
  )
}

export default function EmailsPage() {
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
      <EmailsContent />
    </Suspense>
  )
}
