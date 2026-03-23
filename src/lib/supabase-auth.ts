/**
 * Supabase Auth — browser client only.
 * Safe to import from 'use client' components.
 *
 * For server-side auth, import from '@/lib/supabase-auth-server'.
 */

import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export function createAuthBrowserClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
