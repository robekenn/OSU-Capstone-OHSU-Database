import { supabase } from '../auth/supabase'

export async function appFetch(path: string, init: RequestInit = {}) {
  if (!path.startsWith('/api/')) throw new Error('Expected a same-origin API path')
  const headers = new Headers(init.headers)
  const session = await supabase?.auth.getSession()
  const token = session?.data.session?.access_token
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return fetch(path, { ...init, headers, redirect: 'error' })
}
