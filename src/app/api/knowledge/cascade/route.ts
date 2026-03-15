import { NextRequest } from 'next/server'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'
import { getCascadingRequirements } from '@/lib/knowledge-graph'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.itemId) {
      return validationError('Missing required field: itemId')
    }

    const cascade = await getCascadingRequirements(body.itemId)

    return successResponse({
      item: {
        id: cascade.item.id,
        item_name: cascade.item.item_name,
        trade: cascade.item.trade,
        phase_number: cascade.item.phase_number,
      },
      prerequisites: cascade.prerequisites.map(p => ({
        id: p.id,
        item_name: p.item_name,
        trade: p.trade,
        item_type: p.item_type,
      })),
      downstream: cascade.downstream.map(d => ({
        id: d.id,
        item_name: d.item_name,
        trade: d.trade,
        item_type: d.item_type,
      })),
      materials: cascade.materials,
      inspections: cascade.inspections.map(i => ({
        id: i.id,
        item_name: i.item_name,
        code_references: i.code_references,
      })),
    })
  } catch (error) {
    return errorResponse(error, 'Failed to get cascading requirements')
  }
}
