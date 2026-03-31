/**
 * Plan Takeoff Service — AI-powered extraction from architectural documents.
 *
 * Uses Claude Sonnet 4.6 vision API for PDF pages rendered as images,
 * and text extraction for text-based PDFs. Extracts room schedules,
 * fixture counts, window/door schedules, and material quantities.
 */

import { getAnthropicClient, parseAIJsonResponse } from './ai-clients'
import { supabase } from './supabase'
import pdf from 'pdf-parse-fork'
import { extractFromDXF } from './dxf-extractor'
import type { DxfExtractionResult } from './dxf-extractor'
import type { Selection } from '@/types'

const MODEL = 'claude-sonnet-4-6'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExtractionType =
  | 'room_schedule'
  | 'fixture_count'
  | 'window_schedule'
  | 'door_schedule'
  | 'material_takeoff'
  | 'electrical_schedule'
  | 'plumbing_schedule'
  | 'general'
  // Structural / trade-specific types:
  | 'foundation_takeoff'
  | 'framing_takeoff'
  | 'roofing_takeoff'
  | 'insulation_takeoff'
  | 'site_work_takeoff'
  | 'window_door_schedule'

export interface DocumentExtraction {
  id?: string
  document_id: string
  project_id: string
  extraction_type: ExtractionType
  extracted_data: Record<string, unknown>
  confidence: number
  ai_notes: string
  reviewed: boolean
}

export interface PlanRoom {
  id?: string
  project_id: string
  name: string
  floor: string | null
  square_footage: number | null
  ceiling_height: number | null
  fixtures: Array<{ type: string; count: number; specs?: string }>
  finishes: Array<{ surface: string; material: string; color?: string }>
  source_document_id: string | null
}

export interface TakeoffSummary {
  rooms: PlanRoom[]
  extractions: DocumentExtraction[]
  totalFixtures: number
  totalWindows: number
  totalDoors: number
}

// ---------------------------------------------------------------------------
// Core Processing
// ---------------------------------------------------------------------------

/** Process an uploaded PDF document — extract text and run all extractors */
export async function processUploadedPlan(
  documentId: string,
  projectId: string,
  pdfBuffer: Buffer,
  filename: string
): Promise<TakeoffSummary> {
  // Extract text from PDF
  let textContent = ''
  try {
    const pdfData = await pdf(pdfBuffer)
    textContent = pdfData.text
  } catch {
    console.error('PDF text extraction failed for', filename)
  }

  // Determine extraction approach
  const hasSubstantialText = textContent.length > 200

  // Run extractors based on content
  const extractions: DocumentExtraction[] = []

  if (hasSubstantialText) {
    // Text-based PDF — run all text extractors in parallel
    const [roomSchedule, fixtureCount, windowSchedule, doorSchedule, materialTakeoff] =
      await Promise.all([
        extractRoomSchedule(textContent, filename, documentId, projectId),
        extractFixtureCounts(textContent, filename, documentId, projectId),
        extractWindowSchedule(textContent, filename, documentId, projectId),
        extractDoorSchedule(textContent, filename, documentId, projectId),
        extractMaterialTakeoff(textContent, filename, documentId, projectId),
      ])

    extractions.push(roomSchedule, fixtureCount, windowSchedule, doorSchedule, materialTakeoff)
  } else {
    // Minimal text — try general extraction from whatever we have
    if (textContent.length > 0) {
      const general = await extractGeneral(textContent, filename, documentId, projectId)
      extractions.push(general)
    }
  }

  // Filter out empty extractions and store results
  const validExtractions = extractions.filter(
    e => e.confidence > 0.1 && Object.keys(e.extracted_data).length > 0
  )

  for (const extraction of validExtractions) {
    await storeExtraction(extraction)
  }

  // Build rooms from room schedule extraction
  const rooms: PlanRoom[] = []
  const roomExtraction = validExtractions.find(e => e.extraction_type === 'room_schedule')
  if (roomExtraction?.extracted_data?.rooms) {
    const extractedRooms = roomExtraction.extracted_data.rooms as Array<Record<string, unknown>>
    for (const room of extractedRooms) {
      const planRoom: PlanRoom = {
        project_id: projectId,
        name: (room.name as string) || 'Unknown Room',
        floor: (room.floor as string) || null,
        square_footage: room.square_footage ? Number(room.square_footage) : null,
        ceiling_height: room.ceiling_height ? Number(room.ceiling_height) : null,
        fixtures: (room.fixtures as PlanRoom['fixtures']) || [],
        finishes: (room.finishes as PlanRoom['finishes']) || [],
        source_document_id: documentId,
      }
      const stored = await storeRoom(planRoom)
      if (stored) rooms.push(stored)
    }
  }

  // Count totals from fixture/window/door extractions
  const fixtureExt = validExtractions.find(e => e.extraction_type === 'fixture_count')
  const windowExt = validExtractions.find(e => e.extraction_type === 'window_schedule')
  const doorExt = validExtractions.find(e => e.extraction_type === 'door_schedule')

  const totalFixtures = countItems(fixtureExt?.extracted_data?.fixtures)
  const totalWindows = countItems(windowExt?.extracted_data?.windows)
  const totalDoors = countItems(doorExt?.extracted_data?.doors)

  return { rooms, extractions: validExtractions, totalFixtures, totalWindows, totalDoors }
}

/** Process an uploaded DXF file — parse structured CAD data directly */
export async function processUploadedDXF(
  documentId: string,
  projectId: string,
  dxfContent: string,
  filename: string
): Promise<DxfExtractionResult & { extraction_id?: string }> {
  const result = extractFromDXF(dxfContent)

  // Store the DXF extraction as a document_extraction record
  const extractionData: Record<string, unknown> = {
    layers: result.layers,
    rooms: result.rooms,
    fixtures: result.fixtures,
    dimensions: result.dimensions,
    windows: result.windows,
    doors: result.doors,
    texts: result.texts,
    entity_summary: result.entity_summary,
    raw_entity_count: result.raw_entity_count,
  }

  const { data: stored } = await supabase
    .from('document_extractions')
    .insert({
      document_id: documentId,
      project_id: projectId,
      extraction_type: 'general',
      extracted_data: extractionData,
      confidence: 0.95, // DXF is precise structured data
      ai_notes: `DXF extraction from ${filename}: ${result.layers.length} layers, ${result.raw_entity_count} entities`,
      reviewed: false,
    })
    .select('id')
    .single()

  // Create plan_rooms from DXF room data
  for (const room of result.rooms) {
    await supabase
      .from('plan_rooms')
      .insert({
        project_id: projectId,
        name: room.name,
        floor: null,
        square_footage: room.area_sqft,
        ceiling_height: null,
        fixtures: [],
        finishes: [],
        source_document_id: documentId,
      })
  }

  return {
    ...result,
    extraction_id: stored?.id,
  }
}

// ---------------------------------------------------------------------------
// Individual Extractors
// ---------------------------------------------------------------------------

async function extractRoomSchedule(
  content: string,
  filename: string,
  documentId: string,
  projectId: string
): Promise<DocumentExtraction> {
  return runExtractor({
    extractionType: 'room_schedule',
    content,
    filename,
    documentId,
    projectId,
    prompt: `Extract the room schedule from this construction document. For each room found, extract:
- Room name (e.g., "Primary Bedroom", "Kitchen", "Powder Bath")
- Floor level (1st, 2nd, etc.)
- Square footage
- Ceiling height
- Fixtures list (type, count, specs)
- Finishes (surface type, material, color)

Return JSON:
{
  "rooms": [
    {
      "name": "Room Name",
      "floor": "1st",
      "square_footage": 250,
      "ceiling_height": 9,
      "fixtures": [{"type": "recessed light", "count": 6, "specs": "6-inch LED"}],
      "finishes": [{"surface": "floor", "material": "hardwood", "color": "natural oak"}]
    }
  ],
  "total_rooms": 15,
  "total_square_footage": 7526,
  "notes": "any relevant notes"
}`,
  })
}

async function extractFixtureCounts(
  content: string,
  filename: string,
  documentId: string,
  projectId: string
): Promise<DocumentExtraction> {
  return runExtractor({
    extractionType: 'fixture_count',
    content,
    filename,
    documentId,
    projectId,
    prompt: `Extract all fixture counts from this construction document. Include:
- Plumbing fixtures (toilets, sinks, faucets, shower heads, tubs)
- Lighting fixtures (recessed, pendants, chandeliers, sconces, under-cabinet)
- Electrical fixtures (outlets, switches, dimmers, USB outlets)
- Appliances (range, oven, dishwasher, disposal, hood, washer, dryer)

Return JSON:
{
  "fixtures": [
    {"category": "plumbing", "type": "toilet", "count": 5, "specs": "elongated, comfort height", "rooms": ["Primary Bath", "Bath 2"]},
    {"category": "lighting", "type": "recessed can", "count": 48, "specs": "6-inch LED"}
  ],
  "totals": {"plumbing": 25, "lighting": 80, "electrical": 150, "appliances": 12},
  "notes": "any relevant notes"
}`,
  })
}

async function extractWindowSchedule(
  content: string,
  filename: string,
  documentId: string,
  projectId: string
): Promise<DocumentExtraction> {
  return runExtractor({
    extractionType: 'window_schedule',
    content,
    filename,
    documentId,
    projectId,
    prompt: `Extract the window schedule from this construction document. For each window or group:
- Window mark/tag (e.g., W1, W2)
- Size (width x height)
- Type (fixed, single-hung, double-hung, casement, slider, picture)
- Quantity
- Room location
- Special features (tempered, Low-E, argon, etc.)

Return JSON:
{
  "windows": [
    {"mark": "W1", "size": "36x48", "type": "double-hung", "count": 4, "room": "Living Room", "features": ["Low-E", "argon"]}
  ],
  "total_count": 35,
  "notes": "any relevant notes"
}`,
  })
}

async function extractDoorSchedule(
  content: string,
  filename: string,
  documentId: string,
  projectId: string
): Promise<DocumentExtraction> {
  return runExtractor({
    extractionType: 'door_schedule',
    content,
    filename,
    documentId,
    projectId,
    prompt: `Extract the door schedule from this construction document. For each door:
- Door mark/tag (e.g., D1, D2)
- Size (width x height)
- Type (entry, interior, sliding glass, pocket, barn, bifold, French)
- Material (wood, fiberglass, steel, glass)
- Quantity
- Location
- Hardware notes

Return JSON:
{
  "doors": [
    {"mark": "D1", "size": "36x80", "type": "entry", "material": "fiberglass", "count": 1, "location": "Front Entry", "hardware": "lever handle, deadbolt"}
  ],
  "total_count": 25,
  "notes": "any relevant notes"
}`,
  })
}

async function extractMaterialTakeoff(
  content: string,
  filename: string,
  documentId: string,
  projectId: string
): Promise<DocumentExtraction> {
  return runExtractor({
    extractionType: 'material_takeoff',
    content,
    filename,
    documentId,
    projectId,
    prompt: `Extract material quantities and specifications from this construction document. Look for:
- Concrete quantities (cubic yards)
- Framing lumber (board feet or counts)
- Roofing materials (squares)
- Insulation (R-value, square footage)
- Siding/exterior material quantities
- Drywall (sheets or square footage)
- Flooring quantities by type
- Tile quantities
- Paint estimates

Return JSON:
{
  "materials": [
    {"category": "concrete", "item": "foundation concrete", "quantity": 85, "unit": "cubic yards", "specs": "3500 PSI"},
    {"category": "framing", "item": "2x6 studs", "quantity": 1200, "unit": "each", "specs": "16 OC exterior walls"}
  ],
  "notes": "any relevant notes"
}`,
  })
}

async function extractGeneral(
  content: string,
  filename: string,
  documentId: string,
  projectId: string
): Promise<DocumentExtraction> {
  return runExtractor({
    extractionType: 'general',
    content,
    filename,
    documentId,
    projectId,
    prompt: `Extract any construction-relevant information from this document. Look for:
- Room names and sizes
- Material specifications
- Fixture counts
- Dimensions and measurements
- Notes and annotations
- Any schedules or tables

Return JSON with whatever structured data you can extract:
{
  "type": "description of what this document contains",
  "data": [extracted items],
  "notes": "relevant observations"
}`,
  })
}

// ---------------------------------------------------------------------------
// Trade-Specific Extractors
// ---------------------------------------------------------------------------

export async function extractFoundationTakeoff(
  text: string,
  filename: string,
  documentId: string,
  projectId: string
): Promise<DocumentExtraction> {
  return runExtractor({
    extractionType: 'foundation_takeoff',
    content: text,
    filename,
    documentId,
    projectId,
    prompt: `Extract foundation quantities from this construction document. Look for:
- Slab area (sqft), perimeter (LF)
- Concrete volume (CY), concrete spec (PSI)
- Rebar spec + quantity (LF or tons)
- Post-tension cable count and spec
- Pier/footing locations, count, dimensions
- Grade beam specs (size, quantity)
- Vapor barrier area (sqft)

Return JSON:
{
  "slab": { "area_sqft": null, "perimeter_lf": null, "concrete_cy": null, "concrete_psi": null },
  "rebar": { "spec": null, "quantity_lf": null },
  "post_tension": { "cable_count": null, "spec": null },
  "piers": [{ "location": "", "count": 0, "dimensions": "" }],
  "grade_beams": [{ "size": "", "quantity": 0 }],
  "vapor_barrier_sqft": null,
  "notes": "any relevant notes"
}`,
  })
}

export async function extractFramingTakeoff(
  text: string,
  filename: string,
  documentId: string,
  projectId: string
): Promise<DocumentExtraction> {
  return runExtractor({
    extractionType: 'framing_takeoff',
    content: text,
    filename,
    documentId,
    projectId,
    prompt: `Extract framing quantities from this structural plan. Look for:
- Exterior wall length (LF) and height
- Interior wall length (LF) and height
- Stud spacing (16" or 24" OC)
- Header schedule: each header with size, span, quantity
- Beam schedule: each beam with size, span, quantity
- Rafter/truss spec
- Roof sheathing area (sqft)
- Wall sheathing area (sqft)
- Plate material (2x4, 2x6) and total LF

Return JSON:
{
  "walls": { "exterior_lf": null, "interior_lf": null, "height": null, "stud_spacing": null },
  "headers": [{ "size": "", "span": "", "quantity": 0 }],
  "beams": [{ "size": "", "span": "", "quantity": 0 }],
  "rafters": { "spec": null, "count": null },
  "sheathing": { "roof_sqft": null, "wall_sqft": null },
  "plates": { "material": null, "total_lf": null },
  "notes": "any relevant notes"
}`,
  })
}

export async function extractRoofingTakeoff(
  text: string,
  filename: string,
  documentId: string,
  projectId: string
): Promise<DocumentExtraction> {
  return runExtractor({
    extractionType: 'roofing_takeoff',
    content: text,
    filename,
    documentId,
    projectId,
    prompt: `Extract roofing quantities from this construction document. Look for:
- Roof area (sqft)
- Pitch/slope
- Ridge length (LF), valley length (LF), hip length (LF)
- Eave length (LF)
- Material type (metal, shingle, tile)
- Flashing (LF), drip edge (LF)
- Vent count and type
- Gutter/downspout (LF)

Return JSON:
{
  "roof_sqft": null,
  "pitch": null,
  "ridge_lf": null,
  "valley_lf": null,
  "hip_lf": null,
  "eave_lf": null,
  "material": null,
  "flashing_lf": null,
  "drip_edge_lf": null,
  "vents": [{ "type": "", "count": 0 }],
  "gutter_lf": null,
  "downspout_count": null,
  "notes": "any relevant notes"
}`,
  })
}

export async function extractInsulationTakeoff(
  text: string,
  filename: string,
  documentId: string,
  projectId: string
): Promise<DocumentExtraction> {
  return runExtractor({
    extractionType: 'insulation_takeoff',
    content: text,
    filename,
    documentId,
    projectId,
    prompt: `Extract insulation specifications from this construction document. Look for:
- Wall assembly description
- Exterior wall R-value and material
- Interior wall insulation (if any)
- Ceiling/attic R-value and material
- Floor insulation (if any)
- Rigid insulation spec and area
- Spray foam areas
- Air barrier spec

Return JSON:
{
  "exterior_walls": { "r_value": null, "material": null, "area_sqft": null },
  "ceiling": { "r_value": null, "material": null, "area_sqft": null },
  "rigid": { "spec": null, "area_sqft": null },
  "spray_foam": { "area_sqft": null },
  "air_barrier": { "spec": null, "area_sqft": null },
  "notes": "any relevant notes"
}`,
  })
}

export async function extractSiteWorkTakeoff(
  text: string,
  filename: string,
  documentId: string,
  projectId: string
): Promise<DocumentExtraction> {
  return runExtractor({
    extractionType: 'site_work_takeoff',
    content: text,
    filename,
    documentId,
    projectId,
    prompt: `Extract site work quantities from this civil/grading plan. Look for:
- Cut volume (CY), fill volume (CY)
- Driveway area (sqft) and material
- Utility trenching (LF) by type
- Drainage features: swales (LF), culverts, drains
- Retaining walls (LF x height)
- Erosion control measures

Return JSON:
{
  "earthwork": { "cut_cy": null, "fill_cy": null },
  "driveway": { "area_sqft": null, "material": null },
  "utilities": [{ "type": "", "trench_lf": 0 }],
  "drainage": [{ "type": "", "length_lf": 0 }],
  "retaining_walls": [{ "length_lf": 0, "height_ft": 0 }],
  "erosion_control": [{ "measure": "", "quantity": "" }],
  "notes": "any relevant notes"
}`,
  })
}

export async function extractWindowDoorSchedule(
  text: string,
  filename: string,
  documentId: string,
  projectId: string
): Promise<DocumentExtraction> {
  return runExtractor({
    extractionType: 'window_door_schedule',
    content: text,
    filename,
    documentId,
    projectId,
    prompt: `Extract the combined window and door schedule from this architectural document. For each item extract all available fields.

Windows: mark, width, height, type (fixed/casement/double-hung/slider), quantity, room
Doors: mark, width, height, type (interior/exterior/pocket/barn), material, hardware, quantity, location

Return JSON:
{
  "windows": [{ "mark": "", "width": null, "height": null, "type": "", "quantity": 0, "room": "" }],
  "doors": [{ "mark": "", "width": null, "height": null, "type": "", "material": "", "hardware": "", "quantity": 0, "location": "" }],
  "total_windows": 0,
  "total_doors": 0,
  "notes": "any relevant notes"
}`,
  })
}

// ---------------------------------------------------------------------------
// Trade Extractor Orchestrator
// ---------------------------------------------------------------------------

/**
 * Run the appropriate trade-specific extractors based on plan type.
 * Maps plan types to extractors and runs them in parallel.
 */
export async function runTradeExtractors(
  planType: string,
  text: string,
  filename: string,
  documentId: string,
  projectId: string
): Promise<DocumentExtraction[]> {
  const extractorMap: Record<string, Array<(t: string, f: string, d: string, p: string) => Promise<DocumentExtraction>>> = {
    foundation: [extractFoundationTakeoff],
    structural: [extractFramingTakeoff, extractRoofingTakeoff],
    architectural: [extractWindowDoorSchedule, extractRoomSchedule],
    site: [extractSiteWorkTakeoff],
    detail: [extractInsulationTakeoff],
  }

  const extractors = extractorMap[planType] || [extractGeneral]
  return Promise.all(extractors.map(fn => fn(text, filename, documentId, projectId)))
}

// ---------------------------------------------------------------------------
// Extractor Engine
// ---------------------------------------------------------------------------

async function runExtractor(params: {
  extractionType: ExtractionType
  content: string
  filename: string
  documentId: string
  projectId: string
  prompt: string
}): Promise<DocumentExtraction> {
  const { extractionType, content, filename, documentId, projectId, prompt } = params

  try {
    const response = await getAnthropicClient().messages.create({
      model: MODEL,
      max_tokens: 4096,
      temperature: 0.2,
      system: `You are a construction document analyst extracting structured data from architectural plans, specifications, and construction documents for a 7,526 SF French Country Estate in Liberty Hill, TX. Extract ONLY data that is explicitly present in the document — do NOT fabricate or estimate values. If a section has no relevant data, return an empty result with a note explaining why. Return valid JSON only.`,
      messages: [{
        role: 'user',
        content: `Document: ${filename}\n\n${prompt}\n\nDocument content:\n${content.substring(0, 8000)}`,
      }],
    })

    const text = response.content[0]
    if (text.type === 'text') {
      const extracted = parseAIJsonResponse(text.text) as Record<string, unknown>

      // Estimate confidence based on data richness
      const dataKeys = Object.keys(extracted).filter(k => k !== 'notes')
      const hasData = dataKeys.some(k => {
        const val = extracted[k]
        return Array.isArray(val) ? val.length > 0 : val !== null && val !== undefined
      })
      const confidence = hasData ? 0.85 : 0.1

      return {
        document_id: documentId,
        project_id: projectId,
        extraction_type: extractionType,
        extracted_data: extracted,
        confidence,
        ai_notes: (extracted.notes as string) || '',
        reviewed: false,
      }
    }

    return emptyExtraction(documentId, projectId, extractionType, 'No text response from AI')
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error(`Extraction failed (${extractionType}):`, msg)
    return emptyExtraction(documentId, projectId, extractionType, `Extraction failed: ${msg}`)
  }
}

function emptyExtraction(
  documentId: string,
  projectId: string,
  extractionType: ExtractionType,
  note: string
): DocumentExtraction {
  return {
    document_id: documentId,
    project_id: projectId,
    extraction_type: extractionType,
    extracted_data: {},
    confidence: 0,
    ai_notes: note,
    reviewed: false,
  }
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

async function storeExtraction(extraction: DocumentExtraction): Promise<DocumentExtraction | null> {
  const { data, error } = await supabase
    .from('document_extractions')
    .insert({
      document_id: extraction.document_id,
      project_id: extraction.project_id,
      extraction_type: extraction.extraction_type,
      extracted_data: extraction.extracted_data,
      confidence: extraction.confidence,
      ai_notes: extraction.ai_notes,
      reviewed: false,
    })
    .select()
    .single()

  if (error) {
    console.error('Error storing extraction:', error)
    return null
  }

  return data as DocumentExtraction
}

async function storeRoom(room: PlanRoom): Promise<PlanRoom | null> {
  const { data, error } = await supabase
    .from('plan_rooms')
    .insert({
      project_id: room.project_id,
      name: room.name,
      floor: room.floor,
      square_footage: room.square_footage,
      ceiling_height: room.ceiling_height,
      fixtures: room.fixtures,
      finishes: room.finishes,
      source_document_id: room.source_document_id,
    })
    .select()
    .single()

  if (error) {
    console.error('Error storing room:', error)
    return null
  }

  return data as PlanRoom
}

// ---------------------------------------------------------------------------
// Read Operations
// ---------------------------------------------------------------------------

/** Get all extractions for a project */
export async function getExtractions(
  projectId: string,
  filters?: { documentId?: string; type?: ExtractionType }
): Promise<DocumentExtraction[]> {
  let query = supabase
    .from('document_extractions')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (filters?.documentId) query = query.eq('document_id', filters.documentId)
  if (filters?.type) query = query.eq('extraction_type', filters.type)

  const { data, error } = await query
  if (error) return []
  return (data || []) as DocumentExtraction[]
}

/** Get rooms extracted from plans */
export async function getRoomSchedule(projectId: string): Promise<PlanRoom[]> {
  const { data, error } = await supabase
    .from('plan_rooms')
    .select('*')
    .eq('project_id', projectId)
    .order('floor', { ascending: true })
    .order('name', { ascending: true })

  if (error) return []
  return (data || []) as PlanRoom[]
}

/** Get fixture summary across all extractions */
export async function getFixtureSummary(projectId: string): Promise<{
  categories: Record<string, number>
  items: Array<{ category: string; type: string; count: number; specs?: string }>
}> {
  const extractions = await getExtractions(projectId, { type: 'fixture_count' })
  const items: Array<{ category: string; type: string; count: number; specs?: string }> = []
  const categories: Record<string, number> = {}

  for (const ext of extractions) {
    const fixtures = ext.extracted_data?.fixtures as Array<Record<string, unknown>> | undefined
    if (!fixtures) continue

    for (const f of fixtures) {
      const category = (f.category as string) || 'other'
      const count = Number(f.count) || 0
      items.push({
        category,
        type: (f.type as string) || 'unknown',
        count,
        specs: f.specs as string | undefined,
      })
      categories[category] = (categories[category] || 0) + count
    }
  }

  return { categories, items }
}

/** Mark an extraction as reviewed */
export async function markExtractionReviewed(extractionId: string): Promise<boolean> {
  const { error } = await supabase
    .from('document_extractions')
    .update({ reviewed: true, updated_at: new Date().toISOString() })
    .eq('id', extractionId)

  return !error
}

// ---------------------------------------------------------------------------
// Auto-Generation from Takeoff Data
// ---------------------------------------------------------------------------

/** Create selection records from fixture extraction data */
export async function createSelectionsFromTakeoff(
  projectId: string,
  extractionId: string
): Promise<{ created: number; errors: string[] }> {
  const { data: extraction } = await supabase
    .from('document_extractions')
    .select('*')
    .eq('id', extractionId)
    .single()

  if (!extraction) return { created: 0, errors: ['Extraction not found'] }

  const fixtures = extraction.extracted_data?.fixtures as Array<Record<string, unknown>> | undefined
  if (!fixtures || fixtures.length === 0) return { created: 0, errors: ['No fixtures to convert'] }

  let created = 0
  const errors: string[] = []

  for (const fixture of fixtures) {
    const rooms = (fixture.rooms as string[]) || ['TBD']
    for (const room of rooms) {
      const selection: Omit<Selection, 'id' | 'created_at' | 'updated_at'> = {
        project_id: projectId,
        room,
        category: (fixture.category as string) || 'general',
        subcategory: (fixture.type as string) || undefined,
        product_name: `${fixture.type || 'Fixture'} (from plan takeoff)`,
        quantity: Number(fixture.count) || 1,
        status: 'considering',
        notes: fixture.specs ? `Spec: ${fixture.specs}` : 'Auto-generated from plan takeoff',
      }

      const { error } = await supabase
        .from('selections')
        .insert(selection)

      if (error) {
        errors.push(`Failed to create selection for ${fixture.type} in ${room}: ${error.message}`)
      } else {
        created++
      }
    }
  }

  return { created, errors }
}

/** Create budget items from material takeoff data */
export async function createBudgetItemsFromTakeoff(
  projectId: string,
  extractionId: string
): Promise<{ created: number; errors: string[] }> {
  const { data: extraction } = await supabase
    .from('document_extractions')
    .select('*')
    .eq('id', extractionId)
    .single()

  if (!extraction) return { created: 0, errors: ['Extraction not found'] }

  const materials = extraction.extracted_data?.materials as Array<Record<string, unknown>> | undefined
  if (!materials || materials.length === 0) return { created: 0, errors: ['No materials to convert'] }

  let created = 0
  const errors: string[] = []

  for (const material of materials) {
    const budgetItem = {
      project_id: projectId,
      category: (material.category as string) || 'Materials',
      description: `${material.item || 'Material'} — ${material.quantity || '?'} ${material.unit || 'units'}`,
      estimated_cost: 0, // Will need pricing research
      status: 'estimated',
      notes: material.specs
        ? `From plan takeoff. Spec: ${material.specs}`
        : 'Auto-generated from plan takeoff — needs pricing',
      source: 'plan_takeoff',
    }

    const { error } = await supabase
      .from('budget_items')
      .insert(budgetItem)

    if (error) {
      errors.push(`Failed to create budget item for ${material.item}: ${error.message}`)
    } else {
      created++
    }
  }

  return { created, errors }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countItems(items: unknown): number {
  if (!Array.isArray(items)) return 0
  return items.reduce((sum, item) => sum + (Number(item.count) || 0), 0)
}
