import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabase } from '@/test/helpers'
import type { Permit } from './permits-service'

const mockSetup = createMockSupabase()
const chain = mockSetup.chain

vi.mock('./supabase', () => ({
  supabase: { from: (...args: unknown[]) => chain.from(...args) },
}))

import { getPermits, getPermitAlerts, seedRequiredPermits, REQUIRED_PERMITS } from './permits-service'

describe('permits-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getPermits', () => {
    it('returns permits for a project', async () => {
      chain.order.mockResolvedValue({
        data: [
          { id: 'p1', type: 'Building Permit', status: 'not_started' },
          { id: 'p2', type: 'OSSF Septic Permit', status: 'applied' },
        ],
        error: null,
      })

      const permits = await getPermits('proj-1')
      expect(permits).toHaveLength(2)
      expect(chain.from).toHaveBeenCalledWith('permits')
    })

    it('returns empty array on error', async () => {
      chain.order.mockResolvedValue({ data: null, error: { message: 'err' } })
      const permits = await getPermits('proj-1')
      expect(permits).toEqual([])
    })
  })

  describe('getPermitAlerts', () => {
    it('flags not_started permits', () => {
      const permits: Permit[] = [
        { id: 'p1', project_id: 'proj-1', type: 'Building Permit', status: 'not_started' },
      ]
      const alerts = getPermitAlerts(permits)
      expect(alerts).toHaveLength(1)
      expect(alerts[0].alertType).toBe('not_started')
    })

    it('flags expired permits', () => {
      const permits: Permit[] = [
        {
          id: 'p1', project_id: 'proj-1', type: 'Building Permit', status: 'approved',
          expiration_date: '2020-01-01',
        },
      ]
      const alerts = getPermitAlerts(permits)
      expect(alerts).toHaveLength(1)
      expect(alerts[0].alertType).toBe('expired')
    })

    it('flags expiring soon permits (within 30 days)', () => {
      const futureDate = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10)
      const permits: Permit[] = [
        {
          id: 'p1', project_id: 'proj-1', type: 'Building Permit', status: 'active',
          expiration_date: futureDate,
        },
      ]
      const alerts = getPermitAlerts(permits)
      expect(alerts).toHaveLength(1)
      expect(alerts[0].alertType).toBe('expiring_soon')
    })

    it('does not flag permits expiring > 30 days out', () => {
      const futureDate = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10)
      const permits: Permit[] = [
        {
          id: 'p1', project_id: 'proj-1', type: 'Building Permit', status: 'active',
          expiration_date: futureDate,
        },
      ]
      const alerts = getPermitAlerts(permits)
      expect(alerts).toHaveLength(0)
    })

    it('sorts alerts by priority (expired first)', () => {
      const permits: Permit[] = [
        { id: 'p1', project_id: 'proj-1', type: 'Permit A', status: 'not_started' },
        {
          id: 'p2', project_id: 'proj-1', type: 'Permit B', status: 'approved',
          expiration_date: '2020-01-01',
        },
      ]
      const alerts = getPermitAlerts(permits)
      expect(alerts[0].alertType).toBe('expired')
      expect(alerts[1].alertType).toBe('not_started')
    })
  })

  describe('REQUIRED_PERMITS', () => {
    it('includes building permit and OSSF', () => {
      const types = REQUIRED_PERMITS.map(p => p.type)
      expect(types).toContain('Building Permit')
      expect(types).toContain('OSSF Septic Permit')
      expect(types).toContain('Electrical Service')
    })
  })
})
