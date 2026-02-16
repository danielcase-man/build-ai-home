import { NextRequest } from 'next/server'
import { analyzeProjectDocument } from '@/lib/document-analyzer'
import { supabase } from '@/lib/supabase'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'message/rfc822',
  'application/vnd.ms-outlook',
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
    const allowedExtensions = new Set(['pdf', 'txt', 'doc', 'docx', 'eml', 'msg'])
    if (!ALLOWED_TYPES.has(file.type) && (!ext || !allowedExtensions.has(ext))) {
      return validationError('Unsupported file type. Accepted: PDF, TXT, DOC, DOCX, EML, MSG')
    }

    // Read file content
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Handle different file types
    let content = ''
    if (file.type === 'application/pdf') {
      content = 'PDF content extraction needs pdf-parse library'
    } else {
      content = buffer.toString('utf-8')
    }

    // Use AI to analyze the document
    const analysis = await analyzeProjectDocument(content, file.name)

    // Update the database with the extracted data
    if (analysis) {
      // Store document reference
      await supabase
        .from('documents')
        .insert({
          filename: file.name,
          file_type: file.type,
          file_size: file.size,
          uploaded_at: new Date().toISOString(),
          analysis_result: analysis
        })
        .select()
        .single()

      // Update project data based on analysis
      if (analysis.phase || analysis.currentStep) {
        await supabase
          .from('project_phases')
          .upsert({
            phase_name: analysis.phase || 'Planning',
            current_step: analysis.currentStep,
            total_steps: analysis.totalSteps || 6,
            updated_at: new Date().toISOString()
          })
      }

      // Add hot topics if found
      if (analysis.hotTopics && analysis.hotTopics.length > 0) {
        const hotTopicsData = analysis.hotTopics.map(topic => ({
          topic: topic,
          priority: 'high',
          created_at: new Date().toISOString()
        }))

        await supabase
          .from('hot_topics')
          .insert(hotTopicsData)
      }

      // Add tasks if found
      if (analysis.tasks && analysis.tasks.length > 0) {
        const tasksData = analysis.tasks.map(task => ({
          task_name: task,
          status: 'pending',
          created_at: new Date().toISOString()
        }))

        await supabase
          .from('tasks')
          .insert(tasksData)
      }
    }

    return successResponse({
      filename: file.name,
      size: file.size,
      analysis,
      message: 'Document uploaded and analyzed successfully'
    })
  } catch (error) {
    return errorResponse(error, 'Failed to process file')
  }
}
