#!/usr/bin/env tsx
/**
 * Seed Bids Data
 *
 * Inserts 27 known bids from Dropbox documents and email quotes into the bids table.
 * Idempotent — deletes all bids for the project before re-inserting.
 *
 * Usage: npx tsx scripts/seed-bids.ts
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

interface BidInput {
  vendor_name: string
  vendor_contact?: string
  vendor_email?: string
  vendor_phone?: string
  category: string
  subcategory?: string
  description: string
  total_amount: number
  status: string
  bid_date: string
  received_date: string
  source: string
  source_document?: string
  internal_notes?: string
  pros?: string
  cons?: string
  scope_of_work?: string
  payment_terms?: string
  lead_time_weeks?: number
}

const BIDS: BidInput[] = [
  // === SITE WORK ===
  {
    vendor_name: 'Triple C Septic',
    vendor_contact: 'Chuck F.',
    category: 'Site Work',
    description: 'Land clearing, grubbing, and site prep for 708 Purple Salvia Cove',
    total_amount: 15000,
    status: 'pending',
    bid_date: '2025-09-15',
    received_date: '2025-09-15',
    source: 'document',
    source_document: 'Development/Bids/Excavation and Septic/Proposal...Land Clearing 15k Chuck F.docx',
    internal_notes: 'Development/Bids/Excavation and Septic/Proposal...Land Clearing 15k Chuck F.docx',
    pros: 'Local, available immediately, bundled with septic',
    scope_of_work: 'Clear trees, grub stumps, rough grade pad area',
  },

  // === WELL & SEPTIC ===
  {
    vendor_name: 'Triple C Septic',
    vendor_contact: 'Chuck F.',
    category: 'Well & Septic',
    subcategory: 'Conventional Septic',
    description: 'Conventional septic system design and installation',
    total_amount: 21010,
    status: 'pending',
    bid_date: '2025-09-15',
    received_date: '2025-09-15',
    source: 'document',
    source_document: 'Development/Bids/Excavation and Septic/Proposal...Septic Design...Chuck.docx',
    internal_notes: 'Development/Bids/Excavation and Septic/Proposal...Septic Design...Chuck.docx',
    pros: 'Lower cost than aerobic, simpler maintenance',
    cons: 'May not be approved depending on soil/perc test',
    scope_of_work: 'Design, permit, install conventional septic system',
  },
  {
    vendor_name: 'Triple C Septic',
    vendor_contact: 'Chuck F.',
    category: 'Well & Septic',
    subcategory: 'Aerobic Septic',
    description: 'Aerobic septic system design and installation',
    total_amount: 25210,
    status: 'pending',
    bid_date: '2025-09-15',
    received_date: '2025-09-15',
    source: 'document',
    source_document: 'Development/Bids/Excavation and Septic/Proposal...Septic Design...Chuck.docx',
    internal_notes: 'Development/Bids/Excavation and Septic/Proposal...Septic Design...Chuck.docx',
    pros: 'More likely to be approved, better for soil conditions',
    cons: 'Higher cost, requires maintenance contract',
    scope_of_work: 'Design, permit, install aerobic septic with spray field',
  },
  {
    vendor_name: 'Paul Swoyer',
    category: 'Well & Septic',
    subcategory: 'Aerobic Septic',
    description: 'Aerobic septic system — full design and installation',
    total_amount: 44850,
    status: 'pending',
    bid_date: '2025-10-01',
    received_date: '2025-10-01',
    source: 'document',
    source_document: 'Development/Bids/Septic/Estimate 13027 (1).pdf',
    internal_notes: 'Development/Bids/Septic/Estimate 13027 (1).pdf',
    cons: 'Significantly more expensive than Triple C',
    scope_of_work: 'Full aerobic system with advanced treatment',
  },
  {
    vendor_name: 'Bee Cave Drilling',
    category: 'Well & Septic',
    subcategory: 'Well Drilling',
    description: 'Water well drilling and pump installation',
    total_amount: 56481,
    status: 'pending',
    bid_date: '2025-10-15',
    received_date: '2025-10-15',
    source: 'document',
    source_document: 'Development/Bids/Well Drilling/Case, Daniel Estimate 13791.pdf',
    internal_notes: 'Development/Bids/Well Drilling/Case, Daniel Estimate 13791.pdf',
    scope_of_work: 'Drill well, install pump, connect to house, pressure tank',
  },

  // === FLOORING ===
  {
    vendor_name: 'Kristynik',
    category: 'Flooring',
    description: 'Hardwood flooring — main house package (supply + install)',
    total_amount: 77014,
    status: 'selected',
    bid_date: '2025-07-20',
    received_date: '2025-07-20',
    source: 'document',
    source_document: 'Development/Bids/Flooring/Est_21646R...15476.pdf',
    internal_notes: 'Development/Bids/Flooring/Est_21646R...15476.pdf',
    pros: 'Premium quality, wide plank white oak, local installer',
    scope_of_work: 'Supply and install hardwood flooring throughout main living areas',
    payment_terms: '50% deposit, balance on completion',
  },
  {
    vendor_name: 'Kristynik',
    category: 'Flooring',
    subcategory: 'Stairs Change Order',
    description: 'Stair treads and risers — change order for custom staircase',
    total_amount: 28434,
    status: 'selected',
    bid_date: '2025-11-10',
    received_date: '2025-11-10',
    source: 'document',
    source_document: 'Development/Bids/Flooring/Est_21721...16928.pdf',
    internal_notes: 'Development/Bids/Flooring/Est_21721...16928.pdf',
    scope_of_work: 'Custom stair treads, risers, and landing material + installation',
  },

  // === WINDOWS & DOORS ===
  {
    vendor_name: 'Prestige Steel',
    vendor_contact: 'Emily Watts',
    vendor_email: 'sales@prestigedoorsandwindows.com',
    vendor_phone: '512-666-9676',
    category: 'Windows & Doors',
    subcategory: 'Non-Thermal',
    description: 'Steel windows and doors — non-thermally broken',
    total_amount: 60328,
    status: 'under_review',
    bid_date: '2025-09-20',
    received_date: '2025-09-20',
    source: 'document',
    source_document: 'Development/Bids/Windows and Doors/Estimate #2670 - Prestige Steel...pdf',
    internal_notes: 'Development/Bids/Windows and Doors/Estimate #2670 - Prestige Steel...pdf',
    pros: 'Most affordable steel option, clean sightlines',
    cons: 'Not thermally broken — less energy efficient',
    scope_of_work: 'Manufacture and deliver steel windows + doors per plans',
  },
  {
    vendor_name: 'Prestige Steel',
    vendor_contact: 'Emily Watts',
    vendor_email: 'sales@prestigedoorsandwindows.com',
    vendor_phone: '512-666-9676',
    category: 'Windows & Doors',
    subcategory: 'Thermal',
    description: 'Steel windows and doors — thermally broken',
    total_amount: 68446,
    status: 'under_review',
    bid_date: '2025-09-20',
    received_date: '2025-09-20',
    source: 'document',
    source_document: 'Development/Bids/Windows and Doors/Estimate #2670 Thermally Broken.pdf',
    internal_notes: 'Development/Bids/Windows and Doors/Estimate #2670 Thermally Broken.pdf',
    pros: 'Energy efficient, still affordable for steel, meets code easily',
    cons: 'Slightly thicker frames than non-thermal',
    scope_of_work: 'Manufacture and deliver thermally broken steel windows + doors per plans',
  },
  {
    vendor_name: 'Citadel',
    category: 'Windows & Doors',
    subcategory: 'Hybrid Steel/Aluminum',
    description: 'Hybrid steel/aluminum windows and doors — premium',
    total_amount: 203985,
    status: 'under_review',
    bid_date: '2025-10-05',
    received_date: '2025-10-05',
    source: 'document',
    source_document: 'Development/Bids/Windows and Doors/Citadel_Case Res Hybrid...pdf',
    internal_notes: 'Development/Bids/Windows and Doors/Citadel_Case Res Hybrid...pdf',
    pros: 'Premium brand, excellent thermal performance',
    cons: 'Very expensive — 3x Prestige thermal price',
    scope_of_work: 'Manufacture and deliver hybrid steel/aluminum windows + doors',
  },
  {
    vendor_name: 'Exclusive',
    category: 'Windows & Doors',
    subcategory: 'Premium Steel',
    description: 'Premium steel windows and doors — top-tier',
    total_amount: 286649,
    status: 'under_review',
    bid_date: '2025-10-10',
    received_date: '2025-10-10',
    source: 'document',
    source_document: 'Development/Bids/Windows and Doors/Case Residence...Exclusive...pdf',
    internal_notes: 'Development/Bids/Windows and Doors/Case Residence...Exclusive...pdf',
    pros: 'Highest quality available, architectural grade',
    cons: 'Most expensive option — 4.2x Prestige thermal',
    scope_of_work: 'Full manufacture and delivery of premium steel window/door package',
  },
  {
    vendor_name: 'French Steel Company (BFS Design)',
    vendor_contact: 'Travis Justis',
    vendor_email: 'travis@frenchsteel.com',
    vendor_phone: '303-386-1016',
    category: 'Windows & Doors',
    subcategory: 'Secco Tuscan Thermal',
    description: 'Secco Tuscan Series OS2-75 thermally broken steel windows & doors — 556 sq ft of glass, via Builders First Source Ultra Team',
    total_amount: 198446,
    status: 'under_review',
    bid_date: '2025-05-05',
    received_date: '2025-05-05',
    source: 'document',
    source_document: 'Development/Bids/Windows and Doors/FSC - Quote #Q3163 - 448 Bold Sundown 198k.pdf',
    internal_notes: 'Quote #Q3163, 50% deposit required',
    pros: 'Secco Tuscan is premium European steel, thermally broken, good mid-range price',
    cons: 'European import — longer lead times possible',
    scope_of_work: 'Manufacture and deliver Secco Tuscan OS2-75 thermally broken steel windows + doors per plans',
    payment_terms: '50% deposit required',
  },
  {
    vendor_name: 'Doorwin / Luvindow',
    vendor_contact: 'Tina Jiang',
    vendor_email: 'tina@doorwingroup.com',
    category: 'Windows & Doors',
    subcategory: 'Thermal Break Aluminum',
    description: '53 windows & doors — 95S Builder Series thermal break aluminum, SDL grilles, HOPPE German hardware, double Low-E argon glazing. DDP $55,746 (EXW $47,981 + $7,765 freight)',
    total_amount: 55746,
    status: 'under_review',
    bid_date: '2025-12-01',
    received_date: '2025-12-01',
    source: 'email',
    internal_notes: 'DDP delivered price. EXW $47,981 + $7,765 freight. No double-hung, no skylights, no brushed brass available.',
    pros: 'Lowest window/door price by far, thermal break aluminum, German hardware included',
    cons: 'No double-hung or skylights available, no brushed brass finish, China import',
    scope_of_work: 'Manufacture and ship 53 thermal break aluminum windows & doors with SDL grilles, HOPPE hardware, double Low-E argon glazing',
    lead_time_weeks: 10,
  },

  // === APPLIANCES ===
  {
    vendor_name: 'FBS / Tri Supply',
    vendor_contact: 'Aaron M. Burden',
    vendor_email: 'amburden@trisupply.net',
    vendor_phone: '512-916-9354',
    category: 'Appliances',
    description: 'Full appliance package — La Cornue Grand Palais, Sub-Zero columns, Miele, Scotsman',
    total_amount: 191107,
    status: 'under_review',
    bid_date: '2025-09-25',
    received_date: '2025-09-25',
    source: 'document',
    source_document: 'Development/Bids/Appliances/Quote 410012.pdf',
    internal_notes: 'Development/Bids/Appliances/Quote 410012.pdf',
    pros: 'Single source for all appliances, volume pricing',
    scope_of_work: 'Supply all kitchen + laundry appliances per spec list',
    payment_terms: 'Deposit required, balance before delivery',
  },
  {
    vendor_name: 'Manna Distributors',
    vendor_contact: 'Alan Nahman',
    vendor_email: 'anahman@mannadistributors.com',
    vendor_phone: '713-977-3318',
    category: 'Appliances',
    subcategory: 'Competing Quote',
    description: 'Full appliance package — La Cornue Chateau 150, 2x Sub-Zero 36" fridge, 2x Sub-Zero 36" freezer, Sub-Zero beverage, Miele oven/combi/warming/cooktop/hood/2x dishwasher/washer/dryer, U-Line ice maker',
    total_amount: 176464,
    status: 'under_review',
    bid_date: '2025-10-21',
    received_date: '2025-10-21',
    source: 'document',
    source_document: 'Development/Bids/Appliances/Quote # m32224 Manna Distributors.pdf',
    internal_notes: 'Subtotal $176,464.33, tax $14,558.31, total $191,022.64',
    pros: 'Lower price than FBS, La Cornue Chateau 150 instead of Grand Palais',
    cons: 'Different La Cornue model (Chateau 150 vs Grand Palais)',
    scope_of_work: 'Supply all kitchen + laundry appliances per spec list',
  },

  // === COUNTERTOPS ===
  {
    vendor_name: 'Stone Systems',
    category: 'Countertops',
    description: 'Natural stone countertops — kitchen, all baths, laundry',
    total_amount: 42905,
    status: 'under_review',
    bid_date: '2025-10-09',
    received_date: '2025-10-09',
    source: 'document',
    source_document: 'Development/Bids/Stone Fabricator/Case, Daniel countertop bid 10.09.25.pdf',
    internal_notes: 'Development/Bids/Stone Fabricator/Case, Daniel countertop bid 10.09.25.pdf',
    pros: 'Most affordable option by far, experienced fabricator',
    scope_of_work: 'Template, fabricate, install all countertops',
  },
  {
    vendor_name: 'Alpha Granite',
    vendor_contact: 'Bruno Pires',
    vendor_email: 'bruno@AlphaGraniteAustin.com',
    vendor_phone: '512-704-5210',
    category: 'Countertops',
    subcategory: 'Calacatta Borghini',
    description: 'Marble Calacatta Borghini Honed 2cm — kitchen, pantry, dining, classroom, utility, master bath, bath 2/3/4 with 4cm miter edges, vein matching',
    total_amount: 147809,
    status: 'under_review',
    bid_date: '2025-10-07',
    received_date: '2025-10-07',
    source: 'document',
    source_document: 'Development/Bids/Stone Fabricator/QUOTE - CALCATTA BORGHINI - 708 PURPLE SALVIA CV.pdf',
    internal_notes: 'Quote #84441, lump sum residential (no tax)',
    pros: 'Full fab + install lump sum, Calacatta Borghini is premium marble, vein matching included',
    cons: 'Most expensive countertop option at $147,809',
    scope_of_work: 'Fabrication and installation of 2cm Calacatta Borghini honed marble, all rooms, 4cm miter edges, oversized piece handling, vein matching',
    payment_terms: '75% deposit, balance on installation day',
  },
  {
    vendor_name: 'Alpha Granite',
    vendor_contact: 'Bruno Pires',
    vendor_email: 'bruno@AlphaGraniteAustin.com',
    vendor_phone: '512-704-5210',
    category: 'Countertops',
    subcategory: 'Calacatta Gold',
    description: 'Marble Calacatta Gold/Caldia Honed 2cm — kitchen, pantry, dining, classroom, utility, master bath, bath 2/3/4 with 4cm miter edges, vein matching',
    total_amount: 140513,
    status: 'under_review',
    bid_date: '2025-10-07',
    received_date: '2025-10-07',
    source: 'document',
    source_document: 'Development/Bids/Stone Fabricator/QUOTE - CALCATTA GOLD - 708 PURPLE SALVIA CV.pdf',
    internal_notes: 'Quote #84444, lump sum residential (no tax)',
    pros: 'Full fab + install lump sum, Calacatta Gold is classic luxury marble, vein matching included',
    cons: 'Still very expensive at $140,513',
    scope_of_work: 'Fabrication and installation of 2cm Calacatta Gold honed marble, all rooms, 4cm miter edges, oversized piece handling, vein matching',
    payment_terms: '75% deposit, balance on installation day',
  },
  {
    vendor_name: 'Blue Label Granite',
    vendor_contact: 'Abbie Fenton',
    vendor_email: 'abbie@bluelabelgranite.com',
    vendor_phone: '512-738-5788',
    category: 'Countertops',
    subcategory: 'Material Only — Calacatta Gold',
    description: 'Material allowance only — 9 slabs of 3cm Calacatta Gold Polished/Honed from Architectural Surfaces (128"x75" = 66.7 sf each)',
    total_amount: 70551,
    status: 'under_review',
    bid_date: '2025-10-16',
    received_date: '2025-10-16',
    source: 'document',
    source_document: 'Development/Bids/Stone Fabricator/D. Case Material Allowance ONLY Estimate 13201.pdf',
    internal_notes: 'Estimate #13201, subtotal $70,551, tax $5,820.46, total $76,371.46. Pair with Labor Est #13198 ($24,755) for combined $95,306',
    pros: 'Separates material from labor for flexibility, hand-select slabs',
    cons: 'Material-only — must also engage labor separately (see Blue Label Labor Est #13198)',
    scope_of_work: '9 slabs of 3cm Calacatta Gold from Architectural Surfaces',
    payment_terms: 'Material cost + 75% of remaining for deposit, balance on install day. 5% CC fee over $5k',
  },
  {
    vendor_name: 'Blue Label Granite',
    vendor_contact: 'Abbie Fenton',
    vendor_email: 'abbie@bluelabelgranite.com',
    vendor_phone: '512-738-5788',
    category: 'Countertops',
    subcategory: 'Labor Only',
    description: 'Fabrication and installation labor — marble for kitchen, island, backsplash, utility, pantry, primary bath, bath 2/3/4. Mitered edges throughout.',
    total_amount: 24755,
    status: 'under_review',
    bid_date: '2025-10-15',
    received_date: '2025-10-15',
    source: 'document',
    source_document: 'Development/Bids/Stone Fabricator/D. Case Labor ONLY Estimate 13198.pdf',
    internal_notes: 'Estimate #13198, no tax on labor. Pair with Material Est #13201 ($70,551) for combined $95,306',
    pros: 'Separates labor from material, competitive fabrication pricing',
    cons: 'Labor-only — must also purchase material separately (see Blue Label Material Est #13201)',
    scope_of_work: 'Marble fabrication & installation: kitchen counters, island (long seam), backsplash w/ vertical install, utility room, pantry, primary bath vanities + shower bench, bath 2/3/4 vanities. All mitered edges, undermount sink cutouts (customer-provided sinks)',
    payment_terms: '75% deposit, balance on installation day. 5% CC fee over $5k',
  },

  // === PLUMBING FIXTURES ===
  {
    vendor_name: 'ProSource Wholesale',
    vendor_contact: 'Taryn Ripley',
    vendor_email: 'tarynr@prosourcetexas.com',
    vendor_phone: '512-836-7888',
    category: 'Plumbing Fixtures',
    description: 'Plumbing fixtures + some lighting — Kingston Brass faucets/sinks, Kichler/Progress lighting, covers kitchen, master bath, bath 2/3/4, powder, classroom, utility, dog wash',
    total_amount: 27850,
    status: 'under_review',
    bid_date: '2025-10-10',
    received_date: '2025-10-10',
    source: 'document',
    source_document: 'Development/Bids/Plumbing and Lighting Fixtures/CASE - PLUMBING QUOTE - 10102025.pdf',
    internal_notes: 'Quote #3261081, subtotal $27,849.90, tax $2,297.62, total $30,147.52. Includes some lighting fixtures.',
    pros: 'Wholesale pricing, covers plumbing + some lighting in one package',
    scope_of_work: 'Supply plumbing fixtures (faucets, sinks, drains) and select lighting fixtures for all rooms',
  },

  // === EXTERIOR LIGHTING ===
  {
    vendor_name: 'Lantern & Scroll',
    vendor_contact: 'Karen Good',
    vendor_email: 'buyfrom@lanternandscroll.com',
    category: 'Exterior Lighting',
    description: 'Copper exterior lighting package — 3x OV240 wall mount, 1x CH23 hanging yoke, 9x CH42 wall mount + top mounts, 1x JS2 flush mount. All natural copper with dark patina finish.',
    total_amount: 13519,
    status: 'under_review',
    bid_date: '2025-11-29',
    received_date: '2025-11-29',
    source: 'document',
    source_document: 'Development/Bids/Electrical/Estimate 11711 - Case Outdoor Lighting.pdf',
    internal_notes: 'Estimate #11771, 6-8 week lead time, handmade copper fixtures',
    pros: 'Handcrafted copper, natural patina develops over time, high-end aesthetic',
    scope_of_work: 'Supply 14 copper outdoor lighting fixtures (wall mounts, hanging, flush mount)',
    lead_time_weeks: 7,
  },
  {
    vendor_name: 'Bevolo Gas & Electric Lights',
    vendor_contact: 'Heather Johnson',
    vendor_email: 'heather@bevolo.com',
    vendor_phone: '504-293-5688',
    category: 'Exterior Lighting',
    description: '9 copper lanterns — 2x French Quarter 18" bracket, 1x French Quarter 18" chain, 5x Williamsburg 22", 1x Williamsburg 18". Pre-discount $7,247 / ~$6,500 with 10% UBuildIt trade discount.',
    total_amount: 7247,
    status: 'under_review',
    bid_date: '2025-12-10',
    received_date: '2025-12-10',
    source: 'email',
    internal_notes: 'Quote #94022. 10% UBuildIt trade discount available (~$6,500 net). Competing with Lantern & Scroll for exterior lighting.',
    pros: 'Iconic Bevolo brand, copper patina, significantly cheaper than Lantern & Scroll',
    cons: 'Fewer fixtures (9 vs 14), different styles than Lantern & Scroll',
    scope_of_work: 'Supply 9 copper exterior lanterns (French Quarter and Williamsburg series)',
    lead_time_weeks: 5,
  },

  // === GARAGE DOORS ===
  {
    vendor_name: "Brown's Garage Doors",
    vendor_contact: 'Anise Brown',
    vendor_email: 'brownsgaragedoors@gmail.com',
    vendor_phone: '830-798-8009',
    category: 'Garage Doors',
    description: '1x 20x10 Amarr Heritage 3000 garage door (short panel, no windows) + Liftmaster 4690L wall mount opener',
    total_amount: 7150,
    status: 'under_review',
    bid_date: '2025-10-21',
    received_date: '2025-10-21',
    source: 'document',
    source_document: 'Development/Bids/Garage Doors/Browns Garage Door Bid.pdf',
    internal_notes: 'Estimate #5818, 6 week lead time, 75% deposit required',
    pros: 'Reputable local installer, Amarr Heritage is quality brand',
    scope_of_work: 'Supply and install 1 garage door + wall mount opener',
    payment_terms: '75% deposit, balance on completion',
    lead_time_weeks: 6,
  },

  // === FOUNDATION ENGINEERING ===
  {
    vendor_name: 'Synergetic Engineering',
    category: 'Foundation Engineering',
    description: 'Post-tension foundation design and engineering plans',
    total_amount: 2500,
    status: 'selected',
    bid_date: '2025-10-01',
    received_date: '2025-10-01',
    source: 'document',
    source_document: 'Development/Bids/Engineering Plans/708 Purple Salvia...Foundation Design...pdf',
    internal_notes: 'Development/Bids/Engineering Plans/708 Purple Salvia...Foundation Design...pdf',
    pros: 'Quick turnaround, already delivered plans',
    scope_of_work: 'PT slab foundation engineering design per structural requirements',
  },

  // === CIVIL ENGINEERING ===
  {
    vendor_name: 'Four A Engineering',
    category: 'Civil Engineering',
    description: 'Civil engineering — site plan, grading plan, drainage, SWPPP',
    total_amount: 5275,
    status: 'selected',
    bid_date: '2025-12-15',
    received_date: '2025-12-15',
    source: 'document',
    source_document: 'Development/Bids/Engineering Plans/Civil Engineering/',
    internal_notes: 'Development/Bids/Engineering Plans/Civil Engineering/',
    pros: 'Competitive price, good reviews, responsive',
    scope_of_work: 'Civil site plan, grading, drainage, erosion control, SWPPP',
  },
  {
    vendor_name: 'Lentz Engineering',
    category: 'Civil Engineering',
    description: 'Civil engineering — full site development plans',
    total_amount: 13000,
    status: 'rejected',
    bid_date: '2025-11-20',
    received_date: '2025-11-20',
    source: 'document',
    source_document: 'Development/Bids/Engineering Plans/Proposal-708 Purple Salvia.pdf',
    internal_notes: 'Development/Bids/Engineering Plans/Proposal-708 Purple Salvia.pdf',
    cons: 'More than 2x the cost of Four A Engineering',
    scope_of_work: 'Full civil engineering site plan package',
  },
]

async function main() {
  console.log('============================================')
  console.log('  Seed Bids Data')
  console.log('============================================')
  console.log(`  Bids to insert: ${BIDS.length}`)
  console.log('')

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

  // 2. Delete existing bids (idempotent)
  const { error: delErr } = await supabase
    .from('bids')
    .delete()
    .eq('project_id', project.id)

  if (delErr) {
    console.error('Error clearing bids:', delErr.message)
  } else {
    console.log('  Cleared existing bids')
  }

  // 3. Build records
  const records = BIDS.map(b => ({
    project_id: project.id,
    vendor_name: b.vendor_name,
    vendor_contact: b.vendor_contact || null,
    vendor_email: b.vendor_email || null,
    vendor_phone: b.vendor_phone || null,
    category: b.category,
    subcategory: b.subcategory || null,
    description: b.description,
    total_amount: b.total_amount,
    status: b.status,
    bid_date: b.bid_date,
    received_date: b.received_date,
    source: b.source,
    source_document: b.source_document || null,
    internal_notes: b.internal_notes || null,
    pros: b.pros || null,
    cons: b.cons || null,
    scope_of_work: b.scope_of_work || null,
    payment_terms: b.payment_terms || null,
    lead_time_weeks: b.lead_time_weeks || null,
    ai_extracted: false,
    needs_review: false,
  }))

  // 4. Insert
  const { error: insErr } = await supabase.from('bids').insert(records)
  if (insErr) {
    console.error('Error inserting bids:', insErr.message)
    process.exit(1)
  }

  // 5. Summary
  console.log('')
  console.log('============================================')
  console.log('  Results')
  console.log('============================================')
  console.log(`  Records inserted: ${records.length}`)

  const byCategory = new Map<string, { count: number; total: number }>()
  for (const b of BIDS) {
    const cat = byCategory.get(b.category) || { count: 0, total: 0 }
    cat.count++
    cat.total += b.total_amount
    byCategory.set(b.category, cat)
  }

  console.log('')
  console.log('  By category:')
  for (const [cat, info] of Array.from(byCategory.entries())) {
    console.log(`    ${cat.padEnd(25)} ${info.count} bids   $${info.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`)
  }

  const selectedTotal = BIDS
    .filter(b => b.status === 'selected')
    .reduce((sum, b) => sum + b.total_amount, 0)
  console.log('')
  console.log(`  Total committed (selected): $${selectedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`)
  console.log('============================================')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
