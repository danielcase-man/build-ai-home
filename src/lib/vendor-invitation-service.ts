/**
 * Vendor Invitation Service — manage vendor access invitations.
 *
 * Uses the vendor_invitations table (Migration 002) to create time-limited
 * invitation tokens that vendors can use to view their scoped project data.
 */

import { supabase } from './supabase'
import crypto from 'crypto'

export interface VendorInvitation {
  id: string
  project_id: string
  vendor_id: string
  email: string
  token: string
  role: string
  expires_at: string
  accepted_at: string | null
  created_at: string
}

/**
 * Create an invitation for a vendor or consultant to access the project.
 * Generates a secure random token with a 7-day expiration.
 */
export async function createVendorInvitation(
  projectId: string,
  vendorId: string | null,
  email: string,
  role: 'vendor' | 'consultant' = 'vendor',
): Promise<VendorInvitation | null> {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('vendor_invitations')
    .insert({
      project_id: projectId,
      vendor_id: vendorId,
      email,
      token,
      role,
      expires_at: expiresAt,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating invitation:', error)
    return null
  }

  return data as VendorInvitation
}

/**
 * Get all invitations for a project.
 */
export async function getVendorInvitations(
  projectId: string,
): Promise<VendorInvitation[]> {
  const { data, error } = await supabase
    .from('vendor_invitations')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) return []
  return (data || []) as VendorInvitation[]
}

/**
 * Look up an invitation by token. Returns null if expired or not found.
 */
export async function getInvitationByToken(
  token: string,
): Promise<VendorInvitation | null> {
  const { data, error } = await supabase
    .from('vendor_invitations')
    .select('*')
    .eq('token', token)
    .single()

  if (error || !data) return null

  // Check expiration
  if (new Date(data.expires_at) < new Date()) return null

  return data as VendorInvitation
}

/**
 * Mark an invitation as accepted.
 */
export async function acceptInvitation(
  token: string,
): Promise<boolean> {
  const { error } = await supabase
    .from('vendor_invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('token', token)
    .is('accepted_at', null)

  return !error
}

/**
 * Revoke (delete) an invitation.
 */
export async function revokeInvitation(
  invitationId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from('vendor_invitations')
    .delete()
    .eq('id', invitationId)

  return !error
}
