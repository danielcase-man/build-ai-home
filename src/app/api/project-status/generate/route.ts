import { updateProjectStatus, getProject } from '@/lib/project-service'
import { successResponse, errorResponse } from '@/lib/api-utils'

export async function POST() {
  try {
    const project = await getProject()

    if (!project) {
      return errorResponse(new Error('No project found'), 'No project found')
    }

    await updateProjectStatus(project.id)

    return successResponse({
      message: 'Project status snapshot generated successfully',
      projectId: project.id
    })
  } catch (error) {
    return errorResponse(error, 'Failed to generate project status snapshot')
  }
}
