// Roster Edge Function: weekly rosters, coach/school/base details. See README.md.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { DOUBLES_RANGE, DOUBLES_TAB, RANGE, TAB, parsePlan, readDoubles } from './plan.js'
import {
  buildWeek, currentMonday, isMonday, isValidAddress, matchSchools, pendingPairs, pickFields, routeMinutes, stationQuery,
  toStored, travelMap, validateCoachFields, validateRule, validateWeek, weekShell,
} from './logic.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-roster-code',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, PATCH, DELETE, OPTIONS',
}
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets.readonly'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const noContent = () => new Response(null, { status: 204, headers: CORS })
const fail = (error: string, status: number) => json({ error }, status)

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

// Every query goes through here so a database error becomes a readable 500.
// deno-lint-ignore no-explicit-any
const ok = <T>({ data, error }: { data: T; error: any }): T => {
  if (error) throw new Error(error.message)
  return data
}

// ── Google auth (copied from read-lesson-plan) ──────────────────────────────
const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const textToBase64url = (text: string) => base64url(new TextEncoder().encode(text))

async function getAccessToken(credentials: { client_email: string; private_key: string }) {
  const now = Math.floor(Date.now() / 1000)
  const unsigned =
    `${textToBase64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.` +
    `${textToBase64url(JSON.stringify({
      iss: credentials.client_email, scope: SCOPES,
      aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
    }))}`
  const pem = credentials.private_key.replace(/\\n/g, '\n')
  const body = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s/g, '')
  const keyBytes = Uint8Array.from(atob(body), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey(
    'pkcs8', keyBytes, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  )
  const signature = new Uint8Array(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned)),
  )
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${base64url(signature)}`,
    }),
  })
  const data = await response.json()
  if (!data.access_token) throw new Error(`Google refused the service account: ${JSON.stringify(data).slice(0, 300)}`)
  return data.access_token as string
}

// Reads the plan sheet once; throws a readable message the caller turns into planError.
async function readSheet(schools: { id: number; name: string; active: boolean }[]) {
  const rawCredentials = Deno.env.get('GOOGLE_SERVICE_ACCOUNT')
  const spreadsheetId = Deno.env.get('GOOGLE_PLAN_SHEET_ID')
  if (!rawCredentials) throw new Error('GOOGLE_SERVICE_ACCOUNT is not set on this function.')
  if (!spreadsheetId) throw new Error('GOOGLE_PLAN_SHEET_ID is not set on this function.')
  const token = await getAccessToken(JSON.parse(rawCredentials))
  const get = (tab: string, range: string) => fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`'${tab}'!${range}`)}`
    + `?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`,
    { headers: { Authorization: `Bearer ${token}` } },
  )

  const response = await get(TAB, RANGE)
  const raw = await response.text()
  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('Google refused access to the plan. Share the spreadsheet with the service account as Viewer - '
        + 'its address is the client_email inside GOOGLE_SERVICE_ACCOUNT.')
    }
    if (response.status === 400 && raw.includes('Unable to parse range')) {
      throw new Error(`The spreadsheet has no tab called "${TAB}".`)
    }
    throw new Error(`Google Sheets refused: ${response.status} ${raw.slice(0, 300)}`)
  }
  const rows = JSON.parse(raw).values || []

  // A workbook without the Doubles tab is fine: no doubles recorded.
  let doubleRows: unknown[][] = []
  try {
    const dres = await get(DOUBLES_TAB, DOUBLES_RANGE)
    if (dres.ok) doubleRows = JSON.parse(await dres.text()).values || []
  } catch { /* leave empty */ }

  const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10) // Singapore date
  return matchSchools(schools, parsePlan(rows, today, readDoubles(doubleRows)))
}

// ── Data ────────────────────────────────────────────────────────────────────
const getCoaches = async () =>
  ok(await db.from('coaches').select('id,name,active,mrt_station,employment_type,can_lead,coach_level').order('name'))
const getSchools = async () =>
  ok(await db.from('schools').select('id,name,brand,class_day,active,address').order('name'))
const getRules = async () =>
  ok(await db.from('roster_rules').select('id,kind,coach_id,school_id,value,active,note').order('id'))
const getSaved = async (id: string) =>
  ok(await db.from('roster_weeks').select('id,status,changed_since_publish,data').eq('id', id).is('deleted_at', null).maybeSingle())

async function loadPlan(schools: Awaited<ReturnType<typeof getSchools>>) {
  try {
    return { plan: await readSheet(schools), planError: null as string | null }
  } catch (e) {
    return { plan: null, planError: String((e as Error).message) } // sheet trouble must not block the roster
  }
}

// ── OneMap (travel times) ───────────────────────────────────────────────────
const ONEMAP = 'https://www.onemap.gov.sg'
class OneMapError extends Error {
  constructor(message = '', public status = 0) { super(message) }
}
class OneMapLoginError extends OneMapError {}
let onemap: { token: string; until: number } | null = null

// Swaps Matin's OneMap login for a token, kept until 5 minutes before it expires.
async function onemapToken() {
  if (onemap && Date.now() < onemap.until) return onemap.token
  const email = Deno.env.get('ONEMAP_EMAIL')
  const password = Deno.env.get('ONEMAP_PASSWORD')
  if (!email || !password) throw new OneMapLoginError()
  const res = await fetch(`${ONEMAP}/api/auth/post/getToken`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  }).catch((e) => { throw new OneMapError(String(e)) })
  const data = await res.json().catch(() => ({}))
  if (!data.access_token) throw new OneMapLoginError()
  onemap = { token: data.access_token, until: Number(data.expiry_timestamp) * 1000 - 300000 || Date.now() + 1800000 }
  return onemap.token
}

async function onemapGet(path: string, retried = false): Promise<any> {
  const res = await fetch(ONEMAP + path, { headers: { Authorization: await onemapToken() } })
    .catch((e) => { throw new OneMapError(String(e)) })
  if (res.status === 401) {
    onemap = null // an expired token gets one fresh try before we blame the login
    if (!retried) return onemapGet(path, true)
    throw new OneMapLoginError()
  }
  if (!res.ok) throw new OneMapError(`${res.status} ${res.statusText}`, res.status)
  return res.json()
}

// "lat,lng" of the best match, or null when OneMap knows no such place.
async function onemapPlace(query: string) {
  const data = await onemapGet(`/api/common/elastic/search?searchVal=${encodeURIComponent(query)}&returnGeom=Y&getAddrDetails=N&pageNum=1`)
  const hit = data.results?.[0]
  return hit ? `${hit.LATITUDE},${hit.LONGITUDE}` : null
}

// Trips are timed for the next Tuesday at 2pm, a normal weekday OneMap has a timetable for.
function nextTuesday() {
  const d = new Date(Date.now() + 8 * 3600000) // Singapore date
  d.setUTCDate(d.getUTCDate() + ((9 - d.getUTCDay()) % 7 || 7))
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}-${d.getUTCFullYear()}`
}
// Minutes for the fastest trip, null when OneMap says there is none. A 4xx for one trip only marks that pair;
// a reply without a plan is an error, so a glitch is never saved as "no route".
async function onemapMinutes(from: string, to: string) {
  let reply
  try {
    reply = await onemapGet(`/api/public/routingsvc/route?start=${from}&end=${to}&routeType=pt&date=${nextTuesday()}&time=14:00:00&mode=TRANSIT&maxWalkDistance=1000&numItineraries=3`)
  } catch (e) {
    if (e instanceof OneMapError && !(e instanceof OneMapLoginError) && e.status >= 400 && e.status < 500 && e.status !== 429) return null
    throw e
  }
  if (!reply?.plan) throw new OneMapError('unexpected routing reply')
  return routeMinutes(reply)
}

async function weekFor(id: string, coaches: unknown[], schools: Awaited<ReturnType<typeof getSchools>>) {
  const { plan, planError } = await loadPlan(schools)
  const saved = await getSaved(id)
  const previous = ok(await db.from('roster_weeks').select('id,status,changed_since_publish,data')
    .lt('id', id).is('deleted_at', null).order('id', { ascending: false }).limit(1).maybeSingle())
  return buildWeek({ id, coaches, schools, plan, planError, saved, previous })
}

// ── Handler ─────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const secret = Deno.env.get('ROSTER_CODE')
    if (!secret) return fail('ROSTER_CODE is not set on this function.', 500)
    if (req.headers.get('x-roster-code') !== secret) return fail('Roster code not accepted.', 401)

    const path = new URL(req.url).pathname.replace(/^.*\/roster/, '') || '/'
    const m = req.method
    const body = m === 'GET' ? {} : await req.json().catch(() => null)
    if ((m === 'PUT' || m === 'PATCH') && (!body || typeof body !== 'object' || Array.isArray(body))) {
      return fail('Body must be a JSON object.', 400)
    }

    if (m === 'GET' && path === '/') {
      const [coaches, schools, bases, travelRows, rules] = await Promise.all([
        getCoaches(), getSchools(), db.from('roster_bases').select('id,code,name,address').order('id').then(ok),
        db.from('travel_times').select('*').then(ok), getRules(),
      ])
      const { plan, planError } = await loadPlan(schools)
      const all = ok(await db.from('roster_weeks').select('id,status,changed_since_publish,data,deleted_at').order('id'))
      const rows = all.filter((w) => !w.deleted_at)
      const deletedWeeks = all.filter((w) => w.deleted_at).map((w) => ({ id: w.id, label: weekShell(w.id).label }))
      const build = (id: string, saved: unknown, previous: unknown) =>
        buildWeek({ id, coaches, schools, plan, planError, saved, previous })
      const weeks = rows.map((row, i) => build(row.id, row, rows[i - 1] ?? null))
      const current = currentMonday(new Date())
      if (!rows.some((w) => w.id === current)) {
        const before = rows.filter((w) => w.id < current).pop() ?? null
        weeks.push(build(current, null, before))
        weeks.sort((x, y) => x.id.localeCompare(y.id))
      }
      return json({ coaches, schools, bases, weeks, planError, unmatchedSchools: plan?.unmatched ?? [], deletedWeeks, rules, ...travelMap(travelRows, coaches, schools) })
    }

    // Works out up to `limit` missing travel times and saves each one as soon as it's known.
    if (m === 'POST' && path === '/travel-times/refresh') {
      const limit = Math.min(100, Math.max(1, Number(body?.limit) || 40))
      const [coaches, schools, rows] = await Promise.all([getCoaches(), getSchools(), db.from('travel_times').select('*').then(ok)])
      const pending = pendingPairs(coaches, schools, rows)
      const batch = pending.slice(0, limit)
      const places = new Map<string, Promise<string | null>>() // each station / postcode looked up once per call
      const place = (q: string) => places.get(q) ?? places.set(q, onemapPlace(q)).get(q)!
      let done = 0
      try {
        for (let i = 0; i < batch.length; i += 4) {
          await Promise.all(batch.slice(i, i + 4).map(async (p) => {
            const [from, to] = await Promise.all([place(stationQuery(p.from_station)), place(p.to_postcode)])
            const minutes = from && to ? await onemapMinutes(from, to) : null
            const status = !from ? 'station-not-found' : minutes === null ? 'no-route' : 'ok'
            ok(await db.from('travel_times').upsert({ ...p, minutes, status, updated_at: new Date().toISOString() }))
            done++
          }))
        }
      } catch (e) {
        if (e instanceof OneMapLoginError) return fail("OneMap didn't accept the login — check ONEMAP_EMAIL / ONEMAP_PASSWORD in Supabase.", 502)
        if (e instanceof OneMapError) return fail(`OneMap is not responding: ${e.message}. Times worked out so far are kept.`, 502)
        throw e
      }
      // the fresh times come back with the counts, so the page never has to reload the whole roster
      const saved = ok(await db.from('travel_times').select('*'))
      return json({ done, remaining: pending.length - done, total: pendingPairs(coaches, schools, []).length, ...travelMap(saved, coaches, schools) })
    }

    let r
    if ((r = path.match(/^\/weeks\/([^/]+)$/))) {
      const id = r[1]
      if (!isMonday(id)) return fail('Week id must be a Monday (YYYY-MM-DD).', 400)

      if (m === 'GET') {
        return json(await weekFor(id, await getCoaches(), await getSchools()))
      }
      if (m === 'PUT') {
        if (body.id !== id) return fail('The week in the body does not match the address.', 400)
        const coachIds = new Set<number>((await getCoaches()).map((c) => c.id))
        const problem = validateWeek(body, coachIds)
        if (problem) return fail(problem, 400)
        const saved = await getSaved(id)
        const published = saved?.status === 'published'
        ok(await db.from('roster_weeks').upsert({
          id, status: saved?.status ?? 'draft', // only /publish changes status
          changed_since_publish: published || !!saved?.changed_since_publish,
          data: toStored(body), updated_at: new Date().toISOString(), deleted_at: null,
        }))
        return noContent()
      }
      // hidden, not removed, so it can be restored; a week never saved has no row, which is still fine
      if (m === 'DELETE') {
        ok(await db.from('roster_weeks').update({ deleted_at: new Date().toISOString() }).eq('id', id))
        return noContent()
      }
    }

    if (m === 'POST' && (r = path.match(/^\/weeks\/([^/]+)\/restore$/))) {
      if (!isMonday(r[1])) return fail('Week id must be a Monday (YYYY-MM-DD).', 400)
      const rows = ok(await db.from('roster_weeks').update({ deleted_at: null }).eq('id', r[1]).select('id'))
      return rows.length ? noContent() : fail('No such week.', 404)
    }

    if (m === 'POST' && (r = path.match(/^\/weeks\/([^/]+)\/publish$/))) {
      if (!isMonday(r[1])) return fail('Week id must be a Monday (YYYY-MM-DD).', 400)
      const rows = ok(await db.from('roster_weeks').update({ status: 'published', changed_since_publish: false })
        .eq('id', r[1]).select('id'))
      return rows.length ? noContent() : fail('Save the week before publishing it.', 404)
    }

    // Rules (Rules tab). A PATCH is checked as the whole rule it would leave behind.
    if ((m === 'POST' && path === '/rules') || (r = path.match(/^\/rules\/(\d+)$/))) {
      const id = r ? Number(r[1]) : null
      const [rules, coaches, schools] = await Promise.all([getRules(), getCoaches(), getSchools()])
      const known = { coachIds: new Set(coaches.map((c) => c.id)), schoolIds: new Set(schools.map((s) => s.id)), rules }
      if (m === 'DELETE' && id) {
        ok(await db.from('roster_rules').delete().eq('id', id))
        return noContent()
      }
      if (m === 'POST' && !id) {
        const rule = pickFields(body ?? {}, ['kind', 'coach_id', 'school_id', 'value', 'note'])
        const problem = validateRule(rule, known)
        if (problem) return fail(problem, 400)
        return json({ id: ok(await db.from('roster_rules').insert(rule).select('id').single()).id }, 201)
      }
      if (m === 'PATCH' && id) {
        const old = rules.find((x) => x.id === id)
        if (!old) return fail('No such rule.', 404)
        const patch = pickFields(body, ['value', 'active', 'note', 'coach_id', 'school_id'])
        if (!Object.keys(patch).length) return fail('Nothing to update.', 400)
        if ('active' in patch && typeof patch.active !== 'boolean') return fail('Active must be true or false.', 400)
        const problem = validateRule({ ...old, ...patch }, known)
        if (problem) return fail(problem, 400)
        ok(await db.from('roster_rules').update(patch).eq('id', id))
        return noContent()
      }
    }

    if (m === 'PATCH' && (r = path.match(/^\/(coaches|schools|bases)\/(\d+)$/))) {
      const [, table, id] = r
      const fields = table === 'coaches' ? pickFields(body, ['mrt_station', 'employment_type', 'can_lead', 'coach_level']) : pickFields(body, ['address'])
      if (!Object.keys(fields).length) return fail('Nothing to update.', 400)
      // clearing an address is allowed: blank is stored as null
      if ('address' in fields && (fields.address === null || (typeof fields.address === 'string' && !fields.address.trim()))) fields.address = null
      const problem = table === 'coaches'
        ? validateCoachFields(fields)
        : fields.address === null || isValidAddress(fields.address) ? null : 'Address must end with a 6-digit postcode.'
      if (problem) return fail(problem, 400)
      const rows = ok(await db.from(table === 'bases' ? 'roster_bases' : table).update(fields).eq('id', Number(id)).select('id'))
      return rows.length ? noContent() : fail(`No such ${table.slice(0, -1)}.`, 404)
    }

    return fail('Not found.', 404)
  } catch (error) {
    return fail(String((error as Error)?.message || error), 500)
  }
})
