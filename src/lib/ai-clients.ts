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

/** Strips markdown code fences from AI JSON responses */
export function parseAIJsonResponse(text: string): unknown {
  let jsonText = text.trim()
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '')
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '')
  }
  return JSON.parse(jsonText)
}
