import { describe, it, expect } from 'vitest'
import { successResponse, errorResponse, validationError } from './api-utils'
import { AppError, AuthenticationError, ValidationError } from './errors'

describe('successResponse', () => {
  it('returns JSON with success: true and data', async () => {
    const res = successResponse({ items: [1, 2] })
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toEqual({ items: [1, 2] })
    expect(res.status).toBe(200)
  })

  it('accepts custom status', async () => {
    const res = successResponse('created', 201)
    expect(res.status).toBe(201)
  })
})

describe('errorResponse', () => {
  it('handles AppError with status and code', async () => {
    const res = errorResponse(new AppError('not found', 404, 'NOT_FOUND'))
    const json = await res.json()
    expect(res.status).toBe(404)
    expect(json.success).toBe(false)
    expect(json.error).toBe('not found')
    expect(json.code).toBe('NOT_FOUND')
  })

  it('handles AuthenticationError', async () => {
    const res = errorResponse(new AuthenticationError())
    expect(res.status).toBe(401)
  })

  it('handles ValidationError', async () => {
    const res = errorResponse(new ValidationError('bad'))
    expect(res.status).toBe(400)
  })

  it('handles plain Error with 500', async () => {
    const res = errorResponse(new Error('oops'))
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.success).toBe(false)
    expect(json.details).toBe('oops')
  })

  it('uses fallback message for non-Error', async () => {
    const res = errorResponse('string error', 'Something went wrong')
    const json = await res.json()
    expect(json.error).toBe('Something went wrong')
  })
})

describe('validationError', () => {
  it('returns 400 with validation code', async () => {
    const res = validationError('email is required')
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toBe('email is required')
    expect(json.code).toBe('VALIDATION_ERROR')
  })
})
