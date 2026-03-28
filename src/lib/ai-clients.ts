/**
 * Lazy-initialized AI client singleton
 */

import Anthropic from '@anthropic-ai/sdk'

let _anthropic: Anthropic | null = null

export function getAnthropicClient(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    })
  }
  return _anthropic
}

/** Strips markdown code fences from AI JSON responses and handles truncation */
export function parseAIJsonResponse(text: string): unknown {
  let jsonText = text.trim()
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '')
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '')
  }

  try {
    return JSON.parse(jsonText)
  } catch {
    // AI response may be truncated (hit max_tokens). Try to repair:
    // 1. Close any unclosed strings
    // 2. Close any unclosed arrays/objects
    let repaired = jsonText
    // Remove trailing incomplete key-value pair
    repaired = repaired.replace(/,\s*"[^"]*"?\s*:?\s*"?[^"]*$/, '')
    // Remove trailing comma
    repaired = repaired.replace(/,\s*$/, '')
    // Count open/close brackets and add missing closers
    const opens = (repaired.match(/[\[{]/g) || []).length
    const closes = (repaired.match(/[\]}]/g) || []).length
    const missing = opens - closes
    if (missing > 0) {
      // Heuristic: close with ] then } based on what's open
      const stack: string[] = []
      for (const ch of repaired) {
        if (ch === '{') stack.push('}')
        else if (ch === '[') stack.push(']')
        else if (ch === '}' || ch === ']') stack.pop()
      }
      repaired += stack.reverse().join('')
    }
    return JSON.parse(repaired)
  }
}
