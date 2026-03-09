import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted to declare mocks before vi.mock hoisting
const { mockChain, CHAIN_METHODS } = vi.hoisted(() => {
  const chain: Record<string, any> = {}
  const methods = ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'in', 'gte', 'order', 'limit', 'single', 'from'] as const
  return { mockChain: chain, CHAIN_METHODS: methods }
})

vi.mock('./supabase', () => {
  // Initialize inside the factory
  for (const m of CHAIN_METHODS) {
    mockChain[m] = vi.fn().mockReturnValue(mockChain)
  }
  // Make single terminal
  mockChain.single = vi.fn().mockResolvedValue({ data: null, error: null })

  // Make chain thenable
  Object.defineProperty(mockChain, 'then', {
    value: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
    writable: true,
    configurable: true,
  })

  return { supabase: { from: (...args: unknown[]) => mockChain.from(...args) } }
})

vi.mock('./env', () => ({
  env: {
    projectAddress: '708 Purple Salvia Cove, Liberty Hill, TX',
    projectName: 'Test Project',
    gmailUserEmail: 'test@gmail.com',
  },
}))

import { DatabaseService } from './database'

function resetChain() {
  for (const m of CHAIN_METHODS) {
    mockChain[m] = vi.fn().mockReturnValue(mockChain)
  }
  mockChain.single = vi.fn().mockResolvedValue({ data: null, error: null })
  Object.defineProperty(mockChain, 'then', {
    value: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
    writable: true,
    configurable: true,
  })
}

describe('DatabaseService', () => {
  let db: DatabaseService

  beforeEach(() => {
    db = new DatabaseService()
    resetChain()
  })

  // ─── getEmailAccount ────────────────────────────────────────────────

  describe('getEmailAccount', () => {
    it('returns account data on success', async () => {
      const account = { id: '1', email_address: 'test@gmail.com' }
      mockChain.single.mockResolvedValueOnce({ data: account, error: null })

      const result = await db.getEmailAccount('test@gmail.com')
      expect(result).toEqual(account)
      expect(mockChain.from).toHaveBeenCalledWith('email_accounts')
    })

    it('returns null on not-found (PGRST116)', async () => {
      mockChain.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
      const result = await db.getEmailAccount('missing@test.com')
      expect(result).toBeNull()
    })

    it('returns null on database error', async () => {
      mockChain.single.mockResolvedValueOnce({ data: null, error: { code: 'OTHER', message: 'fail' } })
      const result = await db.getEmailAccount('test@gmail.com')
      expect(result).toBeNull()
    })

    it('returns null on thrown exception', async () => {
      mockChain.single.mockRejectedValueOnce(new Error('network'))
      const result = await db.getEmailAccount('test@gmail.com')
      expect(result).toBeNull()
    })
  })

  // ─── upsertEmailAccount ─────────────────────────────────────────────

  describe('upsertEmailAccount', () => {
    it('returns upserted data on success', async () => {
      const account = { id: '1', email_address: 'test@gmail.com' }
      mockChain.single.mockResolvedValueOnce({ data: account, error: null })

      const result = await db.upsertEmailAccount(account as any)
      expect(result).toEqual(account)
      expect(mockChain.upsert).toHaveBeenCalled()
    })

    it('returns null on error', async () => {
      mockChain.single.mockResolvedValueOnce({ data: null, error: { message: 'conflict' } })
      const result = await db.upsertEmailAccount({} as any)
      expect(result).toBeNull()
    })
  })

  // ─── getStoredEmails ────────────────────────────────────────────────

  describe('getStoredEmails', () => {
    it('returns emails from query', async () => {
      const emails = [{ id: 'e1', subject: 'Test' }]
      Object.defineProperty(mockChain, 'then', {
        value: (resolve: (v: unknown) => void) => resolve({ data: emails, error: null }),
        writable: true, configurable: true,
      })

      const result = await db.getStoredEmails('proj-1', 10)
      expect(result).toEqual(emails)
    })

    it('returns empty array on error', async () => {
      Object.defineProperty(mockChain, 'then', {
        value: (resolve: (v: unknown) => void) => resolve({ data: null, error: { message: 'fail' } }),
        writable: true, configurable: true,
      })
      const result = await db.getStoredEmails()
      expect(result).toEqual([])
    })
  })

  // ─── storeEmail ─────────────────────────────────────────────────────

  describe('storeEmail', () => {
    it('upserts and returns email', async () => {
      const email = { message_id: 'msg-1', subject: 'Test' }
      mockChain.single.mockResolvedValueOnce({ data: email, error: null })

      const result = await db.storeEmail(email as any)
      expect(result).toEqual(email)
    })

    it('returns null on error', async () => {
      mockChain.single.mockResolvedValueOnce({ data: null, error: { message: 'dup' } })
      const result = await db.storeEmail({} as any)
      expect(result).toBeNull()
    })
  })

  // ─── storeEmails (batch) ────────────────────────────────────────────

  describe('storeEmails', () => {
    it('returns stored emails', async () => {
      const emails = [{ message_id: 'a' }, { message_id: 'b' }]
      // storeEmails chains .upsert().select() — select is terminal here
      Object.defineProperty(mockChain, 'then', {
        value: (resolve: (v: unknown) => void) => resolve({ data: emails, error: null }),
        writable: true, configurable: true,
      })

      const result = await db.storeEmails(emails as any)
      expect(result).toEqual(emails)
    })

    it('returns empty array on error', async () => {
      Object.defineProperty(mockChain, 'then', {
        value: (resolve: (v: unknown) => void) => resolve({ data: null, error: { message: 'fail' } }),
        writable: true, configurable: true,
      })
      const result = await db.storeEmails([])
      expect(result).toEqual([])
    })
  })

  // ─── emailExists ───────────────────────────────────────────────────

  describe('emailExists', () => {
    it('returns true when found', async () => {
      mockChain.single.mockResolvedValueOnce({ data: { id: '1' }, error: null })
      expect(await db.emailExists('msg-1')).toBe(true)
    })

    it('returns false when not found', async () => {
      mockChain.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
      expect(await db.emailExists('msg-x')).toBe(false)
    })

    it('returns false on exception', async () => {
      mockChain.single.mockRejectedValueOnce(new Error('fail'))
      expect(await db.emailExists('msg-x')).toBe(false)
    })
  })

  // ─── getOrCreateProject ─────────────────────────────────────────────

  describe('getOrCreateProject', () => {
    it('returns existing project id', async () => {
      mockChain.single.mockResolvedValueOnce({ data: { id: 'proj-1' }, error: null })
      const result = await db.getOrCreateProject()
      expect(result).toBe('proj-1')
    })

    it('creates project when not found', async () => {
      mockChain.single
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: { id: 'proj-new' }, error: null })

      const result = await db.getOrCreateProject('123 Main St')
      expect(result).toBe('proj-new')
    })

    it('returns null when create fails', async () => {
      mockChain.single
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'create failed' } })

      const result = await db.getOrCreateProject()
      expect(result).toBeNull()
    })
  })

  // ─── getLatestProjectStatus ─────────────────────────────────────────

  describe('getLatestProjectStatus', () => {
    it('returns latest status', async () => {
      const status = { hot_topics: [], action_items: [], recent_decisions: [], next_steps: [], open_questions: [], key_data_points: [], ai_summary: 'ok', date: '2026-01-15' }
      mockChain.single.mockResolvedValueOnce({ data: status, error: null })
      const result = await db.getLatestProjectStatus('proj-1')
      expect(result).toEqual(status)
    })

    it('returns null on not found', async () => {
      mockChain.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
      const result = await db.getLatestProjectStatus('proj-x')
      expect(result).toBeNull()
    })
  })

  // ─── getProjectContactEmails ────────────────────────────────────────

  describe('getProjectContactEmails', () => {
    it('returns filtered email list', async () => {
      const contacts = [{ email: 'a@test.com' }, { email: null }, { email: 'b@test.com' }]
      Object.defineProperty(mockChain, 'then', {
        value: (resolve: (v: unknown) => void) => resolve({ data: contacts, error: null }),
        writable: true, configurable: true,
      })

      const result = await db.getProjectContactEmails('proj-1')
      expect(result).toEqual(['a@test.com', 'b@test.com'])
    })
  })

  // ─── updateLastSync ─────────────────────────────────────────────────

  describe('updateLastSync', () => {
    it('updates without throwing', async () => {
      Object.defineProperty(mockChain, 'then', {
        value: (resolve: (v: unknown) => void) => resolve({ error: null }),
        writable: true, configurable: true,
      })
      await expect(db.updateLastSync('test@gmail.com')).resolves.not.toThrow()
    })
  })
})
