// Who is signed in, kept current. Same shape as the feedback site's version,
// so the two apps answer "who is this" identically.
//
//   session === undefined   still asking Supabase
//   session === null        signed out
//   role                    'admin' | 'coach' | null, read from the token
//
// The role lives in app_metadata, which only the server can set - a user
// cannot promote themselves by editing anything in the browser.
import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'

export function useSession() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => subscription.unsubscribe()
  }, [])

  const meta = session?.user?.app_metadata ?? {}
  const role = meta.role === 'admin' || meta.role === 'coach' ? meta.role : null
  return { session, role }
}
