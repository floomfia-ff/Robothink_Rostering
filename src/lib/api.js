// Stand-in for the backend. Every screen talks to the server only through these functions,
// so Dev 2 / Dev 3 swap the bodies for fetch() calls and keep the signatures. See docs/API_CONTRACT.md.
import { autoFill } from './roster.js'

const KEY = 'roster-prototype:v1'
// shortcut: fake network delay so the Saving / Generating states show; delete when real fetch() calls land.
const wait = () => new Promise((r) => setTimeout(r, 400))

// GET /roster -> { coaches, venues, weeks }
export async function loadRoster() {
  await wait()
  try {
    const saved = localStorage.getItem(KEY)
    if (saved) return JSON.parse(saved)
  } catch {
    // storage blocked or corrupt: fall back to mock data
  }
  return (await import('../data/mockRoster.json')).default
}

// PUT /roster (or split into PUT /weeks/:id, /coaches, /venues on the backend)
export async function saveDraft(roster) {
  await wait()
  localStorage.setItem(KEY, JSON.stringify(roster))
}

// POST /weeks/:id/publish -> backend sets status 'published' and notifies coaches (Dev 4)
export async function publishRoster(roster, weekId) {
  await saveDraft(roster)
  console.info('publish', weekId)
}

// POST /weeks/:id/generate -> the same week with coaches filled in (Dev 3's generateRoster(weekDate)).
// The real endpoint reads coaches and availability from the database; here they are passed in.
export async function generateRoster(week, coaches) {
  await wait()
  const filled = structuredClone(week)
  autoFill(filled, coaches)
  return filled
}

export function resetToMock() {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}
