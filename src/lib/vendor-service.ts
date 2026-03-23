import { supabase } from './supabase'

export interface Vendor {
  id: string
  project_id: string
  company_name: string
  category: string | null
  status: string | null
  primary_contact: string | null
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface VendorWithContact extends Vendor {
  linked_contact: {
    id: string
    name: string
    email: string | null
    phone: string | null
    role: string | null
    company: string | null
  } | null
}

export async function getVendorsWithContacts(projectId: string): Promise<VendorWithContact[]> {
  const { data: vendors, error } = await supabase
    .from('vendors')
    .select('*')
    .eq('project_id', projectId)
    .order('company_name', { ascending: true })

  if (error) return []

  if (!vendors || vendors.length === 0) return []

  // Get all contacts for this project for linking
  const contactIds = vendors
    .map(v => v.primary_contact)
    .filter((id): id is string => !!id)

  let contactMap = new Map<string, { id: string; name: string; email: string | null; phone: string | null; role: string | null; company: string | null }>()

  if (contactIds.length > 0) {
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, name, email, phone, role, company')
      .in('id', contactIds)

    if (contacts) {
      contactMap = new Map(contacts.map(c => [c.id, c]))
    }
  }

  return vendors.map(v => ({
    ...v,
    linked_contact: v.primary_contact ? contactMap.get(v.primary_contact) || null : null,
  }))
}

export interface ProjectContact {
  id: string
  name: string
  email: string | null
  phone: string | null
  role: string | null
  company: string | null
}

export async function getProjectContacts(projectId: string): Promise<ProjectContact[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('id, name, email, phone, role, company')
    .eq('project_id', projectId)
    .order('name', { ascending: true })

  if (error) return []
  return data || []
}

export async function linkVendorToContact(vendorId: string, contactId: string): Promise<boolean> {
  const { error } = await supabase
    .from('vendors')
    .update({ primary_contact: contactId, updated_at: new Date().toISOString() })
    .eq('id', vendorId)

  if (error) {
    console.error('Error linking vendor to contact:', error)
    return false
  }
  return true
}

export async function unlinkVendorContact(vendorId: string): Promise<boolean> {
  const { error } = await supabase
    .from('vendors')
    .update({ primary_contact: null, updated_at: new Date().toISOString() })
    .eq('id', vendorId)

  if (error) {
    console.error('Error unlinking vendor contact:', error)
    return false
  }
  return true
}
