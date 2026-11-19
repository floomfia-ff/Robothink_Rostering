// The shared Supabase project - the same one the feedback site uses, so the
// accounts are the same accounts. Nothing new to create: every login that
// opens the feedback admin opens this too.
//
// Both values below are safe in the browser. The anon key is designed to be
// public; it identifies the project, it does not grant anything on its own.
// What decides who may read or change the roster is the signed-in user's role,
// checked by the roster Edge Function.
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

/** False when the two variables above are missing, so the page can say so. */
export const configured = Boolean(url && key)

// Deliberately does NOT throw when they are missing. Throwing here runs at
// import time, before React renders anything, so the whole site would be a
// blank white page - and the likeliest moment for that is the first deploy
// after this change, when the host has the old variables but not these two.
// A placeholder client lets RequireAdmin render a message that says which
// variables to add and where.
export const supabase = createClient(url || 'https://placeholder.supabase.co', key || 'placeholder')

/** The signed-in user's access token, or null. Sent with every roster API call. */
export async function accessToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}
