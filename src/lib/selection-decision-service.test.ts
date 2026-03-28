import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetSelections = vi.fn()
const mockGetBids = vi.fn()
const mockGetActivePhase = vi.fn()
const mockGetLeadTimeAlerts = vi.fn()

vi.mock('./selections-service', () => ({ getSelections: (...a: unknown[]) => mockGetSelections(...a) }))
vi.mock('./bids-service', () => ({ getBids: (...a: unknown[]) => mockGetBids(...a) }))
vi.mock('./workflow-service', () => ({
  getActivePhase: (...a: unknown[]) => mockGetActivePhase(...a),
  getLeadTimeAlerts: (...a: unknown[]) => mockGetLeadTimeAlerts(...a),
}))

import { getSelectionDecisionQueue } from './selection-decision-service'

const PROJECT_ID = 'proj-1'

function makeBid(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bid-1',
    vendor_name: 'Test Vendor',
    total_amount: 50000,
    category: 'Cabinetry',
    status: 'pending',
    ...overrides,
  }
}

function makeSelection(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sel-1',
    project_id: PROJECT_ID,
    category: 'cabinetry',
    status: 'considering',
    room: 'Kitchen',
    product_name: 'Maple Cabinets',
    quantity: 1,
    ...overrides,
  }
}

describe('getSelectionDecisionQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSelections.mockResolvedValue([])
    mockGetBids.mockResolvedValue([])
    mockGetActivePhase.mockResolvedValue({ phase_number: 1, name: 'Pre-Construction', status: 'active' })
    mockGetLeadTimeAlerts.mockResolvedValue([])
  })

  it('returns empty zones when no data', async () => {
    const result = await getSelectionDecisionQueue(PROJECT_ID)
    expect(result.decisionQueue).toEqual([])
    expect(result.lockedIn).toEqual([])
    expect(result.future).toHaveLength(10) // all 10 mapped categories are "future"
    expect(result.activePhase).toBe(1)
  })

  it('puts categories with bids but no selected vendor in decisionQueue', async () => {
    mockGetBids.mockResolvedValue([makeBid({ id: 'b1', status: 'pending' })])

    const result = await getSelectionDecisionQueue(PROJECT_ID)
    const cabinetry = result.decisionQueue.find(c => c.category === 'cabinetry')
    expect(cabinetry).toBeDefined()
    expect(cabinetry!.zone).toBe('decision')
    expect(cabinetry!.bids).toHaveLength(1)
    expect(cabinetry!.selectedBid).toBeUndefined()
  })

  it('puts categories with selected bid in lockedIn', async () => {
    mockGetBids.mockResolvedValue([makeBid({ id: 'b1', status: 'selected' })])
    mockGetSelections.mockResolvedValue([makeSelection({ status: 'selected', bid_id: 'b1' })])

    const result = await getSelectionDecisionQueue(PROJECT_ID)
    const cabinetry = result.lockedIn.find(c => c.category === 'cabinetry')
    expect(cabinetry).toBeDefined()
    expect(cabinetry!.zone).toBe('locked')
    expect(cabinetry!.selectedBid).toBeDefined()
    expect(cabinetry!.selectedBid!.vendorName).toBe('Test Vendor')
  })

  it('puts categories with no bids in future', async () => {
    const result = await getSelectionDecisionQueue(PROJECT_ID)
    // All categories have no bids → all in future
    expect(result.future).toHaveLength(10)
    expect(result.future.every(c => c.zone === 'future')).toBe(true)
  })

  it('computes urgency=high when category phase <= active phase', async () => {
    mockGetActivePhase.mockResolvedValue({ phase_number: 6, name: 'Interior Finishes', status: 'active' })
    mockGetBids.mockResolvedValue([makeBid({ status: 'pending' })]) // cabinetry is phase 6

    const result = await getSelectionDecisionQueue(PROJECT_ID)
    const cabinetry = result.decisionQueue.find(c => c.category === 'cabinetry')
    expect(cabinetry!.urgency).toBe('high')
  })

  it('computes urgency=medium when category is next phase', async () => {
    mockGetActivePhase.mockResolvedValue({ phase_number: 5, name: 'Building Envelope', status: 'active' })
    mockGetBids.mockResolvedValue([makeBid({ status: 'pending' })]) // cabinetry is phase 6

    const result = await getSelectionDecisionQueue(PROJECT_ID)
    const cabinetry = result.decisionQueue.find(c => c.category === 'cabinetry')
    expect(cabinetry!.urgency).toBe('medium')
  })

  it('computes urgency=low for far-future phases', async () => {
    mockGetActivePhase.mockResolvedValue({ phase_number: 2, name: 'Foundation', status: 'active' })
    mockGetBids.mockResolvedValue([makeBid({ status: 'pending' })]) // cabinetry phase 6

    const result = await getSelectionDecisionQueue(PROJECT_ID)
    const cabinetry = result.decisionQueue.find(c => c.category === 'cabinetry')
    expect(cabinetry!.urgency).toBe('low')
  })

  it('uses lead-time alert urgency when present', async () => {
    mockGetActivePhase.mockResolvedValue({ phase_number: 2, name: 'Foundation', status: 'active' })
    mockGetBids.mockResolvedValue([makeBid({ status: 'pending' })])
    mockGetSelections.mockResolvedValue([makeSelection({ id: 'sel-cab' })])
    mockGetLeadTimeAlerts.mockResolvedValue([{
      type: 'lead_time_warning',
      priority: 'urgent',
      title: 'Order by 2026-04-15: Maple Cabinets',
      message: 'OVERDUE',
      selection_id: 'sel-cab',
      order_by_date: '2026-04-15',
    }])

    const result = await getSelectionDecisionQueue(PROJECT_ID)
    const cabinetry = result.decisionQueue.find(c => c.category === 'cabinetry')
    expect(cabinetry!.urgency).toBe('urgent')
    expect(cabinetry!.leadTimeAlert).toBeDefined()
    expect(cabinetry!.leadTimeAlert!.priority).toBe('urgent')
  })

  it('sorts decisionQueue by urgency then phase', async () => {
    mockGetActivePhase.mockResolvedValue({ phase_number: 6, name: 'Interior Finishes', status: 'active' })
    mockGetBids.mockResolvedValue([
      makeBid({ id: 'b1', category: 'Cabinetry', status: 'pending' }),
      makeBid({ id: 'b2', category: 'Windows & Doors', status: 'pending' }),
    ])

    const result = await getSelectionDecisionQueue(PROJECT_ID)
    // Windows is phase 5 (<=6 → high), Cabinetry is phase 6 (<=6 → high)
    // Both high, sorted by phase: windows (5) before cabinetry (6)
    const categories = result.decisionQueue.map(c => c.category)
    expect(categories.indexOf('windows')).toBeLessThan(categories.indexOf('cabinetry'))
  })

  it('counts non-alternative selections', async () => {
    mockGetBids.mockResolvedValue([makeBid({ status: 'selected' })])
    mockGetSelections.mockResolvedValue([
      makeSelection({ id: 's1', status: 'selected' }),
      makeSelection({ id: 's2', status: 'selected' }),
      makeSelection({ id: 's3', status: 'alternative' }),
    ])

    const result = await getSelectionDecisionQueue(PROJECT_ID)
    const cabinetry = result.lockedIn.find(c => c.category === 'cabinetry')
    expect(cabinetry!.selectionCount).toBe(2) // excludes alternative
  })

  it('computes statusSummary correctly', async () => {
    mockGetBids.mockResolvedValue([makeBid({ status: 'selected' })])
    mockGetSelections.mockResolvedValue([
      makeSelection({ id: 's1', status: 'selected' }),
      makeSelection({ id: 's2', status: 'ordered' }),
      makeSelection({ id: 's3', status: 'ordered' }),
      makeSelection({ id: 's4', status: 'alternative' }),
    ])

    const result = await getSelectionDecisionQueue(PROJECT_ID)
    const cabinetry = result.lockedIn.find(c => c.category === 'cabinetry')
    expect(cabinetry!.statusSummary).toEqual({ selected: 1, ordered: 2, alternative: 1 })
  })

  it('handles null active phase', async () => {
    mockGetActivePhase.mockResolvedValue(null)
    mockGetBids.mockResolvedValue([makeBid({ status: 'pending' })])

    const result = await getSelectionDecisionQueue(PROJECT_ID)
    expect(result.activePhase).toBeNull()
    // With no active phase, decision queue items get 'low' urgency
    const cabinetry = result.decisionQueue.find(c => c.category === 'cabinetry')
    expect(cabinetry!.urgency).toBe('low')
  })

  it('maps multiple bids to same category', async () => {
    mockGetBids.mockResolvedValue([
      makeBid({ id: 'b1', vendor_name: 'Vendor A', total_amount: 40000, status: 'pending' }),
      makeBid({ id: 'b2', vendor_name: 'Vendor B', total_amount: 55000, status: 'pending' }),
    ])

    const result = await getSelectionDecisionQueue(PROJECT_ID)
    const cabinetry = result.decisionQueue.find(c => c.category === 'cabinetry')
    expect(cabinetry!.bids).toHaveLength(2)
  })
})
