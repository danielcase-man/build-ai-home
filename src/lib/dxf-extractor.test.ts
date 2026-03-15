import { describe, it, expect } from 'vitest'
import { extractFromDXF } from './dxf-extractor'

// Minimal DXF file content for testing
function makeDxf(entities: string): string {
  return `0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${entities}0\nENDSEC\n0\nEOF`
}

function makeLine(layer: string, x1: number, y1: number, x2: number, y2: number): string {
  return `0\nLINE\n8\n${layer}\n10\n${x1}\n20\n${y1}\n11\n${x2}\n21\n${y2}\n`
}

function makeText(layer: string, x: number, y: number, text: string): string {
  return `0\nTEXT\n8\n${layer}\n10\n${x}\n20\n${y}\n1\n${text}\n`
}

function makeCircle(layer: string, cx: number, cy: number, r: number): string {
  return `0\nCIRCLE\n8\n${layer}\n10\n${cx}\n20\n${cy}\n40\n${r}\n`
}

function makeInsert(layer: string, blockName: string, x: number, y: number): string {
  return `0\nINSERT\n8\n${layer}\n2\n${blockName}\n10\n${x}\n20\n${y}\n`
}

describe('DXF Extractor', () => {
  describe('extractFromDXF', () => {
    it('parses a minimal DXF with lines', () => {
      const dxf = makeDxf(
        makeLine('Walls', 0, 0, 100, 0) +
        makeLine('Walls', 100, 0, 100, 80) +
        makeLine('Walls', 100, 80, 0, 80) +
        makeLine('Walls', 0, 80, 0, 0)
      )

      const result = extractFromDXF(dxf)

      expect(result.raw_entity_count).toBe(4)
      expect(result.layers).toHaveLength(1)
      expect(result.layers[0].name).toBe('Walls')
      expect(result.layers[0].category).toBe('walls')
      expect(result.entity_summary.LINE).toBe(4)
    })

    it('classifies layers correctly', () => {
      const dxf = makeDxf(
        makeLine('A-WALL', 0, 0, 10, 0) +
        makeLine('E-POWER', 0, 0, 10, 0) +
        makeLine('PLMB-FIXT', 0, 0, 10, 0) +
        makeLine('A-DOOR', 0, 0, 10, 0) +
        makeLine('A-GLAZ', 0, 0, 10, 0) +
        makeLine('DIM', 0, 0, 10, 0) +
        makeLine('HVAC', 0, 0, 10, 0) +
        makeLine('A-ROOF', 0, 0, 10, 0)
      )

      const result = extractFromDXF(dxf)

      const layerMap = new Map(result.layers.map(l => [l.name, l.category]))
      expect(layerMap.get('A-WALL')).toBe('walls')
      expect(layerMap.get('E-POWER')).toBe('electrical')
      expect(layerMap.get('PLMB-FIXT')).toBe('plumbing')
      expect(layerMap.get('A-DOOR')).toBe('doors')
      expect(layerMap.get('A-GLAZ')).toBe('windows')
      expect(layerMap.get('DIM')).toBe('dimensions')
      expect(layerMap.get('HVAC')).toBe('hvac')
      expect(layerMap.get('A-ROOF')).toBe('roof')
    })

    it('extracts text entities', () => {
      const dxf = makeDxf(
        makeText('ROOM-NAMES', 50, 40, 'Kitchen') +
        makeText('ROOM-NAMES', 150, 40, 'Living Room') +
        makeText('NOTES', 0, 0, 'See detail A')
      )

      const result = extractFromDXF(dxf)
      expect(result.texts).toHaveLength(3)
      expect(result.texts[0].text).toBe('Kitchen')
      expect(result.texts[1].text).toBe('Living Room')
    })

    it('extracts room names from text entities on room layers', () => {
      const dxf = makeDxf(
        makeText('ROOM', 50, 40, 'Kitchen') +
        makeText('ROOM', 150, 40, 'Master Bedroom') +
        makeText('ROOM', 250, 40, 'Dining Room')
      )

      const result = extractFromDXF(dxf)
      expect(result.rooms.length).toBeGreaterThanOrEqual(3)
      const names = result.rooms.map(r => r.name)
      expect(names).toContain('Kitchen')
      expect(names).toContain('Master Bedroom')
      expect(names).toContain('Dining Room')
    })

    it('extracts fixtures from plumbing/electrical layers', () => {
      const dxf = makeDxf(
        makeCircle('PLMB-FIXT', 50, 40, 5) +
        makeCircle('PLMB-FIXT', 150, 40, 5) +
        makeInsert('E-POWER', 'OUTLET', 50, 30) +
        makeInsert('E-POWER', 'SWITCH', 60, 30)
      )

      const result = extractFromDXF(dxf)
      expect(result.fixtures.length).toBeGreaterThanOrEqual(2)
    })

    it('counts window and door block inserts', () => {
      const dxf = makeDxf(
        makeInsert('A-DOOR', 'DOOR-36', 50, 0) +
        makeInsert('A-DOOR', 'DOOR-36', 150, 0) +
        makeInsert('A-DOOR', 'DOOR-30', 250, 0) +
        makeInsert('A-GLAZ', 'WINDOW-3648', 50, 60) +
        makeInsert('A-GLAZ', 'WINDOW-3648', 150, 60)
      )

      const result = extractFromDXF(dxf)
      expect(result.doors.length).toBeGreaterThanOrEqual(1)
      expect(result.windows.length).toBeGreaterThanOrEqual(1)

      // Count totals
      const totalDoors = result.doors.reduce((s, d) => s + d.count, 0)
      const totalWindows = result.windows.reduce((s, w) => s + w.count, 0)
      expect(totalDoors).toBe(3)
      expect(totalWindows).toBe(2)
    })

    it('handles empty DXF gracefully', () => {
      const dxf = makeDxf('')

      const result = extractFromDXF(dxf)
      expect(result.raw_entity_count).toBe(0)
      expect(result.layers).toHaveLength(0)
      expect(result.rooms).toHaveLength(0)
    })

    it('throws on invalid DXF content', () => {
      expect(() => extractFromDXF('not a dxf file')).toThrow('DXF parse failed')
    })

    it('groups same-name block inserts into counts', () => {
      const dxf = makeDxf(
        makeInsert('A-DOOR', 'DOOR-36x80', 0, 0) +
        makeInsert('A-DOOR', 'DOOR-36x80', 50, 0) +
        makeInsert('A-DOOR', 'DOOR-36x80', 100, 0) +
        makeInsert('A-DOOR', 'DOOR-36x80', 150, 0) +
        makeInsert('A-DOOR', 'DOOR-30x80', 200, 0)
      )

      const result = extractFromDXF(dxf)
      // Should have 2 door types, not 5
      expect(result.doors).toHaveLength(2)
      const door36 = result.doors.find(d => d.block_name === 'DOOR-36x80')
      expect(door36?.count).toBe(4)
    })
  })
})
