/**
 * Construction Knowledge Graph — Service Layer
 *
 * Provides queries against the construction_knowledge and project_knowledge_state
 * tables. The knowledge graph models every step, material, inspection, and
 * decision point in building a home, with dependency tracking.
 */

import { supabase } from './supabase'
import type {
  KnowledgeItem,
  KnowledgeTreeNode,
  ProjectKnowledgeState,
  KnowledgeSeedItem,
} from '@/types'

// ---------------------------------------------------------------------------
// Read Operations
// ---------------------------------------------------------------------------

/** Fetch all knowledge items, optionally filtered by phase or trade */
export async function getKnowledgeItems(filters?: {
  phase_number?: number
  trade?: string
  item_type?: string
}): Promise<KnowledgeItem[]> {
  let query = supabase
    .from('construction_knowledge')
    .select('*')
    .order('phase_number', { ascending: true })
    .order('sort_order', { ascending: true })

  if (filters?.phase_number) {
    query = query.eq('phase_number', filters.phase_number)
  }
  if (filters?.trade) {
    query = query.eq('trade', filters.trade)
  }
  if (filters?.item_type) {
    query = query.eq('item_type', filters.item_type)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching knowledge items:', error)
    return []
  }

  return (data || []) as KnowledgeItem[]
}

/** Build a hierarchical tree of knowledge items with optional project state */
export async function getKnowledgeTree(
  projectId?: string,
  filters?: { phase_number?: number; trade?: string }
): Promise<KnowledgeTreeNode[]> {
  const items = await getKnowledgeItems(filters)

  // Fetch project state if projectId provided
  let stateMap: Map<string, ProjectKnowledgeState> = new Map()
  if (projectId) {
    const states = await getProjectKnowledgeStates(projectId)
    stateMap = new Map(states.map(s => [s.knowledge_id, s]))
  }

  // Build tree from flat list
  const nodeMap = new Map<string, KnowledgeTreeNode>()
  const roots: KnowledgeTreeNode[] = []

  // First pass: create all nodes
  for (const item of items) {
    nodeMap.set(item.id, {
      ...item,
      children: [],
      state: stateMap.get(item.id) || null,
    })
  }

  // Second pass: wire parent-child relationships
  for (const item of items) {
    const node = nodeMap.get(item.id)!
    if (item.parent_id && nodeMap.has(item.parent_id)) {
      nodeMap.get(item.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

/** Get project-specific knowledge states */
export async function getProjectKnowledgeStates(
  projectId: string,
  filters?: { status?: string }
): Promise<ProjectKnowledgeState[]> {
  let query = supabase
    .from('project_knowledge_state')
    .select('*')
    .eq('project_id', projectId)

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching project knowledge states:', error)
    return []
  }

  return (data || []) as ProjectKnowledgeState[]
}

/** Get all items that are blocking progress — status='blocked' or dependencies not met */
export async function getBlockers(projectId: string): Promise<Array<{
  item: KnowledgeItem
  state: ProjectKnowledgeState
  unmetDependencies: KnowledgeItem[]
}>> {
  // Get all knowledge items and project states
  const [items, states] = await Promise.all([
    getKnowledgeItems(),
    getProjectKnowledgeStates(projectId),
  ])

  const itemMap = new Map(items.map(i => [i.id, i]))
  const stateMap = new Map(states.map(s => [s.knowledge_id, s]))

  const blockers: Array<{
    item: KnowledgeItem
    state: ProjectKnowledgeState
    unmetDependencies: KnowledgeItem[]
  }> = []

  for (const state of states) {
    if (state.status !== 'blocked') continue

    const item = itemMap.get(state.knowledge_id)
    if (!item) continue

    // Find which dependencies aren't completed
    const unmet = (item.dependencies || [])
      .map(depId => itemMap.get(depId))
      .filter((dep): dep is KnowledgeItem => {
        if (!dep) return false
        const depState = stateMap.get(dep.id)
        return !depState || depState.status !== 'completed'
      })

    blockers.push({ item, state, unmetDependencies: unmet })
  }

  return blockers
}

/** Get items that are ready to start (all dependencies completed) */
export async function getReadyItems(projectId: string): Promise<KnowledgeItem[]> {
  const [items, states] = await Promise.all([
    getKnowledgeItems(),
    getProjectKnowledgeStates(projectId),
  ])

  const stateMap = new Map(states.map(s => [s.knowledge_id, s]))

  return items.filter(item => {
    const state = stateMap.get(item.id)
    if (state && state.status !== 'pending') return false
    if (!state) {
      // Item hasn't been initialized yet — check if it could be ready
    }

    // Check all dependencies are completed
    const deps = item.dependencies || []
    if (deps.length === 0) return state?.status === 'pending' || !state

    return deps.every(depId => {
      const depState = stateMap.get(depId)
      return depState?.status === 'completed'
    })
  })
}

/** Get all decision points, optionally filtered by phase */
export async function getDecisionPoints(
  projectId: string,
  phaseNumber?: number
): Promise<Array<{ item: KnowledgeItem; state: ProjectKnowledgeState | null }>> {
  const filters: { phase_number?: number; item_type: string } = { item_type: 'decision_point' }
  if (phaseNumber) filters.phase_number = phaseNumber

  const items = await getKnowledgeItems(filters)
  const states = await getProjectKnowledgeStates(projectId)
  const stateMap = new Map(states.map(s => [s.knowledge_id, s]))

  return items.map(item => ({
    item,
    state: stateMap.get(item.id) || null,
  }))
}

/**
 * Get cascading requirements for a knowledge item.
 * E.g., "add a light fixture" returns: junction box, romex, switch,
 * dimmer, rough-in inspection; then fixture, final inspection.
 */
export async function getCascadingRequirements(itemId: string): Promise<{
  item: KnowledgeItem
  prerequisites: KnowledgeItem[]
  downstream: KnowledgeItem[]
  materials: Array<{ name: string; quantity_formula?: string; unit?: string; specs?: string; from_item: string }>
  inspections: KnowledgeItem[]
}> {
  const items = await getKnowledgeItems()
  const itemMap = new Map(items.map(i => [i.id, i]))

  const item = itemMap.get(itemId)
  if (!item) {
    throw new Error(`Knowledge item not found: ${itemId}`)
  }

  // Walk dependency chain backward (prerequisites)
  const prerequisites: KnowledgeItem[] = []
  const visited = new Set<string>()

  function collectPrereqs(id: string) {
    const node = itemMap.get(id)
    if (!node || visited.has(id)) return
    visited.add(id)

    for (const depId of (node.dependencies || [])) {
      if (depId !== itemId) {
        const dep = itemMap.get(depId)
        if (dep) {
          collectPrereqs(depId)
          prerequisites.push(dep)
        }
      }
    }
  }
  collectPrereqs(itemId)

  // Walk triggers forward (downstream)
  const downstream: KnowledgeItem[] = []
  const visitedDown = new Set<string>()

  function collectDownstream(id: string) {
    const node = itemMap.get(id)
    if (!node || visitedDown.has(id)) return
    visitedDown.add(id)

    for (const trigId of (node.triggers || [])) {
      const trig = itemMap.get(trigId)
      if (trig) {
        downstream.push(trig)
        collectDownstream(trigId)
      }
    }
  }
  collectDownstream(itemId)

  // Also add children as part of cascade
  const children = items.filter(i => i.parent_id === itemId)
  for (const child of children) {
    if (!downstream.find(d => d.id === child.id)) {
      downstream.push(child)
    }
  }

  // Collect all materials from item + prerequisites + downstream
  const allItems = [item, ...prerequisites, ...downstream]
  const materials = allItems.flatMap(i =>
    (i.materials || []).map(m => ({ ...m, from_item: i.item_name }))
  )

  // Find all inspections in the cascade
  const inspections = allItems.filter(i => i.item_type === 'inspection' || i.inspection_required)

  return { item, prerequisites, downstream, materials, inspections }
}

/** Get a summary of knowledge state for AI context */
export async function getKnowledgeStateSummary(projectId: string): Promise<{
  totalItems: number
  completed: number
  inProgress: number
  blocked: number
  ready: number
  pending: number
  decisionsPending: number
}> {
  const [items, states] = await Promise.all([
    getKnowledgeItems(),
    getProjectKnowledgeStates(projectId),
  ])

  const stateMap = new Map(states.map(s => [s.knowledge_id, s]))

  let completed = 0
  let inProgress = 0
  let blocked = 0
  let pending = 0

  for (const state of states) {
    switch (state.status) {
      case 'completed': completed++; break
      case 'in_progress': inProgress++; break
      case 'blocked': blocked++; break
      case 'pending': pending++; break
    }
  }

  // Count decisions pending
  const decisionItems = items.filter(i => i.decision_required)
  const decisionsPending = decisionItems.filter(d => {
    const state = stateMap.get(d.id)
    return !state || state.status === 'pending' || state.status === 'ready'
  }).length

  // Count ready items
  const readyItems = await getReadyItems(projectId)

  return {
    totalItems: items.length,
    completed,
    inProgress,
    blocked,
    ready: readyItems.length,
    pending,
    decisionsPending,
  }
}

// ---------------------------------------------------------------------------
// Write Operations
// ---------------------------------------------------------------------------

/** Update the state of a knowledge item for a project */
export async function updateKnowledgeState(
  projectId: string,
  knowledgeId: string,
  update: Partial<Pick<ProjectKnowledgeState, 'status' | 'blocking_reason' | 'actual_cost' | 'completed_date' | 'notes'>>
): Promise<ProjectKnowledgeState | null> {
  const { data, error } = await supabase
    .from('project_knowledge_state')
    .upsert(
      {
        project_id: projectId,
        knowledge_id: knowledgeId,
        ...update,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'project_id,knowledge_id' }
    )
    .select()
    .single()

  if (error) {
    console.error('Error updating knowledge state:', error)
    return null
  }

  // If completed, check if any triggered items should become "ready"
  if (update.status === 'completed') {
    await updateTriggeredItems(projectId, knowledgeId)
  }

  return data as ProjectKnowledgeState
}

/** When an item is completed, update downstream items to "ready" if all deps met */
async function updateTriggeredItems(projectId: string, completedItemId: string): Promise<void> {
  const items = await getKnowledgeItems()
  const states = await getProjectKnowledgeStates(projectId)
  const stateMap = new Map(states.map(s => [s.knowledge_id, s]))
  const itemMap = new Map(items.map(i => [i.id, i]))

  const completedItem = itemMap.get(completedItemId)
  if (!completedItem) return

  // Find items that list this as a dependency
  const dependents = items.filter(i =>
    (i.dependencies || []).includes(completedItemId)
  )

  for (const dep of dependents) {
    const depState = stateMap.get(dep.id)
    // Only upgrade if currently pending or blocked
    if (depState && depState.status !== 'pending' && depState.status !== 'blocked') continue

    // Check if ALL dependencies are now completed
    const allDepsMet = (dep.dependencies || []).every(dId => {
      const ds = stateMap.get(dId)
      return ds?.status === 'completed' || dId === completedItemId
    })

    if (allDepsMet) {
      await supabase
        .from('project_knowledge_state')
        .upsert(
          {
            project_id: projectId,
            knowledge_id: dep.id,
            status: 'ready',
            blocking_reason: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'project_id,knowledge_id' }
        )
    }
  }
}

/** Initialize project knowledge states for all items (run once per project) */
export async function initializeProjectKnowledgeStates(projectId: string): Promise<number> {
  const items = await getKnowledgeItems()
  const existing = await getProjectKnowledgeStates(projectId)
  const existingIds = new Set(existing.map(e => e.knowledge_id))

  // Only create states for items not yet tracked
  const newStates = items
    .filter(item => !existingIds.has(item.id))
    .map(item => ({
      project_id: projectId,
      knowledge_id: item.id,
      status: (item.dependencies || []).length === 0 ? 'ready' : 'pending',
    }))

  if (newStates.length === 0) return 0

  const { error } = await supabase
    .from('project_knowledge_state')
    .insert(newStates)

  if (error) {
    console.error('Error initializing knowledge states:', error)
    return 0
  }

  return newStates.length
}

// ---------------------------------------------------------------------------
// Seed Operations
// ---------------------------------------------------------------------------

/** Seed the construction_knowledge table from seed data */
export async function seedKnowledgeGraph(seedData: KnowledgeSeedItem[]): Promise<{
  created: number
  errors: string[]
}> {
  let created = 0
  const errors: string[] = []

  for (const item of seedData) {
    try {
      const parentId = await insertKnowledgeItem(item, null)
      if (parentId) {
        created++

        // Insert children
        if (item.children) {
          for (const child of item.children) {
            const childId = await insertKnowledgeItem(
              { ...child, phase_number: item.phase_number, trade: item.trade },
              parentId
            )
            if (childId) created++
            else errors.push(`Failed to insert child: ${child.item_name}`)
          }
        }
      } else {
        errors.push(`Failed to insert: ${item.item_name}`)
      }
    } catch (err) {
      errors.push(`Error inserting ${item.item_name}: ${err}`)
    }
  }

  return { created, errors }
}

async function insertKnowledgeItem(
  item: KnowledgeSeedItem & { phase_number: number; trade: string },
  parentId: string | null
): Promise<string | null> {
  const { data, error } = await supabase
    .from('construction_knowledge')
    .insert({
      phase_number: item.phase_number,
      trade: item.trade,
      item_name: item.item_name,
      item_type: item.item_type,
      parent_id: parentId,
      sort_order: item.sort_order,
      description: item.description || null,
      inspection_required: item.inspection_required || false,
      decision_required: item.decision_required || false,
      typical_duration_days: item.typical_duration_days || null,
      typical_cost_range: item.typical_cost_range || null,
      materials: item.materials || [],
      code_references: item.code_references || [],
      decision_options: item.decision_options || null,
      dependencies: [],
      triggers: [],
    })
    .select('id')
    .single()

  if (error) {
    console.error(`Error inserting ${item.item_name}:`, error)
    return null
  }

  return data?.id || null
}

/** Check if knowledge graph has been seeded */
export async function isKnowledgeGraphSeeded(): Promise<boolean> {
  const { count, error } = await supabase
    .from('construction_knowledge')
    .select('*', { count: 'exact', head: true })

  if (error) return false
  return (count || 0) > 0
}
