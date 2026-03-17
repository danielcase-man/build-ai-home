import { NextRequest, NextResponse } from 'next/server'
import { syncAllConnections } from '@/lib/plaid-sync'
import { supabase } from '@/lib/supabase'
import { createHash, timingSafeEqual } from 'crypto'
import { importJWK, jwtVerify, decodeProtectedHeader, decodeJwt } from 'jose'

// Cache JWKs for 24 hours to avoid fetching on every webhook
const jwkCache = new Map<string, { key: CryptoKey; expiresAt: number }>()
const JWK_CACHE_TTL = 24 * 60 * 60 * 1000

async function getPlaidJwk(kid: string): Promise<CryptoKey> {
  const cached = jwkCache.get(kid)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.key
  }

  const res = await fetch('https://production.plaid.com/webhook_verification_key/get', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_SECRET,
      key_id: kid,
    }),
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch Plaid JWK: ${res.status}`)
  }

  const { key: jwk } = await res.json()
  const cryptoKey = await importJWK(jwk, 'ES256')

  if (cryptoKey instanceof Uint8Array) {
    throw new Error('Expected CryptoKey, got raw key')
  }

  jwkCache.set(kid, { key: cryptoKey, expiresAt: Date.now() + JWK_CACHE_TTL })
  return cryptoKey
}

async function verifyPlaidWebhook(request: NextRequest, rawBody: string): Promise<boolean> {
  const token = request.headers.get('plaid-verification')
  if (!token) {
    console.warn('Missing Plaid-Verification header')
    return false
  }

  try {
    // 1. Decode header to get kid
    const header = decodeProtectedHeader(token)
    if (header.alg !== 'ES256') {
      console.warn(`Unexpected JWT algorithm: ${header.alg}`)
      return false
    }
    if (!header.kid) {
      console.warn('Missing kid in JWT header')
      return false
    }

    // 2. Fetch the JWK for this kid
    const key = await getPlaidJwk(header.kid)

    // 3. Verify JWT signature (max 5 min clock tolerance)
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['ES256'],
      clockTolerance: 300,
    })

    // 4. Constant-time compare body hash (prevents timing attacks)
    const bodyHash = createHash('sha256').update(rawBody).digest('hex')
    const claimedHash = String(payload.request_body_sha256 || '')
    if (bodyHash.length !== claimedHash.length ||
        !timingSafeEqual(Buffer.from(bodyHash), Buffer.from(claimedHash))) {
      console.warn('Plaid webhook body hash mismatch')
      return false
    }

    return true
  } catch (err) {
    console.error('Plaid webhook verification failed:', err)
    return false
  }
}

/**
 * Plaid webhook handler.
 * Plaid sends webhooks for TRANSACTIONS events like SYNC_UPDATES_AVAILABLE.
 * This triggers a sync without waiting for the daily cron.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()

    // Verify webhook signature in production
    if (process.env.PLAID_ENV === 'production') {
      const isValid = await verifyPlaidWebhook(request, rawBody)
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const body = JSON.parse(rawBody)
    const { webhook_type, webhook_code, item_id } = body

    console.log(`Plaid webhook: ${webhook_type}/${webhook_code} for item ${item_id}`)

    if (webhook_type === 'TRANSACTIONS') {
      if (webhook_code === 'SYNC_UPDATES_AVAILABLE' || webhook_code === 'DEFAULT_UPDATE') {
        // Find the project for this item
        const { data: connection } = await supabase
          .from('plaid_connections')
          .select('project_id')
          .eq('item_id', item_id)
          .single()

        if (connection) {
          const result = await syncAllConnections(connection.project_id)
          console.log(`Webhook sync complete: +${result.added} ~${result.modified} -${result.removed} matched:${result.autoMatched}`)
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Plaid webhook error:', error)
    return NextResponse.json({ received: true }, { status: 200 }) // Always 200 to Plaid
  }
}
