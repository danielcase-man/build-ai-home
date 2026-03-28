import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock loan-service before importing
vi.mock('./loan-service', () => ({
  getActiveConstructionLoan: vi.fn(),
  updateLoanFields: vi.fn(),
}))

import { detectAndUpdateLoanStatusRuleBased } from './loan-status-rules'
import { getActiveConstructionLoan, updateLoanFields } from './loan-service'

const mockGetLoan = vi.mocked(getActiveConstructionLoan)
const mockUpdateFields = vi.mocked(updateLoanFields)

const baseLoan = {
  id: 'loan-1',
  project_id: 'proj-1',
  lender_name: 'River Bear Financial',
  loan_type: 'construction_permanent' as const,
  loan_amount: 830000,
  application_status: 'submitted' as const,
  loan_officer_name: 'David Wilson',
  loan_officer_email: 'david@riverbearfinancial.com',
  loan_contact_email: 'dbreton@thefederalsavingsbank.com',
}

describe('loan-status-rules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetLoan.mockResolvedValue(baseLoan)
    mockUpdateFields.mockResolvedValue(true)
  })

  it('returns no update when no loan exists', async () => {
    mockGetLoan.mockResolvedValue(null)
    const result = await detectAndUpdateLoanStatusRuleBased('proj-1', [])
    expect(result.updated).toBe(false)
  })

  it('returns no update when no loan-related emails', async () => {
    const result = await detectAndUpdateLoanStatusRuleBased('proj-1', [
      { from: 'random@example.com', subject: 'Hello', body: 'Hi there', date: '2026-03-28' },
    ])
    expect(result.updated).toBe(false)
  })

  it('detects "conditionally approved" status', async () => {
    const result = await detectAndUpdateLoanStatusRuleBased('proj-1', [
      {
        from: 'david@riverbearfinancial.com',
        subject: 'Loan Update - Conditionally Approved',
        body: 'Great news — your loan has been conditionally approved. There are a few conditions to clear.',
        date: '2026-03-28',
      },
    ])
    expect(result.updated).toBe(true)
    expect(mockUpdateFields).toHaveBeenCalledWith('loan-1', expect.objectContaining({
      application_status: 'conditionally_approved',
    }))
  })

  it('detects "fully approved" status', async () => {
    mockGetLoan.mockResolvedValue({ ...baseLoan, application_status: 'conditionally_approved' })
    const result = await detectAndUpdateLoanStatusRuleBased('proj-1', [
      {
        from: 'david@riverbearfinancial.com',
        subject: 'Clear to Close',
        body: 'Your loan is fully approved and clear to close.',
        date: '2026-03-28',
      },
    ])
    expect(result.updated).toBe(true)
    expect(mockUpdateFields).toHaveBeenCalledWith('loan-1', expect.objectContaining({
      application_status: 'approved',
    }))
  })

  it('detects "funded" status', async () => {
    mockGetLoan.mockResolvedValue({ ...baseLoan, application_status: 'approved' })
    const result = await detectAndUpdateLoanStatusRuleBased('proj-1', [
      {
        from: 'david@riverbearfinancial.com',
        subject: 'Funding Complete',
        body: 'The loan has been funded. Wire sent to title company.',
        date: '2026-03-28',
      },
    ])
    expect(result.updated).toBe(true)
    expect(mockUpdateFields).toHaveBeenCalledWith('loan-1', expect.objectContaining({
      application_status: 'funded',
    }))
  })

  it('detects "rejected" from any status', async () => {
    const result = await detectAndUpdateLoanStatusRuleBased('proj-1', [
      {
        from: 'david@riverbearfinancial.com',
        subject: 'Application Update',
        body: 'Unfortunately, your loan application has been denied.',
        date: '2026-03-28',
      },
    ])
    expect(result.updated).toBe(true)
    expect(mockUpdateFields).toHaveBeenCalledWith('loan-1', expect.objectContaining({
      application_status: 'rejected',
    }))
  })

  it('prevents backward status progression', async () => {
    mockGetLoan.mockResolvedValue({ ...baseLoan, application_status: 'conditionally_approved' })
    const result = await detectAndUpdateLoanStatusRuleBased('proj-1', [
      {
        from: 'david@riverbearfinancial.com',
        subject: 'File submitted to underwriting',
        body: 'Your file has been submitted to underwriting for review.',
        date: '2026-03-28',
      },
    ])
    expect(result.updated).toBe(false)
    expect(result.reason).toContain('backward')
  })

  it('extracts interest rate from email body', async () => {
    const result = await detectAndUpdateLoanStatusRuleBased('proj-1', [
      {
        from: 'david@riverbearfinancial.com',
        subject: 'Loan Conditionally Approved',
        body: 'Your loan has been conditionally approved. The rate locked at 6.75% for 60 days.',
        date: '2026-03-28',
      },
    ])
    expect(result.updated).toBe(true)
    const updateCall = mockUpdateFields.mock.calls[0]
    expect(updateCall[0]).toBe('loan-1')
    expect(updateCall[1]).toHaveProperty('application_status', 'conditionally_approved')
    expect(updateCall[1]).toHaveProperty('interest_rate', 6.75)
  })

  it('filters out emails with no loan signals', async () => {
    const result = await detectAndUpdateLoanStatusRuleBased('proj-1', [
      {
        from: 'random@unknown.com',
        subject: 'Weekend sale',
        body: 'Great deals this weekend.',
        date: '2026-03-28',
      },
    ])
    expect(result.updated).toBe(false)
  })

  it('matches emails by lender name in subject', async () => {
    const result = await detectAndUpdateLoanStatusRuleBased('proj-1', [
      {
        from: 'unknown@bank.com',
        subject: 'River Bear Financial — Conditionally Approved',
        body: 'Good news! Approved with conditions.',
        date: '2026-03-28',
      },
    ])
    expect(result.updated).toBe(true)
  })

  it('picks highest priority match when multiple keywords present', async () => {
    mockGetLoan.mockResolvedValue({ ...baseLoan, application_status: 'under_review' })
    const result = await detectAndUpdateLoanStatusRuleBased('proj-1', [
      {
        from: 'david@riverbearfinancial.com',
        subject: 'Update',
        body: 'The file is under review. We expect to have conditional approval this week. The loan has been conditionally approved with the following conditions to clear...',
        date: '2026-03-28',
      },
    ])
    // "conditionally approved" (priority 7) > "under review" (priority 5)
    expect(mockUpdateFields).toHaveBeenCalledWith('loan-1', expect.objectContaining({
      application_status: 'conditionally_approved',
    }))
  })
})
