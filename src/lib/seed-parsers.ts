/**
 * Seed Parsers & Runner
 * Parses structured project documents (JSON, CSV, Markdown) and populates Supabase.
 * Used by both the CLI seed script and the /api/admin/seed endpoint.
 */

import * as fs from 'fs'
import * as path from 'path'
import { parse as csvParse } from 'csv-parse/sync'
import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================================
// Types
// ============================================================

export interface SeedResult {
  project: { id: string }
  counts: Record<string, number>
  errors: string[]
}

// ============================================================
// Utility Functions
// ============================================================

function parseDollar(val: string): number | null {
  if (!val) return null
  const cleaned = val.replace(/[$,\s]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

function mapBudgetStatus(bidStatus: string): 'estimated' | 'bid_received' | 'approved' | 'paid' {
  const s = bidStatus.toUpperCase()
  if (s.includes('PAID')) return 'paid'
  if (s.includes('KEEPING') || s.includes('INCLUDED') || s.includes('SELECTED')) return 'approved'
  if (s.includes('HAS BID') || s.includes('RECOMMENDED') || s.includes('COMPARE') ||
      s.includes('OPTION') || s.includes('OVER BUDGET') || s.includes('CONSIDER') ||
      s.includes('NEW BID')) return 'bid_received'
  return 'estimated'
}

function findVendorId(name: string | null, vendorMap: Map<string, string>): string | null {
  if (!name) return null
  const skip = ['TBD', 'Various', 'Reserve', 'Defer', 'Reduce', 'Already Done']
  if (skip.includes(name)) return null
  if (vendorMap.has(name)) return vendorMap.get(name)!
  // Partial match
  const lower = name.toLowerCase()
  const entries = Array.from(vendorMap.entries())
  for (const [key, id] of entries) {
    if (key.toLowerCase().includes(lower) || lower.includes(key.toLowerCase())) return id
  }
  return null
}

function walkDir(dir: string): string[] {
  const files: string[] = []
  if (!fs.existsSync(dir)) return files
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkDir(fullPath))
    } else {
      files.push(fullPath)
    }
  }
  return files
}

async function batchInsert(
  supabase: SupabaseClient, table: string, records: Record<string, unknown>[], batchSize = 50
): Promise<Record<string, unknown>[]> {
  const results: Record<string, unknown>[] = []
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize)
    const { data, error } = await supabase.from(table).insert(batch).select()
    if (error) {
      console.warn(`[seed] Warning inserting into ${table} (batch ${Math.floor(i / batchSize)}): ${error.message}`)
    }
    if (data) results.push(...data)
  }
  return results
}

// ============================================================
// Known Contacts (from VENDOR_DIRECTORY.md + PROJECT_SPECIFICATIONS.json)
// ============================================================

const KNOWN_CONTACTS = [
  { name: 'Aaron Mischenko', email: 'aaronm.tx@ubuildit.com', phone: '(737) 775-6134', company: 'UBuildIt - Williamson', role: 'Construction Consultant (Planning & Operations)', type: 'consultant' as const, is_ubuildit_team: true, track_emails: true },
  { name: 'John Trimble', email: 'johnt.tx@ubuildit.com', phone: '(512) 639-0125', company: 'UBuildIt - Williamson', role: 'Construction Consultant', type: 'consultant' as const, is_ubuildit_team: true, track_emails: true },
  { name: 'Chase Howard', email: 'chase@asiri-designs.com', phone: null, company: 'Asiri Design', role: 'Structural Engineer', type: 'engineer' as const, is_ubuildit_team: false, track_emails: true },
  { name: 'Sharif Asiri', email: 'sharif@asiri-designs.com', phone: '(503) 926-2531', company: 'Asiri Design', role: 'Structural Engineer', type: 'engineer' as const, is_ubuildit_team: false, track_emails: true },
  { name: 'Daniel Arredondo', email: 'daniel@fouraengineering.com', phone: '(512) 627-9671', company: 'Four A Engineering LLC', role: 'Civil Engineer, PE', type: 'engineer' as const, is_ubuildit_team: false, track_emails: true },
  { name: 'Jeff King', email: 'projects@3daydesign.com', phone: '(512) 848-2671', company: 'Synergetic Engineering LLC', role: 'Foundation Engineer / COO', type: 'engineer' as const, is_ubuildit_team: false, track_emails: true },
  { name: 'Aaron Burden', email: 'amburden@trisupply.net', phone: '(512) 916-9354', company: 'FBS Appliances / Tri Supply', role: 'Appliance Specialist', type: 'supplier' as const, is_ubuildit_team: false, track_emails: true },
  { name: 'Jay Hale', email: 'jay@byop.net', phone: '(210) 364-6884', company: 'Build Your Own Pool (BYOP)', role: 'Pool Designer', type: 'vendor' as const, is_ubuildit_team: false, track_emails: true },
  { name: 'Randy', email: 'randy@cobrastone.com', phone: null, company: 'CobraStone', role: 'Exterior Stone Sales', type: 'vendor' as const, is_ubuildit_team: false, track_emails: true },
  { name: 'Rafael Viera', email: 'rdviera@copeland-eng.com', phone: null, company: 'Copeland Engineering', role: 'Structural Engineer', type: 'engineer' as const, is_ubuildit_team: false, track_emails: true },
  { name: 'Matt Bonnette', email: 'MatthewB@kippflores.com', phone: null, company: 'Kipp Flores Architects LLC', role: 'Architect', type: 'architect' as const, is_ubuildit_team: false, track_emails: true },
  { name: 'Travis Weiser', email: 's.travis.weiser@gmail.com', phone: '(979) 224-7748', company: 'Independent', role: 'Septic Designer, PE', type: 'engineer' as const, is_ubuildit_team: false, track_emails: true },
  { name: 'Chuck F.', email: 'triplecseptic@yahoo.com', phone: null, company: 'Triple C Septic', role: 'Septic & Excavation Contractor', type: 'contractor' as const, is_ubuildit_team: false, track_emails: true },
  { name: 'Chris Dringenberg', email: 'chris.dringenberg@swengineers.com', phone: '(512) 312-4336', company: 'Southwest Engineers', role: 'Civil Engineer, Director of Land Development', type: 'engineer' as const, is_ubuildit_team: false, track_emails: false },
  { name: 'Ted Uwague', email: 'ted@lentzengineering.com', phone: null, company: 'Lentz Engineering', role: 'Civil Engineer', type: 'engineer' as const, is_ubuildit_team: false, track_emails: false },
  { name: 'Christopher Willis', email: 'Christopher.Willis@bldr.com', phone: null, company: 'Builder.com / BLDR', role: 'Lumber Sales', type: 'supplier' as const, is_ubuildit_team: false, track_emails: true },
  { name: 'Tina', email: null, phone: null, company: 'Doorwin / Luvindow', role: 'Windows Sales', type: 'supplier' as const, is_ubuildit_team: false, track_emails: false, notes: 'Contact info obtained via UBuildIt' },
  { name: 'Kim', email: null, phone: null, company: 'Stone Systems', role: 'Countertop Sales', type: 'vendor' as const, is_ubuildit_team: false, track_emails: false },
]

// ============================================================
// Known Vendors
// ============================================================

const KNOWN_VENDORS = [
  { company_name: 'Kipp Flores Architects LLC', category: 'architecture', status: 'completed' as const, email_domains: ['kippflores.com'], auto_track_emails: true, primary_contact_name: 'Matt Bonnette', notes: 'Project KFA-0465. Plans complete.' },
  { company_name: 'Synergetic Engineering LLC', category: 'foundation_engineering', status: 'active' as const, email_domains: ['3daydesign.com'], auto_track_emails: true, primary_contact_name: 'Jeff King', notes: 'Foundation design REV3 complete. Awaiting pre-pour cert.' },
  { company_name: 'Asiri Design', category: 'structural_engineering', status: 'active' as const, email_domains: ['asiri-designs.com'], auto_track_emails: true, primary_contact_name: 'Sharif Asiri', notes: 'Contracted Dec 2, 2025. 3 of 11 structural details delivered.' },
  { company_name: 'Texas Home Consulting LLC (UBuildIt)', category: 'construction_consulting', status: 'active' as const, email_domains: ['ubuildit.com'], auto_track_emails: true, primary_contact_name: 'Aaron Mischenko', notes: 'Fee: $7.75/sq ft (min $15K). Engagement fee $5K paid.' },
  { company_name: 'Kristynik Hardwood Flooring', category: 'flooring', status: 'active' as const, email_domains: [], auto_track_emails: false, notes: 'Contracted. $105,448 total. $38,507 deposit paid. Monarch Manor Barnsley European Oak.' },
  { company_name: 'Four A Engineering LLC', category: 'civil_engineering', status: 'active' as const, email_domains: ['fouraengineering.com'], auto_track_emails: true, primary_contact_name: 'Daniel Arredondo', notes: 'Contracted Jan 2026. $5,275 total, $3,165 retainer paid. Grading plan draft delivered.' },
  { company_name: 'Copeland Engineering', category: 'structural_engineering', status: 'completed' as const, email_domains: ['copeland-eng.com'], auto_track_emails: false, primary_contact_name: 'Rafael Viera', notes: 'Steel column added Dec 2025. Work complete.' },
  { company_name: 'FBS Appliances / Tri Supply', category: 'appliances', status: 'potential' as const, email_domains: ['trisupply.net'], auto_track_emails: true, primary_contact_name: 'Aaron Burden', notes: 'Value-engineered package ~$165K. Pending final confirmation.' },
  { company_name: 'Prestige Steel', category: 'windows_doors', status: 'potential' as const, email_domains: [], auto_track_emails: false, notes: 'Non-thermal $60,328 / Thermal $68,446 (recommended). 8-15 week lead.' },
  { company_name: 'Citadel', category: 'windows_doors', status: 'potential' as const, email_domains: [], auto_track_emails: false, notes: 'Hybrid triple pane. $203,985. Over budget.' },
  { company_name: 'Exclusive Windows & Doors', category: 'windows_doors', status: 'potential' as const, email_domains: [], auto_track_emails: false, notes: 'Weather Shield + Valor Steel. $286,649. Over budget.' },
  { company_name: 'Doorwin / Luvindow', category: 'windows_doors', status: 'potential' as const, email_domains: [], auto_track_emails: false, primary_contact_name: 'Tina', notes: 'V2 quote received. No single/double hung. No skylights.' },
  { company_name: 'Stone Systems', category: 'countertops', status: 'potential' as const, email_domains: [], auto_track_emails: false, primary_contact_name: 'Kim', notes: '$42,905. Incomplete - awaiting utility room + study color selections.' },
  { company_name: 'Triple C Septic', category: 'septic_excavation', status: 'potential' as const, email_domains: ['yahoo.com'], auto_track_emails: false, primary_contact_name: 'Chuck F.', notes: 'Conventional $21,010 / Aerobic $25,210. Also bid site clearing $15K.' },
  { company_name: 'Paul Swoyer Septics LLC', category: 'septic', status: 'potential' as const, email_domains: [], auto_track_emails: false, notes: 'Aerobic 1500 GPD + 6,500 SF drip field. $44,850.' },
  { company_name: 'Bee Cave Drilling', category: 'well_drilling', status: 'potential' as const, email_domains: [], auto_track_emails: false, notes: '560 ft limestone well. $56,481. Ready to accept.' },
  { company_name: 'Build Your Own Pool (BYOP)', category: 'pool', status: 'potential' as const, email_domains: ['byop.net'], auto_track_emails: true, primary_contact_name: 'Jay Hale', notes: 'Pool design in progress. Hardscape extension pending.' },
  { company_name: 'CobraStone', category: 'exterior_stone', status: 'potential' as const, email_domains: ['cobrastone.com'], auto_track_emails: true, primary_contact_name: 'Randy', notes: 'Bid requested Feb 13, 2026. Showroom visited.' },
  { company_name: 'Southwest Engineers', category: 'civil_engineering', status: 'potential' as const, email_domains: ['swengineers.com'], auto_track_emails: false, primary_contact_name: 'Chris Dringenberg', notes: 'Bid received, NOT selected. Went with Four A Engineering.' },
  { company_name: 'Lentz Engineering', category: 'civil_engineering', status: 'potential' as const, email_domains: ['lentzengineering.com'], auto_track_emails: false, primary_contact_name: 'Ted Uwague', notes: 'Bid $13,000. Not selected - higher than Four A.' },
  { company_name: 'Builder.com / BLDR', category: 'lumber_framing', status: 'potential' as const, email_domains: ['bldr.com'], auto_track_emails: false, primary_contact_name: 'Christopher Willis', notes: 'Lumber quote received Dec 2025.' },
  { company_name: 'AmeriSurveyors', category: 'survey', status: 'completed' as const, email_domains: [], auto_track_emails: false, notes: 'Land survey complete. $2,529 paid.' },
  { company_name: 'Prince Development', category: 'architecture', status: 'completed' as const, email_domains: [], auto_track_emails: false, notes: 'Preliminary design. $14,748 paid.' },
]

// ============================================================
// Known Bids
// ============================================================

const KNOWN_BIDS = [
  { vendor_name: 'Triple C Septic', category: 'Site Clearing', description: 'Tree removal & burning on-site, vegetation removal to bare soil, lot grading', total_amount: 15000, status: 'pending' as const, bid_date: '2025-10-05', source: 'document' },
  { vendor_name: 'Triple C Septic', category: 'Septic System', subcategory: 'Conventional Leaching', description: 'Conventional leaching chamber system. Installation $18,500 + Design/Permit $2,510.', total_amount: 21010, status: 'pending' as const, bid_date: '2025-10-05', source: 'document' },
  { vendor_name: 'Triple C Septic', category: 'Septic System', subcategory: 'Aerobic Spray', description: 'Aerobic spray system. Installation $22,500 + Design/Permit $2,710.', total_amount: 25210, status: 'pending' as const, bid_date: '2025-10-05', source: 'document' },
  { vendor_name: 'Paul Swoyer Septics LLC', category: 'Septic System', subcategory: 'Aerobic 1500 GPD', description: '1500 GPD aerobic + 6,500 SF drip field + 20 loads sandy loam + 2-yr service', total_amount: 44850, status: 'pending' as const, bid_date: '2025-10-05', source: 'document', inclusions: ['1500 GPD Aerobic Unit', '2000 gal pump tank', '6,500 SF drip field', '20 loads sandy loam', 'Permit & design ($3,500)', '2-year service ($550)', 'Tie-in other entities ($650)'] },
  { vendor_name: 'Bee Cave Drilling', category: 'Well Drilling', description: '560 ft limestone well, 1.5 HP submersible with controls, 2,500-gal poly storage, constant pressure system', total_amount: 56481, status: 'pending' as const, bid_date: '2025-10-05', source: 'document' },
  { vendor_name: 'Kristynik Hardwood Flooring', category: 'Flooring', subcategory: 'Original Contract', description: '3/4" x 9-1/2" Monarch Manor Barnsley European Oak. 4,778 SF.', total_amount: 77014, status: 'selected' as const, bid_date: '2025-10-01', source: 'document' },
  { vendor_name: 'Kristynik Hardwood Flooring', category: 'Flooring', subcategory: 'Change Order (Stairs/Attic)', description: 'Stairs to attic storage: 19 treads, 21 risers, 1 landing', total_amount: 28434, status: 'selected' as const, bid_date: '2025-10-01', source: 'document' },
  { vendor_name: 'Prestige Steel', category: 'Windows & Doors', subcategory: 'Non-Thermal', description: 'Steel windows and doors, non-thermally broken. Lowest cost option.', total_amount: 60328, status: 'under_review' as const, bid_date: '2025-10-01', source: 'document' },
  { vendor_name: 'Prestige Steel', category: 'Windows & Doors', subcategory: 'Thermally Broken', description: 'Steel windows and doors, thermally broken. Best value. RECOMMENDED.', total_amount: 68446, status: 'under_review' as const, bid_date: '2025-10-01', source: 'document', notes: 'Recommended option for energy efficiency' },
  { vendor_name: 'Citadel', category: 'Windows & Doors', subcategory: 'Hybrid Triple Pane', description: 'Thermal SS doors + aluminum windows, triple pane low-E. 14-15 week lead.', total_amount: 203985, status: 'under_review' as const, bid_date: '2025-10-01', source: 'document', notes: 'Over budget' },
  { vendor_name: 'Exclusive Windows & Doors', category: 'Windows & Doors', subcategory: 'Premium (Weather Shield + Valor)', description: 'Weather Shield + Valor Steel. Installation NOT included for Valor.', total_amount: 286649, status: 'under_review' as const, bid_date: '2025-10-01', source: 'document', notes: 'Over budget' },
  { vendor_name: 'FBS Appliances / Tri Supply', category: 'Appliances', description: 'Complete appliance package: La Cornue Grand Palais 180, Sub-Zero, Miele, Scotsman. Value-engineered.', total_amount: 165000, status: 'under_review' as const, bid_date: '2025-10-01', source: 'document' },
  { vendor_name: 'Stone Systems', category: 'Countertops', description: 'Marble countertops for kitchen and bathrooms. Incomplete - awaiting utility room and study color selections.', total_amount: 42905, status: 'under_review' as const, bid_date: '2025-10-01', source: 'document' },
  { vendor_name: 'Synergetic Engineering LLC', category: 'Foundation Engineering', description: 'Foundation design + pre-pour certification. Post-tension slab. REV3 complete.', total_amount: 2500, status: 'selected' as const, bid_date: '2025-09-01', source: 'document' },
  { vendor_name: 'Four A Engineering LLC', category: 'Civil Engineering', description: 'Site grading plan, drainage plan, underground utilities master plan. Retainer $3,165 paid.', total_amount: 5275, status: 'selected' as const, bid_date: '2026-01-14', source: 'document' },
  { vendor_name: 'Lentz Engineering', category: 'Civil Engineering', description: 'Civil engineering proposal. Higher priced than Four A.', total_amount: 13000, status: 'rejected' as const, bid_date: '2026-01-07', source: 'document', notes: 'Not selected - higher price than Four A Engineering' },
]

// ============================================================
// Action Items (from ACTION_ITEMS.md, last updated 2026-02-14)
// ============================================================

const ACTION_ITEMS = [
  { title: 'Resolve septic site plan delivery to Travis Weiser', description: 'BLOCKER: Confirm Matt Bonnette (KFA) sent the site plan CAD to Travis Weiser. Travis only received floor plans + survey, NOT the site plan. He needs: 708 PURPLE SALVIA COVE 01-28-26 30x42.pdf', priority: 'urgent' as const },
  { title: 'Follow up with Asiri on remaining structural details', description: 'Sharif Asiri delivered 3 of 11 structural transition details on Feb 13. Get timeline and cost for remaining 8 details. Confirm Kipp Flores received the 3 details.', priority: 'urgent' as const },
  { title: 'Windows & doors vendor decision', description: 'Assess Doorwin viewing results (Feb 13). Review V2 quote. Evaluate limitations: no single/double hung, no skylights, no brushed brass hardware. Source 7 skylights separately. Compare with Prestige Steel thermal ($68,446 recommended). Critical path: 8-15 week lead time.', priority: 'high' as const },
  { title: 'Follow up with CobraStone for exterior stone bid', description: 'Bid requested Feb 13. Plans sent. Showroom visited same day. Contact Randy at randy@cobrastone.com for bid timeline.', priority: 'high' as const },
  { title: 'Finalize civil engineering grading plan', description: 'Draft delivered Jan 26 by Four A Engineering. Resolve cabana placement adjustment before finalization. Request underground utilities plan once grading finalized. Coordinate with septic/well/pool placement.', priority: 'high' as const },
  { title: 'Follow up on pool design hardscape finalization', description: 'Follow up with Jay Hale (BYOP) on updated pool design. Last activity Feb 5 - working on extending hardscape. Coordinate finalized placement with Four A Engineering grading plan.', priority: 'high' as const },
  { title: 'Submit permitting applications', description: 'HOA application (Mesa Vista POA): needs final architectural plans, site plan, color/material selections. Blocked by civil engineering plan finalization. Building permit (Williamson County): needs approved civil + architectural plans + foundation cert.', priority: 'medium' as const },
  { title: 'Septic contractor selection', description: 'Compare bids apples-to-apples once Travis completes design. Chuck F. conventional $21,010 / aerobic $25,210 vs Paul Swoyer aerobic $44,850. Verify Chuck scope details.', priority: 'medium' as const },
  { title: 'Accept Bee Cave Drilling well bid', description: 'Accept $56,481 bid for 560 ft limestone well + 2,500-gal storage + constant pressure system. Coordinate timing with site work.', priority: 'medium' as const },
  { title: 'Confirm final appliance package with FBS', description: 'Last activity Feb 5 - updated quote with Miele finishes. Verify La Cornue Grand Palais 180 ($88,800) keeping per value engineering. Review lead times (La Cornue 16+ weeks). Total ~$165K.', priority: 'medium' as const },
  { title: 'Accept Chuck F. site clearing bid', description: 'Accept $15,000 bid for tree removal, vegetation clearing, and lot grading. Schedule after civil engineering approved.', priority: 'medium' as const },
  { title: 'Finalize construction loan', description: 'Guild Mortgage docs on file. Set up construction draw schedule.', priority: 'medium' as const },
  { title: 'Solicit remaining critical bids', description: 'Foundation concrete contractor, framing contractor, roofing contractor, HVAC contractor, plumbing rough-in, electrical rough-in. Need 3+ bids for critical path trades.', priority: 'medium' as const },
  { title: 'Update budget and documentation', description: 'Update Master_Construction_Budget.csv with current bid data. Reconcile with value engineering plan. Update expenses tracking (last comprehensive update Oct 2025).', priority: 'medium' as const },
]

// ============================================================
// Planning Phase Steps
// ============================================================

const PLANNING_STEPS = [
  { step_number: 1, step_name: 'Land Purchase', status: 'completed' as const, start_date: '2025-06-02', completion_date: '2025-06-02', notes: 'Land purchased for $221,912' },
  { step_number: 2, step_name: 'Design & Engineering', status: 'completed' as const, start_date: '2025-07-01', completion_date: '2025-12-17', notes: 'Architectural plans finalized Dec 17, 2025. Foundation engineering REV3 Dec 4, 2025.' },
  { step_number: 3, step_name: 'Permitting', status: 'not_started' as const, notes: 'Blocked by civil engineering plan finalization. HOA + Williamson County building permit needed.' },
  { step_number: 4, step_name: 'Procurement', status: 'in_progress' as const, start_date: '2025-10-01', notes: 'Flooring contracted. Window/door, septic, well, appliance decisions pending.' },
  { step_number: 5, step_name: 'Site Preparation', status: 'not_started' as const, notes: 'Chuck F. bid received ($15K). Waiting on permits and civil engineering.' },
  { step_number: 6, step_name: 'Construction Start', status: 'not_started' as const, notes: 'Target TBD. Requires permits, financing, and key contractor selection.' },
]

// ============================================================
// Selections (from PROJECT_SPECIFICATIONS.json appliances + specs)
// ============================================================

const KNOWN_SELECTIONS = [
  { room: 'Kitchen', category: 'appliance', product_name: 'La Cornue Grand Palais 180', brand: 'La Cornue', model_number: 'Grand Palais 180', finish: 'Pure White with SS trim', material: 'Cast iron / stainless steel', unit_price: 88800, total_price: 88800, status: 'selected', lead_time: '16 weeks', notes: 'OWNER REQUIREMENT - keeping despite value engineering. LP gas.' },
  { room: 'Kitchen', category: 'appliance', subcategory: 'Refrigeration', product_name: 'Sub-Zero 48" Built-In', brand: 'Sub-Zero', model_number: 'BI-48S/O', unit_price: 13000, total_price: 13000, status: 'considering', notes: 'Recommended single unit. Alternative: dual columns IC-30CI/IC-30FI at $39,000 (save ~$26K with single).' },
  { room: 'Kitchen', category: 'appliance', subcategory: 'Ovens & Dishwashers', product_name: 'Miele Oven/Steam/Dishwasher Package', brand: 'Miele', unit_price: 55000, total_price: 55000, status: 'selected', notes: '2 ovens, 1 steam oven, 2 dishwashers, cooktop, hood, microwave. Included in FBS package.' },
  { room: 'Whole House', category: 'flooring', product_name: 'Monarch Manor Barnsley European Oak', brand: 'Kristynik Hardwood', collection: 'Monarch Manor', finish: 'Prefinished', material: '3/4" x 9-1/2" Engineered European Oak', quantity: 4778, unit_price: 16.12, total_price: 77014, status: 'ordered', notes: 'Deposit $38,507 paid. Balance $66,941. Change order for stairs $28,434 additional.' },
  { room: 'Kitchen / Bathrooms', category: 'countertop', product_name: 'Marble Countertops', brand: 'Stone Systems', unit_price: 42905, total_price: 42905, status: 'considering', notes: 'OWNER REQUIREMENT - marble only. Incomplete - awaiting utility room + study color selections.' },
  { room: 'Whole House', category: 'windows', product_name: 'Steel Windows & Doors (Thermally Broken)', brand: 'Prestige Steel', unit_price: 68446, total_price: 68446, status: 'considering', lead_time: '8-15 weeks', notes: 'Recommended option. Also evaluating Doorwin/Luvindow and others.' },
]

// ============================================================
// CSV Parsing Functions
// ============================================================

// Simple CSV line parser that handles quoted fields with edge cases (inch marks, emojis)
function splitCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current.trim())
  return fields
}

export function parseBudgetCSV(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n').filter(l => l.trim())
  if (lines.length === 0) return []

  // Skip header line
  const dataLines = lines.slice(1)

  return dataLines
    .map(line => {
      const fields = splitCSVLine(line)
      return {
        phase_raw: fields[0] || '',
        category: fields[1] || '',
        item: fields[2] || '',
        vendor: fields[3] || null,
        bid_status: fields[4] || '',
        low: fields[5] || '',
        mid: fields[6] || '',
        high: fields[7] || '',
        notes: fields[8] || null,
      }
    })
    .filter(r => {
      const phase = r.phase_raw.trim()
      if (!phase || !/^\d+$/.test(phase)) return false
      if ((r.bid_status).toUpperCase().includes('REMOVED')) return false
      return true
    })
    .map(r => ({
      phase: parseInt(r.phase_raw),
      category: r.category.trim(),
      item: r.item.trim(),
      vendor: r.vendor?.trim() || null,
      bid_status: r.bid_status.trim(),
      low: parseDollar(r.low),
      mid: parseDollar(r.mid),
      high: parseDollar(r.high),
      notes: r.notes?.trim() || null,
    }))
}

export function parseTasksCSV(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const records: Record<string, string>[] = csvParse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  })

  const milestones: { task_id: number; name: string; description: string; phase: string }[] = []
  const tasks: { task_id: number; title: string; description: string; phase: string; parent_task_id: number | null; dependencies: string }[] = []

  for (const r of records) {
    const taskId = parseInt(r['TaskID'])
    if (isNaN(taskId)) continue

    // CSV has trailing commas, so Yes/No can shift into the Owner column
    const isParentFlag = (r['IsParentTask'] || r['Owner'] || '').trim().toLowerCase()
    const isParent = isParentFlag === 'yes'

    if (isParent) {
      milestones.push({
        task_id: taskId,
        name: r['TaskName']?.trim() || '',
        description: r['Description']?.trim() || '',
        phase: r['Phase']?.trim() || '',
      })
    } else {
      tasks.push({
        task_id: taskId,
        title: r['TaskName']?.trim() || '',
        description: r['Description']?.trim() || '',
        phase: r['Phase']?.trim() || '',
        parent_task_id: r['ParentTaskID'] ? parseInt(r['ParentTaskID']) : null,
        dependencies: r['Dependencies']?.trim() || '',
      })
    }
  }

  return { milestones, tasks }
}

// ============================================================
// Document Scanner
// ============================================================

export function scanDocuments(basePath: string) {
  const docs: { name: string; file_url: string; category: string; file_type: string; description: string }[] = []
  const docExtensions = ['.pdf', '.csv', '.json', '.md', '.xlsx', '.xls', '.docx']

  const scanDirs: { dir: string; category: string }[] = [
    { dir: 'Development/Design/Site Plan and Latest/Latest/FINAL', category: 'architectural_plans' },
    { dir: 'Development/Design/Engineering Plans', category: 'engineering' },
    { dir: 'Development/Bids', category: 'bids' },
    { dir: 'Development/Expenses', category: 'financial' },
    { dir: 'Development/Permitting', category: 'permits' },
    { dir: 'HOA', category: 'hoa' },
  ]

  for (const { dir, category } of scanDirs) {
    const fullDir = path.join(basePath, dir)
    const files = walkDir(fullDir)

    for (const filePath of files) {
      const ext = path.extname(filePath).toLowerCase()
      if (!docExtensions.includes(ext)) continue

      const relativePath = path.relative(basePath, filePath)
      const fileName = path.basename(filePath)

      docs.push({
        name: fileName,
        file_url: relativePath.replace(/\\/g, '/'),
        category,
        file_type: ext.replace('.', ''),
        description: `${category.replace(/_/g, ' ')} - ${fileName}`,
      })
    }
  }

  return docs
}

// ============================================================
// Main Seed Runner
// ============================================================

export async function runSeed(supabase: SupabaseClient, docPath: string): Promise<SeedResult> {
  const result: SeedResult = { project: { id: '' }, counts: {}, errors: [] }
  const log = (msg: string) => console.log(`[seed] ${msg}`)

  try {
    // ---- 1. Get or create project ----
    log('Getting or creating project...')
    // Use ilike for partial match in case address was updated with zip code
    const { data: existingProject } = await supabase
      .from('projects')
      .select('id')
      .ilike('address', '%708 Purple Salvia Cove%')
      .limit(1)
      .single()

    let projectId: string

    if (existingProject) {
      projectId = existingProject.id
      log(`Found existing project: ${projectId}`)
    } else {
      const { data: newProject, error: createErr } = await supabase
        .from('projects')
        .insert({
          name: '708 Purple Salvia Cove - French Country Estate',
          address: '708 Purple Salvia Cove, Liberty Hill, TX',
          phase: 'planning',
          budget_total: 1200000,
        })
        .select('id')
        .single()

      if (createErr || !newProject) {
        throw new Error(`Failed to create project: ${createErr?.message}`)
      }
      projectId = newProject.id
      log(`Created new project: ${projectId}`)
    }

    result.project.id = projectId

    // ---- 2. Update project with full details ----
    log('Updating project details...')
    const specsPath = path.join(docPath, 'Development', 'PROJECT_SPECIFICATIONS.json')
    let specs: Record<string, unknown> = {}
    if (fs.existsSync(specsPath)) {
      specs = JSON.parse(fs.readFileSync(specsPath, 'utf-8'))
    }

    const { error: updateErr } = await supabase
      .from('projects')
      .update({
        name: '708 Purple Salvia Cove - French Country Estate',
        address: '708 Purple Salvia Cove, Liberty Hill, TX 78642',
        lot_info: 'Mesa Vista Ranch Phase 2, Lot 67, Block 1',
        square_footage: 7526,
        style: 'French Country Estate',
        phase: 'planning',
        current_step: 4,
        start_date: '2025-06-02',
        budget_total: 1200000,
      })
      .eq('id', projectId)

    if (updateErr) {
      result.errors.push(`Project update failed: ${updateErr.message}`)
    }

    // ---- 3. Clear existing child data ----
    log('Clearing existing data for project...')
    const tablesToClear = [
      'project_status', 'bids', 'budget_items', 'tasks',
      'documents', 'permits', 'milestones', 'planning_phase_steps',
      'vendors', 'contacts',
    ]
    for (const table of tablesToClear) {
      const { error } = await supabase.from(table).delete().eq('project_id', projectId)
      if (error) log(`Warning: Could not clear ${table}: ${error.message}`)
    }
    // Try selections table (may not exist)
    try {
      await supabase.from('selections').delete().eq('project_id', projectId)
    } catch {
      // Table may not exist
    }

    // ---- 4. Insert contacts ----
    log('Inserting contacts...')
    const contactRecords = KNOWN_CONTACTS.map(c => ({
      project_id: projectId,
      name: c.name,
      email: c.email,
      phone: c.phone,
      company: c.company,
      role: c.role,
      type: c.type,
      is_ubuildit_team: c.is_ubuildit_team,
      track_emails: c.track_emails,
      notes: (c as Record<string, unknown>).notes || null,
    }))
    const insertedContacts = await batchInsert(supabase, 'contacts', contactRecords)
    result.counts.contacts = insertedContacts.length
    log(`  Inserted ${insertedContacts.length} contacts`)

    // Build contact lookup by name
    const contactMap = new Map<string, string>()
    for (const c of insertedContacts) {
      contactMap.set(c.name as string, c.id as string)
    }

    // ---- 5. Insert vendors ----
    log('Inserting vendors...')
    const vendorRecords = KNOWN_VENDORS.map(v => ({
      project_id: projectId,
      company_name: v.company_name,
      category: v.category,
      status: v.status,
      primary_contact: v.primary_contact_name ? contactMap.get(v.primary_contact_name) || null : null,
      email_domains: v.email_domains,
      auto_track_emails: v.auto_track_emails,
      notes: v.notes || null,
    }))
    const insertedVendors = await batchInsert(supabase, 'vendors', vendorRecords)
    result.counts.vendors = insertedVendors.length
    log(`  Inserted ${insertedVendors.length} vendors`)

    // Build vendor lookup by company_name
    const vendorMap = new Map<string, string>()
    for (const v of insertedVendors) {
      vendorMap.set(v.company_name as string, v.id as string)
    }

    // ---- 6. Insert milestones ----
    log('Parsing tasks CSV...')
    const tasksCSVPath = path.join(docPath, 'Construction Management', 'Construction_Tasks.csv')
    let milestones: { task_id: number; name: string; description: string; phase: string }[] = []
    let csvTasks: { task_id: number; title: string; description: string; phase: string; parent_task_id: number | null; dependencies: string }[] = []

    if (fs.existsSync(tasksCSVPath)) {
      const parsed = parseTasksCSV(tasksCSVPath)
      milestones = parsed.milestones
      csvTasks = parsed.tasks
    } else {
      log('  Warning: Construction_Tasks.csv not found')
    }

    log('Inserting milestones...')
    const milestoneRecords = milestones.map(m => ({
      project_id: projectId,
      name: m.name,
      description: m.description,
      status: 'pending',
      notes: `Phase: ${m.phase}`,
    }))
    const insertedMilestones = await batchInsert(supabase, 'milestones', milestoneRecords)
    result.counts.milestones = insertedMilestones.length
    log(`  Inserted ${insertedMilestones.length} milestones`)

    // Build milestone lookup by original task_id
    const milestoneMap = new Map<number, string>()
    for (let i = 0; i < milestones.length; i++) {
      if (insertedMilestones[i]) {
        milestoneMap.set(milestones[i].task_id, insertedMilestones[i].id as string)
      }
    }

    // ---- 7. Insert planning phase steps ----
    log('Inserting planning phase steps...')
    const stepRecords = PLANNING_STEPS.map(s => ({
      project_id: projectId,
      step_number: s.step_number,
      step_name: s.step_name,
      status: s.status,
      start_date: (s as Record<string, unknown>).start_date || null,
      completion_date: (s as Record<string, unknown>).completion_date || null,
      notes: s.notes || null,
    }))
    const insertedSteps = await batchInsert(supabase, 'planning_phase_steps', stepRecords)
    result.counts.planning_steps = insertedSteps.length
    log(`  Inserted ${insertedSteps.length} planning steps`)

    // ---- 8. Insert tasks (from CSV) ----
    log('Inserting construction tasks...')
    const taskRecords = csvTasks.map(t => ({
      project_id: projectId,
      milestone_id: t.parent_task_id ? milestoneMap.get(t.parent_task_id) || null : null,
      title: t.title,
      description: t.description,
      status: 'pending',
      priority: 'medium',
      notes: t.dependencies ? `Dependencies: Task IDs ${t.dependencies}. Phase: ${t.phase}` : `Phase: ${t.phase}`,
    }))
    const insertedTasks = await batchInsert(supabase, 'tasks', taskRecords)
    result.counts.tasks = insertedTasks.length
    log(`  Inserted ${insertedTasks.length} construction tasks`)

    // ---- 8b. Insert action items as standalone tasks ----
    log('Inserting action items...')
    const actionRecords = ACTION_ITEMS.map(a => ({
      project_id: projectId,
      title: a.title,
      description: a.description,
      status: 'pending',
      priority: a.priority,
      notes: 'Source: ACTION_ITEMS.md (Feb 2026). Pre-construction/planning phase task.',
    }))
    const insertedActions = await batchInsert(supabase, 'tasks', actionRecords)
    result.counts.action_items = insertedActions.length
    result.counts.tasks += insertedActions.length
    log(`  Inserted ${insertedActions.length} action items`)

    // ---- 9. Insert budget items ----
    log('Parsing budget CSV...')
    const budgetCSVPath = path.join(docPath, 'Development', 'Bids', 'Construction_Budget_COMPLETE_Oct_2025.csv')
    let budgetItems: ReturnType<typeof parseBudgetCSV> = []

    if (fs.existsSync(budgetCSVPath)) {
      budgetItems = parseBudgetCSV(budgetCSVPath)
    } else {
      log('  Warning: Construction_Budget_COMPLETE_Oct_2025.csv not found')
    }

    log('Inserting budget items...')
    const phaseNames: Record<number, string> = {
      0: 'Pre-Construction', 1: 'Site Prep', 2: 'Well & Septic',
      3: 'Foundation', 4: 'Framing & Roof', 5: 'Exterior Envelope',
      6: 'MEP & IAQ', 7: 'Interior Finishes', 8: 'Cabinetry & Millwork',
      9: 'Surfaces & Fixtures', 10: 'Appliances', 11: 'Driveway & Culverts',
      12: 'Contingency',
    }

    const budgetRecords = budgetItems.map(b => {
      const status = mapBudgetStatus(b.bid_status)
      return {
        project_id: projectId,
        category: `Phase ${b.phase} - ${phaseNames[b.phase] || b.category}`,
        subcategory: b.category,
        description: b.item + (b.notes ? ` (${b.notes})` : ''),
        estimated_cost: b.mid,
        actual_cost: status === 'paid' ? b.mid : null,
        vendor_id: findVendorId(b.vendor, vendorMap),
        status,
        payment_date: status === 'paid' ? '2025-10-01' : null,
        notes: b.notes,
      }
    })
    const insertedBudget = await batchInsert(supabase, 'budget_items', budgetRecords)
    result.counts.budget_items = insertedBudget.length
    log(`  Inserted ${insertedBudget.length} budget items`)

    // ---- 10. Insert bids ----
    log('Inserting bids...')
    const bidRecords = KNOWN_BIDS.map(b => ({
      project_id: projectId,
      vendor_id: findVendorId(b.vendor_name, vendorMap),
      vendor_name: b.vendor_name,
      category: b.category,
      subcategory: (b as Record<string, unknown>).subcategory || null,
      description: b.description,
      total_amount: b.total_amount,
      status: b.status,
      bid_date: b.bid_date,
      received_date: b.bid_date,
      source: b.source,
      ai_extracted: false,
      needs_review: false,
      inclusions: (b as Record<string, unknown>).inclusions || null,
      internal_notes: (b as Record<string, unknown>).notes || null,
      selection_notes: b.status === 'rejected' ? (b as Record<string, unknown>).notes as string || null : null,
    }))
    const insertedBids = await batchInsert(supabase, 'bids', bidRecords)
    result.counts.bids = insertedBids.length
    log(`  Inserted ${insertedBids.length} bids`)

    // ---- 11. Insert permits ----
    log('Inserting permits...')
    const permitRecords = [
      {
        project_id: projectId,
        type: 'HOA Approval',
        status: 'not_started',
        notes: 'Mesa Vista POA. Application at: Permitting/Mesa Vista HOA/New Home Construction Application.pdf. Needs: final architectural plans, site plan, color/material selections. Blocked by civil engineering plan finalization.',
      },
      {
        project_id: projectId,
        type: 'Building Permit',
        status: 'not_started',
        notes: 'Williamson County. Prerequisites: civil engineering plans, HOA approval, foundation engineering certification.',
      },
    ]
    const insertedPermits = await batchInsert(supabase, 'permits', permitRecords)
    result.counts.permits = insertedPermits.length
    log(`  Inserted ${insertedPermits.length} permits`)

    // ---- 12. Insert documents ----
    log('Scanning and registering documents...')
    const docRecords = scanDocuments(docPath).map(d => ({
      project_id: projectId,
      category: d.category,
      name: d.name,
      description: d.description,
      file_url: d.file_url,
      file_type: d.file_type,
    }))
    const insertedDocs = await batchInsert(supabase, 'documents', docRecords)
    result.counts.documents = insertedDocs.length
    log(`  Inserted ${insertedDocs.length} documents`)

    // ---- 13. Insert selections ----
    log('Inserting selections...')
    try {
      const selectionRecords = KNOWN_SELECTIONS.map(s => ({
        project_id: projectId,
        room: s.room,
        category: s.category,
        subcategory: (s as Record<string, unknown>).subcategory || null,
        product_name: s.product_name,
        brand: (s as Record<string, unknown>).brand || null,
        collection: (s as Record<string, unknown>).collection || null,
        model_number: (s as Record<string, unknown>).model_number || null,
        finish: (s as Record<string, unknown>).finish || null,
        material: (s as Record<string, unknown>).material || null,
        quantity: (s as Record<string, unknown>).quantity || 1,
        unit_price: s.unit_price,
        total_price: s.total_price,
        status: s.status,
        lead_time: (s as Record<string, unknown>).lead_time || null,
        notes: s.notes || null,
      }))
      const insertedSelections = await batchInsert(supabase, 'selections', selectionRecords)
      result.counts.selections = insertedSelections.length
      log(`  Inserted ${insertedSelections.length} selections`)
    } catch {
      log('  Selections table may not exist - skipping')
      result.counts.selections = 0
    }

    // ---- 14. Insert project status snapshot ----
    log('Inserting project status snapshot...')
    const today = new Date().toISOString().split('T')[0]
    const statusRecord = {
      project_id: projectId,
      date: today,
      phase: 'planning',
      current_step: 4,
      progress_percentage: 35,
      hot_topics: [
        'Septic site plan BLOCKER - Travis Weiser needs site plan from architect',
        'Windows/doors decision critical - 8-15 week lead time',
        'Asiri Design: only 3 of 11 structural details delivered',
        'Civil engineering grading plan under review - cabana adjustment needed',
      ],
      action_items: [
        'Resolve septic site plan delivery to Travis Weiser (URGENT)',
        'Make windows & doors vendor decision (HIGH)',
        'Follow up with Asiri on remaining 8 structural details (URGENT)',
        'Finalize civil engineering grading plan (HIGH)',
        'Follow up with CobraStone for exterior stone bid (HIGH)',
      ],
      recent_decisions: [
        'Four A Engineering contracted for civil engineering ($5,275) - Jan 2026',
        'Asiri Design contracted for structural details - Dec 2025',
        'Value engineering target set at $1.2M - keeping La Cornue, deferring driveway',
        'Flamberge Rotisserie removed from appliance package ($18,800 savings)',
      ],
      budget_status: 'on_track',
      budget_used: 292361,
    }

    const { data: statusData, error: statusErr } = await supabase
      .from('project_status')
      .upsert(statusRecord, { onConflict: 'project_id,date' })
      .select()

    if (statusErr) {
      log(`  Warning: project_status insert failed: ${statusErr.message}`)
      result.counts.project_status = 0
    } else {
      result.counts.project_status = statusData?.length || 0
      log(`  Inserted project status snapshot`)
    }

    log('')
    log('Seed completed successfully!')

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    result.errors.push(msg)
    console.error(`[seed] Fatal error: ${msg}`)
    if (error instanceof Error && error.stack) {
      console.error(error.stack)
    }
  }

  return result
}
