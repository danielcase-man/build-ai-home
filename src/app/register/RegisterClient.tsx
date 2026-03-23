'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { createAuthBrowserClient } from '@/lib/supabase-auth'

export default function RegisterClient() {
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      setLoading(false)
      return
    }

    try {
      const supabase = createAuthBrowserClient()

      // Step 1: Create auth user via Supabase
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (signUpError) {
        setError(signUpError.message)
        setLoading(false)
        return
      }

      if (!data.user) {
        setError('Failed to create account. Please try again.')
        setLoading(false)
        return
      }

      // Step 2: Create user_profile + project_member via API
      const profileRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auth_user_id: data.user.id,
          email,
          display_name: displayName || email.split('@')[0],
        }),
      })

      if (!profileRes.ok) {
        const err = await profileRes.json()
        setError(err.error || 'Failed to complete registration.')
        setLoading(false)
        return
      }

      // If Supabase requires email confirmation, show success message
      // Otherwise auto-login happened via signUp, redirect to dashboard
      if (data.session) {
        // Auto-logged in — redirect
        router.push('/')
        router.refresh()
      } else {
        // Email confirmation required
        setSuccess(true)
      }
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <Card className="w-full max-w-sm shadow-lg">
        <CardContent className="py-8 text-center space-y-3">
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
          <h2 className="text-lg font-semibold">Check your email</h2>
          <p className="text-sm text-muted-foreground">
            We sent a confirmation link to <strong>{email}</strong>.
            Click the link to activate your account, then sign in.
          </p>
          <Link href="/login">
            <Button variant="outline" className="mt-4">Go to Sign In</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-sm shadow-lg">
      <CardHeader className="text-center pb-4">
        <div className="flex justify-center mb-3">
          <Image src="/favicon-48x48.png" alt="FrameWork" width={48} height={48} className="rounded-lg" />
        </div>
        <CardTitle className="text-xl">
          <span className="text-orange-500">Frame</span>Work
        </CardTitle>
        <p className="text-sm text-muted-foreground">Create your account</p>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleRegister} className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <div>
            <Label htmlFor="displayName">Name</Label>
            <Input
              id="displayName"
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Daniel Case"
              autoFocus
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
              className="mt-1"
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Creating account...</>
            ) : (
              'Create Account'
            )}
          </Button>
        </form>

        <p className="text-xs text-center text-muted-foreground mt-4">
          Already have an account?{' '}
          <Link href="/login" className="text-primary hover:underline">Sign in</Link>
        </p>
      </CardContent>
    </Card>
  )
}
