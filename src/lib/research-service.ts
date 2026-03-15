/**
 * AI Research Service — web-search-powered research at decision points.
 *
 * Uses Claude Sonnet 4.6 with the built-in web_search server tool to research
 * vendors, materials, pricing, code requirements, and general construction topics.
 * Results are cached in the research_cache table with a 7-day TTL.
 */

import { getAnthropicClient, parseAIJsonResponse } from './ai-clients'
import { supabase } from './supabase'
import type Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-sonnet-4-6'
const CACHE_TTL_DAYS = 7

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ResearchType = 'vendor' | 'material' | 'pricing' | 'code' | 'general'

export interface ResearchSource {
  url: string
  title: string
  snippet?: string
  accessed_date: string
}

export interface ResearchResult {
  id?: string
  project_id: string
  knowledge_id: string | null
  query: string
  search_type: ResearchType
  results: Record<string, unknown>
  sources: ResearchSource[]
  ai_analysis: string
  expires_at: string
  created_at?: string
}

// ---------------------------------------------------------------------------
// Web Search Tool Configuration
// ---------------------------------------------------------------------------

function getWebSearchTool(): Anthropic.WebSearchTool20250305 {
  return {
    type: 'web_search_20250305',
    name: 'web_search',
    max_uses: 5,
    user_location: {
      type: 'approximate',
      city: 'Liberty Hill',
      region: 'TX',
      country: 'US',
      timezone: 'America/Chicago',
    },
  }
}

// ---------------------------------------------------------------------------
// Core Research Function
// ---------------------------------------------------------------------------

/**
 * Execute an AI-powered research query using Claude + web search.
 * Returns cached results if available and not expired.
 */
export async function research(params: {
  projectId: string
  query: string
  searchType: ResearchType
  knowledgeId?: string
  forceRefresh?: boolean
}): Promise<ResearchResult> {
  const { projectId, query, searchType, knowledgeId, forceRefresh } = params

  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = await getCachedResearch(projectId, query, searchType)
    if (cached) return cached
  }

  // Build the research prompt based on type
  const systemPrompt = getResearchSystemPrompt(searchType)
  const userPrompt = getResearchUserPrompt(query, searchType)

  try {
    const client = getAnthropicClient()
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      temperature: 0.3,
      system: systemPrompt,
      tools: [getWebSearchTool()],
      messages: [{ role: 'user', content: userPrompt }],
    })

    // Extract text content and web search sources from response
    const { analysis, sources, structuredResults } = extractResearchResponse(response)

    const result: ResearchResult = {
      project_id: projectId,
      knowledge_id: knowledgeId || null,
      query,
      search_type: searchType,
      results: structuredResults,
      sources,
      ai_analysis: analysis,
      expires_at: new Date(Date.now() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    }

    // Cache the result
    await cacheResearch(result)

    return result
  } catch (error) {
    console.error('Research query failed:', error)
    return {
      project_id: projectId,
      knowledge_id: knowledgeId || null,
      query,
      search_type: searchType,
      results: {},
      sources: [],
      ai_analysis: `Research failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      expires_at: new Date().toISOString(),
    }
  }
}

// ---------------------------------------------------------------------------
// Specialized Research Functions
// ---------------------------------------------------------------------------

/** Research vendors/contractors for a specific trade in the project area */
export async function researchVendors(
  projectId: string,
  trade: string,
  location = 'Liberty Hill, TX'
): Promise<ResearchResult> {
  return research({
    projectId,
    query: `${trade} contractors and vendors near ${location}`,
    searchType: 'vendor',
  })
}

/** Research materials — options, specs, pricing, availability */
export async function researchMaterials(
  projectId: string,
  category: string,
  specs?: string
): Promise<ResearchResult> {
  const query = specs
    ? `${category} materials with specs: ${specs}`
    : `${category} materials options and pricing for residential construction`
  return research({
    projectId,
    query,
    searchType: 'material',
  })
}

/** Research local building code requirements */
export async function researchCodeRequirements(
  projectId: string,
  trade: string,
  jurisdiction = 'Williamson County, TX'
): Promise<ResearchResult> {
  return research({
    projectId,
    query: `${trade} building code requirements ${jurisdiction} residential construction 2024-2025`,
    searchType: 'code',
  })
}

/** General research with full project context */
export async function researchWithContext(
  projectId: string,
  query: string,
  knowledgeId?: string
): Promise<ResearchResult> {
  return research({
    projectId,
    query,
    searchType: 'general',
    knowledgeId,
  })
}

// ---------------------------------------------------------------------------
// Cache Operations
// ---------------------------------------------------------------------------

async function getCachedResearch(
  projectId: string,
  query: string,
  searchType: ResearchType
): Promise<ResearchResult | null> {
  const { data, error } = await supabase
    .from('research_cache')
    .select('*')
    .eq('project_id', projectId)
    .eq('query', query)
    .eq('search_type', searchType)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return null

  return data as ResearchResult
}

async function cacheResearch(result: ResearchResult): Promise<void> {
  const { error } = await supabase
    .from('research_cache')
    .upsert({
      project_id: result.project_id,
      knowledge_id: result.knowledge_id,
      query: result.query,
      search_type: result.search_type,
      results: result.results,
      sources: result.sources,
      ai_analysis: result.ai_analysis,
      expires_at: result.expires_at,
    })

  if (error) {
    console.error('Failed to cache research result:', error)
  }
}

/** Get all cached research for a project, optionally filtered */
export async function getCachedResearchResults(
  projectId: string,
  filters?: { knowledgeId?: string; searchType?: ResearchType }
): Promise<ResearchResult[]> {
  let query = supabase
    .from('research_cache')
    .select('*')
    .eq('project_id', projectId)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  if (filters?.knowledgeId) {
    query = query.eq('knowledge_id', filters.knowledgeId)
  }
  if (filters?.searchType) {
    query = query.eq('search_type', filters.searchType)
  }

  const { data, error } = await query

  if (error) return []
  return (data || []) as ResearchResult[]
}

/** Clear expired cache entries */
export async function clearExpiredCache(): Promise<number> {
  const { data, error } = await supabase
    .from('research_cache')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select('id')

  if (error) return 0
  return data?.length || 0
}

// ---------------------------------------------------------------------------
// Prompt Builders
// ---------------------------------------------------------------------------

function getResearchSystemPrompt(searchType: ResearchType): string {
  const base = `You are a construction research assistant helping a homeowner building a 7,526 SF French Country Estate at 708 Purple Salvia Cove, Liberty Hill, TX (Williamson County). Use web search to find current, accurate information. Always cite your sources.`

  const typeSpecific: Record<ResearchType, string> = {
    vendor: `${base}

Focus on finding local contractors, vendors, and suppliers. For each vendor found, extract:
- Company name and contact info
- Service area and specialties
- Reviews/ratings if available
- Estimated pricing ranges
- License/insurance status if mentioned

Prioritize vendors within 50 miles of Liberty Hill, TX. Note if a vendor serves the Austin/Georgetown/Cedar Park area.`,

    material: `${base}

Focus on finding material options, specifications, and pricing. For each material option:
- Product name and manufacturer
- Key specifications
- Price range (per unit and installed)
- Pros and cons for residential use
- Availability and lead times
- Compatibility with French Country architectural style`,

    pricing: `${base}

Focus on current pricing data for construction materials and labor in Central Texas. Include:
- Material costs (per unit)
- Labor rates
- Total installed costs
- Price trends (rising/stable/falling)
- Budget recommendations`,

    code: `${base}

Focus on building code requirements. Search for:
- Current IRC/IBC code sections that apply
- Texas-specific amendments
- Williamson County local requirements
- Required inspections and their sequence
- Common compliance issues to watch for
- Recent code changes (2024-2025)`,

    general: `${base}

Research the topic thoroughly and provide a comprehensive analysis relevant to residential construction. Structure your findings clearly with actionable recommendations.`,
  }

  return typeSpecific[searchType]
}

function getResearchUserPrompt(query: string, searchType: ResearchType): string {
  const outputFormat = `

After searching, provide your findings as a JSON object with these keys:
{
  "summary": "2-3 paragraph analysis of findings",
  "findings": [
    {
      "title": "finding title",
      "details": "detailed description",
      "relevance": "high/medium/low",
      "source": "where this was found"
    }
  ],
  "recommendations": ["actionable recommendation 1", "recommendation 2"],
  "cost_estimates": {"low": number_or_null, "mid": number_or_null, "high": number_or_null},
  "key_considerations": ["important factor 1", "factor 2"],
  "next_steps": ["suggested next step 1", "step 2"]
}

Return valid JSON only after your research is complete.`

  return `Research the following for my home construction project:\n\n${query}${outputFormat}`
}

// ---------------------------------------------------------------------------
// Response Extraction
// ---------------------------------------------------------------------------

function extractResearchResponse(response: Anthropic.Message): {
  analysis: string
  sources: ResearchSource[]
  structuredResults: Record<string, unknown>
} {
  let analysis = ''
  const sources: ResearchSource[] = []
  let structuredResults: Record<string, unknown> = {}

  for (const block of response.content) {
    if (block.type === 'text') {
      // Try to parse as JSON first
      try {
        structuredResults = parseAIJsonResponse(block.text) as Record<string, unknown>
        analysis = (structuredResults.summary as string) || block.text
      } catch {
        // Not JSON, use as plain text analysis
        analysis = block.text
      }
    } else if (block.type === 'web_search_tool_result') {
      // Extract web search results as sources
      // The web_search_tool_result contains search results
      const searchResults = block as unknown as {
        type: 'web_search_tool_result'
        content: Array<{
          type: string
          url?: string
          title?: string
          encrypted_content?: string
          page_age?: string
        }>
      }
      if (searchResults.content) {
        for (const result of searchResults.content) {
          if (result.type === 'web_search_result' && result.url) {
            sources.push({
              url: result.url,
              title: result.title || 'Untitled',
              snippet: undefined,
              accessed_date: new Date().toISOString(),
            })
          }
        }
      }
    }
  }

  return { analysis, sources, structuredResults }
}
