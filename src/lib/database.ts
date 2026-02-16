import { supabase } from './supabase'
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

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        console.error('Error fetching email account:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Database error:', error)
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

      if (error) {
        console.error('Error fetching stored emails:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Database error:', error)
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

  async getRecentEmails(days: number = 7): Promise<EmailRecord[]> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - days)

      const { data, error } = await supabase
        .from('emails')
        .select('*')
        .gte('received_date', cutoffDate.toISOString())
        .order('received_date', { ascending: false })

      if (error) {
        console.error('Error fetching recent emails:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Database error:', error)
      return []
    }
  }

  // Project Management
  async getOrCreateProject(address?: string): Promise<string | null> {
    const projectAddress = address || '708 Purple Salvia Cove, Liberty Hill, TX'

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
          name: 'Purple Salvia Cove Construction',
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
}

export const db = new DatabaseService()
