import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockGetProject,
  mockGetBids,
  mockCreatePdfDocument,
  mockAddHeader,
  mockAddSectionTitle,
  mockAddTable,
  mockAddParagraph,
  mockAddFooter,
  mockDocToBuffer,
} = vi.hoisted(() => ({
  mockGetProject: vi.fn(),
  mockGetBids: vi.fn(),
  mockCreatePdfDocument: vi.fn(),
  mockAddHeader: vi.fn(),
  mockAddSectionTitle: vi.fn(),
  mockAddTable: vi.fn(),
  mockAddParagraph: vi.fn(),
  mockAddFooter: vi.fn(),
  mockDocToBuffer: vi.fn(),
}))

vi.mock('react', () => ({ cache: (fn: unknown) => fn }))

vi.mock('@/lib/project-service', () => ({
  getProject: mockGetProject,
}))

vi.mock('@/lib/bids-service', () => ({
  getBids: mockGetBids,
}))

vi.mock('@/lib/pdf-generator', () => ({
  createPdfDocument: mockCreatePdfDocument,
  addHeader: mockAddHeader,
  addSectionTitle: mockAddSectionTitle,
  addTable: mockAddTable,
  addParagraph: mockAddParagraph,
  addFooter: mockAddFooter,
  docToBuffer: mockDocToBuffer,
}))

import { GET } from './route'

describe('GET /api/export/bid-comparison', () => {
  const mockDoc = { fake: 'doc' }

  const sampleBids = [
    {
      vendor_name: 'ABC Framing',
      total_amount: 45000,
      status: 'received',
      lead_time_weeks: 4,
      scope_of_work: 'Full framing package',
      description: 'Framing work',
      category: 'Framing',
    },
    {
      vendor_name: 'XYZ Framing',
      total_amount: 52000,
      status: 'selected',
      lead_time_weeks: 6,
      scope_of_work: 'Complete framing',
      description: 'Framing work',
      category: 'Framing',
    },
    {
      vendor_name: 'Plumbing Pro',
      total_amount: 18000,
      status: 'received',
      lead_time_weeks: null,
      scope_of_work: null,
      description: 'Plumbing rough-in',
      category: 'Plumbing',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProject.mockResolvedValue({ id: 'proj-1', address: '708 Purple Salvia Cove' })
    mockGetBids.mockResolvedValue(sampleBids)
    mockCreatePdfDocument.mockReturnValue(mockDoc)
    mockDocToBuffer.mockResolvedValue(Buffer.from('fake-pdf'))
  })

  it('generates a PDF bid comparison', async () => {
    const req = new NextRequest('http://localhost/api/export/bid-comparison')
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(res.headers.get('Content-Disposition')).toContain('attachment; filename="bid-comparison-')

    expect(mockCreatePdfDocument).toHaveBeenCalled()
    expect(mockAddHeader).toHaveBeenCalledWith(
      mockDoc,
      'Bid Comparison',
      expect.stringContaining('708 Purple Salvia Cove')
    )
    expect(mockAddSectionTitle).toHaveBeenCalledWith(mockDoc, 'Framing')
    expect(mockAddSectionTitle).toHaveBeenCalledWith(mockDoc, 'Plumbing')
    expect(mockAddTable).toHaveBeenCalledTimes(2)
    expect(mockAddFooter).toHaveBeenCalledWith(mockDoc)
    expect(mockDocToBuffer).toHaveBeenCalledWith(mockDoc)
  })

  it('filters by category query param', async () => {
    const req = new NextRequest('http://localhost/api/export/bid-comparison?category=Framing')
    await GET(req)

    // Only Framing section, not Plumbing
    expect(mockAddSectionTitle).toHaveBeenCalledWith(mockDoc, 'Framing')
    expect(mockAddSectionTitle).not.toHaveBeenCalledWith(mockDoc, 'Plumbing')
    expect(mockAddTable).toHaveBeenCalledTimes(1)
  })

  it('shows spread and selected vendor for multi-bid categories', async () => {
    const req = new NextRequest('http://localhost/api/export/bid-comparison')
    await GET(req)

    // Framing has 2 bids — should show range paragraph and selected paragraph
    expect(mockAddParagraph).toHaveBeenCalledWith(
      mockDoc,
      expect.stringContaining('Range:')
    )
    expect(mockAddParagraph).toHaveBeenCalledWith(
      mockDoc,
      expect.stringContaining('Selected: XYZ Framing')
    )
  })

  it('returns 404 when no project found', async () => {
    mockGetProject.mockResolvedValueOnce(null)

    const req = new NextRequest('http://localhost/api/export/bid-comparison')
    const res = await GET(req)
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('No project found')
  })

  it('returns 500 when PDF generation throws', async () => {
    mockDocToBuffer.mockRejectedValueOnce(new Error('PDF error'))

    const req = new NextRequest('http://localhost/api/export/bid-comparison')
    const res = await GET(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('Failed to generate PDF')
  })

  it('handles empty bids gracefully', async () => {
    mockGetBids.mockResolvedValueOnce([])

    const req = new NextRequest('http://localhost/api/export/bid-comparison')
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(mockAddSectionTitle).not.toHaveBeenCalled()
    expect(mockAddTable).not.toHaveBeenCalled()
  })
})
