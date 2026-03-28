import { NextRequest } from 'next/server'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'
import { getProject } from '@/lib/project-service'
import { getPhotoTimeline, getPhotosByRoom, getPhotoCount, uploadPhoto } from '@/lib/photo-service'
import type { PhotoType } from '@/lib/photo-service'

export async function GET(request: NextRequest) {
  try {
    const project = await getProject()
    if (!project) return successResponse({ photos: [] })

    const { searchParams } = request.nextUrl
    const view = searchParams.get('view')

    if (view === 'by_room') {
      const byRoom = await getPhotosByRoom(project.id)
      return successResponse({ rooms: byRoom })
    }

    if (view === 'count') {
      const count = await getPhotoCount(project.id)
      return successResponse({ count })
    }

    const phase = searchParams.get('phase') ? parseInt(searchParams.get('phase')!) : undefined
    const room = searchParams.get('room') || undefined
    const type = (searchParams.get('type') || undefined) as PhotoType | undefined

    const photos = await getPhotoTimeline(project.id, { phase, room, type })
    return successResponse({ count: photos.length, photos })
  } catch (error) {
    return errorResponse(error, 'Failed to fetch photos')
  }
}

export async function POST(request: NextRequest) {
  try {
    const project = await getProject()
    if (!project) return errorResponse(new Error('No project'), 'No project found')

    const formData = await request.formData()
    const file = formData.get('photo') as File

    if (!file) return validationError('No photo provided')

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const photo = await uploadPhoto({
      projectId: project.id,
      photoBuffer: buffer,
      filename: file.name,
      mimeType: file.type,
      caption: formData.get('caption') as string || undefined,
      photoType: (formData.get('type') as PhotoType) || 'progress',
      room: formData.get('room') as string || undefined,
      phaseNumber: formData.get('phase') ? parseInt(formData.get('phase') as string) : undefined,
      knowledgeId: formData.get('knowledge_id') as string || undefined,
    })

    if (!photo) return errorResponse(new Error('Upload failed'), 'Failed to upload photo')

    // Photo analysis deferred to Claude Code scheduled agent (Phase 2)
    // Photos are stored immediately; ai_description populated later
    return successResponse({ photo })
  } catch (error) {
    return errorResponse(error, 'Failed to upload photo')
  }
}
