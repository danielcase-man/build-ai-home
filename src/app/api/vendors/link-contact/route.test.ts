import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockLinkVendorToContact, mockUnlinkVendorContact } = vi.hoisted(() => ({
  mockLinkVendorToContact: vi.fn(),
  mockUnlinkVendorContact: vi.fn(),
}))

vi.mock('@/lib/vendor-service', () => ({
  linkVendorToContact: mockLinkVendorToContact,
  unlinkVendorContact: mockUnlinkVendorContact,
}))

import { PATCH } from './route'

describe('PATCH /api/vendors/link-contact', () => {
  beforeEach(() => vi.clearAllMocks())

  it('links vendor to contact', async () => {
    mockLinkVendorToContact.mockResolvedValueOnce(true)

    const req = new NextRequest('http://localhost/api/vendors/link-contact', {
      method: 'PATCH',
      body: JSON.stringify({ vendorId: 'v-1', contactId: 'c-1' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.message).toContain('linked')
    expect(mockLinkVendorToContact).toHaveBeenCalledWith('v-1', 'c-1')
  })

  it('unlinks vendor contact when contactId is null', async () => {
    mockUnlinkVendorContact.mockResolvedValueOnce(true)

    const req = new NextRequest('http://localhost/api/vendors/link-contact', {
      method: 'PATCH',
      body: JSON.stringify({ vendorId: 'v-1', contactId: null }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.message).toContain('unlinked')
    expect(mockUnlinkVendorContact).toHaveBeenCalledWith('v-1')
  })

  it('returns error when vendorId is missing', async () => {
    const req = new NextRequest('http://localhost/api/vendors/link-contact', {
      method: 'PATCH',
      body: JSON.stringify({ contactId: 'c-1' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('returns error when contactId is missing (not null)', async () => {
    const req = new NextRequest('http://localhost/api/vendors/link-contact', {
      method: 'PATCH',
      body: JSON.stringify({ vendorId: 'v-1' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('returns error when link fails', async () => {
    mockLinkVendorToContact.mockResolvedValueOnce(false)

    const req = new NextRequest('http://localhost/api/vendors/link-contact', {
      method: 'PATCH',
      body: JSON.stringify({ vendorId: 'v-1', contactId: 'c-1' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('returns error when unlink fails', async () => {
    mockUnlinkVendorContact.mockResolvedValueOnce(false)

    const req = new NextRequest('http://localhost/api/vendors/link-contact', {
      method: 'PATCH',
      body: JSON.stringify({ vendorId: 'v-1', contactId: null }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})
