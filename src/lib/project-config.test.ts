import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockChain: Record<string, ReturnType<typeof vi.fn>> = {}
for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'in', 'gte', 'order', 'limit', 'single', 'from'] as const) {
  mockChain[m] = vi.fn()
}
for (const m of Object.keys(mockChain)) {
  mockChain[m].mockReturnValue(mockChain)
}

vi.mock('./supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockChain.from(...args) },
}))

import { getProjectConfig, getDropboxBasePath } from './project-config'

describe('project-config', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    for (const m of Object.keys(mockChain)) {
      mockChain[m].mockReturnValue(mockChain)
    }
    process.env = { ...originalEnv }
    delete process.env.DROPBOX_BASE
  })

  afterEach(() => {
    process.env = originalEnv
  })

  // ── getProjectConfig ────────────────────────────────────────────────

  describe('getProjectConfig', () => {
    it('returns DB config when row exists', async () => {
      mockChain.single.mockResolvedValueOnce({
        data: {
          project_id: 'proj-001',
          dropbox_base_path: '/custom/path',
          email_account_id: 'ea-001',
          project_address: '708 Purple Salvia',
          inception_date: '2025-12-01',
        },
        error: null,
      })

      const config = await getProjectConfig('proj-001')

      expect(config.projectId).toBe('proj-001')
      expect(config.dropboxBasePath).toBe('/custom/path')
      expect(config.emailAccountId).toBe('ea-001')
      expect(config.projectAddress).toBe('708 Purple Salvia')
      expect(config.inceptionDate).toBe('2025-12-01')
    })

    it('returns defaults when no row exists', async () => {
      mockChain.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })

      const config = await getProjectConfig('proj-001')

      expect(config.projectId).toBe('proj-001')
      expect(config.dropboxBasePath).toBeNull()
      expect(config.emailAccountId).toBeNull()
      expect(config.projectAddress).toBeNull()
      expect(config.inceptionDate).toBeNull()
    })
  })

  // ── getDropboxBasePath ──────────────────────────────────────────────

  describe('getDropboxBasePath', () => {
    it('returns DB value when present', async () => {
      mockChain.single.mockResolvedValueOnce({
        data: {
          project_id: 'proj-001',
          dropbox_base_path: '/db/dropbox/path',
          email_account_id: null,
          project_address: null,
          inception_date: null,
        },
        error: null,
      })

      const path = await getDropboxBasePath('proj-001')
      expect(path).toBe('/db/dropbox/path')
    })

    it('falls back to DROPBOX_BASE env var when no DB value', async () => {
      mockChain.single.mockResolvedValueOnce({ data: null, error: null })
      process.env.DROPBOX_BASE = '/env/dropbox/path'

      const path = await getDropboxBasePath('proj-001')
      expect(path).toBe('/env/dropbox/path')
    })

    it('falls back to hardcoded default when no DB or env value', async () => {
      mockChain.single.mockResolvedValueOnce({ data: null, error: null })

      const path = await getDropboxBasePath('proj-001')
      expect(path).toBe('C:/Users/danie/Dropbox/Properties/Austin, TX/Liberty Hill/708 Purple Salvia Cove')
    })

    it('prefers DB over env var', async () => {
      process.env.DROPBOX_BASE = '/env/path'
      mockChain.single.mockResolvedValueOnce({
        data: {
          project_id: 'proj-001',
          dropbox_base_path: '/db/path',
          email_account_id: null,
          project_address: null,
          inception_date: null,
        },
        error: null,
      })

      const path = await getDropboxBasePath('proj-001')
      expect(path).toBe('/db/path')
    })
  })
})
