import { createContext, useContext, useEffect, useState } from 'react'
import type { PropsWithChildren } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { authenticatedFetch } from '../api/http'

export type Profile = { id: number; subject: string; email: string; name: string; systemRole: 'user' | 'admin' | 'owner' }
type AuthContextValue = { session: Session | null; profile: Profile | null; loading: boolean; refreshProfile: () => Promise<void>; signOut: () => Promise<void> }
const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(activeSession: Session | null) {
    if (!activeSession) { setProfile(null); return }
    const response = await authenticatedFetch('/api/auth/me')
    if (!response.ok) throw new Error('Could not load your account.')
    setProfile(await response.json() as Profile)
  }

  async function refreshProfile() { await loadProfile(session) }

  useEffect(() => {
    let active = true
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      try { await loadProfile(data.session) } finally { if (active) setLoading(false) }
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(true)
      setTimeout(() => { void loadProfile(nextSession).finally(() => setLoading(false)) }, 0)
    })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])

  async function signOut() { await supabase.auth.signOut(); setProfile(null) }
  return <AuthContext.Provider value={{ session, profile, loading, refreshProfile, signOut }}>{children}</AuthContext.Provider>
}

// oxlint-disable-next-line react/only-export-components -- keeping the hook beside its provider avoids exporting the raw context.
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
