/**
 * Email Template Service — reusable templates for common vendor communications.
 *
 * Templates use {{variable}} placeholders that get replaced at render time.
 */

import { supabase } from './supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmailTemplate {
  id?: string
  project_id: string
  name: string
  subject_template: string
  body_template: string
  variables: Array<{ name: string; description: string; default?: string }>
  created_at?: string
  updated_at?: string
}

// ---------------------------------------------------------------------------
// Read Operations
// ---------------------------------------------------------------------------

/** Get all templates for a project */
export async function getTemplates(projectId: string): Promise<EmailTemplate[]> {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('project_id', projectId)
    .order('name', { ascending: true })

  if (error) return []
  return (data || []) as EmailTemplate[]
}

/** Get a single template by name */
export async function getTemplateByName(projectId: string, name: string): Promise<EmailTemplate | null> {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('project_id', projectId)
    .eq('name', name)
    .single()

  if (error) return null
  return data as EmailTemplate
}

/** Render a template with variable substitutions */
export function renderTemplate(
  template: EmailTemplate,
  variables: Record<string, string>
): { subject: string; body: string } {
  let subject = template.subject_template
  let body = template.body_template

  // Apply defaults first, then user-provided values
  for (const v of template.variables) {
    const value = variables[v.name] || v.default || ''
    const pattern = new RegExp(`\\{\\{${v.name}\\}\\}`, 'g')
    subject = subject.replace(pattern, value)
    body = body.replace(pattern, value)
  }

  // Also replace any remaining {{variables}} from the vars map
  for (const [key, value] of Object.entries(variables)) {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    subject = subject.replace(pattern, value)
    body = body.replace(pattern, value)
  }

  return { subject, body }
}

// ---------------------------------------------------------------------------
// Write Operations
// ---------------------------------------------------------------------------

/** Create or update a template */
export async function upsertTemplate(template: EmailTemplate): Promise<EmailTemplate | null> {
  const { data, error } = await supabase
    .from('email_templates')
    .upsert({
      project_id: template.project_id,
      name: template.name,
      subject_template: template.subject_template,
      body_template: template.body_template,
      variables: template.variables,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'project_id,name' })
    .select()
    .single()

  if (error) {
    console.error('Error upserting template:', error)
    return null
  }
  return data as EmailTemplate
}

/** Seed default templates for a project */
export async function createDefaultTemplates(projectId: string): Promise<number> {
  const defaults: Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at'>[] = [
    {
      project_id: projectId,
      name: 'bid_request',
      subject_template: 'Bid Request: {{category}} — Case Residence, 708 Purple Salvia Cove',
      body_template: `<p>Hi {{vendor_name}},</p>

<p>My name is Daniel Case and I am building a 7,526 SF French Country Estate at 708 Purple Salvia Cove, Liberty Hill, TX 78642 (Williamson County). I am working with UBuildIt (Texas Home Consulting) as my building consultant.</p>

<p>I would like to request a bid for <b>{{category}}</b> for this project.</p>

<p><b>Project Details:</b></p>
<ul>
  <li><b>Address:</b> 708 Purple Salvia Cove, Liberty Hill, TX 78642</li>
  <li><b>Size:</b> ~7,526 sq ft (main house)</li>
  <li><b>Style:</b> French Country Estate</li>
  <li><b>Scope:</b> {{scope_description}}</li>
</ul>

<p>{{additional_notes}}</p>

<p>Architectural plans are available upon request. Please let me know if you need any additional information to prepare your bid.</p>

<p>Best regards,<br>Daniel Case<br>(714) 872-0025<br>danielcase.info@gmail.com</p>`,
      variables: [
        { name: 'vendor_name', description: 'Vendor contact name' },
        { name: 'category', description: 'Bid category (e.g., Framing, Electrical)' },
        { name: 'scope_description', description: 'Brief scope of work description' },
        { name: 'additional_notes', description: 'Any additional notes or requirements', default: '' },
      ],
    },
    {
      project_id: projectId,
      name: 'bid_follow_up',
      subject_template: 'Following Up: {{category}} Bid — Case Residence',
      body_template: `<p>Hi {{vendor_name}},</p>

<p>I wanted to follow up on the bid request I sent on {{request_date}} for <b>{{category}}</b> at our home build at 708 Purple Salvia Cove, Liberty Hill, TX.</p>

<p>We are in the process of finalizing our vendor selections and would love to include your bid in our review. If you need any additional information or plans to complete the bid, please let me know.</p>

<p>{{additional_notes}}</p>

<p>Best regards,<br>Daniel Case<br>(714) 872-0025<br>danielcase.info@gmail.com</p>`,
      variables: [
        { name: 'vendor_name', description: 'Vendor contact name' },
        { name: 'category', description: 'Bid category' },
        { name: 'request_date', description: 'When the original bid was requested' },
        { name: 'additional_notes', description: 'Additional context', default: '' },
      ],
    },
    {
      project_id: projectId,
      name: 'schedule_confirmation',
      subject_template: 'Schedule Confirmation: {{trade}} — 708 Purple Salvia Cove',
      body_template: `<p>Hi {{vendor_name}},</p>

<p>This is to confirm that <b>{{trade}}</b> work is scheduled to begin on <b>{{start_date}}</b> at 708 Purple Salvia Cove, Liberty Hill, TX 78642.</p>

<p><b>Key Details:</b></p>
<ul>
  <li><b>Start Date:</b> {{start_date}}</li>
  <li><b>Estimated Duration:</b> {{duration}}</li>
  <li><b>Site Contact:</b> Daniel Case — (714) 872-0025</li>
  <li><b>Building Consultant:</b> Aaron Mischenko — (737) 775-6134</li>
</ul>

<p>{{additional_notes}}</p>

<p>Please confirm receipt and let me know if you have any questions.</p>

<p>Best regards,<br>Daniel Case<br>(714) 872-0025<br>danielcase.info@gmail.com</p>`,
      variables: [
        { name: 'vendor_name', description: 'Vendor contact name' },
        { name: 'trade', description: 'Trade or service type' },
        { name: 'start_date', description: 'Scheduled start date' },
        { name: 'duration', description: 'Expected duration', default: 'TBD' },
        { name: 'additional_notes', description: 'Additional info', default: '' },
      ],
    },
    {
      project_id: projectId,
      name: 'thank_you_bid',
      subject_template: 'Thank You for Your Bid: {{category}} — Case Residence',
      body_template: `<p>Hi {{vendor_name}},</p>

<p>Thank you for submitting your bid for <b>{{category}}</b> for our home at 708 Purple Salvia Cove, Liberty Hill, TX. We appreciate the time you put into the proposal.</p>

<p>We are currently reviewing all bids and will be making our decision by <b>{{decision_date}}</b>. {{additional_notes}}</p>

<p>Best regards,<br>Daniel Case<br>(714) 872-0025<br>danielcase.info@gmail.com</p>`,
      variables: [
        { name: 'vendor_name', description: 'Vendor contact name' },
        { name: 'category', description: 'Bid category' },
        { name: 'decision_date', description: 'When you expect to decide' },
        { name: 'additional_notes', description: 'Additional notes', default: '' },
      ],
    },
  ]

  let created = 0
  for (const template of defaults) {
    const result = await upsertTemplate(template)
    if (result) created++
  }

  return created
}
