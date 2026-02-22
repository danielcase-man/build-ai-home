import { describe, it, expect } from 'vitest'
import { parseAIJsonResponse } from './ai-clients'

describe('parseAIJsonResponse', () => {
  it('parses plain JSON', () => {
    expect(parseAIJsonResponse('{"key": "value"}')).toEqual({ key: 'value' })
  })

  it('strips ```json fences and parses', () => {
    const input = '```json\n{"key": "value"}\n```'
    expect(parseAIJsonResponse(input)).toEqual({ key: 'value' })
  })

  it('strips bare ``` fences and parses', () => {
    const input = '```\n{"key": "value"}\n```'
    expect(parseAIJsonResponse(input)).toEqual({ key: 'value' })
  })

  it('trims surrounding whitespace', () => {
    const input = '  \n  {"key": "value"}  \n  '
    expect(parseAIJsonResponse(input)).toEqual({ key: 'value' })
  })

  it('parses arrays', () => {
    expect(parseAIJsonResponse('[1, 2, 3]')).toEqual([1, 2, 3])
  })

  it('throws on invalid JSON', () => {
    expect(() => parseAIJsonResponse('not json')).toThrow()
  })

  it('throws on empty string', () => {
    expect(() => parseAIJsonResponse('')).toThrow()
  })
})
