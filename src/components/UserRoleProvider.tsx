'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export type UserRole = 'owner' | 'consultant' | 'vendor'

interface UserInfo {
  id: string
  email: string
  display_name: string
  role: UserRole
  vendor_id: string | null
}

interface UserRoleContextValue {
  user: UserInfo | null
  loading: boolean
}

const UserRoleContext = createContext<UserRoleContextValue>({
  user: null,
  loading: true,
})

export function useUserRole() {
  return useContext(UserRoleContext)
}

export default function UserRoleProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(res => {
        if (res.success && res.data?.authenticated) {
          setUser(res.data.user)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <UserRoleContext.Provider value={{ user, loading }}>
      {children}
    </UserRoleContext.Provider>
  )
}
