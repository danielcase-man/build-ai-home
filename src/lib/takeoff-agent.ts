/**
 * Takeoff Agent — Structural Takeoff Pipeline
 *
 * 4-phase pipeline that connects plan discovery, trade extraction,
 * and takeoff item creation:
 *
 *   Phase A: Catalog files into documents table (cheap, no AI)
 *   Phase B: Discover latest plans from file_inventory
 *   Phase C: Extract structural data from plans via AI trade extractors
 *   Phase D: Create takeoff runs + items from extraction data
 *
 * Phases B-D only run when there are NEW file events (not backlog re-runs).
 * Registered with the agent router for the 'takeoff' domain.
 */

import * as fs from 'fs'
import * as path from 'path'
import { registerAgent } from './agent-router'
import { updateFileStatus } from './dropbox-watcher'
import { supabase } from './supabase'
import { discoverLatestPlans } from './plan-discovery-service'
import { runTradeExtractors, storeExtraction } from './plan-takeoff-service'
import type { DocumentExtraction } from './plan-takeoff-service'
import { extractTextFromPDF } from './document-analyzer'
import { createTakeoffRun, insertTakeoffItems, getTakeoffRuns, updateTakeoffRunStatus } from './takeoff-service'
import type { ChangeEvent, AgentResult, PlanSource, TakeoffItem } from '@/types'

// ─── Plan Classification Helpers (Phase A) ──────────────────────────────────

/**
 * Classify a plan file into a specific type based on path and name.
 */
function classifyPlanType(filePath: string, fileName: string): PlanSource['type'] {
  const lower = (filePath + '/' + fileName).toLowerCase()

  if (/structural|struct|framing/i.test(lower)) return 'structural'
  if (/foundation|slab|footing|pier/i.test(lower)) return 'foundation'
  if (/electrical|elec|lighting|panel/i.test(lower)) return 'electrical'
  if (/mechanical|hvac|duct/i.test(lower)) return 'mechanical'
  if (/plumbing|piping/i.test(lower)) return 'plumbing'
  if (/site|survey|grading|topo/i.test(lower)) return 'site'
  if (/detail|section|elevation/i.test(lower)) return 'detail'
  return 'architectural' // default for plan files
}

/**
 * Determine confidence level based on file type.
 */
function getConfidence(fileType: string): PlanSource['confidence'] {
  if (['pdf', 'txt', 'md', 'html'].includes(fileType)) return 'text_extractable'
  if (['jpg', 'jpeg', 'png', 'webp'].includes(fileType)) return 'image_ocr'
  return 'estimated'
}

/**
 * Extract a readable category from the file path.
 */
function extractCategory(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/')
  const markers = ['plans', 'drawings', 'architectural', 'structural', 'engineering']
  const idx = parts.findIndex(p => markers.some(m => p.toLowerCase().includes(m)))
  if (idx !== -1) {
    return parts.slice(idx, -1).join('/')
  }
  return parts.slice(-3, -1).join('/')
}

// ─── Extraction → TakeoffItem Mapping ───────────────────────────────────────

/** Map extraction type to the trade name used in takeoff_runs */
const EXTRACTION_TO_TRADE: Record<string, string> = {
  foundation_takeoff: 'Foundation (Pad Prep + PT Slab)',
  framing_takeoff: 'Framing (Lumber + Labor)',
  roofing_takeoff: 'Roofing',
  insulation_takeoff: 'Insulation',
  site_work_takeoff: 'Site Clearing & Grading',
  window_door_schedule: 'Windows & Doors',
  room_schedule: 'Interior Finishes',
}

/**
 * Convert a DocumentExtraction into an array of TakeoffItem-shaped objects.
 * Each extraction type has its own mapping logic.
 */
function mapExtractionToItems(
  extraction: DocumentExtraction,
  takeoffRunId: string,
  projectId: string
): Omit<TakeoffItem, 'id' | 'created_at' | 'updated_at' | 'quantity_with_waste' | 'total_cost'>[] {
  const items: Omit<TakeoffItem, 'id' | 'created_at' | 'updated_at' | 'quantity_with_waste' | 'total_cost'>[] = []
  const data = extraction.extracted_data
  const trade = EXTRACTION_TO_TRADE[extraction.extraction_type] || extraction.extraction_type
  const sourceDetail = `Extracted from ${extraction.document_id} — ${extraction.extraction_type}`

  const base = {
    takeoff_run_id: takeoffRunId,
    project_id: projectId,
    trade,
    source: 'structural_plan' as const,
    confidence: 'calculated' as const,
    source_detail: sourceDetail,
  }

  let sortOrder = 0

  switch (extraction.extraction_type) {
    case 'foundation_takeoff': {
      const slab = data.slab as Record<string, unknown> | undefined
      const rebar = data.rebar as Record<string, unknown> | undefined
      const postTension = data.post_tension as Record<string, unknown> | undefined
      const piers = data.piers as Array<Record<string, unknown>> | undefined
      const vaporBarrier = data.vapor_barrier_sqft as number | undefined

      if (slab?.concrete_cy) {
        items.push({
          ...base,
          category: 'concrete',
          item_name: 'Concrete Slab',
          quantity: Number(slab.concrete_cy),
          unit: 'CY',
          material_spec: slab.concrete_psi ? `${slab.concrete_psi} PSI` : undefined,
          sort_order: sortOrder++,
        })
      }
      if (slab?.perimeter_lf) {
        items.push({
          ...base,
          category: 'concrete',
          item_name: 'Slab Perimeter Forms',
          quantity: Number(slab.perimeter_lf),
          unit: 'LF',
          sort_order: sortOrder++,
        })
      }
      if (rebar?.quantity_lf) {
        items.push({
          ...base,
          category: 'concrete',
          item_name: `Rebar${rebar.spec ? ` (${rebar.spec})` : ''}`,
          quantity: Number(rebar.quantity_lf),
          unit: 'LF',
          material_spec: rebar.spec as string | undefined,
          sort_order: sortOrder++,
        })
      }
      if (postTension?.cable_count) {
        items.push({
          ...base,
          category: 'concrete',
          item_name: 'Post-Tension Cables',
          quantity: Number(postTension.cable_count),
          unit: 'EA',
          material_spec: postTension.spec as string | undefined,
          sort_order: sortOrder++,
        })
      }
      if (piers && piers.length > 0) {
        const totalPierCount = piers.reduce((sum, p) => sum + (Number(p.count) || 0), 0)
        if (totalPierCount > 0) {
          items.push({
            ...base,
            category: 'concrete',
            item_name: 'Pier/Footing',
            quantity: totalPierCount,
            unit: 'EA',
            sort_order: sortOrder++,
          })
        }
      }
      if (vaporBarrier) {
        items.push({
          ...base,
          category: 'concrete',
          item_name: 'Vapor Barrier',
          quantity: Number(vaporBarrier),
          unit: 'SF',
          sort_order: sortOrder++,
        })
      }
      break
    }

    case 'framing_takeoff': {
      const walls = data.walls as Record<string, unknown> | undefined
      const headers = data.headers as Array<Record<string, unknown>> | undefined
      const beams = data.beams as Array<Record<string, unknown>> | undefined
      const sheathing = data.sheathing as Record<string, unknown> | undefined
      const plates = data.plates as Record<string, unknown> | undefined

      if (walls?.exterior_lf) {
        items.push({
          ...base,
          category: 'framing',
          item_name: 'Exterior Wall Framing',
          quantity: Number(walls.exterior_lf),
          unit: 'LF',
          sort_order: sortOrder++,
        })
      }
      if (walls?.interior_lf) {
        items.push({
          ...base,
          category: 'framing',
          item_name: 'Interior Wall Framing',
          quantity: Number(walls.interior_lf),
          unit: 'LF',
          sort_order: sortOrder++,
        })
      }
      if (headers) {
        for (const header of headers) {
          if (header.quantity) {
            items.push({
              ...base,
              category: 'framing',
              item_name: `Header${header.size ? ` (${header.size})` : ''}`,
              quantity: Number(header.quantity),
              unit: 'EA',
              material_spec: header.size as string | undefined,
              sort_order: sortOrder++,
            })
          }
        }
      }
      if (beams) {
        for (const beam of beams) {
          if (beam.quantity) {
            items.push({
              ...base,
              category: 'framing',
              item_name: `Beam${beam.size ? ` (${beam.size})` : ''}`,
              quantity: Number(beam.quantity),
              unit: 'EA',
              material_spec: beam.size as string | undefined,
              sort_order: sortOrder++,
            })
          }
        }
      }
      if (sheathing?.roof_sqft) {
        items.push({
          ...base,
          category: 'framing',
          item_name: 'Roof Sheathing',
          quantity: Number(sheathing.roof_sqft),
          unit: 'SF',
          sort_order: sortOrder++,
        })
      }
      if (sheathing?.wall_sqft) {
        items.push({
          ...base,
          category: 'framing',
          item_name: 'Wall Sheathing',
          quantity: Number(sheathing.wall_sqft),
          unit: 'SF',
          sort_order: sortOrder++,
        })
      }
      if (plates?.total_lf) {
        items.push({
          ...base,
          category: 'framing',
          item_name: `Plates${plates.material ? ` (${plates.material})` : ''}`,
          quantity: Number(plates.total_lf),
          unit: 'LF',
          material_spec: plates.material as string | undefined,
          sort_order: sortOrder++,
        })
      }
      break
    }

    case 'roofing_takeoff': {
      const roofSqft = data.roof_sqft as number | undefined
      const material = data.material as string | undefined
      const ridgeLf = data.ridge_lf as number | undefined
      const flashingLf = data.flashing_lf as number | undefined
      const dripEdgeLf = data.drip_edge_lf as number | undefined
      const gutterLf = data.gutter_lf as number | undefined
      const vents = data.vents as Array<Record<string, unknown>> | undefined

      if (roofSqft) {
        items.push({
          ...base,
          category: 'roofing',
          item_name: `Roofing${material ? ` (${material})` : ''}`,
          quantity: Number(roofSqft),
          unit: 'SF',
          material_spec: material,
          sort_order: sortOrder++,
        })
      }
      if (ridgeLf) {
        items.push({
          ...base,
          category: 'roofing',
          item_name: 'Ridge Cap',
          quantity: Number(ridgeLf),
          unit: 'LF',
          sort_order: sortOrder++,
        })
      }
      if (flashingLf) {
        items.push({
          ...base,
          category: 'roofing',
          item_name: 'Flashing',
          quantity: Number(flashingLf),
          unit: 'LF',
          sort_order: sortOrder++,
        })
      }
      if (dripEdgeLf) {
        items.push({
          ...base,
          category: 'roofing',
          item_name: 'Drip Edge',
          quantity: Number(dripEdgeLf),
          unit: 'LF',
          sort_order: sortOrder++,
        })
      }
      if (gutterLf) {
        items.push({
          ...base,
          category: 'roofing',
          item_name: 'Gutters',
          quantity: Number(gutterLf),
          unit: 'LF',
          sort_order: sortOrder++,
        })
      }
      if (vents) {
        for (const vent of vents) {
          if (vent.count) {
            items.push({
              ...base,
              category: 'roofing',
              item_name: `Roof Vent${vent.type ? ` (${vent.type})` : ''}`,
              quantity: Number(vent.count),
              unit: 'EA',
              sort_order: sortOrder++,
            })
          }
        }
      }
      break
    }

    case 'insulation_takeoff': {
      const extWalls = data.exterior_walls as Record<string, unknown> | undefined
      const ceiling = data.ceiling as Record<string, unknown> | undefined
      const rigid = data.rigid as Record<string, unknown> | undefined
      const sprayFoam = data.spray_foam as Record<string, unknown> | undefined

      if (extWalls?.area_sqft) {
        items.push({
          ...base,
          category: 'insulation',
          item_name: `Exterior Wall Insulation${extWalls.material ? ` (${extWalls.material})` : ''}`,
          quantity: Number(extWalls.area_sqft),
          unit: 'SF',
          material_spec: extWalls.material as string | undefined,
          sort_order: sortOrder++,
        })
      }
      if (ceiling?.area_sqft) {
        items.push({
          ...base,
          category: 'insulation',
          item_name: `Ceiling Insulation${ceiling.material ? ` (${ceiling.material})` : ''}`,
          quantity: Number(ceiling.area_sqft),
          unit: 'SF',
          material_spec: ceiling.material as string | undefined,
          sort_order: sortOrder++,
        })
      }
      if (rigid?.area_sqft) {
        items.push({
          ...base,
          category: 'insulation',
          item_name: `Rigid Insulation${rigid.spec ? ` (${rigid.spec})` : ''}`,
          quantity: Number(rigid.area_sqft),
          unit: 'SF',
          material_spec: rigid.spec as string | undefined,
          sort_order: sortOrder++,
        })
      }
      if (sprayFoam?.area_sqft) {
        items.push({
          ...base,
          category: 'insulation',
          item_name: 'Spray Foam',
          quantity: Number(sprayFoam.area_sqft),
          unit: 'SF',
          sort_order: sortOrder++,
        })
      }
      break
    }

    case 'site_work_takeoff': {
      const earthwork = data.earthwork as Record<string, unknown> | undefined
      const driveway = data.driveway as Record<string, unknown> | undefined
      const utilities = data.utilities as Array<Record<string, unknown>> | undefined

      if (earthwork?.cut_cy) {
        items.push({
          ...base,
          category: 'site_work',
          item_name: 'Earthwork - Cut',
          quantity: Number(earthwork.cut_cy),
          unit: 'CY',
          sort_order: sortOrder++,
        })
      }
      if (earthwork?.fill_cy) {
        items.push({
          ...base,
          category: 'site_work',
          item_name: 'Earthwork - Fill',
          quantity: Number(earthwork.fill_cy),
          unit: 'CY',
          sort_order: sortOrder++,
        })
      }
      if (driveway?.area_sqft) {
        items.push({
          ...base,
          category: 'site_work',
          item_name: `Driveway${driveway.material ? ` (${driveway.material})` : ''}`,
          quantity: Number(driveway.area_sqft),
          unit: 'SF',
          material_spec: driveway.material as string | undefined,
          sort_order: sortOrder++,
        })
      }
      if (utilities) {
        for (const util of utilities) {
          if (util.trench_lf) {
            items.push({
              ...base,
              category: 'site_work',
              item_name: `Utility Trench${util.type ? ` (${util.type})` : ''}`,
              quantity: Number(util.trench_lf),
              unit: 'LF',
              sort_order: sortOrder++,
            })
          }
        }
      }
      break
    }

    case 'window_door_schedule': {
      const windows = data.windows as Array<Record<string, unknown>> | undefined
      const doors = data.doors as Array<Record<string, unknown>> | undefined

      if (windows) {
        for (const win of windows) {
          const qty = Number(win.quantity) || 1
          const sizeStr = win.width && win.height ? `${win.width}x${win.height}` : ''
          items.push({
            ...base,
            category: 'windows',
            item_name: `${win.type || 'Window'} Window${win.mark ? ` ${win.mark}` : ''}${sizeStr ? ` (${sizeStr})` : ''}`,
            quantity: qty,
            unit: 'EA',
            room: (win.room as string) || undefined,
            sort_order: sortOrder++,
          })
        }
      }
      if (doors) {
        for (const door of doors) {
          const qty = Number(door.quantity) || 1
          const sizeStr = door.width && door.height ? `${door.width}x${door.height}` : ''
          items.push({
            ...base,
            category: 'doors',
            item_name: `${door.type || 'Door'} Door${door.mark ? ` ${door.mark}` : ''}${sizeStr ? ` (${sizeStr})` : ''}`,
            quantity: qty,
            unit: 'EA',
            room: (door.location as string) || undefined,
            sort_order: sortOrder++,
          })
        }
      }
      break
    }

    default:
      // Unknown extraction type — skip
      break
  }

  return items
}

// ─── Phase A: Catalog Files ─────────────────────────────────────────────────

async function phaseA_catalogFiles(
  events: ChangeEvent[],
  projectId: string
): Promise<{ cataloged: number; errors: string[] }> {
  const fileEvents = events.filter(e => e.file_path && e.file_name)
  let cataloged = 0
  const errors: string[] = []

  for (const event of fileEvents) {
    const filePath = event.file_path!
    const fileName = event.file_name!
    const fileType = event.file_type || path.extname(fileName).replace('.', '')

    try {
      // Check if already cataloged
      const { data: existing } = await supabase
        .from('documents')
        .select('id')
        .eq('file_url', filePath)
        .limit(1)

      if (existing && existing.length > 0) {
        await updateFileStatus(filePath, 'skipped', { error_message: 'Already cataloged' })
        continue
      }

      const planType = classifyPlanType(filePath, fileName)
      const category = extractCategory(filePath)
      const confidence = getConfidence(fileType)

      let fileSize = 0
      try {
        const stat = fs.statSync(filePath)
        fileSize = stat.size
      } catch { /* file may have moved */ }

      const { error: insertError } = await supabase
        .from('documents')
        .insert({
          project_id: projectId,
          name: fileName,
          category: category || 'Plans',
          file_url: filePath,
          file_type: fileType,
          file_size: fileSize,
          source_path: filePath,
          ai_classification: `plan_type:${planType}; confidence:${confidence}`,
          description: `${planType} plan — cataloged by intelligence engine`,
        })

      if (insertError) {
        errors.push(`${fileName}: ${insertError.message}`)
        await updateFileStatus(filePath, 'failed', { error_message: insertError.message })
      } else {
        cataloged++
        await updateFileStatus(filePath, 'completed')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      errors.push(`${fileName}: ${msg}`)
      await updateFileStatus(filePath, 'failed', { error_message: msg })
    }
  }

  return { cataloged, errors }
}

// ─── Phase B: Discover Latest Plans ─────────────────────────────────────────

// Re-export for testing
export { discoverLatestPlans }

// ─── Phase C: Extract Structural Data ───────────────────────────────────────

interface ExtractionResult {
  planFileName: string
  planType: string
  extractions: DocumentExtraction[]
}

async function phaseC_extractPlans(
  plans: Record<string, { fileId: string; filePath: string; fileName: string; planType: string; version: number; versionLabel: string; modifiedAt: string; confidence: number }>,
  projectId: string
): Promise<{ extracted: ExtractionResult[]; skipped: number; errors: string[] }> {
  const extracted: ExtractionResult[] = []
  let skipped = 0
  const errors: string[] = []

  for (const [planType, plan] of Object.entries(plans)) {
    try {
      // Check if already extracted — dedup by document_id + extraction_type pattern
      const { data: existingExtractions } = await supabase
        .from('document_extractions')
        .select('id, extraction_type')
        .eq('document_id', plan.fileId)
        .like('extraction_type', '%_takeoff')

      // Also check window_door_schedule and room_schedule
      const { data: existingSchedules } = await supabase
        .from('document_extractions')
        .select('id, extraction_type')
        .eq('document_id', plan.fileId)
        .in('extraction_type', ['window_door_schedule', 'room_schedule'])

      const allExisting = [...(existingExtractions || []), ...(existingSchedules || [])]

      if (allExisting.length > 0) {
        skipped++
        continue
      }

      // Read the PDF from local filesystem
      let pdfBuffer: Buffer
      try {
        pdfBuffer = fs.readFileSync(plan.filePath)
      } catch (err) {
        errors.push(`${plan.fileName}: Could not read file — ${err instanceof Error ? err.message : 'Unknown error'}`)
        continue
      }

      // Extract text
      const text = await extractTextFromPDF(pdfBuffer)
      if (!text || text.length < 50) {
        errors.push(`${plan.fileName}: Insufficient text content (${text.length} chars)`)
        continue
      }

      // Run trade extractors
      const extractions = await runTradeExtractors(
        planType,
        text,
        plan.fileName,
        plan.fileId,
        projectId
      )

      // Store valid extractions
      const validExtractions: DocumentExtraction[] = []
      for (const extraction of extractions) {
        if (extraction.confidence > 0.1 && Object.keys(extraction.extracted_data).length > 0) {
          const stored = await storeExtraction(extraction)
          if (stored) {
            validExtractions.push(stored)
          }
        }
      }

      if (validExtractions.length > 0) {
        extracted.push({
          planFileName: plan.fileName,
          planType,
          extractions: validExtractions,
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      errors.push(`${plan.fileName}: ${msg}`)
    }
  }

  return { extracted, skipped, errors }
}

// ─── Phase D: Create Takeoff Runs + Items ───────────────────────────────────

async function phaseD_createTakeoffItems(
  extractionResults: ExtractionResult[],
  projectId: string
): Promise<{ itemsCreated: number; runsCreated: number; errors: string[] }> {
  let itemsCreated = 0
  let runsCreated = 0
  const errors: string[] = []

  // Group extractions by trade
  const byTrade = new Map<string, { extractions: DocumentExtraction[]; planFileName: string }>()

  for (const result of extractionResults) {
    for (const extraction of result.extractions) {
      const trade = EXTRACTION_TO_TRADE[extraction.extraction_type]
      if (!trade) continue

      const existing = byTrade.get(trade)
      if (existing) {
        existing.extractions.push(extraction)
      } else {
        byTrade.set(trade, {
          extractions: [extraction],
          planFileName: result.planFileName,
        })
      }
    }
  }

  for (const [trade, { extractions, planFileName }] of byTrade) {
    try {
      // Supersede any existing draft runs for this trade
      const existingRuns = await getTakeoffRuns(projectId, { trade, status: 'draft' })

      // Build plan_sources from the extraction data
      const planSources: PlanSource[] = extractions.map(ext => ({
        name: planFileName,
        type: ext.extraction_type.replace('_takeoff', '').replace('_schedule', '') as PlanSource['type'],
        confidence: ext.confidence >= 0.8 ? 'text_extractable' as const : 'estimated' as const,
        version: 'latest',
      }))

      // Create the takeoff run
      const avgConfidence = extractions.reduce((sum, e) => sum + e.confidence, 0) / extractions.length
      const run = await createTakeoffRun({
        project_id: projectId,
        trade,
        name: `${trade} — Auto-extracted`,
        description: `Structural takeoff auto-extracted from ${planFileName}`,
        plan_sources: planSources,
        confidence_pct: Math.round(avgConfidence * 100),
        status: 'draft',
      })

      if (!run) {
        errors.push(`Failed to create takeoff run for trade: ${trade}`)
        continue
      }

      runsCreated++

      // Supersede old runs now that the new one exists
      for (const oldRun of existingRuns) {
        await updateTakeoffRunStatus(oldRun.id, 'superseded', run.id)
      }

      // Map extractions to takeoff items
      const allItems: Omit<TakeoffItem, 'id' | 'created_at' | 'updated_at' | 'quantity_with_waste' | 'total_cost'>[] = []
      for (const extraction of extractions) {
        const mapped = mapExtractionToItems(extraction, run.id, projectId)
        allItems.push(...mapped)
      }

      if (allItems.length > 0) {
        const { inserted, errors: insertErrors } = await insertTakeoffItems(allItems)
        itemsCreated += inserted
        errors.push(...insertErrors)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      errors.push(`${trade}: ${msg}`)
    }
  }

  return { itemsCreated, runsCreated, errors }
}

// ─── Main Handler ───────────────────────────────────────────────────────────

/**
 * Takeoff Agent handler — 4-phase structural takeoff pipeline.
 */
async function handleTakeoff(events: ChangeEvent[], projectId: string): Promise<AgentResult> {
  const startTime = Date.now()
  const result: AgentResult = {
    domain: 'takeoff',
    source: 'dropbox',
    action: 'structural_takeoff',
    details: '',
    records_created: 0,
    records_updated: 0,
    errors: [],
    duration_ms: 0,
  }

  const fileEvents = events.filter(e => e.file_path && e.file_name)
  const hasNewFiles = fileEvents.length > 0

  if (!hasNewFiles) {
    result.details = 'No plan files to catalog'
    result.duration_ms = Date.now() - startTime
    return result
  }

  // Phase A: Catalog files (always runs when there are file events)
  const phaseAResult = await phaseA_catalogFiles(events, projectId)
  result.records_created += phaseAResult.cataloged
  result.errors.push(...phaseAResult.errors)

  // Phases B-D: Only run when there are new file events
  let plansExtracted = 0
  let itemsCreated = 0
  let tradesProcessed = 0

  try {
    // Phase B: Discover latest plans
    const discovery = await discoverLatestPlans(projectId)
    const planCount = Object.keys(discovery.plans).length

    if (planCount > 0) {
      // Phase C: Extract structural data
      const phaseCResult = await phaseC_extractPlans(discovery.plans, projectId)
      plansExtracted = phaseCResult.extracted.length
      result.errors.push(...phaseCResult.errors)

      if (phaseCResult.extracted.length > 0) {
        // Phase D: Create takeoff runs + items
        const phaseDResult = await phaseD_createTakeoffItems(phaseCResult.extracted, projectId)
        itemsCreated = phaseDResult.itemsCreated
        tradesProcessed = phaseDResult.runsCreated
        result.records_created += phaseDResult.itemsCreated
        result.records_updated += phaseDResult.runsCreated
        result.errors.push(...phaseDResult.errors)
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    result.errors.push(`Pipeline error: ${msg}`)
  }

  // Build summary details
  const parts: string[] = []
  parts.push(`Cataloged ${phaseAResult.cataloged} file(s)`)
  if (plansExtracted > 0) parts.push(`Extracted ${plansExtracted} plan(s)`)
  if (itemsCreated > 0) parts.push(`Created ${itemsCreated} takeoff items across ${tradesProcessed} trade(s)`)
  if (result.errors.length > 0) parts.push(`${result.errors.length} error(s)`)
  result.details = parts.join('. ') + '.'

  result.duration_ms = Date.now() - startTime
  return result
}

registerAgent('takeoff', handleTakeoff)
export { handleTakeoff, mapExtractionToItems, EXTRACTION_TO_TRADE }
