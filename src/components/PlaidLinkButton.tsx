'use client'

import { useState, useCallback } from 'react'
import { usePlaidLink, type PlaidLinkOnSuccessMetadata } from 'react-plaid-link'
import { Button } from '@/components/ui/button'
import { Landmark, Loader2 } from 'lucide-react'

interface PlaidLinkButtonProps {
  onSuccess: () => void
}

export default function PlaidLinkButton({ onSuccess }: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchLinkToken = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/plaid/link-token', { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        setLinkToken(json.data.link_token)
      } else {
        setError(json.error || 'Failed to initialize bank connection')
      }
    } catch {
      setError('Failed to connect. Check your Plaid credentials.')
    } finally {
      setLoading(false)
    }
  }, [])

  const onPlaidSuccess = useCallback(
    async (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => {
      setLoading(true)
      try {
        const res = await fetch('/api/plaid/exchange-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            public_token: publicToken,
            institution_name: metadata.institution?.name,
            institution_id: metadata.institution?.institution_id,
          }),
        })
        const json = await res.json()
        if (json.success) {
          onSuccess()
        } else {
          setError(json.error || 'Failed to save bank connection')
        }
      } catch {
        setError('Failed to save bank connection')
      } finally {
        setLoading(false)
      }
    },
    [onSuccess]
  )

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: onPlaidSuccess,
    onExit: () => {
      // User closed Plaid Link — no action needed
    },
  })

  // Two-step: first fetch token, then open Link
  const handleClick = async () => {
    if (linkToken && ready) {
      open()
    } else {
      await fetchLinkToken()
    }
  }

  // Auto-open when token is ready
  if (linkToken && ready && !loading) {
    open()
  }

  return (
    <div>
      <Button onClick={handleClick} disabled={loading}>
        {loading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Landmark className="h-4 w-4 mr-2" />
        )}
        Connect Bank Account
      </Button>
      {error && <p className="text-sm text-destructive mt-2">{error}</p>}
    </div>
  )
}
