# Database Import Plan - 708 Purple Salvia Cove

**Generated:** 2026-02-11
**Data Source:** Dropbox folder (all files current as of Feb 6, 2026)
**Target Database:** Supabase (ubuildit-manager app)

---

## Executive Summary

This document outlines the plan to populate the ubuildit-manager database with accurate, current information about the 708 Purple Salvia Cove construction project. All data has been extracted from the comprehensive Dropbox archive.

### Current Project Status
- **Phase:** Pre-Construction (Planning Phase - Step 4-5 of 6)
- **Start Date:** June 2, 2025 (Land Purchase)
- **Target Budget:** $1,200,000
- **Total Square Footage:** 7,526 sq ft
- **Amount Spent to Date:** $289,196
- **Contracted but Unpaid:** $66,941+

---

## 1. PROJECT RECORD

### Table: `projects`

```sql
INSERT INTO projects (
  name,
  address,
  lot_info,
  square_footage,
  style,
  phase,
  current_step,
  start_date,
  target_completion,
  budget_total,
  created_at,
  updated_at
) VALUES (
  '708 Purple Salvia Cove Custom Home',
  '708 Purple Salvia Cove, Liberty Hill, TX 78642',
  'Mesa Vista Ranch Phase 2, Lot 67, Block 1',
  7526,
  'French Country Estate',
  'planning',
  4,
  '2025-06-02',
  NULL, -- TBD based on permit approval
  1200000.00,
  NOW(),
  NOW()
);
```

**Notes:**
- Current step is 4 (between Cost Review and Financing/Pre-Construction Prep)
- Land purchased June 2, 2025
- Architectural plans complete (Kipp Flores - Dec 17, 2025)
- Engineering complete: Foundation (Synergetic REV3), Structural (Asiri - in progress), Civil (Four A - contracted Jan 14, 2026)

---

## 2. PLANNING PHASE STEPS

### Table: `planning_phase_steps`

The UBuildIt process has 6 planning phase steps:

```javascript
const planningSteps = [
  {
    step_number: 1,
    step_name: 'Dream Home & Site Selection',
    status: 'completed',
    start_date: '2025-03-01',
    completion_date: '2025-06-02',
    notes: 'Land purchased June 2, 2025. Mesa Vista Ranch Phase 2, Lot 67. $221,912 total.'
  },
  {
    step_number: 2,
    step_name: 'Site Review & Evaluation',
    status: 'completed',
    start_date: '2025-06-03',
    completion_date: '2025-07-25',
    notes: 'Topographic survey completed by Texas Land Surveying ($2,529). UBuildIt engagement contract signed July 25, 2025.'
  },
  {
    step_number: 3,
    step_name: 'Plan Development',
    status: 'completed',
    start_date: '2025-07-26',
    completion_date: '2025-12-17',
    notes: 'Architecture: Prince Development ($14,748) then Kipp Flores ($4,000). Final plans dated Dec 17, 2025 (main), Nov 19, 2025 (RV garage), Jan 13, 2026 (cabana). Engineering: Synergetic Foundation REV3 (Dec 4, 2025), Asiri Structural (in progress Feb 2026).'
  },
  {
    step_number: 4,
    step_name: 'Cost Review & Specifications',
    status: 'in_progress',
    start_date: '2025-10-01',
    completion_date: null,
    notes: 'Budget analysis completed Oct 2025. Value engineering to $1.2M target. Flooring selected (Kristynik $105,448). Soliciting bids for windows/doors, septic, well, appliances. Civil engineering contracted (Four A - $5,275) Jan 14, 2026.'
  },
  {
    step_number: 5,
    step_name: 'Financing',
    status: 'in_progress',
    start_date: '2026-01-01',
    completion_date: null,
    notes: 'One-Time Close Construction Loan in progress with Guild Mortgage. Documents prepared. Awaiting final approval.'
  },
  {
    step_number: 6,
    step_name: 'Pre-Construction Preparation',
    status: 'not_started',
    start_date: null,
    completion_date: null,
    notes: 'Awaiting: Civil engineering plans (in progress), HOA approval, building permit. Ready to accept bids: Chuck F. site clearing ($15K), Bee Cave well drilling ($56,481).'
  }
];
```

---

## 3. CONTACTS & VENDORS

### Table: `contacts`

Total contacts to import: **24 individuals**

#### A. Contracted Vendors (Active)

1. **Kipp Flores** - Kipp Flores Architects LLC
   - Role: Architect
   - Company: Kipp Flores Architects LLC
   - Type: architect
   - Email: (from project files)
   - Status: Plans complete (KFA-0465)
   - Amount Paid: $4,000

2. **Jeff King** - Synergetic Engineering / 3DAYDESIGN.COM
   - Role: Foundation Engineer
   - Type: engineer
   - Email: projects@3daydesign.com
   - Phone: (512) 848-2671
   - Status: Complete (REV3 delivered)
   - Amount Paid: $2,500

3. **Chase Howard** - Asiri Design
   - Role: Structural Engineer
   - Type: engineer
   - Email: chase@asiri-designs.com
   - Status: In Progress (detail drawings due Feb 7, 2026)

4. **Sharif** - Asiri Design
   - Role: Structural Engineer (Secondary Contact)
   - Type: engineer
   - Email: sharif@asiri-designs.com

5. **Daniel J. Arredondo, PE** - Four A Engineering
   - Role: Civil Engineer
   - Type: engineer
   - Email: daniel@fouraengineering.com
   - Phone: (512) 627-9671
   - Status: Contracted Jan 14, 2026
   - Amount Paid: $3,165 (retainer)
   - Total Contract: $5,275

6. **Aaron Mischenko** - UBuildIt Williamson
   - Role: Planning & Operations Manager
   - Type: consultant
   - Email: aaronm.tx@ubuildit.com
   - Phone Office: (512) 828-3187
   - Phone Mobile: (737) 775-6134
   - is_ubuildit_team: true
   - track_emails: true
   - Amount Paid: $5,000 engagement fee

7. **John Trimble** - UBuildIt Williamson
   - Role: Construction Consultant
   - Type: consultant
   - Email: johnt.tx@ubuildit.com
   - Phone Office: (737) 253-8422
   - Phone Mobile: (512) 639-0125
   - is_ubuildit_team: true
   - track_emails: true

8. **Kristynik Hardwood Flooring, Inc.** (Company Contact)
   - Role: Flooring Contractor
   - Type: contractor
   - Phone: (512) 238-8035
   - Amount Paid: $38,507 (deposit)
   - Total Contract: $105,448

#### B. Pending Decision Vendors

9. **Tina** - Prestige Steel (Windows & Doors)
   - Role: Sales Representative
   - Type: vendor
   - Company: Prestige Steel
   - Pending Quote: $68,446 (Recommended: Thermally Broken)

10. **Aaron M. Burden** - FBS Appliances / Tri Supply
    - Role: Appliance Specialist
    - Type: vendor
    - Email: amburden@trisupply.net
    - Phone: (512) 916-9354
    - Pending Quote: ~$165,000 (value engineered)

11. **Chuck F.** - Triple C Septic
    - Role: Septic & Excavation
    - Type: contractor
    - Email: triplecseptic@yahoo.com
    - Pending Quotes:
      - Septic (Aerobic): $25,210
      - Site Clearing: $15,000

12. **Paul Swoyer** - Paul Swoyer Septics LLC
    - Role: Septic System (Alternative Bid)
    - Type: contractor
    - Pending Quote: $44,850

13. **Bee Cave Drilling** (Company Contact)
    - Role: Well Drilling
    - Type: contractor
    - Pending Quote: $56,481 (Ready to Accept)

14. **Kim** - Stone Systems
    - Role: Stone Fabrication
    - Type: vendor
    - Pending Quote: $42,905 (Incomplete - awaiting selections)

15. **Jay Hale** - Build Your Own Pool (BYOP)
    - Role: Pool Designer
    - Type: consultant
    - Email: jay@byop.net
    - Phone: (210) 364-6884
    - Status: Design in Progress

#### C. Alternative Bids (Not Selected)

16. **Chris Dringenberg** - Southwest Engineers
    - Role: Civil Engineer (Alternative)
    - Type: engineer
    - Email: chris.dringenberg@swengineers.com
    - Phone: (512) 312-4336 ext 212
    - Status: Bid received, not selected

17. **Ted Uwague** - Lentz Engineering
    - Role: Civil Engineer (Alternative)
    - Type: engineer
    - Email: ted@lentzengineering.com
    - Status: Bid $13,000, not selected

18. **Christopher Willis** - Builder.com / BLDR
    - Role: Lumber Supply
    - Type: vendor
    - Email: Christopher.Willis@bldr.com
    - Status: Quote received Dec 9, 2025

19. **Rafael Viera** - Copeland Engineering
    - Role: Structural Engineering (Additional)
    - Type: engineer
    - Email: rdviera@copeland-eng.com
    - Status: Completed Dec 2025 (steel column addition)

#### D. UBuildIt Team (Additional Contacts)

20. **Mike Trevino** - UBuildIt
    - Email: mike.trevino@ubuildit.com
    - is_ubuildit_team: true
    - track_emails: true

21. **Harry Savio** - UBuildIt
    - Email: harry.savio@ubuildit.com
    - is_ubuildit_team: true
    - track_emails: true

22. **Seth Koppel** - Real Estate Agent
    - Type: other
    - Notes: Agent for land purchase

23. **Travis** - Septic Designer
    - Role: Septic Design (Inquiry only)
    - Type: consultant
    - Status: Contacted Jan 28, 2026

24. **Nicole** - Texas Land Surveying
    - Email: nicole@texas-ls.com
    - Phone: (512) 930-1600
    - Company: Texas Land Surveying, Inc.
    - Amount Paid: $2,528.65

---

## 4. VENDORS TABLE

### Table: `vendors`

```javascript
const vendors = [
  {
    company_name: 'Kipp Flores Architects LLC',
    category: 'Architecture',
    status: 'completed',
    email_domains: ['@kippflores.com'],
    auto_track_emails: true,
    added_date: '2025-07-01'
  },
  {
    company_name: 'Synergetic Engineering LLC / 3DAYDESIGN.COM',
    category: 'Foundation Engineering',
    status: 'completed',
    email_domains: ['@3daydesign.com'],
    auto_track_emails: true,
    added_date: '2025-09-01'
  },
  {
    company_name: 'Asiri Design',
    category: 'Structural Engineering',
    status: 'active',
    email_domains: ['@asiri-designs.com'],
    auto_track_emails: true,
    added_date: '2025-12-02'
  },
  {
    company_name: 'Four A Engineering, LLC',
    category: 'Civil Engineering',
    status: 'active',
    email_domains: ['@fouraengineering.com'],
    auto_track_emails: true,
    added_date: '2026-01-14'
  },
  {
    company_name: 'UBuildIt - Williamson',
    category: 'Construction Consulting',
    status: 'active',
    email_domains: ['@ubuildit.com'],
    auto_track_emails: true,
    added_date: '2025-07-25'
  },
  {
    company_name: 'Kristynik Hardwood Flooring, Inc.',
    category: 'Flooring',
    status: 'active',
    email_domains: [],
    auto_track_emails: false,
    added_date: '2025-07-19'
  },
  {
    company_name: 'Prestige Steel',
    category: 'Windows & Doors',
    status: 'potential',
    auto_track_emails: true,
    added_date: '2025-05-01'
  },
  {
    company_name: 'FBS Appliances / Tri Supply',
    category: 'Appliances',
    status: 'potential',
    email_domains: ['@trisupply.net'],
    auto_track_emails: true,
    added_date: '2025-08-22'
  },
  {
    company_name: 'Triple C Septic',
    category: 'Septic & Excavation',
    status: 'potential',
    email_domains: ['@yahoo.com'],
    auto_track_emails: false,
    added_date: '2025-10-05'
  },
  {
    company_name: 'Bee Cave Drilling',
    category: 'Well Drilling',
    status: 'potential',
    auto_track_emails: false,
    added_date: '2025-09-24'
  },
  {
    company_name: 'Stone Systems',
    category: 'Countertops',
    status: 'potential',
    auto_track_emails: false,
    added_date: '2025-10-01'
  },
  {
    company_name: 'Build Your Own Pool (BYOP)',
    category: 'Pool Design & Construction',
    status: 'potential',
    email_domains: ['@byop.net'],
    auto_track_emails: true,
    added_date: '2026-02-04'
  }
];
```

---

## 5. BUDGET ITEMS

### Table: `budget_items`

#### A. COMPLETED PAYMENTS

```javascript
const completedPayments = [
  {
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
    category: 'Soft Costs',
    subcategory: 'Architectural Services',
    description: 'Kipp Flores Architects LLC - Final Design',
    estimated_cost: 4000.00,
    actual_cost: 4000.00,
    status: 'paid',
    payment_date: '2025-10-01',
    notes: 'Two payments of $2,000 each. Plans dated Dec 17, 2025 (main), Nov 19, 2025 (RV garage), Jan 13, 2026 (cabana)'
  },
  {
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
    category: 'Soft Costs',
    subcategory: 'Engineering',
    description: 'Synergetic Engineering - Foundation Design',
    estimated_cost: 2500.00,
    actual_cost: 2500.00,
    status: 'paid',
    payment_date: '2025-10-07',
    notes: 'Foundation engineering complete. REV3 dated Dec 4, 2025. Includes pre-pour certification.'
  },
  {
    category: 'Soft Costs',
    subcategory: 'Engineering',
    description: 'Four A Engineering - Civil Engineering (Retainer)',
    estimated_cost: 5275.00,
    actual_cost: 3165.00,
    status: 'approved',
    approval_date: '2026-01-14',
    payment_date: '2026-01-14',
    notes: 'Project #25-648912. Retainer $3,165 paid. Balance $2,110 due on completion. Grading plan draft delivered Jan 26, 2026.'
  },
  {
    category: 'Construction Consulting',
    subcategory: 'Owner-Builder Services',
    description: 'UBuildIt Williamson - Engagement Fee',
    estimated_cost: 15000.00,
    actual_cost: 5000.00,
    status: 'approved',
    approval_date: '2025-07-25',
    payment_date: '2025-08-04',
    notes: 'Contract signed 7/25/25. $7.75/sq ft minimum $15K. $5K engagement fee paid. Balance due at construction milestones.'
  },
  {
    category: 'Finishes',
    subcategory: 'Flooring',
    description: 'Kristynik Hardwood Flooring - Deposit (50%)',
    estimated_cost: 105448.00,
    actual_cost: 38507.00,
    status: 'approved',
    approval_date: '2025-08-04',
    payment_date: '2025-08-11',
    notes: 'Original contract $77,014 + Change Order $28,434 = $105,448 total. 50% deposit paid. Balance $66,941 due on progress billing. 4,778 sq ft Monarch Manor European Oak.'
  }
];
```

**TOTAL PAID TO DATE:** $289,195.60

#### B. CONTRACTED BUT UNPAID

```javascript
const contractedUnpaid = [
  {
    category: 'Soft Costs',
    subcategory: 'Engineering',
    description: 'Four A Engineering - Civil Engineering (Balance)',
    estimated_cost: 5275.00,
    actual_cost: 2110.00,
    status: 'approved',
    approval_date: '2026-01-14',
    notes: 'Balance due on completion of grading plan and utilities plan.'
  },
  {
    category: 'Construction Consulting',
    subcategory: 'Owner-Builder Services',
    description: 'UBuildIt Williamson - Balance',
    estimated_cost: 15000.00,
    actual_cost: 10000.00, // Estimated remaining
    status: 'approved',
    notes: 'Calculated: (7,526 sq ft × $7.75) - $5,000 engagement = ~$53,326.50 total - $5,000 = $48,326.50 balance. Verify calculation.'
  },
  {
    category: 'Finishes',
    subcategory: 'Flooring',
    description: 'Kristynik Hardwood Flooring - Balance',
    estimated_cost: 105448.00,
    actual_cost: 66941.00,
    status: 'approved',
    notes: 'Balance due on progress: $38,507 (original) + $28,434 (change order) = $66,941'
  }
];
```

**COMMITTED BUT UNPAID:** $66,941+ (known, UBuildIt balance TBD based on exact sq ft)

#### C. PENDING BIDS (Ready to Accept)

```javascript
const readyToAccept = [
  {
    category: 'Site Work',
    subcategory: 'Well Drilling',
    description: 'Bee Cave Drilling - 560ft Limestone Well System',
    estimated_cost: 56481.00,
    actual_cost: null,
    status: 'bid_received',
    notes: '560 ft limestone well, 1.5 HP pump, 2,500-gal poly tank, constant pressure system. Ready to accept.'
  },
  {
    category: 'Site Work',
    subcategory: 'Land Clearing',
    description: 'Chuck F. - Site Clearing & Grading',
    estimated_cost: 15000.00,
    actual_cost: null,
    status: 'bid_received',
    notes: 'Tree removal & burning on-site, vegetation to bare soil, lot grading. 50% to start. Ready to accept.'
  }
];
```

#### D. PENDING BIDS (Awaiting Decision)

```javascript
const awaitingDecision = [
  {
    category: 'Envelope',
    subcategory: 'Windows & Doors',
    description: 'Prestige Steel - Thermally Broken (RECOMMENDED)',
    estimated_cost: 68446.00,
    actual_cost: null,
    status: 'bid_received',
    notes: 'Recommended option. Alternative bids: Non-Thermal $60,328; Citadel $203,985; Exclusive $286,649. 8-15 week lead time - CRITICAL PATH.'
  },
  {
    category: 'Appliances',
    subcategory: 'Kitchen & Laundry',
    description: 'FBS Appliances - Value Engineered Package',
    estimated_cost: 165000.00,
    actual_cost: null,
    status: 'bid_received',
    notes: 'Includes La Cornue Grand Palais 180 ($88,800 - keeping), single Sub-Zero 48", Miele ovens/DW. Value engineered from $226K original bid. 16-week lead for La Cornue.'
  },
  {
    category: 'Site Work',
    subcategory: 'Septic System',
    description: 'Chuck F. Triple C Septic - Aerobic Spray',
    estimated_cost: 25210.00,
    actual_cost: null,
    status: 'bid_received',
    notes: 'Aerobic spray system. NEED SCOPE CLARIFICATION: GPD capacity, spray field size, sandy loam included?, service agreement?'
  },
  {
    category: 'Site Work',
    subcategory: 'Septic System',
    description: 'Paul Swoyer Septics - Aerobic (Alternative)',
    estimated_cost: 44850.00,
    actual_cost: null,
    status: 'bid_received',
    notes: '1500 GPD Aerobic + 2,000 pump tank + 6,500 SF drip field + 20 loads sandy loam + 2-yr service + design/permit. More expensive but comprehensive.'
  },
  {
    category: 'Finishes',
    subcategory: 'Countertops',
    description: 'Stone Systems - Marble/Quartz Countertops',
    estimated_cost: 42905.00,
    actual_cost: null,
    status: 'bid_received',
    notes: 'Dekton Daze kitchen, Silestone bathrooms. INCOMPLETE - awaiting utility room and study color selections.'
  }
];
```

#### E. BIDS NEEDED (Critical Path)

```javascript
const bidsNeeded = [
  {
    category: 'Foundation',
    subcategory: 'Concrete',
    description: 'Foundation Concrete Contractor - Post-Tension Slab',
    estimated_cost: 95000.00, // Mid-range from HTML estimate
    actual_cost: null,
    status: 'estimated',
    notes: 'CRITICAL - Need post-tension slab specialist. Synergetic foundation engineering complete (REV3). Estimated $95K-$118K per budget analysis.'
  },
  {
    category: 'Framing',
    subcategory: 'Lumber & Labor',
    description: 'Framing Contractor - Main House & RV Garage',
    estimated_cost: 85000.00,
    actual_cost: null,
    status: 'estimated',
    notes: 'CRITICAL - Estimated $85K-$98K. Separate truss bid needed ($28K-$34K).'
  },
  {
    category: 'Roofing',
    subcategory: 'Shingles',
    description: 'Roofing Contractor - Architectural Shingles',
    estimated_cost: 17000.00,
    actual_cost: null,
    status: 'estimated',
    notes: 'Estimated $17K-$22K per budget analysis.'
  },
  {
    category: 'MEP',
    subcategory: 'HVAC',
    description: 'HVAC Contractor - 2-Zone Variable Speed',
    estimated_cost: 85000.00,
    actual_cost: null,
    status: 'estimated',
    notes: 'CRITICAL - Estimated $85K-$95K. Includes ERV system integration. Long lead time.'
  },
  {
    category: 'MEP',
    subcategory: 'Plumbing',
    description: 'Plumbing Contractor - Rough-In & Fixtures',
    estimated_cost: 35000.00,
    actual_cost: null,
    status: 'estimated',
    notes: 'CRITICAL - Rough-in $23K-$27K + Fixtures $12K-$15K = $35K-$42K estimated.'
  },
  {
    category: 'MEP',
    subcategory: 'Electrical',
    description: 'Electrical Contractor - Service & Rough-In',
    estimated_cost: 33000.00,
    actual_cost: null,
    status: 'estimated',
    notes: 'CRITICAL - Estimated $33K-$38K per budget analysis.'
  },
  {
    category: 'Insulation',
    subcategory: 'Spray Foam',
    description: 'Insulation Contractor - Spray Foam',
    estimated_cost: 16000.00,
    actual_cost: null,
    status: 'estimated',
    notes: 'Per UBuildIt insulation specs. Estimated $16K-$20K.'
  },
  {
    category: 'Drywall',
    subcategory: 'Hang & Finish',
    description: 'Drywall Contractor',
    estimated_cost: 18000.00,
    actual_cost: null,
    status: 'estimated',
    notes: 'Estimated $18K-$22K per budget analysis.'
  },
  {
    category: 'Finishes',
    subcategory: 'Cabinetry',
    description: 'Cabinet Shop - Kitchen & Bathrooms',
    estimated_cost: 40000.00,
    actual_cost: null,
    status: 'estimated',
    notes: 'Semi-custom cabinets. Estimated $40K-$50K.'
  },
  {
    category: 'Finishes',
    subcategory: 'Interior Doors & Trim',
    description: 'Trim Carpenter - Doors, Casing, Baseboards',
    estimated_cost: 23000.00,
    actual_cost: null,
    status: 'estimated',
    notes: 'Estimated $23K-$28K per budget analysis.'
  },
  {
    category: 'Finishes',
    subcategory: 'Painting',
    description: 'Painting Contractor - Interior/Exterior',
    estimated_cost: 15000.00,
    actual_cost: null,
    status: 'estimated',
    notes: 'Estimated $15K-$19K per budget analysis.'
  },
  {
    category: 'Finishes',
    subcategory: 'Tile',
    description: 'Tile Contractor - Bath & Shower Tile',
    estimated_cost: 25000.00,
    actual_cost: null,
    status: 'estimated',
    notes: 'Estimated $25K-$30K per budget analysis.'
  }
];
```

---

## 6. TASKS & MILESTONES

### Construction Tasks CSV Analysis

The `Construction_Tasks.csv` file contains **148 tasks** organized into phases:
- Pre-construction (14 tasks)
- Design Finalization (9 tasks)
- Permitting (6 tasks)
- Procurement (23 tasks)
- Site Preparation (6 tasks)
- Foundation Construction (9 tasks)
- Framing (10 tasks)
- Roofing (6 tasks)
- Rough-In (7 tasks)
- Exterior Finishes (7 tasks)
- Insulation (4 tasks)
- Drywall (5 tasks)
- Interior Finishes (10 tasks)
- Mechanical Completion (6 tasks)
- Exterior Completion (6 tasks)
- Final Cleanup (3 tasks)
- Project Completion (7 tasks)

### Current Status Mapping

Based on ACTION_ITEMS.md and VENDOR_DIRECTORY.md:

**COMPLETED TASKS:**
- ✅ Complete Land Purchase (Task #4)
- ✅ Establish Initial Project Budget (Task #6)
- ✅ Conduct Land Survey and Site Plan (Task #9)
- ✅ Finalize Architectural Plans (Task #17)
- ✅ Complete Structural Engineering (Task #19) - 95% (Asiri details in progress)
- ✅ Complete Final Construction Documents (Task #25) - Plans complete
- ✅ Assemble Design/Engineering Team (Task #15)

**IN PROGRESS:**
- 🔄 Secure Construction Financing (Task #5) - Guild Mortgage in progress
- 🔄 Plan Utilities Access (Task #12) - Civil engineering contracted
- 🔄 Obtain HOA/Development Approval (Task #13) - Not yet submitted
- 🔄 Select multiple contractors (Tasks #33-49) - Flooring selected, others pending

**BLOCKED/CRITICAL PATH:**
- 🔴 Submit Building Permit Application (Task #26) - Blocked by: Civil engineering plans, HOA approval
- 🔴 Submit Septic Permit Application (Task #27) - Blocked by: Septic contractor selection
- 🔴 Obtain Building Permit Approval (Task #29) - Blocked by Task #26
- 🔴 Select Windows & Doors (Task #40) - CRITICAL: 8-15 week lead time

### Milestones to Create

```javascript
const milestones = [
  {
    name: 'Planning Phase Complete',
    description: 'Complete all 6 UBuildIt planning phase steps',
    target_date: '2026-04-01', // Estimated
    status: 'in_progress',
    dependencies: null
  },
  {
    name: 'Permits Approved',
    description: 'HOA approval + Building permit + Septic permit approved',
    target_date: '2026-05-15', // Estimated: 8-12 weeks from now
    status: 'pending',
    dependencies: JSON.stringify(['Planning Phase Complete'])
  },
  {
    name: 'Foundation Complete',
    description: 'Site cleared, well drilled, septic installed, foundation poured',
    target_date: '2026-07-01',
    status: 'pending',
    dependencies: JSON.stringify(['Permits Approved'])
  },
  {
    name: 'Dried-In (Weather Tight)',
    description: 'Framing complete, roof on, windows/doors installed',
    target_date: '2026-09-01',
    status: 'pending',
    dependencies: JSON.stringify(['Foundation Complete'])
  },
  {
    name: 'Rough-In Complete',
    description: 'All MEP rough-in (HVAC, plumbing, electrical) installed and inspected',
    target_date: '2026-10-15',
    status: 'pending',
    dependencies: JSON.stringify(['Dried-In (Weather Tight)'])
  },
  {
    name: 'Interior Finishes Complete',
    description: 'Drywall, paint, flooring, cabinets, countertops, fixtures installed',
    target_date: '2026-12-15',
    status: 'pending',
    dependencies: JSON.stringify(['Rough-In Complete'])
  },
  {
    name: 'Final Inspection & CO',
    description: 'Final inspection passed, Certificate of Occupancy issued',
    target_date: '2027-01-15',
    status: 'pending',
    dependencies: JSON.stringify(['Interior Finishes Complete'])
  }
];
```

---

## 7. PERMITS

### Table: `permits`

```javascript
const permits = [
  {
    type: 'HOA Architectural Review',
    permit_number: null,
    application_date: null,
    approval_date: null,
    status: 'not_started',
    notes: 'Mesa Vista HOA. Application in Permitting/Mesa Vista HOA/. Need: Final architectural plans, site plan, color/material selections. Estimated 2-4 weeks.'
  },
  {
    type: 'Building Permit',
    permit_number: null,
    application_date: null,
    approval_date: null,
    status: 'not_started',
    notes: 'Williamson County. Need: Civil engineering plans (in progress - Four A), HOA approval, foundation certification. Estimated 4-6 weeks after submission.'
  },
  {
    type: 'Septic Permit',
    permit_number: null,
    application_date: null,
    approval_date: null,
    status: 'not_started',
    notes: 'Need: Select septic contractor (Chuck F. vs Paul Swoyer), septic system design, County Health Department approval.'
  }
];
```

---

## 8. PROJECT STATUS SNAPSHOTS

### Table: `project_status`

Create initial snapshot for current date:

```javascript
const initialStatus = {
  date: '2026-02-11',
  phase: 'planning',
  current_step: 4,
  progress_percentage: 15, // Rough estimate: Planning ~20% of project, at step 4/6
  hot_topics: JSON.stringify([
    'Civil engineering grading plan under review (Four A)',
    'Windows/Doors decision urgent - 8-15 week lead time',
    'Septic contractor selection needed (Chuck F. vs Paul Swoyer)',
    'HOA approval pending - need to submit application',
    'Construction loan approval in progress (Guild Mortgage)'
  ]),
  action_items: JSON.stringify([
    { item: 'Finalize civil engineering grading plan', priority: 'critical', owner: 'Daniel Case', due: '2026-02-28' },
    { item: 'Select and order windows/doors', priority: 'critical', owner: 'Daniel Case', due: '2026-02-20' },
    { item: 'Accept Bee Cave well drilling bid ($56,481)', priority: 'high', owner: 'Daniel Case', due: '2026-02-15' },
    { item: 'Select septic contractor and finalize scope', priority: 'high', owner: 'Daniel Case', due: '2026-02-25' },
    { item: 'Submit HOA application', priority: 'high', owner: 'Daniel Case', due: '2026-03-01' },
    { item: 'Finalize FBS appliance package', priority: 'medium', owner: 'Daniel Case', due: '2026-02-28' }
  ]),
  recent_decisions: JSON.stringify([
    { date: '2026-01-14', decision: 'Contracted Four A Engineering for civil engineering ($5,275)', impact: 'Critical path - enables permit submission' },
    { date: '2025-12-17', decision: 'Architectural plans finalized (Kipp Flores)', impact: 'Design complete - ready for permitting' },
    { date: '2025-10-04', decision: 'Value engineering plan to $1.2M budget', impact: 'Budget target set - deferred concrete driveway, reduced appliances' },
    { date: '2025-08-04', decision: 'Selected Kristynik flooring ($105,448)', impact: 'Major finish selection complete - keeping premium oak' }
  ]),
  budget_status: 'On Track (with value engineering)',
  budget_used: 289195.60,
  ai_summary: null, // Will be generated by AI based on emails
  last_updated: new Date().toISOString()
};
```

---

## 9. DOCUMENTS

### Table: `documents`

Key documents to catalog (sample - full list would include all PDFs):

```javascript
const keyDocuments = [
  {
    category: 'Legal',
    name: 'Sales Contract - 708 Purple Salvia Cove',
    description: 'Property purchase agreement',
    file_url: 'Dropbox/Sales Contract.pdf',
    file_type: 'application/pdf',
    upload_date: '2025-06-02',
    tags: JSON.stringify(['contract', 'land-purchase', 'closing'])
  },
  {
    category: 'Plans',
    name: 'Main House Plans - Dec 17, 2025',
    description: 'Final architectural plans for main residence',
    file_url: 'Dropbox/Design/Site Plan and Latest/Latest/FINAL/Case Residence - 708 Purple Salvia Cove 12-17-25.pdf',
    file_type: 'application/pdf',
    upload_date: '2025-12-17',
    tags: JSON.stringify(['architectural-plans', 'main-house', 'final'])
  },
  {
    category: 'Plans',
    name: 'RV Garage Plans - Nov 19, 2025',
    description: 'Architectural plans for RV garage/gym',
    file_url: 'Dropbox/Design/Site Plan and Latest/Latest/FINAL/Case Residence RV Garage -11-19-25.pdf',
    file_type: 'application/pdf',
    upload_date: '2025-11-19',
    tags: JSON.stringify(['architectural-plans', 'rv-garage', 'final'])
  },
  {
    category: 'Plans',
    name: 'Cabana Plans - Jan 13, 2026',
    description: 'Architectural plans for pool cabana',
    file_url: 'Dropbox/Design/Site Plan and Latest/Latest/FINAL/KFA-0465 CASE CABANA 01-13-26.pdf',
    file_type: 'application/pdf',
    upload_date: '2026-01-13',
    tags: JSON.stringify(['architectural-plans', 'cabana', 'final'])
  },
  {
    category: 'Engineering',
    name: 'Foundation Engineering REV3',
    description: 'Foundation design by Synergetic Engineering',
    file_url: 'Dropbox/Design/Engineering Plans/Structural/708 Purple Salvia Cove foundation plan REV3 12-04-25.pdf',
    file_type: 'application/pdf',
    upload_date: '2025-12-04',
    tags: JSON.stringify(['engineering', 'foundation', 'structural'])
  },
  {
    category: 'Survey',
    name: 'Topographic Survey',
    description: 'TOPO & TREE SURVEY by Texas Land Surveying',
    file_url: 'Dropbox/Surveys/210038-TOPO_708 Purple Salvia Cove - TOPO & TREE SURVEY.pdf',
    file_type: 'application/pdf',
    upload_date: '2025-07-25',
    tags: JSON.stringify(['survey', 'topographic', 'trees'])
  },
  {
    category: 'Contracts',
    name: 'UBuildIt Contract',
    description: 'Construction consulting agreement',
    file_url: 'Dropbox/Expenses/06_UBuildIt_Construction_Consulting/Case_2024 UBuildIt Classic - Williamson - 11212024.pdf',
    file_type: 'application/pdf',
    upload_date: '2025-07-25',
    tags: JSON.stringify(['contract', 'consulting', 'ubuildit'])
  },
  {
    category: 'Contracts',
    name: 'Kristynik Flooring Contract',
    description: 'Hardwood flooring proposal #21646R',
    file_url: 'Dropbox/Expenses/05_Flooring_Kristynik/Est_21646R_from_Kristynik_Hardwood_Flooring_Inc._15476.pdf',
    file_type: 'application/pdf',
    upload_date: '2025-07-19',
    tags: JSON.stringify(['contract', 'flooring', 'kristynik'])
  }
];
```

---

## 10. EMAIL ACCOUNTS

### Table: `email_accounts`

```javascript
const emailAccounts = [
  {
    user_id: null, // Will be set based on Supabase auth
    email_address: 'danielcase@gmail.com', // Assumed from Gmail setup context
    provider: 'gmail',
    oauth_tokens: null, // To be set by user via Gmail OAuth flow
    sync_enabled: true,
    sync_frequency: 30, // minutes
    last_sync: null
  }
];
```

### Email Tracking Queries

Once Gmail is connected, sync emails from these senders (based on VENDOR_DIRECTORY.md):

```
from:(
  mike.trevino@ubuildit.com OR
  harry.savio@ubuildit.com OR
  aaron.mischenko@ubuildit.com OR
  johnt.tx@ubuildit.com OR
  @ubuildit.com OR
  @kippflores.com OR
  @asiri-designs.com OR
  @fouraengineering.com OR
  @3daydesign.com OR
  @trisupply.net OR
  @byop.net
) OR
subject:("708 Purple Salvia" OR "Mesa Vista")
```

---

## 11. IMPLEMENTATION SCRIPT STRUCTURE

### File: `scripts/import-project-data.js`

```javascript
/**
 * Database Import Script
 * Populates Supabase with 708 Purple Salvia Cove project data
 *
 * Usage: node scripts/import-project-data.js
 *
 * Dependencies:
 * - @supabase/supabase-js
 * - dotenv
 */

// Structure:
// 1. Connect to Supabase
// 2. Insert Project record
// 3. Insert Planning Phase Steps
// 4. Insert Contacts (24 individuals)
// 5. Insert Vendors (12 companies)
// 6. Insert Budget Items (Paid, Contracted, Pending, Estimated)
// 7. Insert Permits (3 permits)
// 8. Insert Milestones (7 milestones)
// 9. Insert Tasks (148 tasks from CSV)
// 10. Insert Project Status snapshot
// 11. Insert Documents (key documents)
// 12. Insert Email Account record
// 13. Log summary

// Error handling:
// - Rollback on failure (within transaction if possible)
// - Log all operations
// - Provide detailed success/failure messages
```

---

## 12. VALIDATION CHECKLIST

Before running the import script:

- [ ] Verify Supabase connection credentials
- [ ] Confirm all table schemas match script expectations
- [ ] Backup existing database (if any data present)
- [ ] Review all monetary amounts for accuracy
- [ ] Verify all dates are in correct format (YYYY-MM-DD)
- [ ] Confirm vendor/contact email addresses
- [ ] Check that foreign key relationships are maintained
- [ ] Test with a small subset first (dry run)

After running the import script:

- [ ] Verify project record exists with correct data
- [ ] Confirm 6 planning phase steps inserted
- [ ] Verify 24 contacts inserted
- [ ] Confirm 12 vendors inserted
- [ ] Check budget items sum correctly ($289,196 paid + pending)
- [ ] Verify tasks are properly linked to parent tasks via dependencies
- [ ] Confirm milestones have correct dependency structure
- [ ] Test email account sync (after OAuth setup)
- [ ] Verify document links are valid
- [ ] Check project status snapshot displays correctly in UI

---

## 13. POST-IMPORT TASKS

After successful import:

1. **Gmail OAuth Setup**
   - User connects Gmail via app UI
   - OAuth tokens stored in `email_accounts.oauth_tokens`
   - Run initial email sync (last 30 days)
   - Verify emails from UBuildIt team appear

2. **Update ACTION_ITEMS.md**
   - Mark "Populate database" as complete
   - Add date of completion
   - Note any discrepancies found during import

3. **User Review**
   - Have owner review dashboard
   - Verify all amounts are correct
   - Confirm vendor contact information
   - Update any outdated information

4. **Ongoing Maintenance**
   - Set up regular email sync (every 30 minutes)
   - Update budget items as bids are accepted
   - Mark tasks as complete as work progresses
   - Add new vendors/contacts as they're engaged

---

## NOTES & ASSUMPTIONS

### Data Quality
- All data extracted from Dropbox as of Feb 6, 2026
- Most budget documents dated October 2025
- VENDOR_DIRECTORY.md and ACTION_ITEMS.md dated Feb 6, 2026 (most current)
- Some vendor amounts are estimates pending final quotes

### Assumptions Made
- Owner email: danielcase@gmail.com (not explicitly stated, assumed from context)
- Target completion date: Not set (TBD based on permit approval)
- Project start date: June 2, 2025 (land purchase date used)
- UBuildIt balance: ~$48,326.50 (7,526 sq ft × $7.75 - $5,000 engagement)

### Missing Information
- Exact OAuth tokens for Gmail (user must authorize)
- Some contractor phone numbers (only company phones available)
- Specific email addresses for several vendors
- Final delivery dates for pending bids

### Value Engineering Impact
- Original budget estimates: $1.3M-$1.4M
- Target budget: $1.2M
- Deferred: Concrete driveway (~$80K), premium IAQ (~$10K), stone accents (~$8K)
- Reduced: Appliances (single Sub-Zero vs dual columns, ~$26K savings)
- Keeping: La Cornue range ($88,800), Premium flooring ($105,448)

---

## SUPPORT DOCUMENTATION

### Source Files Referenced
- `VENDOR_DIRECTORY.md` (Feb 6, 2026)
- `ACTION_ITEMS.md` (Feb 6, 2026)
- `PROJECT_SPECIFICATIONS.json` (Feb 6, 2026)
- `Budget_Reality_Check_Actual_Bids_vs_Estimates.md` (Oct 5, 2025)
- `Construction_Tasks.csv` (May 11, 2025)
- `Master_Construction_Budget.csv` (Oct 5, 2025)
- `Expenses/README_EXPENSES_SUMMARY.md` (Oct 10, 2025)
- `Civil_Engineering_RFP_Summary.md` (Jan 2, 2026)
- `CHANGELOG.md` (Feb 6, 2026)

### Additional Resources
- Dropbox folder structure analyzed
- All FINAL architectural plans reviewed
- Engineering documents catalogued
- Bid documents cross-referenced

---

**Document Status:** READY FOR IMPLEMENTATION
**Next Step:** Create `scripts/import-project-data.js` based on this plan
**Owner Approval:** REQUIRED before execution
