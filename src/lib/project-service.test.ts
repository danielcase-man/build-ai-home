import { describe, it, expect, vi } from 'vitest'

// Stub React cache() before importing — it's a server-only API
vi.mock('react', () => ({
  cache: (fn: unknown) => fn,
}))

import { calculateCurrentStep } from './project-service'

describe('calculateCurrentStep', () => {
  it('returns {currentStep: 1, totalSteps: 6} for null input', () => {
    expect(calculateCurrentStep(null)).toEqual({ currentStep: 1, totalSteps: 6 })
  })

  it('returns {currentStep: 1, totalSteps: 6} for empty array', () => {
    expect(calculateCurrentStep([])).toEqual({ currentStep: 1, totalSteps: 6 })
  })

  it('returns the in_progress step number', () => {
    const steps = [
      { step_number: 1, status: 'completed' },
      { step_number: 2, status: 'in_progress' },
      { step_number: 3, status: 'pending' },
    ]
    expect(calculateCurrentStep(steps)).toEqual({ currentStep: 2, totalSteps: 3 })
  })

  it('returns highest completed + 1 when no in_progress', () => {
    const steps = [
      { step_number: 1, status: 'completed' },
      { step_number: 2, status: 'completed' },
      { step_number: 3, status: 'pending' },
      { step_number: 4, status: 'pending' },
    ]
    expect(calculateCurrentStep(steps)).toEqual({ currentStep: 3, totalSteps: 4 })
  })

  it('caps at totalSteps when all steps are completed', () => {
    const steps = [
      { step_number: 1, status: 'completed' },
      { step_number: 2, status: 'completed' },
      { step_number: 3, status: 'completed' },
    ]
    expect(calculateCurrentStep(steps)).toEqual({ currentStep: 3, totalSteps: 3 })
  })

  it('picks the highest in_progress step when multiple exist', () => {
    const steps = [
      { step_number: 1, status: 'in_progress' },
      { step_number: 2, status: 'in_progress' },
      { step_number: 3, status: 'pending' },
    ]
    expect(calculateCurrentStep(steps)).toEqual({ currentStep: 2, totalSteps: 3 })
  })

  it('returns 1 when all steps are pending', () => {
    const steps = [
      { step_number: 1, status: 'pending' },
      { step_number: 2, status: 'pending' },
      { step_number: 3, status: 'pending' },
      { step_number: 4, status: 'pending' },
      { step_number: 5, status: 'pending' },
      { step_number: 6, status: 'pending' },
    ]
    expect(calculateCurrentStep(steps)).toEqual({ currentStep: 1, totalSteps: 6 })
  })
})
