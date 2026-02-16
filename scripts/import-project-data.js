/**
 * Database Import Script for 708 Purple Salvia Cove
 *
 * This script populates the Supabase database with current project data
 * extracted from the Dropbox archive as of Feb 6, 2026.
 *
 * Usage: node scripts/import-project-data.js
 *
 * Requirements:
 * - NEXT_PUBLIC_SUPABASE_URL in .env.local
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ ERROR: Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Track imported IDs for foreign key relationships
const imported = {
  projectId: null,
  contacts: {},
  vendors: {},
  milestones: {},
  tasks: {}
}

const stats = {
  projects: 0,
  planningSteps: 0,
  contacts: 0,
  vendors: 0,
  budgetItems: 0,
  permits: 0,
  milestones: 0,
  tasks: 0,
  documents: 0,
  projectStatus: 0
}

/**
 * 1. INSERT PROJECT RECORD
 */
async function insertProject() {
  console.log('\n📁 Inserting project record...')

  const { data, error } = await supabase
    .from('projects')
    .insert([{
      name: '708 Purple Salvia Cove Custom Home',
      address: '708 Purple Salvia Cove, Liberty Hill, TX 78642',
      lot_info: 'Mesa Vista Ranch Phase 2, Lot 67, Block 1',
      square_footage: 7526,
      style: 'French Country Estate',
      phase: 'planning',
      current_step: 4,
      start_date: '2025-06-02',
      target_completion: null,
      budget_total: 1200000.00
    }])
    .select()

  if (error) throw error

  imported.projectId = data[0].id
  stats.projects = 1
  console.log(`✅ Project created with ID: ${imported.projectId}`)
}

/**
 * 2. INSERT PLANNING PHASE STEPS
 */
async function insertPlanningSteps() {
  console.log('\n📋 Inserting planning phase steps...')

  const steps = [
    {
      project_id: imported.projectId,
      step_number: 1,
      step_name: 'Dream Home & Site Selection',
      status: 'completed',
      start_date: '2025-03-01',
      completion_date: '2025-06-02',
      notes: 'Land purchased June 2, 2025. Mesa Vista Ranch Phase 2, Lot 67. $221,912 total.'
    },
    {
      project_id: imported.projectId,
      step_number: 2,
      step_name: 'Site Review & Evaluation',
      status: 'completed',
      start_date: '2025-06-03',
      completion_date: '2025-07-25',
      notes: 'Topographic survey completed by Texas Land Surveying ($2,529). UBuildIt engagement contract signed July 25, 2025.'
    },
    {
      project_id: imported.projectId,
      step_number: 3,
      step_name: 'Plan Development',
      status: 'completed',
      start_date: '2025-07-26',
      completion_date: '2025-12-17',
      notes: 'Architecture: Prince Development ($14,748) then Kipp Flores ($4,000). Final plans dated Dec 17, 2025 (main), Nov 19, 2025 (RV garage), Jan 13, 2026 (cabana). Engineering: Synergetic Foundation REV3 (Dec 4, 2025), Asiri Structural (in progress Feb 2026).'
    },
    {
      project_id: imported.projectId,
      step_number: 4,
      step_name: 'Cost Review & Specifications',
      status: 'in_progress',
      start_date: '2025-10-01',
      completion_date: null,
      notes: 'Budget analysis completed Oct 2025. Value engineering to $1.2M target. Flooring selected (Kristynik $105,448). Soliciting bids for windows/doors, septic, well, appliances. Civil engineering contracted (Four A - $5,275) Jan 14, 2026.'
    },
    {
      project_id: imported.projectId,
      step_number: 5,
      step_name: 'Financing',
      status: 'in_progress',
      start_date: '2026-01-01',
      completion_date: null,
      notes: 'One-Time Close Construction Loan in progress with Guild Mortgage. Documents prepared. Awaiting final approval.'
    },
    {
      project_id: imported.projectId,
      step_number: 6,
      step_name: 'Pre-Construction Preparation',
      status: 'not_started',
      start_date: null,
      completion_date: null,
      notes: 'Awaiting: Civil engineering plans (in progress), HOA approval, building permit. Ready to accept bids: Chuck F. site clearing ($15K), Bee Cave well drilling ($56,481).'
    }
  ]

  const { data, error } = await supabase
    .from('planning_phase_steps')
    .insert(steps)
    .select()

  if (error) throw error

  stats.planningSteps = data.length
  console.log(`✅ Inserted ${stats.planningSteps} planning phase steps`)
}

/**
 * 3. INSERT CONTACTS
 */
async function insertContacts() {
  console.log('\n👥 Inserting contacts...')

  const contacts = [
    // Architects
    { name: 'Kipp Flores', company: 'Kipp Flores Architects LLC', type: 'architect', role: 'Architect', notes: 'KFA-0465. Plans complete.' },

    // Engineers
    { name: 'Jeff King', company: 'Synergetic Engineering / 3DAYDESIGN.COM', email: 'projects@3daydesign.com', phone: '(512) 848-2671', type: 'engineer', role: 'Foundation Engineer', notes: 'REV3 complete Dec 4, 2025' },
    { name: 'Chase Howard', company: 'Asiri Design', email: 'chase@asiri-designs.com', type: 'engineer', role: 'Structural Engineer', notes: 'Detail drawings in progress (due Feb 7, 2026)' },
    { name: 'Sharif', company: 'Asiri Design', email: 'sharif@asiri-designs.com', type: 'engineer', role: 'Structural Engineer (Secondary)' },
    { name: 'Daniel J. Arredondo', company: 'Four A Engineering, LLC', email: 'daniel@fouraengineering.com', phone: '(512) 627-9671', type: 'engineer', role: 'Civil Engineer PE', notes: 'Contracted Jan 14, 2026. Project #25-648912. Grading plan draft delivered Jan 26.' },
    { name: 'Rafael Viera', company: 'Copeland Engineering', email: 'rdviera@copeland-eng.com', type: 'engineer', role: 'Structural Engineer', notes: 'Completed steel column addition Dec 2025' },

    // UBuildIt Team
    { name: 'Aaron Mischenko', company: 'UBuildIt - Williamson', email: 'aaronm.tx@ubuildit.com', phone: '(512) 828-3187', type: 'consultant', role: 'Planning & Operations Manager', is_ubuildit_team: true, track_emails: true },
    { name: 'John Trimble', company: 'UBuildIt - Williamson', email: 'johnt.tx@ubuildit.com', phone: '(737) 253-8422', type: 'consultant', role: 'Construction Consultant', is_ubuildit_team: true, track_emails: true },
    { name: 'Mike Trevino', company: 'UBuildIt', email: 'mike.trevino@ubuildit.com', type: 'consultant', is_ubuildit_team: true, track_emails: true },
    { name: 'Harry Savio', company: 'UBuildIt', email: 'harry.savio@ubuildit.com', type: 'consultant', is_ubuildit_team: true, track_emails: true },

    // Contractors
    { name: 'Kristynik Hardwood Flooring', company: 'Kristynik Hardwood Flooring, Inc.', phone: '(512) 238-8035', type: 'contractor', role: 'Flooring Contractor', notes: 'Contract $105,448. Deposit $38,507 paid.' },
    { name: 'Chuck F.', company: 'Triple C Septic', email: 'triplecseptic@yahoo.com', type: 'contractor', role: 'Septic & Excavation', notes: 'Bids: Septic $25,210, Site Clearing $15,000' },
    { name: 'Paul Swoyer', company: 'Paul Swoyer Septics LLC', type: 'contractor', role: 'Septic System', notes: 'Bid: $44,850 (1500 GPD aerobic + drip field)' },
    { name: 'Bee Cave Drilling', company: 'Bee Cave Drilling', type: 'contractor', role: 'Well Drilling', notes: 'Bid: $56,481. 560ft limestone well, constant pressure system.' },

    // Vendors
    { name: 'Tina', company: 'Prestige Steel', type: 'vendor', role: 'Sales Representative', notes: 'Windows & Doors. Thermally Broken bid: $68,446' },
    { name: 'Aaron M. Burden', company: 'FBS Appliances / Tri Supply', email: 'amburden@trisupply.net', phone: '(512) 916-9354', type: 'vendor', role: 'Appliance Specialist', notes: 'Value engineered package ~$165K' },
    { name: 'Kim', company: 'Stone Systems', type: 'vendor', role: 'Stone Fabrication', notes: 'Bid: $42,905. Awaiting final selections.' },
    { name: 'Jay Hale', company: 'Build Your Own Pool (BYOP)', email: 'jay@byop.net', phone: '(210) 364-6884', type: 'consultant', role: 'Pool Designer', notes: 'Design in progress. Coordinating with civil engineer.' },

    // Survey
    { name: 'Nicole', company: 'Texas Land Surveying, Inc.', email: 'nicole@texas-ls.com', phone: '(512) 930-1600', type: 'other', role: 'Survey Coordinator', notes: 'TOPO survey complete. $2,529 paid.' },

    // Alternative Bids
    { name: 'Chris Dringenberg', company: 'Southwest Engineers', email: 'chris.dringenberg@swengineers.com', phone: '(512) 312-4336', type: 'engineer', role: 'Civil Engineer (Alternative)', notes: 'Bid received, not selected' },
    { name: 'Ted Uwague', company: 'Lentz Engineering', email: 'ted@lentzengineering.com', type: 'engineer', role: 'Civil Engineer (Alternative)', notes: 'Bid $13,000, not selected' },
    { name: 'Christopher Willis', company: 'Builder.com / BLDR', email: 'Christopher.Willis@bldr.com', type: 'vendor', role: 'Lumber Supply', notes: 'Quote received Dec 9, 2025' },

    // Other
    { name: 'Seth Koppel', type: 'other', role: 'Real Estate Agent', notes: 'Agent for land purchase' },
    { name: 'Travis', type: 'consultant', role: 'Septic Designer', notes: 'Inquiry sent Jan 28, 2026' }
  ]

  for (const contact of contacts) {
    const { data, error } = await supabase
      .from('contacts')
      .insert([{ ...contact, project_id: imported.projectId }])
      .select()

    if (error) {
      console.error(`⚠️  Failed to insert contact: ${contact.name}`, error.message)
    } else {
      imported.contacts[contact.name] = data[0].id
      stats.contacts++
    }
  }

  console.log(`✅ Inserted ${stats.contacts} contacts`)
}

/**
 * 4. INSERT VENDORS
 */
async function insertVendors() {
  console.log('\n🏢 Inserting vendors...')

  const vendors = [
    {
      project_id: imported.projectId,
      company_name: 'Kipp Flores Architects LLC',
      category: 'Architecture',
      status: 'completed',
      email_domains: ['@kippflores.com'],
      auto_track_emails: true,
      added_date: '2025-07-01',
      notes: 'KFA-0465. Plans complete Dec 17, 2025.'
    },
    {
      project_id: imported.projectId,
      company_name: 'Synergetic Engineering LLC / 3DAYDESIGN.COM',
      category: 'Foundation Engineering',
      status: 'completed',
      email_domains: ['@3daydesign.com'],
      auto_track_emails: true,
      added_date: '2025-09-01',
      notes: 'Foundation engineering REV3 complete. $2,500 paid.'
    },
    {
      project_id: imported.projectId,
      company_name: 'Asiri Design',
      category: 'Structural Engineering',
      status: 'active',
      email_domains: ['@asiri-designs.com'],
      auto_track_emails: true,
      added_date: '2025-12-02',
      notes: 'Detail drawings in progress. Due Feb 7, 2026.'
    },
    {
      project_id: imported.projectId,
      company_name: 'Four A Engineering, LLC',
      category: 'Civil Engineering',
      status: 'active',
      email_domains: ['@fouraengineering.com'],
      auto_track_emails: true,
      added_date: '2026-01-14',
      notes: 'Project #25-648912. Contracted $5,275. Retainer $3,165 paid. Grading plan in review.'
    },
    {
      project_id: imported.projectId,
      company_name: 'UBuildIt - Williamson',
      category: 'Construction Consulting',
      status: 'active',
      email_domains: ['@ubuildit.com'],
      auto_track_emails: true,
      added_date: '2025-07-25',
      notes: 'Texas Home Consulting LLC. $5,000 engagement fee paid. Contract $7.75/sq ft.'
    },
    {
      project_id: imported.projectId,
      company_name: 'Kristynik Hardwood Flooring, Inc.',
      category: 'Flooring',
      status: 'active',
      added_date: '2025-07-19',
      notes: 'Contract $105,448 total. Deposit $38,507 paid. Balance $66,941. Monarch Manor European Oak.'
    },
    {
      project_id: imported.projectId,
      company_name: 'Prestige Steel',
      category: 'Windows & Doors',
      status: 'potential',
      auto_track_emails: true,
      added_date: '2025-05-01',
      notes: 'Recommended: Thermally Broken $68,446. Lead time 8-15 weeks - CRITICAL PATH.'
    },
    {
      project_id: imported.projectId,
      company_name: 'FBS Appliances / Tri Supply',
      category: 'Appliances',
      status: 'potential',
      email_domains: ['@trisupply.net'],
      auto_track_emails: true,
      added_date: '2025-08-22',
      notes: 'Value engineered package ~$165K. Includes La Cornue $88,800 (16-week lead).'
    },
    {
      project_id: imported.projectId,
      company_name: 'Triple C Septic',
      category: 'Septic & Excavation',
      status: 'potential',
      added_date: '2025-10-05',
      notes: 'Aerobic: $25,210. Site clearing: $15,000. Need scope clarification.'
    },
    {
      project_id: imported.projectId,
      company_name: 'Bee Cave Drilling',
      category: 'Well Drilling',
      status: 'potential',
      added_date: '2025-09-24',
      notes: 'Bid $56,481. 560ft limestone well, constant pressure. Ready to accept.'
    },
    {
      project_id: imported.projectId,
      company_name: 'Stone Systems',
      category: 'Countertops',
      status: 'potential',
      added_date: '2025-10-01',
      notes: 'Bid $42,905. Incomplete - awaiting utility room & study color selections.'
    },
    {
      project_id: imported.projectId,
      company_name: 'Build Your Own Pool (BYOP)',
      category: 'Pool Design & Construction',
      status: 'potential',
      email_domains: ['@byop.net'],
      auto_track_emails: true,
      added_date: '2026-02-04',
      notes: 'Design in progress. Coordinating with civil engineer for placement.'
    }
  ]

  for (const vendor of vendors) {
    const { data, error } = await supabase
      .from('vendors')
      .insert([vendor])
      .select()

    if (error) {
      console.error(`⚠️  Failed to insert vendor: ${vendor.company_name}`, error.message)
    } else {
      imported.vendors[vendor.company_name] = data[0].id
      stats.vendors++
    }
  }

  console.log(`✅ Inserted ${stats.vendors} vendors`)
}

/**
 * 5. INSERT BUDGET ITEMS
 */
async function insertBudgetItems() {
  console.log('\n💰 Inserting budget items...')

  const budgetItems = [
    // PAID
    {
      project_id: imported.projectId,
      category: 'Land Acquisition',
      subcategory: 'Property Purchase',
      description: '708 Purple Salvia Cove - Mesa Vista Ranch Ph 2 Lot 67',
      estimated_cost: 221911.95,
      actual_cost: 221911.95,
      status: 'paid',
      approval_date: '2025-06-02',
      payment_date: '2025-06-02',
      notes: 'Closing completed June 2, 2025. Includes all closing costs and fees.'
    },
    {
      project_id: imported.projectId,
      category: 'Soft Costs',
      subcategory: 'Architectural Services',
      description: 'Prince Development LLC - Initial Design',
      estimated_cost: 14748.00,
      actual_cost: 14748.00,
      status: 'paid',
      payment_date: '2025-06-24',
      notes: 'Two payments: $4,805 (3/11/25) + $9,943 (6/24/25)'
    },
    {
      project_id: imported.projectId,
      category: 'Soft Costs',
      subcategory: 'Architectural Services',
      description: 'Kipp Flores Architects LLC - Final Design',
      estimated_cost: 4000.00,
      actual_cost: 4000.00,
      status: 'paid',
      payment_date: '2025-10-01',
      notes: 'Plans dated Dec 17, 2025 (main), Nov 19, 2025 (RV garage), Jan 13, 2026 (cabana)'
    },
    {
      project_id: imported.projectId,
      category: 'Soft Costs',
      subcategory: 'Survey',
      description: 'Texas Land Surveying - Topographic Survey',
      estimated_cost: 2528.65,
      actual_cost: 2528.65,
      status: 'paid',
      payment_date: '2025-07-25',
      notes: 'Invoice #210038-TOPO. TOPO & TREE SURVEY completed.'
    },
    {
      project_id: imported.projectId,
      category: 'Soft Costs',
      subcategory: 'Engineering',
      description: 'Synergetic Engineering - Foundation Design',
      estimated_cost: 2500.00,
      actual_cost: 2500.00,
      status: 'paid',
      payment_date: '2025-10-07',
      notes: 'REV3 dated Dec 4, 2025. Includes pre-pour certification.'
    },
    {
      project_id: imported.projectId,
      category: 'Soft Costs',
      subcategory: 'Engineering',
      description: 'Four A Engineering - Civil Engineering (Retainer)',
      estimated_cost: 5275.00,
      actual_cost: 3165.00,
      status: 'paid',
      approval_date: '2026-01-14',
      payment_date: '2026-01-14',
      notes: 'Project #25-648912. Balance $2,110 due on completion.'
    },
    {
      project_id: imported.projectId,
      category: 'Construction Consulting',
      subcategory: 'Owner-Builder Services',
      description: 'UBuildIt Williamson - Engagement Fee',
      estimated_cost: 15000.00,
      actual_cost: 5000.00,
      status: 'paid',
      approval_date: '2025-07-25',
      payment_date: '2025-08-04',
      notes: '$7.75/sq ft minimum $15K. Balance due at milestones.'
    },
    {
      project_id: imported.projectId,
      category: 'Finishes',
      subcategory: 'Flooring',
      description: 'Kristynik Hardwood Flooring - Deposit (50%)',
      estimated_cost: 105448.00,
      actual_cost: 38507.00,
      status: 'paid',
      approval_date: '2025-08-04',
      payment_date: '2025-08-11',
      notes: 'Total $105,448 ($77,014 + $28,434 change order). Balance $66,941.'
    },

    // APPROVED (Contracted but unpaid)
    {
      project_id: imported.projectId,
      category: 'Soft Costs',
      subcategory: 'Engineering',
      description: 'Four A Engineering - Civil Engineering (Balance)',
      estimated_cost: 2110.00,
      actual_cost: null,
      status: 'approved',
      approval_date: '2026-01-14',
      notes: 'Balance due on completion of grading and utilities plans.'
    },
    {
      project_id: imported.projectId,
      category: 'Finishes',
      subcategory: 'Flooring',
      description: 'Kristynik Hardwood Flooring - Balance',
      estimated_cost: 66941.00,
      actual_cost: null,
      status: 'approved',
      notes: 'Progress billing: $38,507 (original) + $28,434 (change order)'
    },

    // BID RECEIVED (Ready to accept)
    {
      project_id: imported.projectId,
      category: 'Site Work',
      subcategory: 'Well Drilling',
      description: 'Bee Cave Drilling - 560ft Limestone Well System',
      estimated_cost: 56481.00,
      actual_cost: null,
      status: 'bid_received',
      notes: '560ft well, 1.5 HP pump, 2,500-gal tank, constant pressure. Ready to accept.'
    },
    {
      project_id: imported.projectId,
      category: 'Site Work',
      subcategory: 'Land Clearing',
      description: 'Chuck F. - Site Clearing & Grading',
      estimated_cost: 15000.00,
      actual_cost: null,
      status: 'bid_received',
      notes: 'Tree removal, burning, grading. 50% to start. Ready to accept.'
    },
    {
      project_id: imported.projectId,
      category: 'Envelope',
      subcategory: 'Windows & Doors',
      description: 'Prestige Steel - Thermally Broken (RECOMMENDED)',
      estimated_cost: 68446.00,
      actual_cost: null,
      status: 'bid_received',
      notes: '8-15 week lead time - CRITICAL PATH. Alternatives: $60K-$287K'
    },
    {
      project_id: imported.projectId,
      category: 'Appliances',
      subcategory: 'Kitchen & Laundry',
      description: 'FBS Appliances - Value Engineered Package',
      estimated_cost: 165000.00,
      actual_cost: null,
      status: 'bid_received',
      notes: 'La Cornue $88,800, Sub-Zero 48", Miele. 16-week lead for La Cornue.'
    },
    {
      project_id: imported.projectId,
      category: 'Site Work',
      subcategory: 'Septic System',
      description: 'Chuck F. Triple C Septic - Aerobic Spray',
      estimated_cost: 25210.00,
      actual_cost: null,
      status: 'bid_received',
      notes: 'Aerobic spray. Need scope clarification (GPD, field size, loam, service).'
    },
    {
      project_id: imported.projectId,
      category: 'Site Work',
      subcategory: 'Septic System',
      description: 'Paul Swoyer Septics - Aerobic (Alternative)',
      estimated_cost: 44850.00,
      actual_cost: null,
      status: 'bid_received',
      notes: '1500 GPD + 6,500 SF drip field + 20 loads loam + 2-yr service + design'
    },
    {
      project_id: imported.projectId,
      category: 'Finishes',
      subcategory: 'Countertops',
      description: 'Stone Systems - Marble/Quartz Countertops',
      estimated_cost: 42905.00,
      actual_cost: null,
      status: 'bid_received',
      notes: 'Dekton/Silestone. Incomplete - awaiting utility & study selections.'
    },

    // ESTIMATED (Bids needed)
    {
      project_id: imported.projectId,
      category: 'Foundation',
      subcategory: 'Concrete',
      description: 'Foundation Concrete - Post-Tension Slab',
      estimated_cost: 95000.00,
      actual_cost: null,
      status: 'estimated',
      notes: 'CRITICAL - Need PT slab specialist. Est $95K-$118K.'
    },
    {
      project_id: imported.projectId,
      category: 'Framing',
      subcategory: 'Lumber & Labor',
      description: 'Framing Contractor - Main & RV Garage',
      estimated_cost: 85000.00,
      actual_cost: null,
      status: 'estimated',
      notes: 'CRITICAL - Est $85K-$98K. Separate truss bid $28K-$34K.'
    },
    {
      project_id: imported.projectId,
      category: 'MEP',
      subcategory: 'HVAC',
      description: 'HVAC Contractor - 2-Zone Variable Speed',
      estimated_cost: 85000.00,
      actual_cost: null,
      status: 'estimated',
      notes: 'CRITICAL - Est $85K-$95K. Includes ERV. Long lead time.'
    },
    {
      project_id: imported.projectId,
      category: 'MEP',
      subcategory: 'Plumbing',
      description: 'Plumbing Contractor - Rough-In & Fixtures',
      estimated_cost: 35000.00,
      actual_cost: null,
      status: 'estimated',
      notes: 'CRITICAL - Rough $23K-$27K + Fixtures $12K-$15K.'
    },
    {
      project_id: imported.projectId,
      category: 'MEP',
      subcategory: 'Electrical',
      description: 'Electrical Contractor - Service & Rough-In',
      estimated_cost: 33000.00,
      actual_cost: null,
      status: 'estimated',
      notes: 'CRITICAL - Est $33K-$38K.'
    },
    {
      project_id: imported.projectId,
      category: 'Roofing',
      subcategory: 'Shingles',
      description: 'Roofing Contractor - Architectural Shingles',
      estimated_cost: 17000.00,
      actual_cost: null,
      status: 'estimated',
      notes: 'Est $17K-$22K.'
    },
    {
      project_id: imported.projectId,
      category: 'Insulation',
      subcategory: 'Spray Foam',
      description: 'Insulation Contractor - Spray Foam',
      estimated_cost: 16000.00,
      actual_cost: null,
      status: 'estimated',
      notes: 'Per UBuildIt specs. Est $16K-$20K.'
    },
    {
      project_id: imported.projectId,
      category: 'Drywall',
      subcategory: 'Hang & Finish',
      description: 'Drywall Contractor',
      estimated_cost: 18000.00,
      actual_cost: null,
      status: 'estimated',
      notes: 'Est $18K-$22K.'
    },
    {
      project_id: imported.projectId,
      category: 'Finishes',
      subcategory: 'Cabinetry',
      description: 'Cabinet Shop - Kitchen & Bathrooms',
      estimated_cost: 40000.00,
      actual_cost: null,
      status: 'estimated',
      notes: 'Semi-custom. Est $40K-$50K.'
    },
    {
      project_id: imported.projectId,
      category: 'Finishes',
      subcategory: 'Interior Doors & Trim',
      description: 'Trim Carpenter',
      estimated_cost: 23000.00,
      actual_cost: null,
      status: 'estimated',
      notes: 'Est $23K-$28K.'
    },
    {
      project_id: imported.projectId,
      category: 'Finishes',
      subcategory: 'Painting',
      description: 'Painting Contractor',
      estimated_cost: 15000.00,
      actual_cost: null,
      status: 'estimated',
      notes: 'Est $15K-$19K.'
    },
    {
      project_id: imported.projectId,
      category: 'Finishes',
      subcategory: 'Tile',
      description: 'Tile Contractor - Bath & Shower',
      estimated_cost: 25000.00,
      actual_cost: null,
      status: 'estimated',
      notes: 'Est $25K-$30K.'
    }
  ]

  for (const item of budgetItems) {
    const { error } = await supabase
      .from('budget_items')
      .insert([item])

    if (error) {
      console.error(`⚠️  Failed to insert budget item: ${item.description}`, error.message)
    } else {
      stats.budgetItems++
    }
  }

  console.log(`✅ Inserted ${stats.budgetItems} budget items`)

  // Calculate totals
  const paidTotal = budgetItems
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + (i.actual_cost || 0), 0)

  console.log(`   Total Paid: $${paidTotal.toLocaleString()}`)
}

/**
 * 6. INSERT PERMITS
 */
async function insertPermits() {
  console.log('\n📜 Inserting permits...')

  const permits = [
    {
      project_id: imported.projectId,
      type: 'HOA Architectural Review',
      status: 'not_started',
      notes: 'Mesa Vista HOA. Need: Plans, site plan, materials. Est 2-4 weeks.'
    },
    {
      project_id: imported.projectId,
      type: 'Building Permit',
      status: 'not_started',
      notes: 'Williamson County. Need: Civil plans, HOA approval, foundation cert. Est 4-6 weeks.'
    },
    {
      project_id: imported.projectId,
      type: 'Septic Permit',
      status: 'not_started',
      notes: 'Need: Septic contractor selection, design, County Health approval.'
    }
  ]

  const { data, error } = await supabase
    .from('permits')
    .insert(permits)
    .select()

  if (error) throw error

  stats.permits = data.length
  console.log(`✅ Inserted ${stats.permits} permits`)
}

/**
 * 7. INSERT PROJECT STATUS
 */
async function insertProjectStatus() {
  console.log('\n📊 Inserting project status snapshot...')

  const status = {
    project_id: imported.projectId,
    date: new Date().toISOString().split('T')[0],
    phase: 'planning',
    current_step: 4,
    progress_percentage: 15,
    hot_topics: [
      { priority: 'high', text: 'Civil engineering grading plan under review (Four A)' },
      { priority: 'high', text: 'Windows/Doors decision urgent - 8-15 week lead time' },
      { priority: 'medium', text: 'Septic contractor selection needed (Chuck F. vs Paul Swoyer)' },
      { priority: 'medium', text: 'HOA approval pending - application to be submitted' },
      { priority: 'medium', text: 'Construction loan approval in progress (Guild Mortgage)' }
    ],
    action_items: [
      { item: 'Finalize civil engineering grading plan', priority: 'critical', owner: 'Daniel Case', due: '2026-02-28' },
      { item: 'Select and order windows/doors', priority: 'critical', owner: 'Daniel Case', due: '2026-02-20' },
      { item: 'Accept Bee Cave well drilling bid ($56,481)', priority: 'high', owner: 'Daniel Case', due: '2026-02-15' },
      { item: 'Select septic contractor and finalize scope', priority: 'high', owner: 'Daniel Case', due: '2026-02-25' },
      { item: 'Submit HOA application', priority: 'high', owner: 'Daniel Case', due: '2026-03-01' }
    ],
    recent_decisions: [
      { date: '2026-01-14', decision: 'Contracted Four A Engineering for civil ($5,275)', impact: 'Critical path - enables permits' },
      { date: '2025-12-17', decision: 'Architectural plans finalized (Kipp Flores)', impact: 'Design complete - ready for permitting' },
      { date: '2025-10-04', decision: 'Value engineering plan to $1.2M budget', impact: 'Budget target set - deferred driveway' },
      { date: '2025-08-04', decision: 'Selected Kristynik flooring ($105,448)', impact: 'Major finish selection - premium oak' }
    ],
    budget_status: 'On Track (with value engineering)',
    budget_used: 289195.60,
    ai_summary: 'Pre-construction planning phase. Civil engineering in progress. Awaiting permits. Multiple contractor bids pending.'
  }

  const { error } = await supabase
    .from('project_status')
    .insert([status])

  if (error) throw error

  stats.projectStatus = 1
  console.log(`✅ Inserted project status snapshot`)
}

/**
 * MAIN EXECUTION
 */
async function main() {
  console.log('='.repeat(60))
  console.log('DATABASE IMPORT: 708 Purple Salvia Cove')
  console.log('='.repeat(60))
  console.log(`📅 Date: ${new Date().toISOString().split('T')[0]}`)
  console.log(`🔗 Supabase URL: ${supabaseUrl}`)

  try {
    await insertProject()
    await insertPlanningSteps()
    await insertContacts()
    await insertVendors()
    await insertBudgetItems()
    await insertPermits()
    await insertProjectStatus()

    console.log('\n' + '='.repeat(60))
    console.log('✅ IMPORT COMPLETE!')
    console.log('='.repeat(60))
    console.log('\n📊 Summary:')
    console.log(`   Projects: ${stats.projects}`)
    console.log(`   Planning Steps: ${stats.planningSteps}`)
    console.log(`   Contacts: ${stats.contacts}`)
    console.log(`   Vendors: ${stats.vendors}`)
    console.log(`   Budget Items: ${stats.budgetItems}`)
    console.log(`   Permits: ${stats.permits}`)
    console.log(`   Project Status: ${stats.projectStatus}`)
    console.log(`\n   Project ID: ${imported.projectId}`)
    console.log('\n✨ Database is ready! You can now:')
    console.log('   1. Run the app: npm run dev')
    console.log('   2. Connect Gmail for email sync')
    console.log('   3. Review data in dashboard')
    console.log('\n')

  } catch (error) {
    console.error('\n❌ IMPORT FAILED!')
    console.error('Error:', error.message)
    console.error('\nPartial import completed:')
    console.error(stats)
    process.exit(1)
  }
}

main()
