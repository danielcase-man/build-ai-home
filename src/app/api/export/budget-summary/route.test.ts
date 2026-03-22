import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockGetProject,
  mockGetBudgetItems,
  mockCreatePdfDocument,
  mockAddHeader,
  mockAddSectionTitle,
  mockAddTable,
  mockAddParagraph,
  mockAddFooter,
  mockDocToBuffer,
} = vi.hoisted(() => ({
  mockGetProject: vi.fn(),
  mockGetBudgetItems: vi.fn(),
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

vi.mock('@/lib/budget-service', () => ({
  getBudgetItems: mockGetBudgetItems,
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

describe('GET /api/export/budget-summary', () => {
  const mockDoc = { fake: 'doc' }

  const sampleItems = [
    {
      category: 'Foundation',
      subcategory: 'Concrete',
      description: 'Foundation pour',
      estimated_cost: 30000,
      actual_cost: 28000,
      status: 'paid',
      payment_date: '2026-02-15',
    },
    {
      category: 'Framing',
      subcategory: null,
      description: 'Framing labor',
      estimated_cost: 45000,
      actual_cost: null,
      status: 'pending',
      payment_date: null,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProject.mockResolvedValue({
      id: 'proj-1',
      address: '708 Purple Salvia Cove',
      budget_total: '1500000',
    })
    mockGetBudgetItems.mockResolvedValue(sampleItems)
    mockCreatePdfDocument.mockReturnValue(mockDoc)
    mockDocToBuffer.mockResolvedValue(Buffer.from('fake-pdf'))
  })

  it('returns CSV by default', async () => {
    const req = new NextRequest('http://localhost/api/export/budget-summary')
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/csv')
    expect(res.headers.get('Content-Disposition')).toContain('attachment; filename="budget-summary-')

    const csv = await res.text()
    expect(csv).toContain('Category,Subcategory,Description,Estimated,Actual,Status,Payment Date')
    expect(csv).toContain('Foundation')
    expect(csv).toContain('TOTAL')
  })

  it('returns CSV with format=csv param', async () => {
    const req = new NextRequest('http://localhost/api/export/budget-summary?format=csv')
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/csv')

    const csv = await res.text()
    // Totals row: estimated = 75000, actual = 28000
    expect(csv).toContain('75000')
    expect(csv).toContain('28000')
  })

  it('returns PDF with format=pdf param', async () => {
    const req = new NextRequest('http://localhost/api/export/budget-summary?format=pdf')
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(res.headers.get('Content-Disposition')).toContain('attachment; filename="budget-summary-')

    expect(mockCreatePdfDocument).toHaveBeenCalled()
    expect(mockAddHeader).toHaveBeenCalledWith(
      mockDoc,
      'Budget Summary',
      expect.stringContaining('708 Purple Salvia Cove')
    )
    expect(mockAddParagraph).toHaveBeenCalledWith(
      mockDoc,
      expect.stringContaining('Budget Total:')
    )
    expect(mockAddSectionTitle).toHaveBeenCalledWith(mockDoc, 'Line Items')
    expect(mockAddTable).toHaveBeenCalled()
    expect(mockAddFooter).toHaveBeenCalledWith(mockDoc)
    expect(mockDocToBuffer).toHaveBeenCalledWith(mockDoc)
  })

  it('returns 404 when no project found', async () => {
    mockGetProject.mockResolvedValueOnce(null)

    const req = new NextRequest('http://localhost/api/export/budget-summary')
    const res = await GET(req)
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('No project found')
  })

  it('returns 500 when export throws', async () => {
    mockGetBudgetItems.mockRejectedValueOnce(new Error('DB error'))

    const req = new NextRequest('http://localhost/api/export/budget-summary')
    const res = await GET(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('Failed to generate export')
  })

  it('uses default budget total when project has none', async () => {
    mockGetProject.mockResolvedValueOnce({
      id: 'proj-1',
      address: '708 Purple Salvia Cove',
      budget_total: null,
    })

    const req = new NextRequest('http://localhost/api/export/budget-summary?format=pdf')
    await GET(req)

    // Default is 1200000
    expect(mockAddParagraph).toHaveBeenCalledWith(
      mockDoc,
      expect.stringContaining('$1,200,000')
    )
  })
})
