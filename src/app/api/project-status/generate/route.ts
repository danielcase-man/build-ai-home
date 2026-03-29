import { updateProjectStatus, getProject } from '@/lib/project-service'
import { reconcileTasksFromEmails } from '@/lib/task-reconciler'
import { successResponse, errorResponse } from '@/lib/api-utils'

export async function POST() {
  try {
    const project = await getProject()

    if (!project) {
      return errorResponse(new Error('No project found'), 'No project found')
    }

    // Reconcile tasks against email evidence before generating status
    const reconciliation = await reconcileTasksFromEmails(project.id)

    // Generate fresh status from reconciled data
    await updateProjectStatus(project.id)

    return successResponse({
      message: 'Project status snapshot generated successfully',
      projectId: project.id,
      tasksReconciled: reconciliation.tasksUpdated,
      tasksDeduplicated: reconciliation.tasksDeduplicated,
    })
  } catch (error) {
    return errorResponse(error, 'Failed to generate project status snapshot')
  }
}
