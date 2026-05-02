import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

// Build a Supabase client that injects the Clerk session JWT into every request
// (for RLS policies that read auth.jwt()->>'sub' to identify the user).
// Pass a `getToken` function that returns a Promise<string|null> — typically
// useAuth().getToken({ template: 'supabase' }) from @clerk/clerk-react.
export function makeSupabaseClient(getToken) {
  if (!supabaseConfigured) return null
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      fetch: async (input, init = {}) => {
        const token = getToken ? await getToken() : null
        const headers = new Headers(init.headers)
        if (token) headers.set('Authorization', `Bearer ${token}`)
        return fetch(input, { ...init, headers })
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
