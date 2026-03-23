'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2,
  Building2,
  MapPin,
  Mail,
  Loader2,
  AlertCircle,
  Shield,
} from 'lucide-react'

interface InviteData {
  invitation: {
    id: string
    email: string
    expires_at: string
    accepted_at: string | null
  }
  vendor: {
    company_name: string
    category: string | null
  } | null
  project: {
    address: string
    phase: string
  } | null
}

type PageState = 'loading' | 'valid' | 'accepted' | 'already_accepted' | 'expired' | 'error'

export default function InviteAcceptClient({ token }: { token: string }) {
  const [state, setState] = useState<PageState>('loading')
  const [data, setData] = useState<InviteData | null>(null)
  const [accepting, setAccepting] = useState(false)
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')

  useEffect(() => {
    fetch(`/api/vendors/invite/accept?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) {
          setState('expired')
          return
        }
        const json = await res.json()
        const inviteData = json.data as InviteData
        setData(inviteData)

        if (inviteData.invitation.accepted_at) {
          setState('already_accepted')
        } else {
          setState('valid')
        }
      })
      .catch(() => setState('error'))
  }, [token])

  const handleAccept = async () => {
    if (password.length < 8) return
    setAccepting(true)
    try {
      const res = await fetch('/api/vendors/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, display_name: displayName || undefined }),
      })
      if (res.ok) {
        setState('accepted')
      } else {
        setState('error')
      }
    } catch {
      setState('error')
    } finally {
      setAccepting(false)
    }
  }

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="text-center pb-4">
        <div className="flex justify-center mb-3">
          <Image src="/favicon-48x48.png" alt="FrameWork" width={48} height={48} className="rounded-lg" />
        </div>
        <CardTitle className="text-xl">
          <span className="text-orange-500">Frame</span>Work
        </CardTitle>
        <p className="text-sm text-muted-foreground">Vendor Portal Invitation</p>
      </CardHeader>

      <CardContent>
        {state === 'loading' && (
          <div className="flex flex-col items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <p className="text-sm text-muted-foreground">Validating invitation...</p>
          </div>
        )}

        {state === 'valid' && data && (
          <div className="space-y-5">
            <div className="bg-blue-50 rounded-lg p-4 space-y-3">
              {data.vendor && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-600 shrink-0" />
                  <span className="text-sm font-medium">{data.vendor.company_name}</span>
                  {data.vendor.category && (
                    <Badge variant="outline" className="text-xs">{data.vendor.category}</Badge>
                  )}
                </div>
              )}
              {data.project && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-blue-600 shrink-0" />
                  <span className="text-sm">{data.project.address}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-600 shrink-0" />
                <span className="text-sm">{data.invitation.email}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">By accepting, you will be able to:</h3>
              <ul className="text-sm text-muted-foreground space-y-1.5">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  View your bids and bid status
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  Access shared project documents
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  View project communications relevant to your scope
                </li>
              </ul>
            </div>

            <div className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-medium">Create your account</h3>
              <div>
                <label htmlFor="display-name" className="text-sm text-muted-foreground">Your name</label>
                <input
                  id="display-name"
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label htmlFor="password" className="text-sm text-muted-foreground">Choose a password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                  minLength={8}
                />
              </div>
            </div>

            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-gray-50 rounded p-3">
              <Shield className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              Your access is scoped to your vendor relationship only. You will not see other vendors&apos; bids or financial details.
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={handleAccept}
              disabled={accepting || password.length < 8}
            >
              {accepting ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Creating account...</>
              ) : (
                'Accept & Create Account'
              )}
            </Button>
          </div>
        )}

        {state === 'accepted' && (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="bg-emerald-100 p-3 rounded-full mb-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Invitation Accepted</h3>
            <p className="text-sm text-muted-foreground">
              You now have access to the vendor portal. You&apos;ll receive further instructions via email.
            </p>
          </div>
        )}

        {state === 'already_accepted' && (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="bg-blue-100 p-3 rounded-full mb-4">
              <CheckCircle2 className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Already Accepted</h3>
            <p className="text-sm text-muted-foreground">
              This invitation has already been accepted. Your portal access is active.
            </p>
          </div>
        )}

        {state === 'expired' && (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="bg-amber-100 p-3 rounded-full mb-4">
              <AlertCircle className="h-8 w-8 text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Invitation Expired</h3>
            <p className="text-sm text-muted-foreground">
              This invitation link has expired or is invalid. Please contact the project owner for a new invitation.
            </p>
          </div>
        )}

        {state === 'error' && (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="bg-red-100 p-3 rounded-full mb-4">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Something Went Wrong</h3>
            <p className="text-sm text-muted-foreground">
              We couldn&apos;t process this invitation. Please try again or contact the project owner.
            </p>
            <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
