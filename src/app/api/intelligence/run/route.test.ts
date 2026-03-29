import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockRequest } from '@/test/helpers'

// Mock intelligence engine
const mockRunEngine = vi.fn().mockResolvedValue({
  run_id: 'run-001',
  started_at: '2026-03-29T10:00:00Z',
  completed_at: '2026-03-29T10:01:00Z',
  sources_checked: ['dropbox'],
  changes_detected: 3,
  agents_invoked: ['bid_analysis'],
  results: [],
  errors: [],
  duration_ms: 60000,
})
vi.mock('@/lib/intelligence-engine', () => ({
  runIntelligenceEngine: (...args: unknown[]) => mockRunEngine(...args),
}))

// Mock env
vi.mock('@/lib/env', () => ({
  env: { cronSecret: 'test-secret' },
}))

import { POST } from './route'
import { NextRequest } from 'next/server'

describe('POST /api/intelligence/run', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('runs intelligence engine with cron auth', async () => {
    const request = new NextRequest(
      createMockRequest('http://localhost:3000/api/intelligence/run', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-secret' },
      })
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.run_id).toBe('run-001')
    expect(data.data.changes_detected).toBe(3)
    expect(mockRunEngine).toHaveBeenCalledWith(expect.objectContaining({
      triggerType: 'cron',
    }))
  })

  it('parses sources query param', async () => {
    const request = new NextRequest(
      createMockRequest('http://localhost:3000/api/intelligence/run?sources=dropbox,gmail&force=true', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-secret' },
      })
    )

    await POST(request)

    expect(mockRunEngine).toHaveBeenCalledWith(expect.objectContaining({
      sources: ['dropbox', 'gmail'],
      force: true,
    }))
  })

  it('parses backlog query param', async () => {
    const request = new NextRequest(
      createMockRequest('http://localhost:3000/api/intelligence/run?backlog=true', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-secret' },
      })
    )

    await POST(request)

    expect(mockRunEngine).toHaveBeenCalledWith(expect.objectContaining({
      processBacklog: true,
    }))
  })

  it('rejects unauthorized requests in production', async () => {
    // Override NODE_ENV
    const origEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    const request = new NextRequest(
      createMockRequest('http://localhost:3000/api/intelligence/run', {
        method: 'POST',
        headers: { Authorization: 'Bearer wrong-secret' },
      })
    )

    const response = await POST(request)
    expect(response.status).toBe(500) // errorResponse returns 500

    process.env.NODE_ENV = origEnv
  })
})
