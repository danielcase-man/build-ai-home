import { NextRequest } from 'next/server'
import { getPlaidConnections, upsertPlaidConnection } from '@/lib/financial-service'
import { removeItem } from '@/lib/plaid-client'
import { decryptTokens, isEncryptedTokens } from '@/lib/token-encryption'
import { getProject } from '@/lib/project-service'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'

export async function GET() {
  try {
    const project = await getProject()
    if (!project?.id) {
      return errorResponse(new Error('No project found'), 'No project found')
    }

    const connections = await getPlaidConnections(project.id)

    // Strip access_token from response
    const safe = connections.map(({ access_token: _at, ...rest }) => rest)
    return successResponse({ connections: safe })
  } catch (error) {
    return errorResponse(error, 'Failed to fetch Plaid connections')
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { item_id } = await request.json()

    if (!item_id) {
      return validationError('item_id is required')
    }

    const project = await getProject()
    if (!project?.id) {
      return errorResponse(new Error('No project found'), 'No project found')
    }

    // Find the connection to get the access token
    const connections = await getPlaidConnections(project.id)
    const connection = connections.find(c => c.item_id === item_id)

    if (connection) {
      // Disconnect from Plaid
      try {
        let accessToken: string
        const parsed = JSON.parse(connection.access_token)
        if (isEncryptedTokens(parsed)) {
          accessToken = decryptTokens(parsed).access_token as string
        } else {
          accessToken = connection.access_token
        }
        await removeItem(accessToken)
      } catch {
        // Best effort — still mark as disconnected locally
      }

      await upsertPlaidConnection({
        project_id: project.id,
        item_id,
        status: 'disconnected',
      })
    }

    return successResponse({ disconnected: true })
  } catch (error) {
    return errorResponse(error, 'Failed to disconnect bank')
  }
}
