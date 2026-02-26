import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('env', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns required env vars when set', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
    process.env.GOOGLE_CLIENT_ID = 'gid'
    process.env.GOOGLE_CLIENT_SECRET = 'gsec'
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost/cb'

    const { env } = await import('./env')
    expect(env.supabaseUrl).toBe('https://test.supabase.co')
    expect(env.googleClientId).toBe('gid')
  })

  it('throws for missing required env var', async () => {
    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.GOOGLE_CLIENT_SECRET
    delete process.env.GOOGLE_REDIRECT_URI

    const { env } = await import('./env')
    expect(() => env.googleClientId).toThrow('Missing required environment variable: GOOGLE_CLIENT_ID')
  })

  it('returns undefined for missing optional env var', async () => {
    delete process.env.ANTHROPIC_API_KEY
    const { env } = await import('./env')
    expect(env.anthropicApiKey).toBeUndefined()
  })

  it('returns default for optional env with default', async () => {
    delete process.env.PROJECT_ADDRESS
    const { env } = await import('./env')
    expect(env.projectAddress).toBe('708 Purple Salvia Cove, Liberty Hill, TX')
  })

  it('returns set value over default', async () => {
    process.env.PROJECT_ADDRESS = '123 Test St'
    const { env } = await import('./env')
    expect(env.projectAddress).toBe('123 Test St')
  })

  it('returns nodeEnv with default', async () => {
    const { env } = await import('./env')
    expect(env.nodeEnv).toBeDefined()
  })
})
