import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockGetProject,
  mockGetProjectStatus,
  mockCreatePdfDocument,
  mockAddHeader,
  mockAddSectionTitle,
  mockAddParagraph,
  mockAddBulletList,
  mockAddFooter,
  mockDocToBuffer,
} = vi.hoisted(() => ({
  mockGetProject: vi.fn(),
  mockGetProjectStatus: vi.fn(),
  mockCreatePdfDocument: vi.fn(),
  mockAddHeader: vi.fn(),
  mockAddSectionTitle: vi.fn(),
  mockAddParagraph: vi.fn(),
  mockAddBulletList: vi.fn(),
  mockAddFooter: vi.fn(),
  mockDocToBuffer: vi.fn(),
}))

vi.mock('react', () => ({ cache: (fn: unknown) => fn }))

vi.mock('@/lib/project-service', () => ({
  getProject: mockGetProject,
  getProjectStatus: mockGetProjectStatus,
}))

vi.mock('@/lib/pdf-generator', () => ({
  createPdfDocument: mockCreatePdfDocument,
  addHeader: mockAddHeader,
  addSectionTitle: mockAddSectionTitle,
  addParagraph: mockAddParagraph,
  addBulletList: mockAddBulletList,
  addFooter: mockAddFooter,
  docToBuffer: mockDocToBuffer,
}))

import { GET } from './route'

describe('GET /api/export/status-report', () => {
  const mockDoc = { fake: 'doc' }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProject.mockResolvedValue({ id: 'proj-1', address: '708 Purple Salvia Cove' })
    mockGetProjectStatus.mockResolvedValue({
      phase: 'Construction',
      currentStep: 'Foundation',
      stepNumber: 2,
      totalSteps: 10,
      progressPercentage: 20,
      daysElapsed: 45,
      totalDays: 365,
      budgetUsed: 200000,
      budgetTotal: 1500000,
      budgetStatus: 'On Track',
      aiSummary: 'Project is progressing well.',
      hotTopics: [{ priority: 'high', text: 'Concrete delivery delayed' }],
      actionItems: [{ status: 'pending', text: 'Schedule framing inspection' }],
      recentDecisions: [{ decision: 'Use spray foam', impact: 'Better insulation' }],
      nextSteps: ['Pour foundation', 'Order lumber'],
    })
    mockCreatePdfDocument.mockReturnValue(mockDoc)
    mockDocToBuffer.mockResolvedValue(Buffer.from('fake-pdf-content'))
  })

  it('generates a PDF status report', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(res.headers.get('Content-Disposition')).toContain('attachment; filename="status-report-')

    expect(mockCreatePdfDocument).toHaveBeenCalled()
    expect(mockAddHeader).toHaveBeenCalledWith(mockDoc, 'Project Status Report', expect.stringContaining('708 Purple Salvia Cove'))
    expect(mockAddSectionTitle).toHaveBeenCalledWith(mockDoc, 'Overview')
    expect(mockAddSectionTitle).toHaveBeenCalledWith(mockDoc, 'AI Summary')
    expect(mockAddSectionTitle).toHaveBeenCalledWith(mockDoc, 'Hot Topics')
    expect(mockAddSectionTitle).toHaveBeenCalledWith(mockDoc, 'Action Items')
    expect(mockAddSectionTitle).toHaveBeenCalledWith(mockDoc, 'Recent Decisions')
    expect(mockAddSectionTitle).toHaveBeenCalledWith(mockDoc, 'Next Steps')
    expect(mockAddFooter).toHaveBeenCalledWith(mockDoc)
    expect(mockDocToBuffer).toHaveBeenCalledWith(mockDoc)
  })

  it('returns 404 when no project found', async () => {
    mockGetProject.mockResolvedValueOnce(null)

    const res = await GET()
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('No project found')
  })

  it('returns 404 when no status data', async () => {
    mockGetProjectStatus.mockResolvedValueOnce(null)

    const res = await GET()
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('No status data')
  })

  it('skips optional sections when empty', async () => {
    mockGetProjectStatus.mockResolvedValueOnce({
      phase: 'Planning',
      currentStep: 'Site Analysis',
      stepNumber: 1,
      totalSteps: 6,
      progressPercentage: 10,
      daysElapsed: 10,
      totalDays: 365,
      budgetUsed: 0,
      budgetTotal: 1500000,
      budgetStatus: 'On Track',
      aiSummary: null,
      hotTopics: [],
      actionItems: [],
      recentDecisions: [],
      nextSteps: [],
    })

    await GET()
    expect(mockAddSectionTitle).not.toHaveBeenCalledWith(mockDoc, 'AI Summary')
    expect(mockAddSectionTitle).not.toHaveBeenCalledWith(mockDoc, 'Hot Topics')
    expect(mockAddSectionTitle).not.toHaveBeenCalledWith(mockDoc, 'Action Items')
    expect(mockAddSectionTitle).not.toHaveBeenCalledWith(mockDoc, 'Recent Decisions')
    expect(mockAddSectionTitle).not.toHaveBeenCalledWith(mockDoc, 'Next Steps')
  })

  it('returns 500 when PDF generation throws', async () => {
    mockDocToBuffer.mockRejectedValueOnce(new Error('PDF generation failed'))

    const res = await GET()
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('Failed to generate PDF')
  })
})
