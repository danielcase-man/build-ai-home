import { NextRequest } from 'next/server'
import { exchangePublicToken, getAccounts } from '@/lib/plaid-client'
import { upsertPlaidConnection } from '@/lib/financial-service'
import { encryptTokens } from '@/lib/token-encryption'
import { getProject } from '@/lib/project-service'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    const { public_token, institution_id, institution_name } = await request.json()

    if (!public_token) {
      return validationError('public_token is required')
    }

    const project = await getProject()
    if (!project?.id) {
      return errorResponse(new Error('No project found'), 'No project found')
    }

    // Exchange public token for persistent access token
    const { accessToken, itemId } = await exchangePublicToken(public_token)

    // Get account details
    const accounts = await getAccounts(accessToken)

    // Encrypt the access token before storing
    const encryptedToken = JSON.stringify(encryptTokens({ access_token: accessToken }))

    // Save connection
    const connection = await upsertPlaidConnection({
      project_id: project.id,
      institution_name: institution_name || 'Unknown Bank',
      institution_id: institution_id || undefined,
      item_id: itemId,
      access_token: encryptedToken,
      accounts: accounts.map(a => ({
        account_id: a.account_id,
        name: a.name,
        mask: a.mask || '',
        type: a.type,
        subtype: a.subtype || '',
      })),
      status: 'active',
    })

    return successResponse({ connection })
  } catch (error) {
    return errorResponse(error, 'Failed to exchange Plaid token')
  }
}
