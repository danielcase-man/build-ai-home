/**
 * Server-side Supabase client for use in Server Components and Route Handlers.
 * Creates a new instance per request to avoid shared state between requests.
 * Uses the public anon key (same RLS as client-side).
 */
import { createClient } from '@supabase/supabase-js'
import { env } from './env'

export function createServerSupabaseClient() {
  return createClient(env.supabaseUrl, env.supabaseAnonKey)
}
