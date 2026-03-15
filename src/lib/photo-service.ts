/**
 * Photo Service — site photo documentation with AI vision analysis.
 */

import { supabase } from './supabase'
import { getAnthropicClient } from './ai-clients'

const MODEL = 'claude-sonnet-4-6'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PhotoType = 'progress' | 'issue' | 'inspection' | 'documentation' | 'before_after'

export interface SitePhoto {
  id?: string
  project_id: string
  knowledge_id: string | null
  phase_number: number | null
  room: string | null
  photo_url: string
  thumbnail_url: string | null
  caption: string | null
  photo_type: PhotoType
  taken_at: string
  gps_latitude: number | null
  gps_longitude: number | null
  ai_description: string | null
  tags: string[]
  created_at?: string
}

// ---------------------------------------------------------------------------
// Read Operations
// ---------------------------------------------------------------------------

export async function getPhotoTimeline(
  projectId: string,
  filters?: { phase?: number; room?: string; type?: PhotoType }
): Promise<SitePhoto[]> {
  let query = supabase
    .from('site_photos')
    .select('*')
    .eq('project_id', projectId)
    .order('taken_at', { ascending: false })

  if (filters?.phase) query = query.eq('phase_number', filters.phase)
  if (filters?.room) query = query.eq('room', filters.room)
  if (filters?.type) query = query.eq('photo_type', filters.type)

  const { data, error } = await query
  if (error) return []
  return (data || []) as SitePhoto[]
}

export async function getPhotosByRoom(projectId: string): Promise<Record<string, SitePhoto[]>> {
  const photos = await getPhotoTimeline(projectId)
  const byRoom: Record<string, SitePhoto[]> = {}
  for (const photo of photos) {
    const room = photo.room || 'General'
    if (!byRoom[room]) byRoom[room] = []
    byRoom[room].push(photo)
  }
  return byRoom
}

export async function getPhotoCount(projectId: string): Promise<number> {
  const { count, error } = await supabase
    .from('site_photos')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId)

  if (error) return 0
  return count || 0
}

// ---------------------------------------------------------------------------
// Write Operations
// ---------------------------------------------------------------------------

export async function uploadPhoto(params: {
  projectId: string
  photoBuffer: Buffer
  filename: string
  mimeType: string
  caption?: string
  photoType?: PhotoType
  room?: string
  phaseNumber?: number
  knowledgeId?: string
  latitude?: number
  longitude?: number
}): Promise<SitePhoto | null> {
  const {
    projectId, photoBuffer, filename, mimeType, caption,
    photoType = 'progress', room, phaseNumber, knowledgeId,
    latitude, longitude,
  } = params

  // Upload to Supabase Storage
  const storagePath = `${projectId}/photos/${Date.now()}-${filename}`
  const { error: uploadError } = await supabase.storage
    .from('site-photos')
    .upload(storagePath, photoBuffer, { contentType: mimeType })

  if (uploadError) {
    console.error('Photo upload failed:', uploadError)
    return null
  }

  const { data: urlData } = supabase.storage
    .from('site-photos')
    .getPublicUrl(storagePath)

  const photoUrl = urlData?.publicUrl || storagePath

  // Store metadata
  const { data, error } = await supabase
    .from('site_photos')
    .insert({
      project_id: projectId,
      knowledge_id: knowledgeId || null,
      phase_number: phaseNumber || null,
      room: room || null,
      photo_url: photoUrl,
      caption: caption || null,
      photo_type: photoType,
      taken_at: new Date().toISOString(),
      gps_latitude: latitude || null,
      gps_longitude: longitude || null,
      tags: [],
    })
    .select()
    .single()

  if (error) {
    console.error('Photo metadata insert failed:', error)
    return null
  }

  return data as SitePhoto
}

/** Analyze a photo using Claude vision API */
export async function analyzePhoto(
  photoId: string,
  imageBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp'
): Promise<string> {
  try {
    const response = await getAnthropicClient().messages.create({
      model: MODEL,
      max_tokens: 500,
      temperature: 0.3,
      system: 'You are a construction site photo analyst. Describe what you see in the construction photo concisely, noting progress, materials visible, quality observations, and any potential issues.',
      messages: [{
        role: 'user',
        content: [{
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: imageBase64 },
        }, {
          type: 'text',
          text: 'Describe this construction site photo. Note: materials visible, work stage, quality observations, any concerns.',
        }],
      }],
    })

    const text = response.content[0]
    if (text.type === 'text') {
      // Save description to DB
      await supabase
        .from('site_photos')
        .update({ ai_description: text.text, updated_at: new Date().toISOString() })
        .eq('id', photoId)

      return text.text
    }
    return ''
  } catch (error) {
    console.error('Photo analysis failed:', error)
    return ''
  }
}
