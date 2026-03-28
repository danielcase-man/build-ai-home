/**
 * Bid Package Generator — produces formatted SOWs and outreach emails
 * from takeoff data.
 *
 * This is the bridge between Phase 1 (Takeoff Engine) and Phase 3
 * (Bid Package Automation). Takes structured takeoff items and generates:
 * 1. Scope of Work documents per trade
 * 2. Vendor outreach emails
 * 3. Bid package items list for vendor pricing
 *
 * Eventually this will be invoked by Claude Code workflows. For now it
 * provides the data formatting layer that FrameWork displays and Claude
 * Code calls via Supabase.
 */

import { supabase } from './supabase'
import type { TakeoffItem, BidPackage } from '@/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SOWSection {
  heading: string
  content: string
}

export interface GeneratedSOW {
  trade: string
  title: string
  sections: SOWSection[]
  fullText: string
  itemCount: number
  estimatedTotal: number
}

export interface OutreachEmail {
  to: string
  toName: string
  subject: string
  bodyHtml: string
  trade: string
  bidPackageId: string
}

// ---------------------------------------------------------------------------
// Project Constants (Case Residence)
// ---------------------------------------------------------------------------

const PROJECT_INFO = {
  name: 'Case Residence',
  address: '708 Purple Salvia Cove, Liberty Hill, TX 78642',
  owner: 'Daniel Case',
  ownerPhone: '(714) 872-0025',
  ownerEmail: 'danielcase.info@gmail.com',
  consultant: 'Aaron Mischenko, Texas Home Consulting (UBuildIt Williamson Team)',
  description: `Custom French Country residence, 7,526 sq ft under roof (4,156 main house + 620 porch + 579 covered patio + 2,171 RV garage/workshop). Single-story slab-on-grade. 2x8 T-Stud exterior walls with ZIP System sheathing. 10'-1 1/8" plate heights (12'-1 1/8" garage). Monopoly roof framing with Hunter Panel H-Shield NB + asphalt shingles.`,
  insuranceRequirements: `- General Liability: $1M per occurrence / $2M aggregate minimum
- Workers Compensation: Statutory limits
- Certificate of Insurance naming Daniel Case as additional insured`,
}

// ---------------------------------------------------------------------------
// SOW Generation
// ---------------------------------------------------------------------------

/** Generate a Scope of Work document from takeoff items */
export function generateSOW(
  trade: string,
  title: string,
  items: TakeoffItem[],
  options?: {
    deadline?: string
    ownerFurnished?: string[]
    exclusions?: string[]
    specialNotes?: string
  }
): GeneratedSOW {
  // Group items by category
  const grouped: Record<string, TakeoffItem[]> = {}
  for (const item of items) {
    const key = item.subcategory
      ? `${item.category} — ${item.subcategory}`
      : item.category
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(item)
  }

  const estimatedTotal = items.reduce(
    (sum, item) => sum + (item.total_cost || 0), 0
  )

  const sections: SOWSection[] = []

  // Header
  sections.push({
    heading: 'BID REQUEST',
    content: `${title}\nProject: ${PROJECT_INFO.name}, ${PROJECT_INFO.address}\nOwner-Builder: ${PROJECT_INFO.owner} | ${PROJECT_INFO.ownerPhone} | ${PROJECT_INFO.ownerEmail}\nConsultant: ${PROJECT_INFO.consultant}`,
  })

  // Project description
  sections.push({
    heading: 'PROJECT DESCRIPTION',
    content: PROJECT_INFO.description,
  })

  // Scope of work
  sections.push({
    heading: 'SCOPE OF WORK',
    content: `Provide all labor and materials for ${trade} as detailed in the quantities below. Work to conform to 2021 IRC and all applicable Williamson County building codes.`,
  })

  // Quantities
  const quantityLines: string[] = []
  for (const [category, categoryItems] of Object.entries(grouped)) {
    quantityLines.push(`\n${category.toUpperCase()}:`)
    for (const item of categoryItems) {
      const qty = item.quantity_with_waste || item.quantity
      const spec = item.material_spec ? ` (${item.material_spec})` : ''
      const conf = item.confidence === 'gap' ? ' [VERIFY]' : ''
      quantityLines.push(`  ${item.item_name}${spec}: ${qty} ${item.unit}${conf}`)
    }
  }
  sections.push({
    heading: 'QUANTITIES (from takeoff)',
    content: quantityLines.join('\n'),
  })

  // Must include
  sections.push({
    heading: 'MUST INCLUDE IN BID',
    content: `- All labor and materials unless noted as owner-furnished
- Delivery to jobsite (${PROJECT_INFO.address})
- Cleanup of trade-specific debris
- Warranty (minimum 1 year workmanship)
- Timeline from start to completion
- Payment schedule
- Itemized pricing matching the quantities above`,
  })

  // Owner-furnished
  if (options?.ownerFurnished && options.ownerFurnished.length > 0) {
    sections.push({
      heading: 'OWNER-FURNISHED ITEMS',
      content: options.ownerFurnished.map(i => `- ${i}`).join('\n'),
    })
  }

  // Exclusions
  if (options?.exclusions && options.exclusions.length > 0) {
    sections.push({
      heading: 'NOT IN SCOPE',
      content: options.exclusions.map(i => `- ${i}`).join('\n'),
    })
  }

  // Plans
  sections.push({
    heading: 'PLANS AVAILABLE',
    content: 'Architectural plans, structural plans, foundation plans, and Asiri construction detail package available upon request.',
  })

  // Insurance
  sections.push({
    heading: 'INSURANCE REQUIREMENTS',
    content: PROJECT_INFO.insuranceRequirements,
  })

  // Deadline
  if (options?.deadline) {
    sections.push({
      heading: 'BID DUE DATE',
      content: `${options.deadline}\nPlease submit bids to: ${PROJECT_INFO.ownerEmail}\nQuestions: Contact ${PROJECT_INFO.owner} at ${PROJECT_INFO.ownerPhone}`,
    })
  }

  // Evaluation
  sections.push({
    heading: 'EVALUATION CRITERIA',
    content: 'Bids will be evaluated on price, scope completeness, timeline, references, and warranty terms. Lowest bid is NOT automatically selected.',
  })

  // Special notes
  if (options?.specialNotes) {
    sections.push({
      heading: 'ADDITIONAL NOTES',
      content: options.specialNotes,
    })
  }

  // Compile full text
  const fullText = sections
    .map(s => `${s.heading}\n${'='.repeat(s.heading.length)}\n${s.content}`)
    .join('\n\n')

  return {
    trade,
    title,
    sections,
    fullText,
    itemCount: items.length,
    estimatedTotal,
  }
}

// ---------------------------------------------------------------------------
// Outreach Email Generation
// ---------------------------------------------------------------------------

/** Generate a vendor outreach email from a bid package */
export function generateOutreachEmail(
  vendor: { name: string; contactName: string; email: string },
  sow: GeneratedSOW,
  bidPackageId: string,
  deadline?: string
): OutreachEmail {
  const bodyHtml = `<p>Hi ${vendor.contactName},</p>

<p>I'm reaching out regarding a custom home project in Liberty Hill, TX and would like to request a bid for <b>${sow.trade}</b>.</p>

<p><b>Project Overview:</b></p>
<ul>
  <li><b>Location:</b> ${PROJECT_INFO.address}</li>
  <li><b>Size:</b> 7,526 sq ft under roof (single-story)</li>
  <li><b>Style:</b> French Country custom residence</li>
  <li><b>Items:</b> ${sow.itemCount} line items in the scope</li>
</ul>

<p>I've attached the detailed Scope of Work with quantities and specifications. The material list was generated from our architectural and structural plans.</p>

${deadline ? `<p><b>Bid Due Date:</b> ${deadline}</p>` : ''}

<p>If you're interested and available for this project, please review the attached SOW and submit your itemized bid. Architectural and structural plans are available upon request.</p>

<p>Feel free to reach out with any questions.</p>

<p>Best regards,<br>
${PROJECT_INFO.owner}<br>
${PROJECT_INFO.ownerPhone}<br>
${PROJECT_INFO.ownerEmail}</p>`

  return {
    to: vendor.email,
    toName: vendor.contactName,
    subject: `Bid Request — ${sow.title} | ${PROJECT_INFO.name}`,
    bodyHtml,
    trade: sow.trade,
    bidPackageId,
  }
}

// ---------------------------------------------------------------------------
// Full Pipeline: Takeoff → Bid Package → SOW → Emails
// ---------------------------------------------------------------------------

/** Generate a complete bid package with SOW from a takeoff run */
export async function generateFullBidPackage(
  takeoffRunId: string,
  projectId: string,
  options: {
    trade: string
    title: string
    deadline?: string
    ownerFurnished?: string[]
    exclusions?: string[]
    specialNotes?: string
    categoryFilter?: string[]
  }
): Promise<{ sow: GeneratedSOW; bidPackage: BidPackage | null }> {
  // Get takeoff items
  let query = supabase
    .from('takeoff_items')
    .select('*')
    .eq('takeoff_run_id', takeoffRunId)
    .order('sort_order', { ascending: true })

  const { data } = await query
  let items = (data || []) as TakeoffItem[]

  // Filter by category if specified
  if (options.categoryFilter) {
    items = items.filter(i => options.categoryFilter!.includes(i.category))
  }

  // Generate SOW
  const sow = generateSOW(options.trade, options.title, items, {
    deadline: options.deadline,
    ownerFurnished: options.ownerFurnished,
    exclusions: options.exclusions,
    specialNotes: options.specialNotes,
  })

  // Create bid package in database
  const { data: pkg, error } = await supabase
    .from('bid_packages')
    .insert({
      project_id: projectId,
      takeoff_run_id: takeoffRunId,
      trade: options.trade,
      title: options.title,
      scope_of_work: sow.fullText,
      special_requirements: `Delivery to ${PROJECT_INFO.address}`,
      item_count: items.length,
      estimated_total: sow.estimatedTotal,
      status: 'draft',
      deadline: options.deadline,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating bid package:', error)
    return { sow, bidPackage: null }
  }

  // Insert bid package items
  const packageItems = items.map((item, idx) => ({
    bid_package_id: (pkg as BidPackage).id,
    takeoff_item_id: item.id,
    item_name: item.item_name,
    description: item.description,
    material_spec: item.material_spec,
    quantity: item.quantity_with_waste || item.quantity,
    unit: item.unit,
    notes: item.confidence === 'gap' ? 'VERIFY — estimated from incomplete plans' : item.notes,
    sort_order: idx,
  }))

  if (packageItems.length > 0) {
    await supabase.from('bid_package_items').insert(packageItems)
  }

  return { sow, bidPackage: pkg as BidPackage }
}
