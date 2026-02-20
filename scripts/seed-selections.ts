#!/usr/bin/env tsx
/**
 * Seed Selections via Supabase JS
 *
 * Ports data from setup-selections.js (plumbing + lighting) and adds
 * appliances, tile, hardware, paint, and windows categories.
 *
 * Usage: npx tsx scripts/seed-selections.ts
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || (!SERVICE_KEY && !ANON_KEY)) {
  console.error('Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY || ANON_KEY!)

interface SelectionInput {
  room: string
  location_detail?: string
  category: string
  subcategory?: string
  product_name: string
  brand?: string
  collection?: string
  model_number?: string
  finish?: string
  color?: string
  material?: string
  quantity?: number
  unit_price?: number
  total_price?: number
  price_source?: string
  status?: string
  lead_time?: string
  product_url?: string
  notes?: string
}

async function main() {
  console.log('============================================')
  console.log('  Seed Selections Data')
  console.log('============================================')

  // 1. Find the project
  const { data: project, error: projErr } = await supabase
    .from('projects')
    .select('id, name')
    .ilike('address', '%708 Purple Salvia Cove%')
    .limit(1)
    .single()

  if (projErr || !project) {
    console.error('Could not find project:', projErr?.message)
    process.exit(1)
  }
  console.log(`  Project: ${project.name} (${project.id})`)

  // 2. Clear existing selections (idempotent)
  const { error: delErr } = await supabase
    .from('selections')
    .delete()
    .eq('project_id', project.id)

  if (delErr) {
    console.error('Error clearing selections:', delErr.message)
  } else {
    console.log('  Cleared existing selections')
  }

  // 3. Build all selections
  const selections: SelectionInput[] = []

  // ============================================================
  // PLUMBING — NEWPORT BRASS JACOBEAN COLLECTION
  // ============================================================

  // --- Kitchen Faucets ---
  selections.push({ room: 'Kitchen', category: 'plumbing', subcategory: 'faucet', product_name: 'Pull-Down Kitchen Faucet', brand: 'Newport Brass', collection: 'Jacobean', model_number: '2470-5103/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 754.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  selections.push({ room: 'Kitchen', category: 'plumbing', subcategory: 'faucet', product_name: 'Pot Filler - Wall Mount', brand: 'Newport Brass', collection: 'Jacobean', model_number: '2940-5503/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 987.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  selections.push({ room: 'Pantry', category: 'plumbing', subcategory: 'faucet', product_name: 'Prep/Bar Faucet', brand: 'Newport Brass', collection: 'Jacobean', model_number: '2470-5223/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 688.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })

  // --- Shower components per bathroom (5 components each) ---
  const showerRooms = ['Master Bath', 'Bath 2', 'Bath 3', 'Bath 4', 'Powder Bath']
  for (const room of showerRooms) {
    const notes = room === 'Powder Bath' ? 'Verify if powder bath has shower' : undefined
    selections.push({ room, location_detail: 'Shower', category: 'plumbing', subcategory: 'hand shower', product_name: 'Multifunction Hand Shower', brand: 'Newport Brass', collection: 'Jacobean', model_number: '280J/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 262.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected', notes })
    selections.push({ room, location_detail: 'Shower', category: 'plumbing', subcategory: 'thermostatic rough', product_name: '1/2" Thermostatic Rough Valve', brand: 'Newport Brass', model_number: '1-595', quantity: 1, unit_price: 246.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
    selections.push({ room, location_detail: 'Shower', category: 'plumbing', subcategory: 'thermostatic trim', product_name: 'Thermostatic Trim Plate', brand: 'Newport Brass', collection: 'Jacobean', model_number: '3-2574TS/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 517.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
    selections.push({ room, location_detail: 'Shower', category: 'plumbing', subcategory: 'showerhead', product_name: 'Showerhead', brand: 'Newport Brass', collection: 'Jacobean', model_number: '2144/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 182.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
    selections.push({ room, location_detail: 'Shower', category: 'plumbing', subcategory: 'shower arm', product_name: 'Shower Arm with Flange', brand: 'Newport Brass', model_number: '200-8101/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 105.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  }

  // --- Vanity Faucets ---
  // Master Bath wall-mount x2
  selections.push({ room: 'Master Bath', location_detail: 'Vanity - His', category: 'plumbing', subcategory: 'faucet', product_name: 'Wall Mount Lavatory Faucet', brand: 'Newport Brass', collection: 'Jacobean', model_number: '3-2561/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 574.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  selections.push({ room: 'Master Bath', location_detail: 'Vanity - Hers', category: 'plumbing', subcategory: 'faucet', product_name: 'Wall Mount Lavatory Faucet', brand: 'Newport Brass', collection: 'Jacobean', model_number: '3-2561/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 574.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })

  // Master bath wall-mount rough-ins x2
  selections.push({ room: 'Master Bath', location_detail: 'Vanity - His', category: 'plumbing', subcategory: 'rough-in valve', product_name: 'Wall Mount Lav Rough-In Valve', brand: 'Newport Brass', model_number: '1-684', quantity: 1, unit_price: 104.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  selections.push({ room: 'Master Bath', location_detail: 'Vanity - Hers', category: 'plumbing', subcategory: 'rough-in valve', product_name: 'Wall Mount Lav Rough-In Valve', brand: 'Newport Brass', model_number: '1-684', quantity: 1, unit_price: 104.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })

  // Master bath stabilizer kit
  selections.push({ room: 'Master Bath', category: 'plumbing', subcategory: 'accessory', product_name: 'Wall Mount Stabilizer Kit', brand: 'Newport Brass', model_number: '2-029/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 148.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })

  // Powder bath wall-mount faucet + rough-in
  selections.push({ room: 'Powder Bath', location_detail: 'Vanity', category: 'plumbing', subcategory: 'faucet', product_name: 'Wall Mount Lavatory Faucet', brand: 'Newport Brass', collection: 'Jacobean', model_number: '3-2561/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 574.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  selections.push({ room: 'Powder Bath', location_detail: 'Vanity', category: 'plumbing', subcategory: 'rough-in valve', product_name: 'Wall Mount Lav Rough-In Valve', brand: 'Newport Brass', model_number: '1-684', quantity: 1, unit_price: 104.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })

  // Bath 2, 3, 4 deck-mount faucets
  for (const room of ['Bath 2', 'Bath 3', 'Bath 4']) {
    selections.push({ room, location_detail: 'Vanity', category: 'plumbing', subcategory: 'faucet', product_name: 'Widespread Lavatory Faucet', brand: 'Newport Brass', collection: 'Jacobean', model_number: '2420/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 449.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  }

  // --- Master Tub Filler ---
  selections.push({ room: 'Master Bath', location_detail: 'Tub', category: 'plumbing', subcategory: 'tub filler', product_name: 'Floor Mount Tub Filler', brand: 'Newport Brass', collection: 'Jacobean', model_number: '2480-4261/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 2155.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })
  selections.push({ room: 'Master Bath', location_detail: 'Tub', category: 'plumbing', subcategory: 'tub filler riser', product_name: 'Floor Riser Kit', brand: 'Newport Brass', model_number: '282-01/04', finish: 'Satin Brass PVD', quantity: 1, unit_price: 474.00, price_source: 'CONTRACTOR_Plumbing_Fixtures_List.csv', status: 'selected' })

  // ============================================================
  // SINKS
  // ============================================================

  const totoLavRooms = [
    { room: 'Master Bath', location: 'His Vanity' },
    { room: 'Master Bath', location: 'Hers Vanity' },
    { room: 'Bath 2', location: 'Vanity' },
    { room: 'Bath 3', location: 'Vanity' },
    { room: 'Bath 4', location: 'Vanity' },
    { room: 'Powder Bath', location: 'Vanity' },
  ]
  for (const { room, location } of totoLavRooms) {
    selections.push({ room, location_detail: location, category: 'plumbing', subcategory: 'sink', product_name: 'Undermount Lavatory Sink', brand: 'TOTO', model_number: 'LT193G#01', finish: 'Cotton White', quantity: 1, unit_price: 172.20, price_source: 'Complete_Plumbing_Specification_with_Pricing.md', status: 'selected', notes: '17" x 14" undermount with CeFiONtect' })
  }

  // TOTO upgrade option
  selections.push({ room: 'Master Bath', location_detail: 'Vanity Upgrade Option', category: 'plumbing', subcategory: 'sink', product_name: 'Undermount Lavatory Sink (Upgrade)', brand: 'TOTO', model_number: 'LT546G#01', finish: 'Cotton White', quantity: 2, unit_price: 273.00, price_source: 'TOTO_Lavatory_Sink_Options.md', status: 'considering', notes: '19" x 12-3/8" ADA compliant option' })

  // Franke farmhouse sinks
  selections.push({ room: 'Kitchen', category: 'plumbing', subcategory: 'sink', product_name: 'Farmhouse Apron Front Sink', brand: 'Franke', model_number: 'SK18K62', finish: 'Stainless Steel', quantity: 1, unit_price: 1371.50, price_source: 'Complete_Plumbing_Specification_with_Pricing.md', status: 'selected', notes: '18-gauge stainless farmhouse' })
  selections.push({ room: 'Pantry', category: 'plumbing', subcategory: 'sink', product_name: 'Farmhouse Apron Front Sink', brand: 'Franke', model_number: 'SK18K62', finish: 'Stainless Steel', quantity: 1, unit_price: 1371.50, price_source: 'Complete_Plumbing_Specification_with_Pricing.md', status: 'selected', notes: '18-gauge stainless farmhouse' })

  // Kingston Brass utility sinks
  selections.push({ room: 'Laundry', category: 'plumbing', subcategory: 'sink', product_name: 'Utility Sink', brand: 'Kingston Brass', quantity: 1, unit_price: 1644.95, price_source: 'Complete_Plumbing_Specification_with_Pricing.md', status: 'selected', notes: 'Laundry room utility sink' })
  selections.push({ room: 'Classroom', category: 'plumbing', subcategory: 'sink', product_name: 'Utility Sink', brand: 'Kingston Brass', model_number: 'TBD', quantity: 1, unit_price: 1425.00, price_source: 'Complete_Plumbing_Specification_with_Pricing.md', status: 'selected', notes: 'Classroom/craft room sink' })

  // ============================================================
  // TOILETS
  // ============================================================

  selections.push({ room: 'Master Bath', category: 'plumbing', subcategory: 'toilet', product_name: 'Wall-Hung Toilet + Washlet S7A', brand: 'TOTO', model_number: 'CWT4284736CMFGA#MS', quantity: 1, unit_price: 3071.00, price_source: 'Complete_Plumbing_Specification_with_Pricing.md', status: 'selected', notes: 'Includes in-wall tank system + S7A Washlet bidet seat' })

  for (const room of ['Bath 2', 'Bath 3', 'Bath 4', 'Powder Bath']) {
    selections.push({ room, category: 'plumbing', subcategory: 'toilet', product_name: 'Two-Piece Elongated Toilet', brand: 'TOTO', model_number: 'CST642CEFGAT40#01', finish: 'Cotton White', quantity: 1, unit_price: 820.13, price_source: 'Complete_Plumbing_Specification_with_Pricing.md', status: 'selected', notes: '1.28 GPF, WaterSense, ADA' })
  }

  // ============================================================
  // TUB
  // ============================================================

  selections.push({ room: 'Master Bath', category: 'plumbing', subcategory: 'bathtub', product_name: 'Coletta Freestanding Bathtub', brand: 'Aquatica', model_number: 'Coletta', material: 'Solid Surface', color: 'White', quantity: 1, unit_price: 8780.00, price_source: 'Complete_Plumbing_Specification_with_Pricing.md', status: 'selected', notes: '71" freestanding soaking tub' })

  // ============================================================
  // WATER HEATER & UTILITY
  // ============================================================

  selections.push({ room: 'Utility', category: 'plumbing', subcategory: 'water heater', product_name: 'Tankless Water Heater', brand: 'Rinnai', model_number: 'RXP199iN', quantity: 1, unit_price: 2500.00, price_source: 'Estimate', status: 'considering', notes: '199,000 BTU natural gas, indoor/outdoor' })
  selections.push({ room: 'Utility', category: 'plumbing', subcategory: 'water softener', product_name: 'Water Softener System', brand: 'TBD', quantity: 1, status: 'considering', notes: 'Sizing depends on water hardness test results' })

  // ============================================================
  // PLUMBING — Considering / Placeholder items
  // ============================================================

  for (const room of ['Master Bath', 'Bath 2', 'Bath 3', 'Bath 4']) {
    selections.push({ room, category: 'plumbing', subcategory: 'towel warmer', product_name: 'Towel Warmer', quantity: 1, status: 'considering', notes: 'Brand/model TBD' })
    selections.push({ room, category: 'plumbing', subcategory: 'heated floor', product_name: 'Heated Floor System', quantity: 1, status: 'considering', notes: 'Electric radiant mat' })
  }

  selections.push({ room: 'Master Bath', category: 'plumbing', subcategory: 'steam generator', product_name: 'Steam Shower Generator', quantity: 1, status: 'considering', notes: 'Sizing depends on shower volume' })
  selections.push({ room: 'Laundry', category: 'plumbing', subcategory: 'faucet', product_name: 'Laundry Faucet', brand: 'Kingston Brass', status: 'considering', notes: 'Considering Kingston Brass options' })
  selections.push({ room: 'Classroom', category: 'plumbing', subcategory: 'faucet', product_name: 'Classroom Faucet', brand: 'Kingston Brass', status: 'considering', notes: 'Considering Kingston Brass options' })
  selections.push({ room: 'Dog Wash', category: 'plumbing', subcategory: 'hand shower', product_name: 'Dog Wash Hand Shower', status: 'considering', notes: 'Need to select model — wall-mount hand shower recommended' })

  // ============================================================
  // LIGHTING
  // ============================================================

  selections.push({ room: 'Kitchen', location_detail: 'Island', category: 'lighting', subcategory: 'chandelier', product_name: 'Vetivene 46.5" 8-Light Linear Chandelier', brand: 'Kichler', collection: 'Vetivene', finish: 'Natural Brass', quantity: 1, unit_price: 775.00, price_source: 'CASE_Itemized_Plumbing_Lighting.csv', status: 'selected' })
  selections.push({ room: 'Dining Room', category: 'lighting', subcategory: 'chandelier', product_name: 'Vetivene 29" 6-Light Chandelier', brand: 'Kichler', collection: 'Vetivene', finish: 'Natural Brass', quantity: 1, unit_price: 455.00, price_source: 'CASE_Itemized_Plumbing_Lighting.csv', status: 'selected' })
  selections.push({ room: 'Foyer', category: 'lighting', subcategory: 'chandelier', product_name: 'Vetivene 20" 3-Light Chandelier', brand: 'Kichler', collection: 'Vetivene', finish: 'Natural Brass', quantity: 1, unit_price: 270.00, price_source: 'CASE_Itemized_Plumbing_Lighting.csv', status: 'selected' })
  selections.push({ room: 'Master Bath', location_detail: 'Vanity Sconces', category: 'lighting', subcategory: 'sconce', product_name: 'Bisque 1-Light Wall Sconce', brand: 'Visual Comfort', finish: 'Satin Brass', quantity: 4, unit_price: 84.00, price_source: 'CASE_Itemized_Plumbing_Lighting.csv', status: 'selected', notes: '2 per vanity, 4 total' })
  selections.push({ room: 'Bath 2', location_detail: 'Vanity', category: 'lighting', subcategory: 'vanity light', product_name: 'Aiken 4-Light Bath Vanity', brand: 'Progress Lighting', collection: 'Aiken', finish: 'Vintage Brass', quantity: 1, unit_price: 210.00, price_source: 'CASE_Itemized_Plumbing_Lighting.csv', status: 'selected' })

  // Bath 3 options
  selections.push({ room: 'Bath 3', location_detail: 'Vanity - Option 1', category: 'lighting', subcategory: 'vanity light', product_name: 'Hansford 3-Light Bath Vanity', brand: 'Progress Lighting', collection: 'Hansford', finish: 'Vintage Brass', quantity: 1, unit_price: 186.00, price_source: 'CASE_Itemized_Plumbing_Lighting.csv', status: 'considering', notes: 'Option 1 for Bath 3' })
  selections.push({ room: 'Bath 3', location_detail: 'Vanity - Option 2', category: 'lighting', subcategory: 'vanity light', product_name: 'Aiken 4-Light Bath Vanity', brand: 'Progress Lighting', collection: 'Aiken', finish: 'Vintage Brass', quantity: 1, unit_price: 210.00, price_source: 'CASE_Itemized_Plumbing_Lighting.csv', status: 'considering', notes: 'Option 2 for Bath 3' })

  // Bath 4 options
  selections.push({ room: 'Bath 4', location_detail: 'Vanity - Option 1', category: 'lighting', subcategory: 'vanity light', product_name: 'Hansford 3-Light Bath Vanity', brand: 'Progress Lighting', collection: 'Hansford', finish: 'Vintage Brass', quantity: 1, unit_price: 186.00, price_source: 'CASE_Itemized_Plumbing_Lighting.csv', status: 'considering', notes: 'Option 1 for Bath 4' })
  selections.push({ room: 'Bath 4', location_detail: 'Vanity - Option 2', category: 'lighting', subcategory: 'vanity light', product_name: 'Aiken 4-Light Bath Vanity', brand: 'Progress Lighting', collection: 'Aiken', finish: 'Vintage Brass', quantity: 1, unit_price: 210.00, price_source: 'CASE_Itemized_Plumbing_Lighting.csv', status: 'considering', notes: 'Option 2 for Bath 4' })

  // Powder bath sconces
  selections.push({ room: 'Powder Bath', location_detail: 'Vanity', category: 'lighting', subcategory: 'sconce', product_name: 'Aiken 1-Light Wall Sconce', brand: 'Progress Lighting', collection: 'Aiken', finish: 'Vintage Brass', quantity: 2, unit_price: 145.50, price_source: 'CASE_Itemized_Plumbing_Lighting.csv', status: 'selected', notes: '1 per side of mirror' })

  // Placeholder lighting
  selections.push({ room: 'Whole House', category: 'lighting', subcategory: 'recessed', product_name: 'Interior Recessed Cans', quantity: 72, status: 'considering', notes: 'Model TBD — 72 total per lighting plan' })
  selections.push({ room: 'Exterior', category: 'lighting', subcategory: 'recessed', product_name: 'Outdoor Recessed Cans', quantity: 8, status: 'considering', notes: 'Model TBD — soffit/porch areas' })
  selections.push({ room: 'Whole House', category: 'lighting', subcategory: 'sconce', product_name: 'Indoor Wall Sconces', quantity: 22, status: 'considering', notes: 'Model TBD — hallways, stairways, bedrooms' })
  selections.push({ room: 'Exterior', category: 'lighting', subcategory: 'sconce', product_name: 'Outdoor Wall Sconces', quantity: 14, status: 'considering', notes: 'Model TBD — entry, patio, garage' })
  selections.push({ room: 'Garage', category: 'lighting', subcategory: 'ceiling light', product_name: 'Garage Ceiling Lights', quantity: 4, status: 'considering', notes: 'Model TBD — LED shop/flush mount' })

  // ============================================================
  // APPLIANCES — From FBS Quote #410012
  // ============================================================

  selections.push({ room: 'Kitchen', category: 'appliance', subcategory: 'range', product_name: 'Grand Palais 180 Range', brand: 'La Cornue', model_number: 'GP-180', finish: 'Custom Color', quantity: 1, unit_price: 65000.00, price_source: 'FBS Quote #410012', status: 'selected', notes: 'Dual fuel, 71" wide, 6 burners + griddle + 2 ovens' })
  selections.push({ room: 'Kitchen', category: 'appliance', subcategory: 'refrigerator', product_name: '30" Designer Column Refrigerator', brand: 'Sub-Zero', model_number: 'DEC3050R', quantity: 1, unit_price: 9895.00, price_source: 'FBS Quote #410012', status: 'selected', notes: 'Panel-ready, paired with freezer column' })
  selections.push({ room: 'Kitchen', category: 'appliance', subcategory: 'freezer', product_name: '18" Designer Column Freezer', brand: 'Sub-Zero', model_number: 'DEC1850F', quantity: 1, unit_price: 7495.00, price_source: 'FBS Quote #410012', status: 'selected', notes: 'Panel-ready, pairs with refrigerator column' })
  selections.push({ room: 'Kitchen', category: 'appliance', subcategory: 'wall oven', product_name: '30" Convection Oven', brand: 'Miele', model_number: 'H7780BP', quantity: 1, unit_price: 5499.00, price_source: 'FBS Quote #410012', status: 'selected', notes: 'Secondary oven — baking/roasting' })
  selections.push({ room: 'Kitchen', category: 'appliance', subcategory: 'steam oven', product_name: '24" Steam Oven', brand: 'Miele', model_number: 'DGC7785', quantity: 1, unit_price: 5999.00, price_source: 'FBS Quote #410012', status: 'selected', notes: 'Combi-steam, pairs with wall oven stack' })
  selections.push({ room: 'Kitchen', category: 'appliance', subcategory: 'ventilation', product_name: '48" Island Hood', brand: 'Miele', model_number: 'DAI1580', quantity: 1, unit_price: 3799.00, price_source: 'FBS Quote #410012', status: 'selected', notes: 'Ceiling-mounted island ventilation' })
  selections.push({ room: 'Kitchen', category: 'appliance', subcategory: 'dishwasher', product_name: '24" Fully Integrated Dishwasher', brand: 'Miele', model_number: 'G7966SCVi', quantity: 2, unit_price: 2199.00, price_source: 'FBS Quote #410012', status: 'selected', notes: '2 dishwashers — one each side of sink' })
  selections.push({ room: 'Kitchen', category: 'appliance', subcategory: 'ice maker', product_name: '15" Undercounter Ice Maker', brand: 'Scotsman', model_number: 'CU50PA', quantity: 1, unit_price: 3295.00, price_source: 'FBS Quote #410012', status: 'selected', notes: 'Clear ice, 65 lbs/day, gravity drain' })
  selections.push({ room: 'Laundry', category: 'appliance', subcategory: 'washer', product_name: '24" Front Load Washer', brand: 'Miele', model_number: 'WXR860WCS', quantity: 1, unit_price: 2099.00, price_source: 'FBS Quote #410012', status: 'selected', notes: 'TwinDos auto detergent dosing' })
  selections.push({ room: 'Laundry', category: 'appliance', subcategory: 'dryer', product_name: '24" Heat Pump Dryer', brand: 'Miele', model_number: 'TXR860WP', quantity: 1, unit_price: 2099.00, price_source: 'FBS Quote #410012', status: 'selected', notes: 'Ventless heat pump, matches washer' })

  // ============================================================
  // TILE — Placeholder selections
  // ============================================================

  selections.push({ room: 'Kitchen', category: 'tile', subcategory: 'countertop', product_name: 'Marble Countertops', brand: 'Stone Systems', material: 'Natural Marble', quantity: 1, unit_price: 42905.00, price_source: 'Stone Systems bid 10.09.25', status: 'selected', notes: 'Full kitchen + all bath countertops — per Stone Systems bid' })
  selections.push({ room: 'Master Bath', location_detail: 'Shower', category: 'tile', subcategory: 'shower tile', product_name: 'Shower Wall & Floor Tile', material: 'Porcelain/Marble', quantity: 1, status: 'considering', notes: 'Large format wall tile + mosaic floor — selection pending' })
  selections.push({ room: 'Bath 2', location_detail: 'Shower', category: 'tile', subcategory: 'shower tile', product_name: 'Shower Wall & Floor Tile', material: 'Porcelain', quantity: 1, status: 'considering', notes: 'Selection pending' })
  selections.push({ room: 'Bath 3', location_detail: 'Shower', category: 'tile', subcategory: 'shower tile', product_name: 'Shower Wall & Floor Tile', material: 'Porcelain', quantity: 1, status: 'considering', notes: 'Selection pending' })
  selections.push({ room: 'Bath 4', location_detail: 'Shower', category: 'tile', subcategory: 'shower tile', product_name: 'Shower Wall & Floor Tile', material: 'Porcelain', quantity: 1, status: 'considering', notes: 'Selection pending' })
  selections.push({ room: 'Kitchen', category: 'tile', subcategory: 'backsplash', product_name: 'Kitchen Backsplash', material: 'TBD', quantity: 1, status: 'considering', notes: 'Full height behind range, standard elsewhere' })
  selections.push({ room: 'Whole House', category: 'tile', subcategory: 'floor tile', product_name: 'Primary Floor Tile / Stone', material: 'TBD', quantity: 1, status: 'considering', notes: 'Main living areas — limestone or porcelain TBD' })
  selections.push({ room: 'Laundry', category: 'tile', subcategory: 'floor tile', product_name: 'Laundry Floor Tile', material: 'Porcelain', quantity: 1, status: 'considering', notes: 'Durable, water-resistant' })

  // ============================================================
  // HARDWARE — Placeholder selections
  // ============================================================

  selections.push({ room: 'Whole House', category: 'hardware', subcategory: 'door hardware', product_name: 'Interior Door Lever Set', quantity: 28, status: 'considering', notes: 'Satin brass finish to match plumbing — brand TBD. ~28 interior doors' })
  selections.push({ room: 'Kitchen', category: 'hardware', subcategory: 'cabinet pulls', product_name: 'Cabinet Pulls & Knobs', quantity: 1, status: 'considering', notes: 'Kitchen + bath cabinetry — style TBD, satin brass' })
  selections.push({ room: 'Whole House', category: 'hardware', subcategory: 'cabinet pulls', product_name: 'Bath Cabinet Pulls & Knobs', quantity: 1, status: 'considering', notes: 'All bathrooms — coordinate with kitchen' })
  selections.push({ room: 'Exterior', category: 'hardware', subcategory: 'entry hardware', product_name: 'Exterior Door Hardware Set', quantity: 3, status: 'considering', notes: 'Front door + 2 secondary entries — keyed alike' })
  selections.push({ room: 'Whole House', category: 'hardware', subcategory: 'hinges', product_name: 'Door Hinges', quantity: 28, status: 'considering', notes: 'Satin brass ball-bearing hinges — match lever finish' })

  // ============================================================
  // PAINT — Placeholder selections
  // ============================================================

  selections.push({ room: 'Whole House', category: 'paint', subcategory: 'interior', product_name: 'Interior Wall Paint', brand: 'TBD', quantity: 1, status: 'considering', notes: 'Color palette TBD — warm neutrals expected' })
  selections.push({ room: 'Exterior', category: 'paint', subcategory: 'exterior', product_name: 'Exterior Paint / Stain', brand: 'TBD', quantity: 1, status: 'considering', notes: 'French Country palette — stone accents + Hardie board' })
  selections.push({ room: 'Whole House', category: 'paint', subcategory: 'trim', product_name: 'Trim & Millwork Paint', brand: 'TBD', quantity: 1, status: 'considering', notes: 'White or off-white semi-gloss — brand TBD' })

  // ============================================================
  // WINDOWS — Prestige Steel Thermal
  // ============================================================

  selections.push({ room: 'Whole House', category: 'hardware', subcategory: 'windows', product_name: 'Prestige Steel Thermal Windows & Doors', brand: 'Prestige Steel', quantity: 1, unit_price: 68446.00, price_source: 'Estimate #2670 Thermally Broken', status: 'selected', notes: 'Thermally broken steel windows + doors — full house package per estimate' })

  // 4. Build records for insert
  const records = selections.map(s => ({
    project_id: project.id,
    room: s.room,
    location_detail: s.location_detail || null,
    category: s.category,
    subcategory: s.subcategory || null,
    product_name: s.product_name,
    brand: s.brand || null,
    collection: s.collection || null,
    model_number: s.model_number || null,
    finish: s.finish || null,
    color: s.color || null,
    material: s.material || null,
    quantity: s.quantity || 1,
    unit_price: s.unit_price || null,
    total_price: s.total_price ?? (s.unit_price ? s.unit_price * (s.quantity || 1) : null),
    price_source: s.price_source || null,
    status: s.status || 'selected',
    lead_time: s.lead_time || null,
    product_url: s.product_url || null,
    notes: s.notes || null,
  }))

  // 5. Insert in batches
  const BATCH_SIZE = 25
  let inserted = 0
  const errors: string[] = []

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('selections').insert(batch)
    if (error) {
      errors.push(`Batch ${i}: ${error.message}`)
      console.error(`  Error inserting batch at ${i}:`, error.message)
    } else {
      inserted += batch.length
    }
  }

  // 6. Summary
  console.log('')
  console.log('============================================')
  console.log('  Results')
  console.log('============================================')
  console.log(`  Total selections built: ${selections.length}`)
  console.log(`  Records inserted: ${inserted}`)

  // Count by category
  const byCategory = new Map<string, number>()
  for (const s of selections) {
    byCategory.set(s.category, (byCategory.get(s.category) || 0) + 1)
  }
  console.log('')
  console.log('  By category:')
  for (const [cat, count] of Array.from(byCategory.entries())) {
    console.log(`    ${cat.padEnd(15)} ${count} items`)
  }

  if (errors.length > 0) {
    console.log('')
    console.log(`  Errors (${errors.length}):`)
    errors.forEach(e => console.log(`    - ${e}`))
    process.exit(1)
  }

  console.log('============================================')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
