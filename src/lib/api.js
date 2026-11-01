// Every screen talks to the roster function only through these functions.
import { autoFill } from './roster.js'

const URL = import.meta.env.VITE_ROSTER_API_URL
const CODE = import.meta.env.VITE_ROSTER_CODE

let baseline = null // what the server last had, so saveDraft only sends what changed

async function request(method, path, body) {
  if (!URL) throw new Error('VITE_ROSTER_API_URL is not set — copy .env.example to .env.local.')
  const res = await fetch(URL + path, {
    method,
    headers: { 'x-roster-code': CODE, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `${res.status} ${res.statusText}`)
  }
  return res.status === 204 ? null : res.json()
}

export async function loadRoster() {
  const roster = await request('GET', '/')
  baseline = structuredClone(roster)
  return roster
}

export const loadWeek = (id) => request('GET', `/weeks/${id}`)

// Stops at the first error; baseline moves forward per request so a retry resends only what failed.
export async function saveDraft(roster) {
  const patches = (list, old, fields, path) =>
    list.flatMap((item) => {
      const was = old.find((o) => o.id === item.id)
      const patch = Object.fromEntries(fields.filter((f) => item[f] !== was?.[f]).map((f) => [f, item[f]]))
      return was && Object.keys(patch).length ? [{ path: `${path}/${item.id}`, patch, item, was }] : []
    })
  const sends = [
    ...patches(roster.coaches, baseline.coaches, ['mrt_station', 'employment_type'], '/coaches'),
    ...patches(roster.schools, baseline.schools, ['address'], '/schools'),
    ...patches(roster.bases, baseline.bases, ['address'], '/bases'),
  ]
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

export async function publishRoster(roster, weekId) {
  await saveDraft(roster)
  await request('POST', `/weeks/${weekId}/publish`)
  // Server sets changed_since_publish=false on publish; roster here already carries the published week.
  const i = baseline.weeks.findIndex((b) => b.id === weekId)
  baseline.weeks[i] = structuredClone(roster.weeks.find((w) => w.id === weekId))
}

// The real endpoint is not built yet, so this still fills the week in the browser.
export async function generateRoster(week, coaches) {
  const filled = structuredClone(week)
  autoFill(filled, coaches)
  return filled
}
