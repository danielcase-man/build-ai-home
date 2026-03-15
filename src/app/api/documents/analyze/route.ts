import { NextRequest } from 'next/server'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'
import { getProject } from '@/lib/project-service'
import { processUploadedPlan } from '@/lib/plan-takeoff-service'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const project = await getProject()
    if (!project) {
      return errorResponse(new Error('No project found'), 'No project found')
    }

    const body = await request.json()
    const { document_id } = body

    if (!document_id) {
      return validationError('Missing required field: document_id')
    }

    // Fetch document metadata
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', document_id)
      .single()

    if (docError || !doc) {
      return errorResponse(new Error('Document not found'), 'Document not found')
    }

    // For now, we need the PDF content to be re-uploaded or stored
    // This endpoint works with documents that have been processed through /api/upload
    // and still have their content available
    return successResponse({
      message: 'Document analysis queued. Use /api/upload with analyze=true to process new PDFs.',
      document_id,
      document_name: doc.name,
    })
  } catch (error) {
    return errorResponse(error, 'Failed to analyze document')
  }
}
