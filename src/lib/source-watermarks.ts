/**
 * Source Watermarks — track last-processed state for each data source.
 *
 * The foundation of the Incremental Intelligence Engine. Every source
 * (Gmail, Dropbox, JobTread) has a watermark recording when it was
 * last processed and how many items were handled. The intelligence
 * engine reads watermarks to know what's changed since last run.
 */

import { supabase } from './supabase'
import type { IntelligenceSource, SourceWatermark } from '@/types'

/**
 * Get the watermark for a specific source.
 * Returns null if the source has never been processed.
 */
export async function getWatermark(source: IntelligenceSource): Promise<SourceWatermark | null> {
  const { data, error } = await supabase
    .from('source_watermarks')
    .select('*')
    .eq('source', source)
    .single()

  if (error || !data) return null
  return data as SourceWatermark
}

/**
 * Get all watermarks for all sources.
 */
export async function getAllWatermarks(): Promise<SourceWatermark[]> {
  const { data, error } = await supabase
    .from('source_watermarks')
    .select('*')
    .order('source')

  if (error) return []
  return (data || []) as SourceWatermark[]
}

/**
 * Update watermark after processing. Uses upsert so first run creates it.
 */
export async function updateWatermark(
  source: IntelligenceSource,
  update: {
    last_processed_at?: string
    last_processed_id?: string
    items_processed?: number
    errors?: number
    metadata?: Record<string, unknown>
  }
): Promise<void> {
  const now = new Date().toISOString()

  // Get existing to accumulate totals
  const existing = await getWatermark(source)

  const { error } = await supabase
    .from('source_watermarks')
    .upsert({
      source,
      last_processed_at: update.last_processed_at || now,
      last_processed_id: update.last_processed_id || existing?.last_processed_id || null,
      items_processed: (existing?.items_processed || 0) + (update.items_processed || 0),
      errors: (existing?.errors || 0) + (update.errors || 0),
      metadata: update.metadata || existing?.metadata || null,
      updated_at: now,
    }, {
      onConflict: 'source',
    })

  if (error) {
    console.error(`Failed to update watermark for ${source}:`, error)
  }
}

/**
 * Check if enough time has passed since last processing for a source.
 * Returns true if the source should be checked for changes.
 */
export function shouldProcess(watermark: SourceWatermark | null, minIntervalMinutes: number): boolean {
  if (!watermark) return true
  const lastProcessed = new Date(watermark.last_processed_at).getTime()
  const elapsed = Date.now() - lastProcessed
  return elapsed >= minIntervalMinutes * 60 * 1000
}

/**
 * Reset a watermark (for reprocessing).
 */
export async function resetWatermark(source: IntelligenceSource): Promise<void> {
  const { error } = await supabase
    .from('source_watermarks')
    .delete()
    .eq('source', source)

  if (error) {
    console.error(`Failed to reset watermark for ${source}:`, error)
  }
}
