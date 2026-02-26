import { describe, it, expect } from 'vitest'
import { AppError, AuthenticationError, ValidationError, ExternalServiceError } from './errors'

describe('AppError', () => {
  it('has default status 500', () => {
    const err = new AppError('boom')
    expect(err.statusCode).toBe(500)
    expect(err.message).toBe('boom')
    expect(err.name).toBe('AppError')
  })

  it('accepts custom status and code', () => {
    const err = new AppError('not found', 404, 'NOT_FOUND')
    expect(err.statusCode).toBe(404)
    expect(err.code).toBe('NOT_FOUND')
  })

  it('is an instanceof Error', () => {
    expect(new AppError('x')).toBeInstanceOf(Error)
  })
})

describe('AuthenticationError', () => {
  it('has status 401 and default message', () => {
    const err = new AuthenticationError()
    expect(err.statusCode).toBe(401)
    expect(err.message).toBe('Not authenticated')
    expect(err.code).toBe('AUTH_REQUIRED')
    expect(err.name).toBe('AuthenticationError')
  })

  it('accepts custom message', () => {
    expect(new AuthenticationError('session expired').message).toBe('session expired')
  })
})

describe('ValidationError', () => {
  it('has status 400', () => {
    const err = new ValidationError('bad input')
    expect(err.statusCode).toBe(400)
    expect(err.code).toBe('VALIDATION_ERROR')
    expect(err.name).toBe('ValidationError')
  })
})

describe('ExternalServiceError', () => {
  it('prefixes service name', () => {
    const err = new ExternalServiceError('Gmail', 'rate limited')
    expect(err.message).toBe('Gmail: rate limited')
    expect(err.statusCode).toBe(502)
    expect(err.code).toBe('EXTERNAL_SERVICE_ERROR')
  })
})
