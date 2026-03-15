import { NextRequest } from 'next/server'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'
import { getProject } from '@/lib/project-service'
import {
  research,
  researchVendors,
  researchMaterials,
  researchCodeRequirements,
  getCachedResearchResults,
  clearExpiredCache,
} from '@/lib/research-service'
import type { ResearchType } from '@/lib/research-service'

export async function GET(request: NextRequest) {
  try {
    const project = await getProject()
    if (!project) {
      return successResponse({ results: [] })
    }

    const { searchParams } = request.nextUrl
    const knowledgeId = searchParams.get('knowledge_id') || undefined
    const searchType = (searchParams.get('type') || undefined) as ResearchType | undefined

    const results = await getCachedResearchResults(project.id, { knowledgeId, searchType })

    return successResponse({
      count: results.length,
      results: results.map(r => ({
        id: r.id,
        query: r.query,
        search_type: r.search_type,
        ai_analysis: r.ai_analysis,
        sources: r.sources,
        results: r.results,
        knowledge_id: r.knowledge_id,
        expires_at: r.expires_at,
        created_at: r.created_at,
      })),
    })
  } catch (error) {
    return errorResponse(error, 'Failed to fetch research results')
  }
}

export async function POST(request: NextRequest) {
  try {
    const project = await getProject()
    if (!project) {
      return errorResponse(new Error('No project found'), 'No project found')
    }

    const body = await request.json()
    const { query, type, knowledge_id, force_refresh } = body

    if (body.action === 'clear_expired') {
      const cleared = await clearExpiredCache()
      return successResponse({ cleared })
    }

    if (!query) {
      return validationError('Missing required field: query')
    }

    const searchType = (type as ResearchType) || 'general'
    const validTypes = ['vendor', 'material', 'pricing', 'code', 'general']
    if (!validTypes.includes(searchType)) {
      return validationError(`Invalid type: ${type}. Must be one of: ${validTypes.join(', ')}`)
    }

    let result

    // Use specialized research functions for specific types
    switch (searchType) {
      case 'vendor':
        result = await researchVendors(project.id, query)
        break
      case 'material':
        result = await researchMaterials(project.id, query)
        break
      case 'code':
        result = await researchCodeRequirements(project.id, query)
        break
      default:
        result = await research({
          projectId: project.id,
          query,
          searchType,
          knowledgeId: knowledge_id,
          forceRefresh: force_refresh,
        })
    }

    return successResponse({
      query: result.query,
      search_type: result.search_type,
      ai_analysis: result.ai_analysis,
      sources: result.sources,
      results: result.results,
      knowledge_id: result.knowledge_id,
      expires_at: result.expires_at,
    })
  } catch (error) {
    return errorResponse(error, 'Research query failed')
  }
}
