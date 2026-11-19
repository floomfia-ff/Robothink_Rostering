// The shared Supabase project - the same one the feedback site uses, so the
// accounts are the same accounts. Nothing new to create: every login that
// opens the feedback admin opens this too.
//
// WHY THESE TWO ARE IN THE CODE AND NOT ENVIRONMENT VARIABLES
//
// This site is deployed from a different Vercel account to the feedback site,
// so setting variables there is not something we can do by pushing to this
// repo - and the roster showed "isn't configured yet" to everyone until these
// defaults existed.
//
// Both values are public by design. The anon key is MEANT to ship in the
// browser; it already does, inside the feedback site's bundle, and Supabase
// documents it as safe in client code. On its own it grants nothing. What
// decides who may read or change the roster is two things that are not in the
// browser: row level security (on, with no policies, on every roster table)
// and the signed-in account's role, checked by the roster Edge Function.
//
// This is NOT the place for the service_role key, which bypasses row level
// security entirely. If you are ever pasting a Supabase key in here, it is the
// one labelled `anon` / `public`.
//
// An environment variable still wins when one is set, so moving these to
// Vercel later needs no code change.
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || 'https://kfqaaehcjqzfqxhmtskg.supabase.co'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_HQ2BNpMnrr173lnKmPWrtQ_1rn1UwKp'

/** False only if someone removes the defaults above AND sets no variable. */
export const configured = Boolean(url && key)

export const supabase = createClient(url, key)

/** The signed-in user's access token, or null. Sent with every roster API call. */
export async function accessToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}
