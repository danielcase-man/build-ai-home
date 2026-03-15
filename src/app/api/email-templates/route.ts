import { NextRequest } from 'next/server'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'
import { getProject } from '@/lib/project-service'
import {
  getTemplates,
  getTemplateByName,
  renderTemplate,
  upsertTemplate,
  createDefaultTemplates,
} from '@/lib/email-template-service'

export async function GET(request: NextRequest) {
  try {
    const project = await getProject()
    if (!project) return successResponse({ templates: [] })

    const { searchParams } = request.nextUrl
    const name = searchParams.get('name')

    if (name) {
      const template = await getTemplateByName(project.id, name)
      return successResponse({ template })
    }

    const templates = await getTemplates(project.id)
    return successResponse({
      count: templates.length,
      templates,
    })
  } catch (error) {
    return errorResponse(error, 'Failed to fetch templates')
  }
}

export async function POST(request: NextRequest) {
  try {
    const project = await getProject()
    if (!project) return errorResponse(new Error('No project'), 'No project found')

    const body = await request.json()

    if (body.action === 'seed_defaults') {
      const count = await createDefaultTemplates(project.id)
      return successResponse({ seeded: count })
    }

    if (body.action === 'render') {
      if (!body.template_name) return validationError('Missing template_name')
      const template = await getTemplateByName(project.id, body.template_name)
      if (!template) return errorResponse(new Error('Not found'), 'Template not found')
      const rendered = renderTemplate(template, body.variables || {})
      return successResponse(rendered)
    }

    // Create/update template
    if (!body.name || !body.subject_template || !body.body_template) {
      return validationError('Missing required fields: name, subject_template, body_template')
    }

    const template = await upsertTemplate({
      project_id: project.id,
      name: body.name,
      subject_template: body.subject_template,
      body_template: body.body_template,
      variables: body.variables || [],
    })

    return successResponse({ template })
  } catch (error) {
    return errorResponse(error, 'Failed to process template request')
  }
}
