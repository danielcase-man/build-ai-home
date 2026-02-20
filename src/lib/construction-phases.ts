/**
 * Construction phases and trades for the UBuildIt build process.
 * Defines the full scope of work in build order, mapping each trade
 * to its bid category for matching against the bids table.
 */

export interface Trade {
  name: string
  bidCategory: string      // matches bids.category
  budgetEstimate?: number  // rough estimate for reference
  required: boolean
}

export interface ConstructionPhase {
  phase: number
  name: string
  trades: Trade[]
}

export const CONSTRUCTION_PHASES: ConstructionPhase[] = [
  {
    phase: 1,
    name: 'Pre-Construction',
    trades: [
      { name: 'Site Clearing & Grading', bidCategory: 'Site Work', budgetEstimate: 15000, required: true },
      { name: 'Well Drilling', bidCategory: 'Well & Septic', budgetEstimate: 55000, required: true },
      { name: 'Septic System', bidCategory: 'Well & Septic', budgetEstimate: 25000, required: true },
      { name: 'Foundation Engineering', bidCategory: 'Foundation Engineering', budgetEstimate: 2500, required: true },
      { name: 'Civil Engineering', bidCategory: 'Civil Engineering', budgetEstimate: 5275, required: true },
      { name: 'Survey / Staking', bidCategory: 'Surveying', budgetEstimate: 3000, required: true },
      { name: 'Temporary Utilities', bidCategory: 'Temporary Utilities', budgetEstimate: 3000, required: true },
    ],
  },
  {
    phase: 2,
    name: 'Foundation',
    trades: [
      { name: 'Foundation (Pad Prep + PT Slab)', bidCategory: 'Foundation', budgetEstimate: 85000, required: true },
    ],
  },
  {
    phase: 3,
    name: 'Framing & Structure',
    trades: [
      { name: 'Framing (Lumber + Labor)', bidCategory: 'Framing', budgetEstimate: 120000, required: true },
      { name: 'Trusses / Engineered Lumber', bidCategory: 'Trusses', budgetEstimate: 35000, required: true },
      { name: 'Roofing', bidCategory: 'Roofing', budgetEstimate: 30000, required: true },
      { name: 'WRB & Flashings', bidCategory: 'WRB & Flashings', budgetEstimate: 8000, required: true },
    ],
  },
  {
    phase: 4,
    name: 'Rough-Ins (MEP)',
    trades: [
      { name: 'HVAC Rough-In', bidCategory: 'HVAC', budgetEstimate: 45000, required: true },
      { name: 'Plumbing Rough-In', bidCategory: 'Plumbing Rough', budgetEstimate: 35000, required: true },
      { name: 'Electrical Rough-In', bidCategory: 'Electrical', budgetEstimate: 40000, required: true },
      { name: 'ERV / Indoor Air Quality', bidCategory: 'ERV & IAQ', budgetEstimate: 8000, required: false },
    ],
  },
  {
    phase: 5,
    name: 'Building Envelope',
    trades: [
      { name: 'Windows & Doors', bidCategory: 'Windows & Doors', budgetEstimate: 68000, required: true },
      { name: 'Exterior Siding / Cladding', bidCategory: 'Siding', budgetEstimate: 45000, required: true },
      { name: 'Insulation', bidCategory: 'Insulation', budgetEstimate: 18000, required: true },
      { name: 'Stone / Masonry Accents', bidCategory: 'Stone & Masonry', budgetEstimate: 25000, required: false },
    ],
  },
  {
    phase: 6,
    name: 'Interior Finishes',
    trades: [
      { name: 'Drywall', bidCategory: 'Drywall', budgetEstimate: 35000, required: true },
      { name: 'Interior Doors & Trim', bidCategory: 'Doors & Trim', budgetEstimate: 25000, required: true },
      { name: 'Painting', bidCategory: 'Painting', budgetEstimate: 25000, required: true },
      { name: 'Cabinetry', bidCategory: 'Cabinetry', budgetEstimate: 60000, required: true },
      { name: 'Countertops', bidCategory: 'Countertops', budgetEstimate: 43000, required: true },
      { name: 'Tile & Stone', bidCategory: 'Tile', budgetEstimate: 30000, required: true },
      { name: 'Flooring', bidCategory: 'Flooring', budgetEstimate: 105000, required: true },
    ],
  },
  {
    phase: 7,
    name: 'MEP Finishes',
    trades: [
      { name: 'Plumbing Fixtures', bidCategory: 'Plumbing Fixtures', budgetEstimate: 25000, required: true },
      { name: 'Lighting Fixtures', bidCategory: 'Lighting Fixtures', budgetEstimate: 15000, required: true },
      { name: 'Appliances', bidCategory: 'Appliances', budgetEstimate: 191000, required: true },
    ],
  },
  {
    phase: 8,
    name: 'Exterior & Site',
    trades: [
      { name: 'Driveway / Flatwork', bidCategory: 'Driveway', budgetEstimate: 20000, required: true },
      { name: 'Garage Doors', bidCategory: 'Garage Doors', budgetEstimate: 8000, required: true },
      { name: 'Exterior Lighting', bidCategory: 'Exterior Lighting', budgetEstimate: 15000, required: true },
      { name: 'Pool', bidCategory: 'Pool', budgetEstimate: 80000, required: false },
    ],
  },
]

/** Flat list of all trades across all phases */
export function getAllTrades(): (Trade & { phaseName: string; phaseNumber: number })[] {
  return CONSTRUCTION_PHASES.flatMap(phase =>
    phase.trades.map(trade => ({
      ...trade,
      phaseName: phase.name,
      phaseNumber: phase.phase,
    }))
  )
}

/** Get all unique bid categories */
export function getAllBidCategories(): string[] {
  return getAllTrades().map(t => t.bidCategory)
}
