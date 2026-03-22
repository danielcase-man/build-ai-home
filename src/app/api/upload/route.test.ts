import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockGetProject,
  mockAnalyzeProjectDocument,
  mockProcessUploadedPlan,
  mockProcessUploadedDXF,
  mockSupabase,
  mockPdfParse,
} = vi.hoisted(() => {
  const mockResult = { data: null as unknown, error: null as unknown }
  const chain = {
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn(() => mockResult),
  }
  return {
    mockGetProject: vi.fn(),
    mockAnalyzeProjectDocument: vi.fn(),
    mockProcessUploadedPlan: vi.fn(),
    mockProcessUploadedDXF: vi.fn(),
    mockSupabase: { chain, mockResult },
    mockPdfParse: vi.fn(),
  }
})

vi.mock('react', () => ({ cache: (fn: unknown) => fn }))

vi.mock('@/lib/project-service', () => ({
  getProject: mockGetProject,
}))

vi.mock('@/lib/document-analyzer', () => ({
  analyzeProjectDocument: mockAnalyzeProjectDocument,
}))

vi.mock('@/lib/plan-takeoff-service', () => ({
  processUploadedPlan: mockProcessUploadedPlan,
  processUploadedDXF: mockProcessUploadedDXF,
}))

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase.chain,
}))

vi.mock('pdf-parse-fork', () => ({
  default: mockPdfParse,
}))

import { POST } from './route'

function makeRequest(
  filename: string,
  content: string,
  type: string,
  extras?: Record<string, string>
): NextRequest {
  const blob = new Blob([content], { type })
  const file = new File([blob], filename, { type })
  const formData = new FormData()
  formData.append('file', file)
  if (extras) {
    for (const [key, value] of Object.entries(extras)) {
      formData.append(key, value)
    }
  }
  return new NextRequest('http://localhost/api/upload', {
    method: 'POST',
    body: formData,
  })
}

describe('POST /api/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProject.mockResolvedValue({ id: 'proj-1' })
    mockSupabase.mockResult.data = null
    mockSupabase.mockResult.error = null
    mockAnalyzeProjectDocument.mockResolvedValue({
      phase: 'Construction',
      tasks: ['Pour foundation'],
    })
    mockPdfParse.mockResolvedValue({ text: 'Extracted PDF text content' })
  })

  it('returns validation error when no file provided', async () => {
    const formData = new FormData()
    const req = new NextRequest('http://localhost/api/upload', {
      method: 'POST',
      body: formData,
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('No file provided')
  })

  it('returns validation error for unsupported file type', async () => {
    const blob = new Blob(['data'], { type: 'application/zip' })
    const file = new File([blob], 'archive.zip', { type: 'application/zip' })
    const formData = new FormData()
    formData.append('file', file)

    const req = new NextRequest('http://localhost/api/upload', {
      method: 'POST',
      body: formData,
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Unsupported file type')
  })

  it('returns validation error for file too large', async () => {
    // Create a blob larger than 10MB
    const largeContent = 'x'.repeat(11 * 1024 * 1024)
    const blob = new Blob([largeContent], { type: 'text/plain' })
    const file = new File([blob], 'huge.txt', { type: 'text/plain' })
    const formData = new FormData()
    formData.append('file', file)

    const req = new NextRequest('http://localhost/api/upload', {
      method: 'POST',
      body: formData,
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('File too large')
  })

  it('uploads and analyzes a text file', async () => {
    const req = makeRequest('spec.txt', 'Foundation specs for the build.', 'text/plain')
    const res = await POST(req)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.filename).toBe('spec.txt')
    expect(json.data.analysis.phase).toBe('Construction')
    expect(json.data.message).toBe('Document uploaded and analyzed successfully')
    expect(mockAnalyzeProjectDocument).toHaveBeenCalledWith(
      'Foundation specs for the build.',
      'spec.txt'
    )
  })

  it('uploads and analyzes a PDF file', async () => {
    const req = makeRequest('plans.pdf', 'fake-pdf-bytes', 'application/pdf')
    const res = await POST(req)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.filename).toBe('plans.pdf')
    expect(mockPdfParse).toHaveBeenCalled()
    expect(mockAnalyzeProjectDocument).toHaveBeenCalledWith(
      'Extracted PDF text content',
      'plans.pdf'
    )
  })

  it('handles PDF with no extractable text', async () => {
    mockPdfParse.mockResolvedValueOnce({ text: '' })

    const req = makeRequest('image-only.pdf', 'binary-data', 'application/pdf')
    const res = await POST(req)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.analysis).toBeNull()
    expect(json.data.message).toContain('no text content could be extracted')
  })

  it('returns error when no project found', async () => {
    mockGetProject.mockResolvedValueOnce(null)

    const req = makeRequest('spec.txt', 'Some content', 'text/plain')
    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toBe('No project found')
  })

  it('stores document reference and tasks after analysis', async () => {
    mockSupabase.mockResult.data = null
    mockSupabase.mockResult.error = null

    const req = makeRequest('spec.txt', 'Foundation specs content.', 'text/plain')
    await POST(req)

    // Should call supabase.from('documents').insert(...)
    expect(mockSupabase.chain.from).toHaveBeenCalledWith('documents')
    expect(mockSupabase.chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: 'proj-1',
        name: 'spec.txt',
        category: 'uploaded',
      })
    )

    // Should also insert tasks from analysis
    expect(mockSupabase.chain.from).toHaveBeenCalledWith('tasks')
    expect(mockSupabase.chain.insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          project_id: 'proj-1',
          title: 'Pour foundation',
          status: 'pending',
        }),
      ])
    )
  })

  it('accepts files by allowed extension even with generic MIME', async () => {
    const blob = new Blob(['text content'], { type: 'application/octet-stream' })
    const file = new File([blob], 'doc.txt', { type: 'application/octet-stream' })
    const formData = new FormData()
    formData.append('file', file)

    const req = new NextRequest('http://localhost/api/upload', {
      method: 'POST',
      body: formData,
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it('returns 500 when processing throws', async () => {
    mockAnalyzeProjectDocument.mockRejectedValueOnce(new Error('AI service down'))

    const req = makeRequest('spec.txt', 'Content here.', 'text/plain')
    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toBe('Failed to process file')
  })
})
