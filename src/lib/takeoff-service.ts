/**
 * Takeoff Service — CRUD for takeoff runs and items.
 *
 * This service manages the structured output of lumber/materials takeoffs.
 * Takeoffs are performed by Claude Code (via engram skills) and stored here
 * for display in FrameWork and feeding into bid packages.
 *
 * Flow: Plans → Claude Code Takeoff → takeoff_runs + takeoff_items → bid_packages
 */

import { supabase } from './supabase'
import type {
  TakeoffRun,
  TakeoffItem,
  TakeoffRunWithItems,
  BidPackage,
  BidPackageItem,
} from '@/types'

// ---------------------------------------------------------------------------
// Takeoff Runs
// ---------------------------------------------------------------------------

/** Create a new takeoff run */
export async function createTakeoffRun(
  run: Omit<TakeoffRun, 'id' | 'created_at' | 'updated_at'>
): Promise<TakeoffRun | null> {
  const { data, error } = await supabase
    .from('takeoff_runs')
    .insert(run)
    .select()
    .single()

  if (error) {
    console.error('Error creating takeoff run:', error)
    return null
  }
  return data as TakeoffRun
}

/** Get all takeoff runs for a project */
export async function getTakeoffRuns(
  projectId: string,
  filters?: { trade?: string; status?: string }
): Promise<TakeoffRun[]> {
  let query = supabase
    .from('takeoff_runs')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (filters?.trade) query = query.eq('trade', filters.trade)
  if (filters?.status) query = query.eq('status', filters.status)

  const { data, error } = await query
  if (error) return []
  return (data || []) as TakeoffRun[]
}

/** Get a single takeoff run with all its items */
export async function getTakeoffRunWithItems(
  runId: string
): Promise<TakeoffRunWithItems | null> {
  const { data: run, error: runError } = await supabase
    .from('takeoff_runs')
    .select('*')
    .eq('id', runId)
    .single()

  if (runError || !run) return null

  const { data: items } = await supabase
    .from('takeoff_items')
    .select('*')
    .eq('takeoff_run_id', runId)
    .order('sort_order', { ascending: true })
    .order('category', { ascending: true })

  return {
    ...(run as TakeoffRun),
    items: (items || []) as TakeoffItem[],
  }
}

/** Update takeoff run status */
export async function updateTakeoffRunStatus(
  runId: string,
  status: TakeoffRun['status'],
  supersededBy?: string
): Promise<boolean> {
  const update: Record<string, unknown> = { status }
  if (supersededBy) update.superseded_by = supersededBy

  const { error } = await supabase
    .from('takeoff_runs')
    .update(update)
    .eq('id', runId)

  return !error
}

// ---------------------------------------------------------------------------
// Takeoff Items
// ---------------------------------------------------------------------------

/** Insert takeoff items in bulk */
export async function insertTakeoffItems(
  items: Omit<TakeoffItem, 'id' | 'created_at' | 'updated_at' | 'quantity_with_waste' | 'total_cost'>[]
): Promise<{ inserted: number; errors: string[] }> {
  const errors: string[] = []
  let inserted = 0

  // Supabase bulk insert has a practical limit, batch at 100
  for (let i = 0; i < items.length; i += 100) {
    const batch = items.slice(i, i + 100)
    const { error } = await supabase
      .from('takeoff_items')
      .insert(batch)

    if (error) {
      console.error(`[takeoff-service] Insert error:`, error.message, error.details, error.hint)
      console.error(`[takeoff-service] Sample item:`, JSON.stringify(batch[0]).substring(0, 500))
      errors.push(`Batch ${Math.floor(i / 100) + 1}: ${error.message}`)
    } else {
      inserted += batch.length
    }
  }

  return { inserted, errors }
}

/** Get items for a takeoff run, grouped by category */
export async function getTakeoffItemsByCategory(
  runId: string
): Promise<Record<string, TakeoffItem[]>> {
  const { data, error } = await supabase
    .from('takeoff_items')
    .select('*')
    .eq('takeoff_run_id', runId)
    .order('sort_order', { ascending: true })

  if (error || !data) return {}

  const grouped: Record<string, TakeoffItem[]> = {}
  for (const item of data as TakeoffItem[]) {
    const key = item.subcategory ? `${item.category}/${item.subcategory}` : item.category
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(item)
  }
  return grouped
}

/** Get takeoff summary stats for a run */
export async function getTakeoffSummary(runId: string): Promise<{
  totalItems: number
  totalQuantityWithWaste: number
  categories: Record<string, number>
  estimatedCost: number
  gapCount: number
}> {
  const { data } = await supabase
    .from('takeoff_items')
    .select('*')
    .eq('takeoff_run_id', runId)

  const items = (data || []) as TakeoffItem[]

  const categories: Record<string, number> = {}
  let totalQuantityWithWaste = 0
  let estimatedCost = 0
  let gapCount = 0

  for (const item of items) {
    categories[item.category] = (categories[item.category] || 0) + 1
    totalQuantityWithWaste += item.quantity_with_waste || item.quantity
    estimatedCost += item.total_cost || 0
    if (item.confidence === 'gap') gapCount++
  }

  return {
    totalItems: items.length,
    totalQuantityWithWaste,
    categories,
    estimatedCost,
    gapCount,
  }
}

// ---------------------------------------------------------------------------
// Bid Package Generation
// ---------------------------------------------------------------------------

/** Create a bid package from a takeoff run */
export async function createBidPackageFromTakeoff(
  runId: string,
  projectId: string,
  options: {
    title: string
    trade: string
    scopeOfWork?: string
    specialRequirements?: string
    deadline?: string
    categoryFilter?: string[]  // Only include items from these categories
  }
): Promise<BidPackage | null> {
  // Get takeoff items
  const { data: items } = await supabase
    .from('takeoff_items')
    .select('*')
    .eq('takeoff_run_id', runId)
    .order('sort_order', { ascending: true })

  if (!items || items.length === 0) return null

  // Filter by category if specified
  const filteredItems = options.categoryFilter
    ? (items as TakeoffItem[]).filter(i => options.categoryFilter!.includes(i.category))
    : (items as TakeoffItem[])

  // Calculate estimated total
  const estimatedTotal = filteredItems.reduce(
    (sum, item) => sum + ((item as TakeoffItem).total_cost || 0), 0
  )

  // Create the bid package
  const { data: pkg, error: pkgError } = await supabase
    .from('bid_packages')
    .insert({
      project_id: projectId,
      takeoff_run_id: runId,
      trade: options.trade,
      title: options.title,
      scope_of_work: options.scopeOfWork,
      special_requirements: options.specialRequirements || 'Delivery to 708 Purple Salvia Cove, Liberty Hill, TX 78642',
      item_count: filteredItems.length,
      estimated_total: estimatedTotal,
      status: 'draft',
      deadline: options.deadline,
    })
    .select()
    .single()

  if (pkgError || !pkg) {
    console.error('Error creating bid package:', pkgError)
    return null
  }

  // Create bid package items
  const packageItems: Omit<BidPackageItem, 'id' | 'created_at'>[] = filteredItems.map(
    (item, idx) => ({
      bid_package_id: (pkg as BidPackage).id,
      takeoff_item_id: (item as TakeoffItem).id,
      item_name: (item as TakeoffItem).item_name,
      description: (item as TakeoffItem).description || undefined,
      material_spec: (item as TakeoffItem).material_spec || undefined,
      quantity: (item as TakeoffItem).quantity_with_waste || (item as TakeoffItem).quantity,
      unit: (item as TakeoffItem).unit,
      notes: (item as TakeoffItem).notes || undefined,
      sort_order: idx,
    })
  )

  if (packageItems.length > 0) {
    await supabase.from('bid_package_items').insert(packageItems)
  }

  return pkg as BidPackage
}

/** Get bid packages for a project */
export async function getBidPackages(
  projectId: string,
  filters?: { trade?: string; status?: string }
): Promise<BidPackage[]> {
  let query = supabase
    .from('bid_packages')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (filters?.trade) query = query.eq('trade', filters.trade)
  if (filters?.status) query = query.eq('status', filters.status)

  const { data, error } = await query
  if (error) return []
  return (data || []) as BidPackage[]
}

/** Get bid package with its line items */
export async function getBidPackageWithItems(
  packageId: string
): Promise<(BidPackage & { items: BidPackageItem[] }) | null> {
  const { data: pkg } = await supabase
    .from('bid_packages')
    .select('*')
    .eq('id', packageId)
    .single()

  if (!pkg) return null

  const { data: items } = await supabase
    .from('bid_package_items')
    .select('*')
    .eq('bid_package_id', packageId)
    .order('sort_order', { ascending: true })

  return {
    ...(pkg as BidPackage),
    items: (items || []) as BidPackageItem[],
  }
}

/** Update bid package vendor outreach tracking */
export async function trackVendorOutreach(
  packageId: string,
  vendor: {
    vendor_id?: string
    vendor_name: string
    contact_email: string
    sent_date: string
    status: string
    bid_id?: string
  }
): Promise<boolean> {
  const { data: pkg } = await supabase
    .from('bid_packages')
    .select('vendors_contacted')
    .eq('id', packageId)
    .single()

  if (!pkg) return false

  const existing = (pkg.vendors_contacted || []) as Array<Record<string, unknown>>
  existing.push(vendor)

  const { error } = await supabase
    .from('bid_packages')
    .update({
      vendors_contacted: existing,
      status: 'sent',
      sent_date: vendor.sent_date,
    })
    .eq('id', packageId)

  return !error
}
