'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle, AlertCircle, Mail, ChevronDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { toast } from 'sonner'

export default function GmailConnect() {
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [troubleshootOpen, setTroubleshootOpen] = useState(false)
  const searchParams = useSearchParams()

  useEffect(() => {
    const error = searchParams.get('error')
    const success = searchParams.get('success')

    if (error === 'no_code') {
      setError('Authorization was cancelled or no code was received.')
    } else if (error === 'auth_failed') {
      setError('Authentication failed. Please check your Google Cloud Console configuration.')
    } else if (success === 'connected') {
      setIsConnected(true)
      setError(null)
      toast.success('Gmail connected successfully')
    }
  }, [searchParams])

  const handleConnectGmail = async () => {
    setIsConnecting(true)
    setError(null)

    try {
      const response = await fetch('/api/gmail/auth')
      const data = await response.json()

      if (data.authUrl) {
        window.location.href = data.authUrl
      } else {
        setError('Failed to generate authentication URL')
      }
    } catch {
      setError('Failed to initiate Gmail connection')
    } finally {
      setIsConnecting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Gmail Integration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected ? (
          <Alert variant="success">
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Gmail successfully connected!</AlertTitle>
            <AlertDescription>
              You can now fetch and analyze emails from your Gmail account.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Connect your Gmail account to automatically fetch and analyze construction-related emails.
            </p>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  <p>{error}</p>
                  {(error.includes('403') || error.includes('access_denied')) && (
                    <div className="mt-2 text-sm">
                      <p className="font-semibold">Common fixes for 403 errors:</p>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        <li>Ensure Gmail API is enabled in Google Cloud Console</li>
                        <li>Add your email to test users in OAuth consent screen</li>
                        <li>Verify redirect URI matches exactly: <code className="bg-destructive/10 px-1 rounded">http://localhost:3000/api/auth/google/callback</code></li>
                        <li>Clear browser cache and cookies for accounts.google.com</li>
                      </ul>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <Button onClick={handleConnectGmail} disabled={isConnecting}>
              {isConnecting ? 'Connecting...' : 'Connect Gmail Account'}
            </Button>

            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-semibold mb-2">Required Permissions:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Read your Gmail messages</li>
                <li>• Mark messages as read</li>
                <li>• Search and filter emails</li>
              </ul>
            </div>
          </>
        )}

        <Collapsible open={troubleshootOpen} onOpenChange={setTroubleshootOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown className={`h-4 w-4 transition-transform ${troubleshootOpen ? 'rotate-180' : ''}`} />
            Troubleshooting Guide
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-3 space-y-3 text-sm text-muted-foreground p-4 bg-muted rounded-lg">
              <div>
                <p className="font-semibold text-foreground">Getting a 403 Error?</p>
                <ol className="list-decimal list-inside mt-1 space-y-1">
                  <li>Go to <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google Cloud Console</a></li>
                  <li>Navigate to &quot;APIs & Services&quot; → &quot;OAuth consent screen&quot;</li>
                  <li>Add your email address as a test user</li>
                  <li>Check that Gmail API is enabled</li>
                  <li>Verify redirect URI in Credentials matches exactly</li>
                </ol>
              </div>

              <div>
                <p className="font-semibold text-foreground">Still having issues?</p>
                <p>Run the verification script:</p>
                <code className="block bg-background p-2 rounded mt-1 text-xs">
                  node scripts/verify-oauth-config.js
                </code>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  )
}
