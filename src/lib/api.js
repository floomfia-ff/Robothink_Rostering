// Every screen talks to the roster function only through these functions.
import { isValidAddress } from './roster.js'
import { accessToken } from './supabase.js'

const URL = import.meta.env.VITE_ROSTER_API_URL
// Transitional, and on its way out. The function that is deployed TODAY still
// asks for this header, so it keeps being sent until the new one below is
// deployed - that way neither half breaks while the other is being updated.
// Once supabase/functions/roster/index.ts is deployed, delete CODE, drop
// VITE_ROSTER_CODE from .env.example and .env.local, and remove the
// ROSTER_CODE secret in Supabase.
const CODE = import.meta.env.VITE_ROSTER_CODE

let baseline = null // what the server last had, so saveDraft only sends what changed

async function request(method, path, body, signal) {
  if (!URL) throw new Error('VITE_ROSTER_API_URL is not set — copy .env.example to .env.local.')
  // Who is asking. The function verifies this with Supabase and refuses
  // anyone who is not an admin, so it is the real gate - not the code above.
  const token = await accessToken()
  const res = await fetch(URL + path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(CODE ? { 'x-roster-code': CODE } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  }).catch((e) => {
    throw e.name === 'TimeoutError' ? new Error('The server took too long to answer. It may still be waking up — try again.') : e
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `${res.status} ${res.statusText}`)
  }
  return res.status === 204 ? null : res.json()
}

export async function loadRoster() {
  const roster = await request('GET', '/', undefined, AbortSignal.timeout(20000)) // never wait forever on "Loading roster…"
  baseline = structuredClone(roster)
  return roster
}

export const loadWeek = (id) => request('GET', `/weeks/${id}`)

// An older week that came as a stub: loads it in full and swaps it into the save baseline, so it isn't re-saved unchanged.
export async function openArchivedWeek(id) {
  const week = await loadWeek(id)
  baseline.weeks = [...baseline.weeks.filter((w) => w.id !== id), structuredClone(week)]
  return week
}

export async function deleteWeek(id) {
  await request('DELETE', `/weeks/${id}`)
  baseline.weeks = baseline.weeks.filter((w) => w.id !== id)
}

// Brings a deleted week back and returns it as saved.
export async function restoreWeek(id) {
  await request('POST', `/weeks/${id}/restore`)
  return openArchivedWeek(id)
}

// One batch of OneMap travel times: { done, remaining, total }.
export const refreshTravelTimes = (limit = 40) => request('POST', '/travel-times/refresh', { limit })

// Stops at the first error; baseline moves forward per request so a retry resends only what failed.
export async function saveDraft(roster) {
  const patches = (list, old, fields, path) =>
    list.flatMap((item) => {
      const was = old.find((o) => o.id === item.id)
      const patch = Object.fromEntries(fields.filter((f) => item[f] !== was?.[f]).map((f) => [f, item[f]]))
      return was && Object.keys(patch).length ? [{ path: `${path}/${item.id}`, patch, item, was }] : []
    })
  const sends = [
    ...patches(roster.coaches, baseline.coaches, ['mrt_station', 'employment_type', 'can_lead', 'coach_level'], '/coaches'),
    ...patches(roster.schools, baseline.schools, ['address', 'station'], '/schools'),
    ...patches(roster.bases, baseline.bases, ['address'], '/bases'),
  ].filter((s) => !s.patch.address?.trim() || isValidAddress(s.patch.address)) // half-typed addresses wait (the field shows red)
  // weeks first: they are the valuable data, so a bad venue edit can't block them
  for (const w of roster.weeks) {
    const i = baseline.weeks.findIndex((b) => b.id === w.id)
    if (i >= 0 && JSON.stringify(baseline.weeks[i]) === JSON.stringify(w)) continue
    await request('PUT', `/weeks/${w.id}`, w)
    if (i >= 0) baseline.weeks[i] = structuredClone(w)
    else baseline.weeks.push(structuredClone(w))
  }
  for (const s of sends) {
    await request('PATCH', s.path, s.patch)
    Object.assign(s.was, s.patch)
  }
}

// Rules tab: each change goes straight to the server (not through saveDraft).
export const createRule = (rule) => request('POST', '/rules', rule)
export const updateRule = (id, patch) => request('PATCH', `/rules/${id}`, patch)
export const deleteRule = (id) => request('DELETE', `/rules/${id}`)
