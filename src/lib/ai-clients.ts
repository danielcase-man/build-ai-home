/**
 * Lazy-initialized AI client singletons
 * Ensures only one instance per provider across the app
 */

import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'

let _openai: OpenAI | null = null
let _anthropic: Anthropic | null = null

export function getOpenAIClient(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  }
  return _openai
}

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
