/**
 * Import Cabinet Specifications from Bid Package
 *
 * Sources from: Cabinet_Bid_Package_708_Purple_Salvia.pdf (March 3, 2026)
 * This is the CORRECTED spec — ALL cabinets painted white on paint-grade maple.
 * The earlier ProSource bid (ES618204) was wrong — it used QSO/Oyster split.
 *
 * Imports each cabinet specification as a `selections` record with
 * status='considering'. These represent the project's full cabinet needs,
 * vendor-neutral, usable for budget planning and requesting competing bids.
 *
 * Usage: node scripts/import-cabinet-specs.js [--dry-run]
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')

// Common spec applied to ALL cabinets
const COMMON = {
  category: 'cabinetry',
  finish: 'Painted White',
  color: 'White (shade TBD per sample)',
  material: 'Paint-grade Maple, Plywood Box',
  status: 'considering',
  price_source: 'Bid Package 2026-03-03',
}

// Rooms where full-overlay alternate pricing is also requested
const FULL_OVERLAY_ALTERNATE_ROOMS = [
  'Utility / Laundry',
  'Class Room',
  'Built-Ins',
  'Bath 2',
  'Bath 3',
  'Bath 4',
]

function buildSpecs() {
  const specs = []

  function add(room, description, qty, width, height, depth, type, notes) {
    const overlayNote = FULL_OVERLAY_ALTERNATE_ROOMS.includes(room)
      ? 'Full overlay alternate also requested'
      : null
    const allNotes = [notes, overlayNote, `Dimensions: ${width}W x ${height}H x ${depth}D`]
      .filter(Boolean)
      .join(' | ')

    specs.push({
      ...COMMON,
      room,
      product_name: description,
      quantity: qty,
      subcategory: type.toLowerCase(),
      location_detail: `${width} x ${height} x ${depth} (W x H x D)`.replace(/ x N\/A/g, ''),
      notes: allNotes,
    })
  }

  // ═══════════════════════════════════════════════════
  // 1. KITCHEN — Painted white throughout. Inset.
  // ═══════════════════════════════════════════════════
  add('Kitchen', 'Roll Tray Base',                 1, '31"',      '34.5"', '24"',  'Base',  'Finished Left')
  add('Kitchen', '3-Drawer Base',                  2, '15"',      '34.5"', '24"',  'Base',  null)
  add('Kitchen', 'Pantry Pull-Out w/Utensil Org',  1, '12"',      '34.5"', '24"',  'Base',  'Fin. Both Sides')
  add('Kitchen', 'Pantry Pull-Out',                1, '12"',      '34.5"', '24"',  'Base',  'Fin. Both Sides')
  add('Kitchen', 'Roll Tray Base',                 2, '30"',      '34.5"', '24"',  'Base',  '1x Fin. Right')
  add('Kitchen', 'Roll Tray Base',                 1, '32.25"',   '34.5"', '24"',  'Base',  null)
  add('Kitchen', 'Full-Height Door Base (Island)', 5, '37.4"',    '34.5"', '18"',  'Base',  'Reduced depth island cabs')
  add('Kitchen', 'Roll Tray Base',                 2, '38"',      '34.5"', '24"',  'Base',  null)
  add('Kitchen', 'Sink Base w/Tilt-Out Tray',      1, '36"',      '34.5"', '24"',  'Base',  null)
  add('Kitchen', 'Microwave Base w/Drawer',        1, '30"',      '34.5"', '24"',  'Base',  'Cutout dims TBD')
  add('Kitchen', 'Dbl Wastebasket Base',           1, '21"',      '34.5"', '24"',  'Base',  null)
  add('Kitchen', 'Base Super Susan Corner',        1, '36"',      '34.5"', '24"',  'Base',  'Left-hand')
  add('Kitchen', 'Double Oven Cabinet',            2, '31.5"',    '102"',  '24"',  'Tall',  '1x w/4 tray dividers')
  add('Kitchen', 'Tall Panel Filler',              4, '1.5"',     '117"',  '30"',  'Panel', '2L + 2R, oversize ht')
  add('Kitchen', 'Appliance Panel (Fridge)',       2, '36"',      '84"',   'N/A',  'Panel', 'Single inset door')
  add('Kitchen', 'Appliance Panel (DW)',           2, '24"',      '30"',   'N/A',  'Panel', 'Single inset door')
  add('Kitchen', 'Wall Cabinet',                   2, '31.5"',    '15"',   '24"',  'Wall',  'Oversized depth')
  add('Kitchen', 'Wall Cabinet',                   2, '36"',      '33"',   '24"',  'Wall',  'Oversized depth')
  add('Kitchen', 'Wall Cabinet 48H',               2, '24"',      '48"',   '13"',  'Wall',  null)
  add('Kitchen', 'Wall Cabinet 48H',               2, '31-32"',   '48"',   '13"',  'Wall',  'Reduced widths')
  add('Kitchen', 'Wall Cabinet 15H',               4, '24-32"',   '15"',   '13"',  'Wall',  'Various widths')
  add('Kitchen', '3/4" Ply Panel 25"x117"',        3, '25"',      '117"',  '3/4"', 'Panel', 'Painted finish')
  add('Kitchen', '3/4" Ply Panel 48"x34.5"',       2, '48"',      '34.5"', '3/4"', 'Panel', 'Painted finish')
  add('Kitchen', '3/4" Ply Panel 14"x63"',         3, '14"',      '63"',   '3/4"', 'Panel', 'Painted finish')

  // ═══════════════════════════════════════════════════
  // 2. PANTRY — Painted white throughout. Inset.
  // ═══════════════════════════════════════════════════
  add('Pantry', 'Wall Cabinet 33H',               2, '36"',      '33"',   '24"',  'Wall',  'Oversized depth')
  add('Pantry', 'Sink Base',                       1, '36"',      '34.5"', '24"',  'Base',  null)
  add('Pantry', 'Roll Tray Base 2-Door',           1, '24"',      '34.5"', '24"',  'Base',  null)
  add('Pantry', 'Roll Tray Base FHD',              1, '36"',      '34.5"', '24"',  'Base',  'Full height door')
  add('Pantry', 'Roll Tray Base',                  1, '39"',      '34.5"', '24"',  'Base',  'Finished Right')
  add('Pantry', 'Roll Tray Base',                  2, '32"',      '34.5"', '24"',  'Base',  '1x Finished Left')
  add('Pantry', 'Base Super Susan Corner',         1, '36"',      '34.5"', '24"',  'Base',  'Left-hand')
  add('Pantry', 'Appliance Panel',                 2, '36"',      '84"',   'N/A',  'Panel', 'Single door')
  add('Pantry', 'Appliance Panel',                 1, '24"',      '30"',   'N/A',  'Panel', 'Single door')
  add('Pantry', 'Tall Panel Filler',               2, '1.5"',     '117"',  '30"',  'Panel', '1L + 1R')
  add('Pantry', 'Base Panel Filler',               2, '1.5"',     '34.5"', '24"',  'Panel', '1L + 1R')
  add('Pantry', 'Wall Cabinet 48H',                8, '12-36"',   '48"',   '13"',  'Wall',  'Various widths')
  add('Pantry', 'Wall Cabinet 15H',                8, '12-36"',   '15"',   '13"',  'Wall',  'Various widths')
  add('Pantry', 'Wall Appl Garage w/Pocket Door',  1, '36"',      '66"',   '15"',  'Wall',  'Flipper/pocket door')
  add('Pantry', 'Wall Cabinet 30H',                1, '36"',      '30"',   '13"',  'Wall',  null)
  add('Pantry', '3/4" Ply Panel 14"x63"',          3, '14"',      '63"',   '3/4"', 'Panel', 'Painted finish')
  add('Pantry', '3/4" Ply Panel 17"x81"',          2, '17"',      '81"',   '3/4"', 'Panel', 'Painted finish')

  // ═══════════════════════════════════════════════════
  // 3. UTILITY / LAUNDRY — Full overlay alternate requested
  // ═══════════════════════════════════════════════════
  add('Utility / Laundry', 'Roll Tray Base',           2, '27"',    '34.5"', '24"',  'Base',  null)
  add('Utility / Laundry', 'Base Super Susan Corner',  2, '36"',    '34.5"', '24"',  'Base',  '1L + 1R')
  add('Utility / Laundry', 'Roll Tray Base',           1, '33"',    '34.5"', '24"',  'Base',  'Fin. Right')
  add('Utility / Laundry', 'Roll Tray Base',           2, '18"',    '34.5"', '24"',  'Base',  '1L + 1R')
  add('Utility / Laundry', 'Sink Base',                1, '39"',    '34.5"', '24"',  'Base',  null)
  add('Utility / Laundry', 'Wall Cabinet 48H',         8, '18-39"', '48"',   '13"',  'Wall',  'Various widths')
  add('Utility / Laundry', 'Wall Cabinet 30H',         1, '37.5"',  '30"',   '13"',  'Wall',  null)
  add('Utility / Laundry', 'Wall Cabinet 15H',         7, '18-39"', '15"',   '13"',  'Wall',  'Various widths')
  add('Utility / Laundry', '3/4" Ply Panel 14"x63"',   2, '14"',    '63"',   '3/4"', 'Panel', 'Painted finish')

  // ═══════════════════════════════════════════════════
  // 4. DINING ROOM — Base cabs only (buffet/credenza)
  // ═══════════════════════════════════════════════════
  add('Dining Room', 'Roll Tray Base', 3, '29"', '34.5"', '24"', 'Base', 'Reduced from 30"')

  // ═══════════════════════════════════════════════════
  // 5. CLASS ROOM — Full overlay alternate requested
  // ═══════════════════════════════════════════════════
  add('Class Room', 'Roll Tray Base', 2, '45"', '34.5"', '24"', 'Base', '1x Fin. Right')
  add('Class Room', 'Sink Base',      1, '36"', '34.5"', '24"', 'Base', null)

  // ═══════════════════════════════════════════════════
  // 6. PRIMARY BATHROOM — Two vanity runs + two linen towers
  // ═══════════════════════════════════════════════════
  add('Primary Bath', 'Vanity 3-Drawer',       2, '27"', '34.5"', '21"', 'Vanity', '1x Finished Right')
  add('Primary Bath', 'Vanity Sink Cabinet',    1, '27"', '34.5"', '21"', 'Vanity', null)
  add('Primary Bath', 'Vanity 3-Drawer',        2, '18"', '34.5"', '21"', 'Vanity', '1x Finished Left')
  add('Primary Bath', 'Vanity Sink Cabinet',    1, '24"', '34.5"', '21"', 'Vanity', null)
  add('Primary Bath', 'Tall Utility 3-Drawer',  1, '33"', '93"',   '24"', 'Tall',   'Linen tower, Fin. Right')
  add('Primary Bath', 'Tall Utility 3-Drawer',  1, '21"', '93"',   '24"', 'Tall',   'Linen tower, Fin. Left')

  // ═══════════════════════════════════════════════════
  // 7. BEDROOM BUILT-INS — Full overlay alternate requested
  // ═══════════════════════════════════════════════════
  add('Built-Ins', 'Wall Cabinet (deepened)',      3, '42"', '39"',   '18"', 'Wall', 'Depth from 13" to 18"')
  add('Built-Ins', '3-Drawer Base (equal fronts)', 3, '42"', '40.5"', '24"', 'Base', 'Equal-size drawer fronts')

  // ═══════════════════════════════════════════════════
  // 8. BATH 2 — Full overlay alternate requested
  // ═══════════════════════════════════════════════════
  add('Bath 2', 'Vanity 3-Drawer',      1, '30"',    '34.5"', '21"', 'Vanity', null)
  add('Bath 2', 'Vanity Sink Cabinet',   1, '30"',    '34.5"', '21"', 'Vanity', 'Finished Right')
  add('Bath 2', 'Tall Utility Cabinet',  1, '35.25"', '96"',   '24"', 'Tall',   'Linen, Fin. Right')

  // ═══════════════════════════════════════════════════
  // 9. BATH 3 — Full overlay alternate requested
  // ═══════════════════════════════════════════════════
  add('Bath 3', 'Vanity Sink w/Drawers', 1, '41"', '34.5"', '21"', 'Vanity', 'Right-hand drawers')

  // ═══════════════════════════════════════════════════
  // 10. BATH 4 — Full overlay alternate requested
  // ═══════════════════════════════════════════════════
  add('Bath 4', 'Vanity Sink w/Drawers', 1, '41"', '34.5"', '21"', 'Vanity', 'Left-hand drawers')

  // ═══════════════════════════════════════════════════
  // 11. POWDER ROOM
  // ═══════════════════════════════════════════════════
  add('Powder', 'Vanity Sink Cabinet', 1, '36"', '34.5"', '21"', 'Vanity', null)

  // ═══════════════════════════════════════════════════
  // 12. TRIM, MOLDING & ACCESSORIES (whole house)
  // ═══════════════════════════════════════════════════
  const trimRoom = 'Whole House (Trim)'
  function addTrim(description, qty, notes) {
    specs.push({
      ...COMMON,
      room: trimRoom,
      product_name: description,
      quantity: qty,
      subcategory: 'trim',
      location_detail: 'Whole house',
      notes: notes ? `${notes} | Painted white to match cabinets` : 'Painted white to match cabinets',
    })
  }

  addTrim('Starter Strip / Light Rail Molding (8ft)', 21, 'Under-cabinet trim')
  addTrim('Finished Toe Kick (8ft)',                   20, null)
  addTrim('Scribe Molding (8ft)',                       4, 'Bath scribes')
  addTrim('Base Fillers 3"W',                          10, 'Various heights 34.5"-40.5"')
  addTrim('Wall Fillers 3"W',                           8, 'Various heights 39"-66"')
  addTrim('Tall Fillers 3"W',                           3, 'Various heights 93"-102"')
  addTrim('Base Filler Overlays',                       6, 'For inset filler face frames')
  addTrim('Wall Filler Overlays',                       4, 'For inset filler face frames')
  addTrim('Tall Filler Overlays',                       4, 'For inset filler face frames')
  addTrim('Touch-Up Kits',                              2, 'White paint match')

  return specs
}

async function getProjectId() {
  const { data, error } = await supabase
    .from('projects')
    .select('id')
    .limit(1)
    .single()
  if (error) throw new Error(`Failed to get project: ${error.message}`)
  return data.id
}

async function importSpecs() {
  console.log('=== Cabinet Specification Import (Corrected Bid Package) ===\n')
  console.log('Source: Cabinet_Bid_Package_708_Purple_Salvia.pdf (March 3, 2026)')
  console.log('ALL cabinets: Painted White, Paint-grade Maple, Plywood Box, Framed Inset')
  console.log('(ProSource bid ES618204 was WRONG — used QSO/Oyster split)\n')

  const specs = buildSpecs()

  // Summarize by room
  const byRoom = {}
  for (const spec of specs) {
    byRoom[spec.room] = (byRoom[spec.room] || 0) + spec.quantity
  }
  console.log('Cabinet/item counts by room:')
  for (const [room, count] of Object.entries(byRoom)) {
    console.log(`  ${room}: ${count}`)
  }
  const totalItems = Object.values(byRoom).reduce((a, b) => a + b, 0)
  console.log(`  TOTAL: ${totalItems} items (${specs.length} line items)\n`)

  // Summarize by type
  const byType = {}
  for (const spec of specs) {
    byType[spec.subcategory] = (byType[spec.subcategory] || 0) + spec.quantity
  }
  console.log('Counts by type:')
  for (const [type, count] of Object.entries(byType)) {
    console.log(`  ${type}: ${count}`)
  }
  console.log()

  if (DRY_RUN) {
    console.log('[DRY RUN] Would insert these selections:\n')
    specs.forEach((s, i) => {
      console.log(`  ${i + 1}. [${s.room}] ${s.product_name} x${s.quantity} — ${s.finish} [${s.subcategory}]`)
      if (s.notes) console.log(`     ${s.notes}`)
    })
    console.log('\nRe-run without --dry-run to import.')
    return
  }

  const projectId = await getProjectId()
  console.log(`Project ID: ${projectId}\n`)

  // Delete existing cabinet selections (replaces old ProSource-based data)
  const { data: existing, error: existErr } = await supabase
    .from('selections')
    .select('id')
    .eq('project_id', projectId)
    .eq('category', 'cabinetry')

  if (existErr) {
    console.error('Error checking existing selections:', existErr.message)
    return
  }

  if (existing && existing.length > 0) {
    console.log(`Replacing ${existing.length} existing cabinet selections with corrected specs...\n`)
    const { error: delErr } = await supabase
      .from('selections')
      .delete()
      .eq('project_id', projectId)
      .eq('category', 'cabinetry')

    if (delErr) {
      console.error('Error deleting existing selections:', delErr.message)
      return
    }
  }

  // Insert all specs
  const records = specs.map(s => ({ project_id: projectId, ...s }))

  let inserted = 0
  for (let i = 0; i < records.length; i += 20) {
    const batch = records.slice(i, i + 20)
    const { data, error } = await supabase
      .from('selections')
      .insert(batch)
      .select('id')

    if (error) {
      console.error(`Error inserting batch ${i / 20 + 1}:`, error.message)
      console.error('First record in failed batch:', JSON.stringify(batch[0], null, 2))
      return
    }
    inserted += data.length
  }

  console.log(`Successfully imported ${inserted} cabinet selections.\n`)

  // Verify
  const { data: verify } = await supabase
    .from('selections')
    .select('room, product_name, quantity, subcategory, finish, color')
    .eq('project_id', projectId)
    .eq('category', 'cabinetry')
    .order('room')

  if (verify) {
    console.log('Verification — imported records:')
    let currentRoom = ''
    for (const v of verify) {
      if (v.room !== currentRoom) {
        currentRoom = v.room
        console.log(`\n  ${currentRoom}:`)
      }
      console.log(`    ${v.product_name} x${v.quantity} — ${v.finish} [${v.subcategory}]`)
    }
  }

  console.log('\nDone! Corrected cabinet specifications are now in the selections table.')
  console.log('Key changes from ProSource bid:')
  console.log('  - ALL painted white (no QSO Chinchilla, no Oyster split)')
  console.log('  - Paint-grade maple substrate (not oak)')
  console.log('  - Added panels, fillers, ply panels, and trim/molding section')
  console.log('  - Full overlay alternates requested for 6 rooms')
  console.log('  - 140 total boxes (was 115 in ProSource bid scope)')
}

importSpecs().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
