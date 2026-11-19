// ============================================================================
//  The sign-in gate. THIS IS THE WHOLE OF IT - one file.
//
//  WHAT IT REPLACES
//
//  Until now the roster had no login at all. main.jsx rendered the dashboard
//  straight away, and the only thing standing between the public internet and
//  every coach's name, home MRT station and weekly placement was a shared code
//  compiled into the JavaScript - which .env.example itself described as "not
//  a secret". Anyone with the address could read the roster and delete weeks.
//
//  WHAT HAPPENS NOW
//
//    loading   -> a spinner, while we ask Supabase who this is
//    signed out -> the form below
//    signed in, not an admin -> a short "ask Matin" message
//    signed in as an admin   -> the roster
//
//  There is nothing new to set up. This uses the SAME accounts as the feedback
//  site's admin dashboard - all five of them already have role 'admin' - so
//  everyone signs in with the login they already have.
//
//  The gate is the visible half of the fix. The other half is the Edge
//  Function refusing anyone without a valid admin token, so that closing the
//  page is not the only thing stopping someone calling the API directly. See
//  supabase/functions/roster/index.ts.
// ============================================================================

import { useState } from 'react'
import { configured, supabase } from '../lib/supabase.js'
import { useSession } from '../lib/session.js'

const FIELD = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200'

export default function RequireAdmin({ children }) {
  const { session, role } = useSession()

  // The host is missing the two Supabase variables - most likely the first
  // deploy after this change. Say which ones and where, rather than failing
  // as a blank page or a confusing "failed to fetch" on the first sign-in.
  if (!configured) {
    return (
      <Centred>
        <p className="text-base font-semibold text-slate-900">The roster isn&rsquo;t configured yet</p>
        <p className="max-w-md text-sm text-slate-600">
          It needs <code className="rounded bg-slate-200 px-1">VITE_SUPABASE_URL</code> and{' '}
          <code className="rounded bg-slate-200 px-1">VITE_SUPABASE_ANON_KEY</code>, the same two values the
          feedback site uses. Add them in Vercel under Settings → Environment Variables, then redeploy.
          Locally, copy them into <code className="rounded bg-slate-200 px-1">.env.local</code>.
        </p>
      </Centred>
    )
  }

  if (session === undefined) return <Centred><Spinner /><p className="font-semibold text-slate-700">Checking your sign-in…</p></Centred>
  if (!session) return <SignIn />

  if (role !== 'admin') {
    return (
      <Centred>
        <p className="text-base font-semibold text-slate-900">This account can&rsquo;t open the roster</p>
        <p className="max-w-sm text-sm text-slate-600">
          It is signed in, but it is not an admin account. Ask Matin to make it one, or sign in with a
          different account.
        </p>
        <button type="button" onClick={() => supabase.auth.signOut()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
          Sign out
        </button>
      </Centred>
    )
  }

  return children
}

function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    // On success the session listener in useSession swaps this screen for the roster.
    if (err) setError(err.message)
    setBusy(false)
  }

  return (
    <Centred>
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Roster Admin</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in with your RoboThink admin account.</p>
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">Email</label>
          <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={FIELD} />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">Password</label>
          <input id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={FIELD} />
        </div>

        <button type="submit" disabled={busy} className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="text-xs text-slate-500">
          The same account you use for the feedback site&rsquo;s admin dashboard.
        </p>
      </form>
    </Centred>
  )
}

// The roster's own loading look, so the gate does not feel like a different site.
const Centred = ({ children }) => (
  <div className="grid min-h-screen place-items-center bg-gradient-to-b from-indigo-50/60 via-slate-50 to-slate-100 p-8">
    <div className="flex flex-col items-center gap-4 text-center">
      <img src="/robothink-logo.png" alt="RoboThink" className="h-12 w-auto" />
      {children}
    </div>
  </div>
)

const Spinner = () => (
  <span className="h-9 w-9 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600 motion-reduce:animate-none" aria-hidden="true" />
)
