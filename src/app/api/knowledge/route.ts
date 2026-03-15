import { NextRequest } from 'next/server'
import { successResponse, errorResponse } from '@/lib/api-utils'
import { getProject } from '@/lib/project-service'
import {
  getKnowledgeTree,
  getDecisionPoints,
  seedKnowledgeGraph,
  isKnowledgeGraphSeeded,
  initializeProjectKnowledgeStates,
} from '@/lib/knowledge-graph'
import { KNOWLEDGE_SEED_DATA } from '@/lib/knowledge-seed-data'

export async function GET(request: NextRequest) {
  try {
    const project = await getProject()
    const { searchParams } = request.nextUrl

    const phase = searchParams.get('phase')
    const trade = searchParams.get('trade')
    const type = searchParams.get('type')

    if (type === 'decisions') {
      const decisions = await getDecisionPoints(
        project?.id || '',
        phase ? parseInt(phase) : undefined
      )
      return successResponse({
        count: decisions.length,
        decisions: decisions.map(d => ({
          ...d.item,
          state: d.state,
        })),
      })
    }

    const tree = await getKnowledgeTree(
      project?.id || undefined,
      {
        phase_number: phase ? parseInt(phase) : undefined,
        trade: trade || undefined,
      }
    )

    return successResponse({
      count: tree.length,
      tree,
    })
  } catch (error) {
    return errorResponse(error, 'Failed to fetch knowledge graph')
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (body.action === 'seed') {
      const alreadySeeded = await isKnowledgeGraphSeeded()
      if (alreadySeeded && !body.force) {
        return successResponse({
          message: 'Knowledge graph already seeded. Use force: true to re-seed.',
          created: 0,
        })
      }

      const result = await seedKnowledgeGraph(KNOWLEDGE_SEED_DATA)
      return successResponse(result)
    }

    if (body.action === 'initialize') {
      const project = await getProject()
      if (!project) {
        return errorResponse(new Error('No project found'), 'No project found')
      }

      const count = await initializeProjectKnowledgeStates(project.id)
      return successResponse({ initialized: count })
    }

    return errorResponse(new Error('Invalid action'), 'Invalid action. Use "seed" or "initialize".')
  } catch (error) {
    return errorResponse(error, 'Failed to process knowledge graph action')
  }
}
