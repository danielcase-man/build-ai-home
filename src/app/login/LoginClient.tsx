'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, AlertCircle } from 'lucide-react'
import { createAuthBrowserClient } from '@/lib/supabase-auth'

export default function LoginClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createAuthBrowserClient()
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError(authError.message === 'Invalid login credentials'
        ? 'Invalid email or password. Please try again.'
        : authError.message
      )
      setLoading(false)
      return
    }

    // Redirect to intended page or dashboard
    router.push(redirectTo)
    router.refresh()
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
        <p className="text-sm text-muted-foreground">Construction Project Manager</p>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoFocus
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
              placeholder="Your password"
              required
              className="mt-1"
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Signing in...</>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>

        <p className="text-xs text-center text-muted-foreground mt-4">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-primary hover:underline">Create one</Link>
        </p>
      </CardContent>
    </Card>
  )
}
