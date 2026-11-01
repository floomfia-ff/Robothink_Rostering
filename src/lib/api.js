// Stand-in for the backend. Swap these bodies for fetch() calls; keep the signatures.
const KEY = 'roster-prototype:v1'

export async function loadRoster() {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved) return JSON.parse(saved)
  } catch {
    // storage blocked or corrupt: fall back to mock data
  }
  return (await import('../data/mockRoster.json')).default
}

export async function saveDraft(roster) {
  localStorage.setItem(KEY, JSON.stringify(roster))
}

export async function publishRoster(roster, weekId) {
  await saveDraft(roster)
  console.info('publish', weekId) // backend: POST /weeks/:id/publish
}

export function resetToMock() {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}
