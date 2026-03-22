import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockGetProject,
  mockStartWorkflowItem,
  mockCompleteWorkflowItem,
  mockBlockWorkflowItem,
  mockRecordDecision,
  mockLogChange,
} = vi.hoisted(() => ({
  mockGetProject: vi.fn(),
  mockStartWorkflowItem: vi.fn(),
  mockCompleteWorkflowItem: vi.fn(),
  mockBlockWorkflowItem: vi.fn(),
  mockRecordDecision: vi.fn(),
  mockLogChange: vi.fn(),
}))

vi.mock('react', () => ({ cache: (fn: unknown) => fn }))

vi.mock('@/lib/project-service', () => ({
  getProject: mockGetProject,
}))

vi.mock('@/lib/workflow-service', () => ({
  startWorkflowItem: mockStartWorkflowItem,
  completeWorkflowItem: mockCompleteWorkflowItem,
  blockWorkflowItem: mockBlockWorkflowItem,
  recordDecision: mockRecordDecision,
}))

vi.mock('@/lib/audit-service', () => ({
  logChange: mockLogChange,
}))

import { POST } from './route'

function makeReq(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/workflow/update-item', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('POST /api/workflow/update-item', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProject.mockResolvedValue({ id: 'proj-1' })
    mockLogChange.mockResolvedValue(undefined)
  })

  it('returns error when no project found', async () => {
    mockGetProject.mockResolvedValueOnce(null)

    const res = await POST(makeReq({ knowledge_id: 'k-1', action: 'start' }))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('returns validation error when missing knowledge_id', async () => {
    const res = await POST(makeReq({ action: 'start' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
    expect(json.error).toContain('knowledge_id')
  })

  it('returns validation error when missing action', async () => {
    const res = await POST(makeReq({ knowledge_id: 'k-1' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
    expect(json.error).toContain('action')
  })

  it('starts a workflow item', async () => {
    mockStartWorkflowItem.mockResolvedValueOnce({ status: 'in_progress' })

    const res = await POST(makeReq({ knowledge_id: 'k-1', action: 'start' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.state.status).toBe('in_progress')
    expect(mockStartWorkflowItem).toHaveBeenCalledWith('proj-1', 'k-1')
    expect(mockLogChange).toHaveBeenCalled()
  })

  it('completes a workflow item', async () => {
    mockCompleteWorkflowItem.mockResolvedValueOnce({ status: 'completed' })

    const res = await POST(makeReq({
      knowledge_id: 'k-1',
      action: 'complete',
      completed_date: '2026-03-20',
      actual_cost: 5000,
      notes: 'Done',
    }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.state.status).toBe('completed')
    expect(mockCompleteWorkflowItem).toHaveBeenCalledWith('proj-1', 'k-1', {
      completedDate: '2026-03-20',
      actualCost: 5000,
      notes: 'Done',
    })
  })

  it('blocks a workflow item', async () => {
    mockBlockWorkflowItem.mockResolvedValueOnce({ status: 'blocked' })

    const res = await POST(makeReq({
      knowledge_id: 'k-1',
      action: 'block',
      blocking_reason: 'Waiting on permit',
    }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.state.status).toBe('blocked')
    expect(mockBlockWorkflowItem).toHaveBeenCalledWith('proj-1', 'k-1', 'Waiting on permit')
  })

  it('returns validation error when block action missing blocking_reason', async () => {
    const res = await POST(makeReq({ knowledge_id: 'k-1', action: 'block' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
    expect(json.error).toContain('blocking_reason')
  })

  it('records a decision', async () => {
    mockRecordDecision.mockResolvedValueOnce({ status: 'decided' })

    const res = await POST(makeReq({
      knowledge_id: 'k-1',
      action: 'decide',
      selected_option: 'Option A',
      notes: 'Best value',
    }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.state.status).toBe('decided')
    expect(mockRecordDecision).toHaveBeenCalledWith('proj-1', 'k-1', 'Option A', 'Best value')
  })

  it('returns validation error when decide action missing selected_option', async () => {
    const res = await POST(makeReq({ knowledge_id: 'k-1', action: 'decide' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
    expect(json.error).toContain('selected_option')
  })

  it('returns validation error for invalid action', async () => {
    const res = await POST(makeReq({ knowledge_id: 'k-1', action: 'invalid' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
    expect(json.error).toContain('Invalid action')
  })

  it('returns error when update fails (null result)', async () => {
    mockStartWorkflowItem.mockResolvedValueOnce(null)

    const res = await POST(makeReq({ knowledge_id: 'k-1', action: 'start' }))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})
