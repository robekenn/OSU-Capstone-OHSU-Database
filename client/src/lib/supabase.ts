import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string | undefined
if (!url || !anonKey) throw new Error('Supabase authentication environment variables are not configured.')

export const supabase = createClient(url, anonKey)
