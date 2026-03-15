import { NextRequest } from 'next/server'
import { analyzeProjectDocument } from '@/lib/document-analyzer'
import { processUploadedPlan, processUploadedDXF } from '@/lib/plan-takeoff-service'
import { supabase } from '@/lib/supabase'
import { getProject } from '@/lib/project-service'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'
import pdf from 'pdf-parse-fork'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'message/rfc822',
  'application/vnd.ms-outlook',
  'application/dxf',
  'image/vnd.dxf',
  'application/x-dxf',
])

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return validationError('No file provided')
    }

    if (file.size > MAX_FILE_SIZE) {
      return validationError(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`)
    }

    // Allow common doc extensions even if MIME type is generic
    const ext = file.name.split('.').pop()?.toLowerCase()
    const allowedExtensions = new Set(['pdf', 'txt', 'doc', 'docx', 'eml', 'msg', 'dxf'])
    if (!ALLOWED_TYPES.has(file.type) && (!ext || !allowedExtensions.has(ext))) {
      return validationError('Unsupported file type. Accepted: PDF, DXF, TXT, DOC, DOCX, EML, MSG')
    }

    const project = await getProject()
    if (!project) {
      return errorResponse(new Error('No project found'), 'No project found')
    }

    // Read file content
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Handle different file types
    let content = ''
    if (file.type === 'application/pdf' || ext === 'pdf') {
      try {
        const pdfData = await pdf(buffer)
        content = pdfData.text
      } catch (pdfError) {
        console.error('PDF parsing failed:', pdfError)
        content = ''
      }
    } else {
      content = buffer.toString('utf-8')
    }

    if (!content.trim()) {
      return successResponse({
        filename: file.name,
        size: file.size,
        analysis: null,
        message: 'Document uploaded but no text content could be extracted'
      })
    }

    // Use AI to analyze the document
    const analysis = await analyzeProjectDocument(content, file.name)

    if (analysis) {
      // Store document reference using actual schema columns
      const { error: docError } = await supabase
        .from('documents')
        .insert({
          project_id: project.id,
          name: file.name,
          file_type: file.type,
          file_size: file.size,
          category: 'uploaded',
          description: analysis.phase
            ? `Analyzed document - Phase: ${analysis.phase}`
            : 'Uploaded and analyzed document',
          upload_date: new Date().toISOString(),
        })

      if (docError) {
        console.error('Error storing document reference:', docError)
      }

      // Add tasks if found (using actual tasks table schema)
      if (analysis.tasks && analysis.tasks.length > 0) {
        const tasksData = analysis.tasks.map((task: string) => ({
          project_id: project.id,
          title: task,
          status: 'pending',
          priority: 'medium',
        }))

        const { error: taskError } = await supabase
          .from('tasks')
          .insert(tasksData)

        if (taskError) {
          console.error('Error inserting tasks:', taskError)
        }
      }
    }

    // Plan takeoff analysis for PDF or DXF files
    let takeoff = null
    let dxfResult = null
    const isDXF = ext === 'dxf'
    const isPDF = file.type === 'application/pdf' || ext === 'pdf'
    const analyzePlan = formData.get('analyze_plan') === 'true'

    // Get the document ID we just inserted (needed for both PDF and DXF takeoff)
    let documentId: string | null = null
    if (analysis && (analyzePlan || isDXF)) {
      const { data: docRecord } = await supabase
        .from('documents')
        .select('id')
        .eq('project_id', project.id)
        .eq('name', file.name)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      documentId = docRecord?.id || null
    }

    // DXF files always get parsed (they're structured data, no AI needed for extraction)
    if (isDXF && documentId) {
      try {
        const dxfContent = buffer.toString('utf-8')
        dxfResult = await processUploadedDXF(documentId, project.id, dxfContent, file.name)
      } catch (dxfError) {
        console.error('DXF extraction failed:', dxfError)
      }
    }

    // PDF plan takeoff (AI-powered)
    if (isPDF && analyzePlan && documentId) {
      try {
        takeoff = await processUploadedPlan(documentId, project.id, buffer, file.name)
      } catch (takeoffError) {
        console.error('Plan takeoff analysis failed:', takeoffError)
      }
    }

    // Build response message
    let message = 'Document uploaded and analyzed successfully'
    if (dxfResult) {
      message = `DXF file processed: ${dxfResult.rooms.length} rooms, ${dxfResult.fixtures.length} fixtures, ${dxfResult.windows.length} window types, ${dxfResult.doors.length} door types, ${dxfResult.layers.length} layers detected.`
    } else if (takeoff) {
      message = `Document uploaded and analyzed. Extracted ${takeoff.rooms.length} rooms, ${takeoff.totalFixtures} fixtures, ${takeoff.totalWindows} windows, ${takeoff.totalDoors} doors.`
    }

    return successResponse({
      filename: file.name,
      size: file.size,
      analysis,
      takeoff: takeoff ? {
        rooms: takeoff.rooms.length,
        extractions: takeoff.extractions.length,
        totalFixtures: takeoff.totalFixtures,
        totalWindows: takeoff.totalWindows,
        totalDoors: takeoff.totalDoors,
      } : null,
      dxf: dxfResult ? {
        layers: dxfResult.layers.length,
        rooms: dxfResult.rooms.length,
        fixtures: dxfResult.fixtures.length,
        windows: dxfResult.windows.length,
        doors: dxfResult.doors.length,
        dimensions: dxfResult.dimensions.length,
        raw_entities: dxfResult.raw_entity_count,
      } : null,
      message,
    })
  } catch (error) {
    return errorResponse(error, 'Failed to process file')
  }
}
