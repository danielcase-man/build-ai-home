/**
 * DXF Extractor — parses AutoCAD DXF files into structured construction data.
 *
 * Extracts rooms, dimensions, fixtures, windows, doors, and other entities
 * from DXF layers. Provides precise data that can be reconciled with
 * AI vision extractions from PDF plans.
 */

import DxfParser from 'dxf-parser'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DxfEntity {
  type: string
  layer?: string
  handle?: number | string
  vertices?: Array<{ x: number; y: number; z?: number }>
  position?: { x: number; y: number; z?: number }
  startPoint?: { x: number; y: number; z?: number }
  endPoint?: { x: number; y: number; z?: number }
  center?: { x: number; y: number; z?: number }
  radius?: number
  width?: number
  height?: number
  text?: string
  textHeight?: number
  name?: string
  rotation?: number
  xScale?: number
  yScale?: number
  entities?: DxfEntity[]
  shape?: boolean
}

interface DxfData {
  header?: Record<string, unknown>
  tables?: Record<string, unknown>
  blocks?: Record<string, { entities?: DxfEntity[] }>
  entities?: DxfEntity[]
}

export interface DxfRoom {
  name: string
  layer: string
  vertices: Array<{ x: number; y: number }>
  area_sqft: number | null
  perimeter_ft: number | null
  dimensions: string | null
}

export interface DxfFixture {
  type: string
  layer: string
  position: { x: number; y: number }
  block_name?: string
  nearest_room?: string
}

export interface DxfDimension {
  text: string
  layer: string
  length_inches: number | null
  start: { x: number; y: number }
  end: { x: number; y: number }
}

export interface DxfExtractionResult {
  layers: Array<{ name: string; entity_count: number; category: string }>
  rooms: DxfRoom[]
  fixtures: DxfFixture[]
  dimensions: DxfDimension[]
  windows: Array<{ layer: string; block_name: string; position: { x: number; y: number }; count: number }>
  doors: Array<{ layer: string; block_name: string; position: { x: number; y: number }; count: number }>
  texts: Array<{ text: string; layer: string; position: { x: number; y: number } }>
  entity_summary: Record<string, number>
  raw_entity_count: number
}

// ---------------------------------------------------------------------------
// Layer Classification
// ---------------------------------------------------------------------------

/** Map common architectural layer naming conventions to categories */
function classifyLayer(layerName: string): string {
  const name = layerName.toUpperCase()

  // Walls
  if (name.includes('WALL') || name.includes('A-WALL') || name === 'WALLS') return 'walls'

  // Doors
  if (name.includes('DOOR') || name.includes('A-DOOR')) return 'doors'

  // Windows
  if (name.includes('WIND') || name.includes('WINDOW') || name.includes('A-GLAZ')) return 'windows'

  // Electrical
  if (name.includes('ELEC') || name.includes('E-') || name.includes('LIGHT') || name.includes('POWER') || name.includes('OUTLET') || name.includes('SWITCH')) return 'electrical'

  // Plumbing
  if (name.includes('PLMB') || name.includes('PLUMB') || name.includes('P-') || name.includes('FIXT')) return 'plumbing'

  // HVAC
  if (name.includes('HVAC') || name.includes('MECH') || name.includes('M-') || name.includes('DUCT')) return 'hvac'

  // Dimensions
  if (name.includes('DIM') || name.includes('ANNO') || name.includes('A-ANNO')) return 'dimensions'

  // Text/Notes
  if (name.includes('TEXT') || name.includes('NOTE') || name.includes('LABEL') || name.includes('A-NOTE')) return 'text'

  // Rooms/Areas
  if (name.includes('ROOM') || name.includes('AREA') || name.includes('A-AREA') || name.includes('SPACE')) return 'rooms'

  // Structure
  if (name.includes('STRU') || name.includes('S-') || name.includes('FOUND') || name.includes('BEAM') || name.includes('COLUMN')) return 'structure'

  // Roof
  if (name.includes('ROOF') || name.includes('A-ROOF')) return 'roof'

  // Site
  if (name.includes('SITE') || name.includes('C-') || name.includes('TOPO') || name.includes('GRADE')) return 'site'

  // Furniture/casework
  if (name.includes('FURN') || name.includes('CASE') || name.includes('CABINET') || name.includes('A-FURN')) return 'furniture'

  // Appliances
  if (name.includes('APPL') || name.includes('EQUIP')) return 'appliances'

  return 'other'
}

// ---------------------------------------------------------------------------
// Core Extraction
// ---------------------------------------------------------------------------

/** Parse a DXF file buffer and extract structured construction data */
export function extractFromDXF(dxfContent: string): DxfExtractionResult {
  const parser = new DxfParser()
  let dxf: DxfData

  try {
    dxf = parser.parseSync(dxfContent) as unknown as DxfData
  } catch (error) {
    throw new Error(`DXF parse failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  if (!dxf || !dxf.entities) {
    return emptyResult()
  }

  const allEntities = collectEntities(dxf)

  // Classify layers
  const layerCounts = new Map<string, { count: number; category: string }>()
  for (const entity of allEntities) {
    const layer = entity.layer || '0'
    const existing = layerCounts.get(layer)
    if (existing) {
      existing.count++
    } else {
      layerCounts.set(layer, { count: 1, category: classifyLayer(layer) })
    }
  }

  const layers = Array.from(layerCounts.entries()).map(([name, info]) => ({
    name,
    entity_count: info.count,
    category: info.category,
  }))

  // Extract by category
  const rooms = extractRooms(allEntities, layerCounts)
  const fixtures = extractFixtures(allEntities, layerCounts)
  const dimensions = extractDimensions(allEntities, layerCounts)
  const windows = extractBlocksByCategory(allEntities, layerCounts, 'windows')
  const doors = extractBlocksByCategory(allEntities, layerCounts, 'doors')
  const texts = extractTexts(allEntities)

  // Entity type summary
  const entitySummary: Record<string, number> = {}
  for (const entity of allEntities) {
    entitySummary[entity.type] = (entitySummary[entity.type] || 0) + 1
  }

  return {
    layers,
    rooms,
    fixtures,
    dimensions,
    windows,
    doors,
    texts,
    entity_summary: entitySummary,
    raw_entity_count: allEntities.length,
  }
}

/** Collect all entities including those inside blocks */
function collectEntities(dxf: DxfData): DxfEntity[] {
  const entities: DxfEntity[] = [...(dxf.entities || [])]

  // Also collect entities from INSERT references to blocks
  if (dxf.blocks) {
    for (const entity of (dxf.entities || [])) {
      if (entity.type === 'INSERT' && entity.name && dxf.blocks[entity.name]) {
        const block = dxf.blocks[entity.name]
        if (block.entities) {
          for (const blockEntity of block.entities) {
            entities.push({
              ...blockEntity,
              layer: blockEntity.layer || entity.layer,
            })
          }
        }
      }
    }
  }

  return entities
}

// ---------------------------------------------------------------------------
// Entity Extractors
// ---------------------------------------------------------------------------

function extractRooms(
  entities: DxfEntity[],
  layerCounts: Map<string, { count: number; category: string }>
): DxfRoom[] {
  const rooms: DxfRoom[] = []
  const roomLayers = new Set<string>()

  for (const [name, info] of layerCounts) {
    if (info.category === 'rooms') roomLayers.add(name)
  }

  // Look for closed polylines on room layers (these often define room boundaries)
  for (const entity of entities) {
    if (!entity.layer) continue
    if (!roomLayers.has(entity.layer) && classifyLayer(entity.layer) !== 'rooms') continue

    if ((entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') && entity.vertices && entity.shape) {
      const verts = entity.vertices.map(v => ({ x: v.x, y: v.y }))
      const area = calculatePolygonArea(verts)
      const perimeter = calculatePerimeter(verts)

      rooms.push({
        name: `Room (${entity.layer})`,
        layer: entity.layer,
        vertices: verts,
        area_sqft: area > 0 ? Math.round(area * 100) / 100 : null,
        perimeter_ft: perimeter > 0 ? Math.round(perimeter * 100) / 100 : null,
        dimensions: area > 0 ? `~${Math.round(area)} sq ft` : null,
      })
    }
  }

  // Also look for TEXT/MTEXT entities on room layers that name rooms
  for (const entity of entities) {
    if (!entity.layer) continue
    if (entity.type !== 'TEXT' && entity.type !== 'MTEXT') continue

    const text = entity.text?.trim() || ''
    if (!text) continue

    // Common room name patterns
    const roomPatterns = /^(kitchen|bedroom|bath|living|dining|family|laundry|closet|garage|study|office|entry|foyer|hall|pantry|master|primary|utility|mudroom|media|game|bonus|porch|patio|covered)/i
    if (roomPatterns.test(text)) {
      // Try to find the nearest room boundary
      const nearestRoom = rooms.find(r => {
        if (!entity.position) return false
        return isPointNearPolygon(entity.position, r.vertices, 50) // within 50 units
      })

      if (nearestRoom) {
        nearestRoom.name = text
      } else {
        rooms.push({
          name: text,
          layer: entity.layer,
          vertices: entity.position ? [entity.position] : [],
          area_sqft: null,
          perimeter_ft: null,
          dimensions: null,
        })
      }
    }
  }

  return rooms
}

function extractFixtures(
  entities: DxfEntity[],
  layerCounts: Map<string, { count: number; category: string }>
): DxfFixture[] {
  const fixtures: DxfFixture[] = []
  const fixtureLayers = new Set<string>()

  for (const [name, info] of layerCounts) {
    if (['plumbing', 'electrical', 'appliances'].includes(info.category)) {
      fixtureLayers.add(name)
    }
  }

  for (const entity of entities) {
    if (!entity.layer || !fixtureLayers.has(entity.layer)) continue

    // INSERT entities represent block references (fixtures are usually blocks)
    if (entity.type === 'INSERT' && entity.position) {
      fixtures.push({
        type: classifyFixtureBlock(entity.name || entity.layer),
        layer: entity.layer,
        position: { x: entity.position.x, y: entity.position.y },
        block_name: entity.name,
      })
    }

    // CIRCLE entities on plumbing layers often represent fixtures
    if (entity.type === 'CIRCLE' && entity.center) {
      fixtures.push({
        type: classifyLayer(entity.layer),
        layer: entity.layer,
        position: { x: entity.center.x, y: entity.center.y },
      })
    }
  }

  return fixtures
}

function extractDimensions(
  entities: DxfEntity[],
  layerCounts: Map<string, { count: number; category: string }>
): DxfDimension[] {
  const dimensions: DxfDimension[] = []

  for (const entity of entities) {
    if (entity.type !== 'DIMENSION') continue

    const start = entity.startPoint || entity.vertices?.[0] || { x: 0, y: 0 }
    const end = entity.endPoint || entity.vertices?.[1] || { x: 0, y: 0 }
    const length = Math.sqrt(
      Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
    )

    dimensions.push({
      text: entity.text || `${Math.round(length * 12)}"`,
      layer: entity.layer || '0',
      length_inches: Math.round(length * 12 * 100) / 100,
      start: { x: start.x, y: start.y },
      end: { x: end.x, y: end.y },
    })
  }

  return dimensions
}

function extractBlocksByCategory(
  entities: DxfEntity[],
  layerCounts: Map<string, { count: number; category: string }>,
  category: 'windows' | 'doors'
): Array<{ layer: string; block_name: string; position: { x: number; y: number }; count: number }> {
  const blockCounts = new Map<string, { layer: string; position: { x: number; y: number }; count: number }>()

  for (const entity of entities) {
    if (entity.type !== 'INSERT' || !entity.position || !entity.layer) continue

    const layerInfo = layerCounts.get(entity.layer)
    if (!layerInfo || layerInfo.category !== category) {
      // Also check by block name
      const blockName = (entity.name || '').toUpperCase()
      const isTarget = category === 'windows'
        ? (blockName.includes('WIN') || blockName.includes('GLAZ'))
        : (blockName.includes('DOOR') || blockName.includes('DR'))
      if (!isTarget) continue
    }

    const key = entity.name || entity.layer
    const existing = blockCounts.get(key)
    if (existing) {
      existing.count++
    } else {
      blockCounts.set(key, {
        layer: entity.layer,
        position: { x: entity.position.x, y: entity.position.y },
        count: 1,
      })
    }
  }

  return Array.from(blockCounts.entries()).map(([name, info]) => ({
    layer: info.layer,
    block_name: name,
    position: info.position,
    count: info.count,
  }))
}

function extractTexts(entities: DxfEntity[]): Array<{ text: string; layer: string; position: { x: number; y: number } }> {
  const texts: Array<{ text: string; layer: string; position: { x: number; y: number } }> = []

  for (const entity of entities) {
    if (entity.type !== 'TEXT' && entity.type !== 'MTEXT') continue
    if (!entity.text?.trim()) continue

    texts.push({
      text: entity.text.trim(),
      layer: entity.layer || '0',
      position: entity.position
        ? { x: entity.position.x, y: entity.position.y }
        : { x: 0, y: 0 },
    })
  }

  return texts
}

// ---------------------------------------------------------------------------
// Geometry Helpers
// ---------------------------------------------------------------------------

function calculatePolygonArea(vertices: Array<{ x: number; y: number }>): number {
  if (vertices.length < 3) return 0
  let area = 0
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length
    area += vertices[i].x * vertices[j].y
    area -= vertices[j].x * vertices[i].y
  }
  // Convert from drawing units (typically inches) to square feet
  return Math.abs(area / 2) / 144
}

function calculatePerimeter(vertices: Array<{ x: number; y: number }>): number {
  if (vertices.length < 2) return 0
  let perimeter = 0
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length
    perimeter += Math.sqrt(
      Math.pow(vertices[j].x - vertices[i].x, 2) +
      Math.pow(vertices[j].y - vertices[i].y, 2)
    )
  }
  // Convert from drawing units to feet
  return perimeter / 12
}

function isPointNearPolygon(
  point: { x: number; y: number },
  polygon: Array<{ x: number; y: number }>,
  threshold: number
): boolean {
  if (polygon.length === 0) return false
  const centroid = {
    x: polygon.reduce((s, v) => s + v.x, 0) / polygon.length,
    y: polygon.reduce((s, v) => s + v.y, 0) / polygon.length,
  }
  const dist = Math.sqrt(
    Math.pow(point.x - centroid.x, 2) + Math.pow(point.y - centroid.y, 2)
  )
  return dist < threshold
}

function classifyFixtureBlock(name: string): string {
  const n = name.toUpperCase()
  if (n.includes('SINK') || n.includes('LAV')) return 'sink'
  if (n.includes('TOILET') || n.includes('WC') || n.includes('WATER CLOSET')) return 'toilet'
  if (n.includes('TUB') || n.includes('BATH')) return 'bathtub'
  if (n.includes('SHOWER') || n.includes('SHWR')) return 'shower'
  if (n.includes('OUTLET') || n.includes('RECEP')) return 'outlet'
  if (n.includes('SWITCH') || n.includes('SW')) return 'switch'
  if (n.includes('LIGHT') || n.includes('LT') || n.includes('CAN')) return 'light'
  if (n.includes('FAN')) return 'fan'
  if (n.includes('SMOKE') || n.includes('DETECTOR')) return 'smoke_detector'
  if (n.includes('DISH')) return 'dishwasher'
  if (n.includes('RANGE') || n.includes('OVEN') || n.includes('COOK')) return 'range'
  if (n.includes('FRIDGE') || n.includes('REFRIG')) return 'refrigerator'
  if (n.includes('WASHER') || n.includes('DRYER')) return 'washer_dryer'
  return name.toLowerCase()
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyResult(): DxfExtractionResult {
  return {
    layers: [],
    rooms: [],
    fixtures: [],
    dimensions: [],
    windows: [],
    doors: [],
    texts: [],
    entity_summary: {},
    raw_entity_count: 0,
  }
}
