import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockGetPlaidConnections,
  mockUpsertPlaidConnection,
  mockRemoveItem,
  mockDecryptTokens,
  mockIsEncryptedTokens,
  mockGetProject,
} = vi.hoisted(() => ({
  mockGetPlaidConnections: vi.fn(),
  mockUpsertPlaidConnection: vi.fn(),
  mockRemoveItem: vi.fn(),
  mockDecryptTokens: vi.fn(),
  mockIsEncryptedTokens: vi.fn(),
  mockGetProject: vi.fn(),
}))

vi.mock('react', () => ({ cache: (fn: unknown) => fn }))

vi.mock('@/lib/financial-service', () => ({
  getPlaidConnections: mockGetPlaidConnections,
  upsertPlaidConnection: mockUpsertPlaidConnection,
}))

vi.mock('@/lib/plaid-client', () => ({
  removeItem: mockRemoveItem,
}))

vi.mock('@/lib/token-encryption', () => ({
  decryptTokens: mockDecryptTokens,
  isEncryptedTokens: mockIsEncryptedTokens,
}))

vi.mock('@/lib/project-service', () => ({
  getProject: mockGetProject,
}))

import { GET, DELETE } from './route'

describe('GET /api/plaid/connections', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProject.mockResolvedValue({ id: 'proj-1' })
  })

  it('returns connections with access_token stripped', async () => {
    mockGetPlaidConnections.mockResolvedValueOnce([
      { id: 'conn-1', institution_name: 'Chase', item_id: 'item-1', access_token: 'secret-token', status: 'active' },
    ])

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.connections).toHaveLength(1)
    expect(json.data.connections[0]).not.toHaveProperty('access_token')
    expect(json.data.connections[0].institution_name).toBe('Chase')
  })

  it('returns error when no project found', async () => {
    mockGetProject.mockResolvedValueOnce(null)

    const res = await GET()
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})

describe('DELETE /api/plaid/connections', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProject.mockResolvedValue({ id: 'proj-1' })
    mockRemoveItem.mockResolvedValue(undefined)
    mockUpsertPlaidConnection.mockResolvedValue({ id: 'conn-1', status: 'disconnected' })
  })

  it('disconnects a connection', async () => {
    mockGetPlaidConnections.mockResolvedValueOnce([
      { id: 'conn-1', item_id: 'item-1', access_token: JSON.stringify({ iv: 'x', data: 'y', tag: 'z' }) },
    ])
    mockIsEncryptedTokens.mockReturnValueOnce(true)
    mockDecryptTokens.mockReturnValueOnce({ access_token: 'decrypted-token' })

    const req = new NextRequest('http://localhost/api/plaid/connections', {
      method: 'DELETE',
      body: JSON.stringify({ item_id: 'item-1' }),
    })

    const res = await DELETE(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.disconnected).toBe(true)
    expect(mockRemoveItem).toHaveBeenCalledWith('decrypted-token')
    expect(mockUpsertPlaidConnection).toHaveBeenCalledWith(
      expect.objectContaining({ item_id: 'item-1', status: 'disconnected' })
    )
  })

  it('returns validation error when item_id missing', async () => {
    const req = new NextRequest('http://localhost/api/plaid/connections', {
      method: 'DELETE',
      body: JSON.stringify({}),
    })

    const res = await DELETE(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('returns error when no project found', async () => {
    mockGetProject.mockResolvedValueOnce(null)

    const req = new NextRequest('http://localhost/api/plaid/connections', {
      method: 'DELETE',
      body: JSON.stringify({ item_id: 'item-1' }),
    })

    const res = await DELETE(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('still disconnects locally even if Plaid removeItem fails', async () => {
    mockGetPlaidConnections.mockResolvedValueOnce([
      { id: 'conn-1', item_id: 'item-1', access_token: 'plain-token' },
    ])
    mockIsEncryptedTokens.mockReturnValueOnce(false)
    mockRemoveItem.mockRejectedValueOnce(new Error('Plaid error'))

    const req = new NextRequest('http://localhost/api/plaid/connections', {
      method: 'DELETE',
      body: JSON.stringify({ item_id: 'item-1' }),
    })

    const res = await DELETE(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.disconnected).toBe(true)
    expect(mockUpsertPlaidConnection).toHaveBeenCalled()
  })
})
