import { NextRequest } from 'next/server'
import { getProject } from '@/lib/project-service'
import { getBids } from '@/lib/bids-service'
import { getBudgetItems } from '@/lib/budget-service'
import { getSelections } from '@/lib/selections-service'
import { db } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import { successResponse, errorResponse } from '@/lib/api-utils'

export interface SearchResult {
  type: 'bid' | 'budget' | 'selection' | 'email' | 'contact' | 'task'
  title: string
  subtitle: string
  id: string
  href: string
}

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get('q')?.toLowerCase().trim()
    if (!q || q.length < 2) {
      return successResponse({ results: [] })
    }

    const project = await getProject()
    if (!project) {
      return successResponse({ results: [] })
    }

    const projectId = project.id

    // Run all searches in parallel
    const [bids, budgetItems, selections, emails, contacts, tasks] = await Promise.all([
      getBids(projectId),
      getBudgetItems(projectId),
      getSelections(projectId),
      db.getRecentEmails(30),
      supabase
        .from('contacts')
        .select('id, name, company, role, email, phone')
        .eq('project_id', projectId)
        .then(r => r.data || []),
      supabase
        .from('tasks')
        .select('id, title, description, status, priority')
        .eq('project_id', projectId)
        .then(r => r.data || []),
    ])

    const results: SearchResult[] = []

    // Search bids
    for (const b of bids) {
      if (
        b.vendor_name.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        (b.subcategory || '').toLowerCase().includes(q)
      ) {
        results.push({
          type: 'bid',
          title: `${b.vendor_name} — ${b.category}`,
          subtitle: `$${b.total_amount.toLocaleString()} · ${b.status}`,
          id: b.id,
          href: '/bids',
        })
      }
    }

    // Search budget items
    for (const item of budgetItems) {
      if (
        item.category.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        (item.subcategory || '').toLowerCase().includes(q)
      ) {
        results.push({
          type: 'budget',
          title: `${item.category}: ${item.description}`,
          subtitle: item.actual_cost
            ? `$${item.actual_cost.toLocaleString()} actual`
            : `$${(item.estimated_cost || 0).toLocaleString()} estimated`,
          id: item.id,
          href: '/budget',
        })
      }
    }

    // Search selections
    for (const s of selections) {
      if (
        s.product_name.toLowerCase().includes(q) ||
        (s.brand || '').toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.room.toLowerCase().includes(q) ||
        (s.model_number || '').toLowerCase().includes(q)
      ) {
        results.push({
          type: 'selection',
          title: `${s.product_name}${s.brand ? ` (${s.brand})` : ''}`,
          subtitle: `${s.room} · ${s.category} · ${s.status}`,
          id: s.id,
          href: '/selections',
        })
      }
    }

    // Search emails
    for (const e of emails) {
      if (
        e.subject.toLowerCase().includes(q) ||
        e.sender_email.toLowerCase().includes(q) ||
        (e.sender_name || '').toLowerCase().includes(q) ||
        (e.ai_summary || '').toLowerCase().includes(q)
      ) {
        results.push({
          type: 'email',
          title: e.subject,
          subtitle: `From ${e.sender_name || e.sender_email} · ${e.received_date?.split('T')[0] || ''}`,
          id: e.id || e.message_id,
          href: '/emails',
        })
      }
    }

    // Search contacts
    for (const c of contacts) {
      if (
        (c.name || '').toLowerCase().includes(q) ||
        (c.company || '').toLowerCase().includes(q) ||
        (c.role || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q)
      ) {
        results.push({
          type: 'contact',
          title: c.name,
          subtitle: `${c.role || ''} ${c.company ? `at ${c.company}` : ''}`.trim(),
          id: c.id,
          href: '/assistant',
        })
      }
    }

    // Search tasks
    for (const t of tasks) {
      if (
        (t.title || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
      ) {
        results.push({
          type: 'task',
          title: t.title,
          subtitle: `${t.priority} · ${t.status}`,
          id: t.id,
          href: '/project-status',
        })
      }
    }

    // Sort: exact matches first, then alphabetically
    results.sort((a, b) => {
      const aExact = a.title.toLowerCase().startsWith(q) ? 0 : 1
      const bExact = b.title.toLowerCase().startsWith(q) ? 0 : 1
      if (aExact !== bExact) return aExact - bExact
      return a.title.localeCompare(b.title)
    })

    return successResponse({ results: results.slice(0, 30) })
  } catch (error) {
    return errorResponse(error, 'Search failed')
  }
}
