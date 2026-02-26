import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockRunSeed, mockEnv } = vi.hoisted(() => ({
  mockRunSeed: vi.fn().mockResolvedValue({ inserted: 5, errors: [] }),
  mockEnv: {
    cronSecret: 'test-secret',
    documentRepositoryPath: '/test/docs',
    supabaseUrl: 'https://test.supabase.co',
    supabaseAnonKey: 'test-key',
    supabaseServiceRoleKey: undefined as string | undefined,
  },
}))

vi.mock('@/lib/seed-parsers', () => ({
  runSeed: mockRunSeed,
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue({}),
}))

vi.mock('@/lib/env', () => ({
  env: mockEnv,
}))

import { POST } from './route'

describe('POST /api/admin/seed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv.cronSecret = 'test-secret'
  })

  it('rejects unauthorized request', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/seed', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toContain('authorization')
  })

  it('rejects wrong token', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/seed', {
      method: 'POST',
      headers: { authorization: 'Bearer wrong-token' },
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('returns error when CRON_SECRET not configured (P0 auth bypass fix)', async () => {
    mockEnv.cronSecret = undefined
    const req = new NextRequest('http://localhost:3000/api/admin/seed', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toContain('not available')
    expect(mockRunSeed).not.toHaveBeenCalled()
  })

  it('runs seed with valid auth', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/seed', {
      method: 'POST',
      headers: { authorization: 'Bearer test-secret' },
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(mockRunSeed).toHaveBeenCalled()
  })

  it('reports errors from seed operation', async () => {
    mockRunSeed.mockResolvedValueOnce({ inserted: 3, errors: ['Parse error on row 5'] })
    const req = new NextRequest('http://localhost:3000/api/admin/seed', {
      method: 'POST',
      headers: { authorization: 'Bearer test-secret' },
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    const json = await res.json()
    expect(json.data.warning).toContain('1 error(s)')
  })
})
