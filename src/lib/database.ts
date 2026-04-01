import { supabase } from './supabase'
import { env } from './env'
import { createActionItemNotification, createDeadlineNotification } from './notification-service'
import type { EmailRecord, EmailAccountRecord } from '@/types'

export class DatabaseService {

  // Email Account Management
  async getEmailAccount(emailAddress: string): Promise<EmailAccountRecord | null> {
    try {
      const { data, error } = await supabase
        .from('email_accounts')
        .select('*')
        .eq('email_address', emailAddress)
        .single()

      if (error) return null

      return data
    } catch {
      return null
    }
  }

  async upsertEmailAccount(account: EmailAccountRecord): Promise<EmailAccountRecord | null> {
    try {
      const { data, error } = await supabase
        .from('email_accounts')
        .upsert({
          ...account,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'email_address'
        })
        .select()
        .single()

      if (error) {
        console.error('Error upserting email account:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Database error:', error)
      return null
    }
  }

  async updateLastSync(emailAddress: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('email_accounts')
        .update({
          last_sync: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('email_address', emailAddress)

      if (error) {
        console.error('Error updating last sync:', error)
      }
    } catch (error) {
      console.error('Database error:', error)
    }
  }

  // Email Management
  async getStoredEmails(projectId?: string, limit: number = 50): Promise<EmailRecord[]> {
    try {
      let query = supabase
        .from('emails')
        .select('*')
        .order('received_date', { ascending: false })
        .limit(limit)

      if (projectId) {
        query = query.eq('project_id', projectId)
      }

      const { data, error } = await query

      if (error) return []

      return data || []
    } catch {
      return []
    }
  }

  async storeEmail(email: EmailRecord): Promise<EmailRecord | null> {
    try {
      const { data, error } = await supabase
        .from('emails')
        .upsert({
          ...email,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'message_id'
        })
        .select()
        .single()

      if (error) {
        console.error('Error storing email:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Database error:', error)
      return null
    }
  }

  async storeEmails(emails: EmailRecord[]): Promise<EmailRecord[]> {
    try {
      const { data, error } = await supabase
        .from('emails')
        .upsert(
          emails.map(email => ({
            ...email,
            category: email.category || categorizeEmailBySender(email.sender_email, email.subject),
            updated_at: new Date().toISOString()
          })),
          { onConflict: 'message_id' }
        )
        .select()

      if (error) {
        console.error('Error storing emails:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Database error:', error)
      return []
    }
  }

  async emailExists(messageId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('emails')
        .select('id')
        .eq('message_id', messageId)
        .single()

      return !error && !!data
    } catch (error) {
      return false
    }
  }

  async getRecentEmails(days: number = 7, category?: 'construction' | 'all'): Promise<EmailRecord[]> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - days)

      let query = supabase
        .from('emails')
        .select('*')
        .gte('received_date', cutoffDate.toISOString())
        .order('received_date', { ascending: false })

      if (category === 'construction') {
        query = query.in('category', ['construction', 'legal', 'financial'])
      }

      const { data, error } = await query
      if (error) return []

      return data || []
    } catch {
      return []
    }
  }

  async storeEmailAttachments(
    emailId: string,
    attachments: Array<{ filename: string; mimeType: string; attachmentId: string; size: number }>
  ): Promise<void> {
    if (attachments.length === 0) return
    try {
      const { error } = await supabase
        .from('email_attachments')
        .upsert(
          attachments.map(att => ({
            email_id: emailId,
            filename: att.filename,
            file_type: att.mimeType,
            file_size: att.size,
            gmail_attachment_id: att.attachmentId,
            is_document: /\.(pdf|doc|docx|xls|xlsx|csv|txt)$/i.test(att.filename),
            is_image: /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(att.filename),
          })),
          { onConflict: 'email_id,filename', ignoreDuplicates: true }
        )
      if (error) {
        console.error('Error storing email attachments:', error)
      }
    } catch (error) {
      console.error('Database error storing attachments:', error)
    }
  }

  async getEmailAttachments(emailId: string): Promise<Array<{
    id: string
    filename: string
    file_type: string
    file_size: number
    gmail_attachment_id: string | null
    is_document: boolean
    is_image: boolean
  }>> {
    try {
      const { data, error } = await supabase
        .from('email_attachments')
        .select('id, filename, file_type, file_size, gmail_attachment_id, is_document, is_image')
        .eq('email_id', emailId)
        .order('filename', { ascending: true })

      if (error) {
        console.error('Error fetching email attachments:', error)
        return []
      }
      return data || []
    } catch (error) {
      console.error('Database error fetching attachments:', error)
      return []
    }
  }

  // Project Management
  async getOrCreateProject(address?: string): Promise<string | null> {
    const projectAddress = address || env.projectAddress || '708 Purple Salvia Cove, Liberty Hill, TX'
    const projectName = env.projectName || 'Construction Project'

    try {
      const { data } = await supabase
        .from('projects')
        .select('id')
        .eq('address', projectAddress)
        .single()

      if (data) {
        return data.id
      }

      // Create project if it doesn't exist
      const { data: newProject, error: createError } = await supabase
        .from('projects')
        .insert({
          name: projectName,
          address: projectAddress,
          phase: 'planning',
          budget_total: 450000
        })
        .select('id')
        .single()

      if (createError) {
        console.error('Error creating project:', createError)
        return null
      }

      return newProject?.id || null
    } catch (error) {
      console.error('Database error:', error)
      return null
    }
  }

  // Project Status Management
  async getLatestProjectStatus(projectId: string): Promise<{
    hot_topics: unknown[]
    action_items: unknown[]
    recent_decisions: unknown[]
    next_steps: unknown[]
    open_questions: unknown[]
    key_data_points: unknown[]
    ai_summary: string
    date: string
  } | null> {
    try {
      const { data, error } = await supabase
        .from('project_status')
        .select('hot_topics, action_items, recent_decisions, next_steps, open_questions, key_data_points, ai_summary, date')
        .eq('project_id', projectId)
        .order('date', { ascending: false })
        .limit(1)
        .single()

      if (error) return null

      if (!data) return null

      return {
        ...data,
        next_steps: data.next_steps || [],
        open_questions: data.open_questions || [],
        key_data_points: data.key_data_points || [],
      }
    } catch {
      return null
    }
  }

  async upsertProjectStatus(projectId: string, data: {
    phase?: string
    current_step?: number
    progress_percentage?: number
    hot_topics: unknown[]
    action_items: unknown[]
    recent_decisions: unknown[]
    next_steps?: unknown[]
    open_questions?: unknown[]
    key_data_points?: unknown[]
    budget_status?: string
    budget_used?: number
    ai_summary: string
  }): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0]

      const { error } = await supabase
        .from('project_status')
        .upsert({
          project_id: projectId,
          date: today,
          ...data,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'project_id,date'
        })

      if (error) {
        console.error('Error upserting project status:', error)
      }
    } catch (error) {
      console.error('Database error:', error)
    }
  }

  async getProjectStatusHistory(projectId: string, limit: number = 7): Promise<Array<{
    hot_topics: unknown[]
    action_items: unknown[]
    recent_decisions: unknown[]
    next_steps: unknown[]
    open_questions: unknown[]
    key_data_points: unknown[]
    ai_summary: string
    date: string
  }>> {
    try {
      const { data, error } = await supabase
        .from('project_status')
        .select('hot_topics, action_items, recent_decisions, next_steps, open_questions, key_data_points, ai_summary, date')
        .eq('project_id', projectId)
        .order('date', { ascending: false })
        .limit(limit)

      if (error) return []

      return (data || []).map(row => ({
        ...row,
        next_steps: row.next_steps || [],
        open_questions: row.open_questions || [],
        key_data_points: row.key_data_points || [],
      }))
    } catch {
      return []
    }
  }

  // AI-to-Tasks sync: create/update tasks from AI-derived action items
  async syncAIInsightsToTasks(projectId: string, actionItems: Array<{
    status: string
    text: string
    action_type?: 'draft_email' | null
    action_context?: { to?: string; to_name?: string; subject_hint?: string; context?: string }
  }>): Promise<void> {
    if (actionItems.length === 0) return

    try {
      // Get existing AI-generated tasks to avoid duplicates
      const { data: existingTasks } = await supabase
        .from('tasks')
        .select('id, title, status, notes')
        .eq('project_id', projectId)
        .like('notes', '%[ai-generated]%')

      // Normalize task text for fuzzy matching — strip prices, dates, quantities, parentheticals
      const normalizeForMatch = (s: string) => s.toLowerCase()
        .replace(/\$[\d,]+(\.\d+)?/g, '')           // prices
        .replace(/20\d{2}[-/]\d{1,2}[-/]\d{1,2}/g, '') // dates
        .replace(/\d+ (bids?|days?|weeks?|months?|runs?)/g, '') // quantities
        .replace(/\([^)]*\)/g, '')                    // parentheticals
        .replace(/\s+/g, ' ').trim()
        .slice(0, 80) // Compare first 80 chars to handle truncation differences

      const existingNormalized = (existingTasks || []).map(t => ({
        ...t,
        normalized: normalizeForMatch(t.title),
      }))

      for (const item of actionItems) {
        const itemNorm = normalizeForMatch(item.text)

        // Check if a matching task already exists (fuzzy: first 80 chars after normalization)
        const existing = existingNormalized.find(
          t => t.normalized === itemNorm || t.title.toLowerCase() === item.text.toLowerCase()
        )

        if (existing) {
          // Update status if the AI changed it
          const dbStatus = item.status === 'in-progress' ? 'in_progress' : item.status
          if (existing.status !== dbStatus && existing.status !== 'completed') {
            await supabase
              .from('tasks')
              .update({
                status: dbStatus,
                updated_at: new Date().toISOString()
              })
              .eq('id', existing.id)
          }
        } else if (!existingNormalized.some(t => t.normalized === itemNorm) && item.status !== 'completed') {
          // Skip "Select vendor for X" tasks when selections already exist for that category
          const vendorSelectMatch = item.text.match(/select vendor for (\w[\w\s&]*)/i)
          if (vendorSelectMatch) {
            const bidCategory = vendorSelectMatch[1].trim()
            const { data: existingSelections } = await supabase
              .from('selections')
              .select('id')
              .eq('project_id', projectId)
              .ilike('category', `%${bidCategory.toLowerCase().replace(/s$/, '')}%`)
              .not('status', 'in', '("alternative","considering")')
              .limit(1)
            if (existingSelections && existingSelections.length > 0) continue
          }

          // Create new task for pending/in-progress items only
          const priority = item.action_type === 'draft_email' ? 'high' : 'medium'
          const notes = item.action_context
            ? `[ai-generated] Email to: ${item.action_context.to_name || item.action_context.to || 'unknown'} — ${item.action_context.context || ''}`
            : '[ai-generated]'

          await supabase
            .from('tasks')
            .insert({
              project_id: projectId,
              title: item.text,
              priority,
              status: item.status === 'in-progress' ? 'in_progress' : 'pending',
              notes,
            })

          existingNormalized.push({ id: 'new', title: item.text, status: 'pending', notes: '', normalized: itemNorm })

          // Fire notification for high-priority new items
          if (priority === 'high') {
            await createActionItemNotification(projectId, item.text)
          }
        }
      }

      // Scan for tasks approaching deadline (within 3 days) and create notifications
      const threeDaysOut = new Date()
      threeDaysOut.setDate(threeDaysOut.getDate() + 3)
      const { data: urgentTasks } = await supabase
        .from('tasks')
        .select('id, title, due_date')
        .eq('project_id', projectId)
        .neq('status', 'completed')
        .gte('due_date', new Date().toISOString().split('T')[0])
        .lte('due_date', threeDaysOut.toISOString().split('T')[0])

      for (const task of urgentTasks || []) {
        if (task.due_date) {
          await createDeadlineNotification(projectId, task.title, task.due_date)
        }
      }
    } catch (error) {
      console.error('Error syncing AI insights to tasks:', error)
    }
  }

  // Gmail History ID Management
  async getGmailHistoryId(emailAddress: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('email_accounts')
        .select('gmail_history_id')
        .eq('email_address', emailAddress)
        .single()

      if (error || !data) return null
      return data.gmail_history_id || null
    } catch {
      return null
    }
  }

  async updateGmailHistoryId(emailAddress: string, historyId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('email_accounts')
        .update({
          gmail_history_id: historyId,
          updated_at: new Date().toISOString(),
        })
        .eq('email_address', emailAddress)

      if (error) {
        console.error('Error updating Gmail history ID:', error)
      }
    } catch (error) {
      console.error('Database error:', error)
    }
  }

  // Contact-based email query builder
  async getProjectContactEmails(projectId: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('email')
        .eq('project_id', projectId)
        .eq('track_emails', true)

      if (error) return []

      return (data || [])
        .map(c => c.email)
        .filter((email): email is string => !!email)
    } catch {
      return []
    }
  }

  async buildEmailSearchQuery(projectId: string, daysBack: number = 7): Promise<string> {
    const contactEmails = await this.getProjectContactEmails(projectId)

    // Get project address for property-mention matching
    const { data: project } = await supabase
      .from('projects')
      .select('address')
      .eq('id', projectId)
      .single()

    const parts: string[] = []

    // Add contact email filters — match both received AND sent emails
    // This is the primary, most reliable filter
    if (contactEmails.length > 0) {
      const fromFilters = contactEmails.map(e => `from:${e}`)
      const toFilters = contactEmails.map(e => `to:${e}`)
      parts.push(...fromFilters, ...toFilters)
    }

    // Always include @ubuildit.com domain (both directions)
    parts.push('from:@ubuildit.com', 'to:@ubuildit.com')

    // Match full street address as a quoted phrase (precise, avoids noise)
    const address = project?.address
    if (address) {
      const streetMatch = address.match(/^[\d]+\s+[^,]+/)
      if (streetMatch) {
        parts.push(`"${streetMatch[0]}"`)
      }
    }

    const queryBody = parts.length > 0
      ? `(${parts.join(' OR ')})`
      : 'label:inbox'

    return `${queryBody} newer_than:${daysBack}d`
  }

  // ── Lightweight queries for home page ─────────────────────────────────────

  /** Return the most recent email previews (no body text). */
  async getRecentEmailPreviews(limit: number = 5): Promise<Array<{
    sender_name: string | null
    sender_email: string
    subject: string
    received_date: string
    ai_summary: string | null
  }>> {
    try {
      const { data, error } = await supabase
        .from('emails')
        .select('sender_name, sender_email, subject, received_date, ai_summary')
        .order('received_date', { ascending: false })
        .limit(limit)

      if (error) return []

      return data || []
    } catch {
      return []
    }
  }

  /** Get upcoming deadlines: tasks due within N days + bids expiring within N days. */
  async getUpcomingDeadlines(projectId: string, days: number = 7): Promise<Array<{
    type: 'task' | 'bid'
    title: string
    due_date: string
    days_remaining: number
    link: string
  }>> {
    const now = new Date()
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() + days)
    const nowISO = now.toISOString().split('T')[0]
    const cutoffISO = cutoff.toISOString().split('T')[0]

    try {
      const [tasksResult, bidsResult] = await Promise.all([
        supabase
          .from('tasks')
          .select('title, due_date')
          .eq('project_id', projectId)
          .neq('status', 'completed')
          .gte('due_date', nowISO)
          .lte('due_date', cutoffISO)
          .order('due_date', { ascending: true }),
        supabase
          .from('bids')
          .select('vendor_name, category, valid_until')
          .eq('project_id', projectId)
          .neq('status', 'rejected')
          .neq('status', 'expired')
          .gte('valid_until', nowISO)
          .lte('valid_until', cutoffISO)
          .order('valid_until', { ascending: true }),
      ])

      const items: Array<{ type: 'task' | 'bid'; title: string; due_date: string; days_remaining: number; link: string }> = []

      for (const t of tasksResult.data || []) {
        if (!t.due_date) continue
        const daysLeft = Math.ceil((new Date(t.due_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        items.push({ type: 'task', title: t.title, due_date: t.due_date, days_remaining: daysLeft, link: '/project-status' })
      }

      for (const b of bidsResult.data || []) {
        if (!b.valid_until) continue
        const daysLeft = Math.ceil((new Date(b.valid_until).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        items.push({ type: 'bid', title: `${b.vendor_name} — ${b.category} bid expires`, due_date: b.valid_until, days_remaining: daysLeft, link: '/bids' })
      }

      items.sort((a, b) => a.days_remaining - b.days_remaining)
      return items
    } catch {
      return []
    }
  }

  /** Clear OAuth tokens for a Gmail account (used when tokens are broken and user needs to re-auth). */
  async clearEmailAccountTokens(emailAddress: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('email_accounts')
        .update({ oauth_tokens: null, updated_at: new Date().toISOString() })
        .eq('email_address', emailAddress)

      if (error) {
        console.error('Error clearing email account tokens:', error)
        return false
      }
      return true
    } catch (error) {
      console.error('Database error clearing tokens:', error)
      return false
    }
  }

  /**
   * Auto-resolve AI-generated follow-up tasks when the person being followed up
   * with emails back. Matches sender name/email against task text.
   * Returns count of tasks resolved.
   */
  async resolveTasksFromEmail(
    projectId: string,
    senderEmail: string,
    senderName: string,
    subject: string
  ): Promise<number> {
    try {
      // Get open AI-generated tasks
      const { data: openTasks, error } = await supabase
        .from('tasks')
        .select('id, title, notes')
        .eq('project_id', projectId)
        .like('notes', '%[ai-generated]%')
        .in('status', ['pending', 'in_progress'])

      if (error || !openTasks || openTasks.length === 0) return 0

      const normalize = (s: string) =>
        s.toLowerCase()
          .replace(/\b(llc|inc|corp|ltd|co|group)\b/gi, '')
          .replace(/[^a-z0-9 ]/g, '')
          .trim()

      const senderNameNorm = normalize(senderName || '')
      const senderEmailLower = (senderEmail || '').toLowerCase()
      const senderDomain = senderEmailLower.split('@')[1] || ''

      // Extract a meaningful domain label: "riverbearfinancial.com" → "riverbear financial"
      const domainLabel = senderDomain
        ? normalize(senderDomain.split('.')[0].replace(/([a-z])([A-Z])/g, '$1 $2'))
        : ''

      // Patterns to extract person/company name from task text
      const namePatterns = [
        /follow\s*up\s+with\s+(.+?)(?:\s+(?:about|on|re|regarding|for)\b|$)/i,
        /from\s+(.+?)(?:\s+(?:about|on|re|regarding)\b|$)/i,
        /(?:email|contact|reach out to|write to|message)\s+(.+?)(?:\s+(?:about|on|re|regarding|for)\b|$)/i,
        /with\s+(.+?)(?:\s+(?:about|on|re|regarding|for)\b|$)/i,
        /(?:to|from)\s+(.+?)(?:\s+at\b|$)/i,
      ]

      let resolvedCount = 0

      for (const task of openTasks) {
        const taskText = `${task.title} ${task.notes || ''}`.toLowerCase()

        let matched = false

        // 1. Direct sender email or name match in task text
        if (senderEmailLower && taskText.includes(senderEmailLower)) {
          matched = true
        }

        // 2. Try extracting name from task and matching against sender
        if (!matched && senderNameNorm) {
          for (const pattern of namePatterns) {
            const m = task.title.match(pattern)
            if (m) {
              const extractedName = normalize(m[1])
              if (!extractedName) continue
              // Partial match both ways (handles "David Wilson" vs "David" or "Wilson")
              if (
                senderNameNorm.includes(extractedName) ||
                extractedName.includes(senderNameNorm)
              ) {
                matched = true
                break
              }
              // Check individual words (at least 2 chars) for partial name matches
              const extractedWords = extractedName.split(/\s+/).filter(w => w.length >= 2)
              const senderWords = senderNameNorm.split(/\s+/).filter(w => w.length >= 2)
              if (extractedWords.some(ew => senderWords.some(sw => sw === ew))) {
                matched = true
                break
              }
            }
          }
        }

        // 3. Domain-based match: task mentions company name that maps to sender domain
        if (!matched && domainLabel) {
          // Split domain label into words and check if any appear in task text
          const domainWords = domainLabel.split(/\s+/).filter(w => w.length >= 4)
          if (domainWords.some(dw => taskText.includes(dw))) {
            matched = true
          }
        }

        if (matched) {
          const resolveNote = `[auto-resolved: reply received from ${senderName || senderEmail} on ${new Date().toISOString().split('T')[0]}]`
          const updatedNotes = task.notes ? `${task.notes}\n${resolveNote}` : resolveNote

          await supabase
            .from('tasks')
            .update({
              status: 'completed',
              completed_date: new Date().toISOString(),
              notes: updatedNotes,
              updated_at: new Date().toISOString(),
            })
            .eq('id', task.id)

          resolvedCount++
        }
      }

      if (resolvedCount > 0) {
        console.log(`Auto-resolved ${resolvedCount} task(s) from email by ${senderName} <${senderEmail}>`)
      }

      return resolvedCount
    } catch (error) {
      console.error('Error resolving tasks from email:', error)
      return 0
    }
  }

  /** Check whether a Gmail account with OAuth tokens exists. */
  async hasEmailAccountConfigured(): Promise<boolean> {
    try {
      const gmailEmail = env.gmailUserEmail
      if (!gmailEmail) return false

      const { data, error } = await supabase
        .from('email_accounts')
        .select('id')
        .eq('email_address', gmailEmail)
        .not('oauth_tokens', 'is', null)
        .limit(1)

      if (error) return false
      return (data?.length ?? 0) > 0
    } catch {
      return false
    }
  }
}

/**
 * Classify an email as construction-related or other based on sender domain.
 * Simple pattern matching — no AI needed for this.
 */
/**
 * Fallback email categorization by sender domain.
 * Used when AI classification hasn't run yet (e.g., manual fetch).
 * AI classification in classifyAndSummarizeEmail() is more accurate.
 */
function categorizeEmailBySender(senderEmail: string | undefined, subject: string | undefined): string {
  if (!senderEmail) return 'unknown'
  const email = senderEmail.toLowerCase()
  const subj = (subject || '').toLowerCase()

  // Known construction vendor/partner domains — be specific
  const constructionDomains = [
    'ubuildit.com', 'asiri-designs.com', 'riverbearfinancial.com',
    'fouraengineering.com', 'copeland-eng.com', '3daydesign.com',
    'trisupply.net', 'byop.net', 'cobrastone.com', 'lentzengineering.com',
    'bldr.com', 'kristynik', 'thefederalsavingsbank.com', 'kippflores.com',
    'swengineers.com', 'triplecseptic', 'prosource',
  ]
  for (const domain of constructionDomains) {
    if (email.includes(domain)) return 'construction'
  }

  // Subject keywords strongly indicating construction
  const constructionSubjects = [
    'purple salvia', 'ubuildit', 'urla', 'foundation', 'structural',
    'septic', 'grading plan', 'bid', 'quote', 'estimate',
  ]
  for (const kw of constructionSubjects) {
    if (subj.includes(kw)) return 'construction'
  }

  // Default to unknown — let AI classify properly
  // DO NOT default to 'construction' — strict filtering is better than noise
  return 'unknown'
}

export const db = new DatabaseService()
