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

if (!url || !key) {
  // Thrown at import time on purpose: a missing key otherwise shows up as a
  // confusing "failed to fetch" on the first sign-in attempt.
  throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not set — copy .env.example to .env.local.')
}

export const supabase = createClient(url, key)

/** The signed-in user's access token, or null. Sent with every roster API call. */
export async function accessToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}
