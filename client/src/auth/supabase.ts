import { createClient } from '@supabase/supabase-js'

const url = import.meta.env?.VITE_PUBLIC_SUPABASE_URL
const key = import.meta.env?.VITE_PUBLIC_SUPABASE_ANON_KEY
export const supabase = url && key ? createClient(url, key, {
  auth: { detectSessionInUrl: false },
}) : null

// A username alias for the isolated, synthetic local fixture only. It does not
// bypass Supabase's password check or the API's instructor check.
export const localDemo = Boolean(import.meta.env?.DEV && url &&
  ['http://127.0.0.1:54321', 'http://localhost:54321'].includes(url.replace(/\/$/, '')))
