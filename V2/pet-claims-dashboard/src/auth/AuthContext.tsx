import React, { createContext, useContext, useMemo, useState } from 'react'
import type { AuthUser } from './auth'
import { getSession, logout as doLogout, updateProfile as doUpdateProfile } from './auth'

type AuthCtx = {
  user: AuthUser | null
  setUser: (u: AuthUser | null) => void
  logout: () => void
  updateProfile: (patch: Partial<Pick<AuthUser, 'name' | 'email'>>) => AuthUser
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (typeof window === 'undefined') return null
    return getSession()
  })

  const value = useMemo<AuthCtx>(() => ({
    user,
    setUser,
    logout: () => {
      doLogout()
      setUser(null)
    },
    updateProfile: (patch) => {
      const next = doUpdateProfile(patch)
      setUser(next)
      return next
    },
  }), [user])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

