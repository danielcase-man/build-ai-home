/**
 * Supabase Auth — server-side clients.
 * Only import from Server Components and Route Handlers.
 * Do NOT import from 'use client' components or middleware.
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function createAuthServerClient() {
  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Called from Server Component — can't set cookies
        }
      },
    },
  })
}

export async function getCurrentUser() {
  const supabase = await createAuthServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getCurrentUserProfile() {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createAuthServerClient()
  const { data } = await supabase
    .from('user_profiles')
    .select('*, project_members(project_id, role, permissions)')
    .eq('auth_user_id', user.id)
    .single()

  return data
}
