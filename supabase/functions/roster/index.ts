// Roster Edge Function: weekly rosters, coach/school/base details. See README.md.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { DOUBLES_RANGE, DOUBLES_TAB, RANGE, TAB, parsePlan, readDoubles } from './plan.js'
import {
  buildWeek, currentMonday, isMonday, isValidAddress, matchSchools, pickFields, toStored, validateCoachFields,
  validateWeek,
} from './logic.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-roster-code',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, PATCH, OPTIONS',
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
  ok(await db.from('coaches').select('id,name,active,mrt_station,employment_type').order('name'))
const getSchools = async () =>
  ok(await db.from('schools').select('id,name,brand,class_day,active,address').order('name'))
const getSaved = async (id: string) =>
  ok(await db.from('roster_weeks').select('id,status,changed_since_publish,data').eq('id', id).maybeSingle())

async function loadPlan(schools: Awaited<ReturnType<typeof getSchools>>) {
  try {
    return { plan: await readSheet(schools), planError: null as string | null }
  } catch (e) {
    return { plan: null, planError: String((e as Error).message) } // sheet trouble must not block the roster
  }
}

async function weekFor(id: string, coaches: unknown[], schools: Awaited<ReturnType<typeof getSchools>>) {
  const { plan, planError } = await loadPlan(schools)
  const saved = await getSaved(id)
  const previous = ok(await db.from('roster_weeks').select('id,status,changed_since_publish,data')
    .lt('id', id).order('id', { ascending: false }).limit(1).maybeSingle())
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
      const [coaches, schools, bases] = await Promise.all([
        getCoaches(), getSchools(), db.from('roster_bases').select('id,code,name,address').order('id').then(ok),
      ])
      const { plan, planError } = await loadPlan(schools)
      const rows = ok(await db.from('roster_weeks').select('id,status,changed_since_publish,data').order('id'))
      const build = (id: string, saved: unknown, previous: unknown) =>
        buildWeek({ id, coaches, schools, plan, planError, saved, previous })
      const weeks = rows.map((row, i) => build(row.id, row, rows[i - 1] ?? null))
      const current = currentMonday(new Date())
      if (!rows.some((w) => w.id === current)) {
        const before = rows.filter((w) => w.id < current).pop() ?? null
        weeks.push(build(current, null, before))
        weeks.sort((x, y) => x.id.localeCompare(y.id))
      }
      return json({ coaches, schools, bases, weeks, planError, unmatchedSchools: plan?.unmatched ?? [] })
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
          data: toStored(body), updated_at: new Date().toISOString(),
        }))
        return noContent()
      }
    }

    if (m === 'POST' && (r = path.match(/^\/weeks\/([^/]+)\/publish$/))) {
      if (!isMonday(r[1])) return fail('Week id must be a Monday (YYYY-MM-DD).', 400)
      const rows = ok(await db.from('roster_weeks').update({ status: 'published', changed_since_publish: false })
        .eq('id', r[1]).select('id'))
      return rows.length ? noContent() : fail('Save the week before publishing it.', 404)
    }

    if (m === 'PATCH' && (r = path.match(/^\/(coaches|schools|bases)\/(\d+)$/))) {
      const [, table, id] = r
      const fields = table === 'coaches' ? pickFields(body, ['mrt_station', 'employment_type']) : pickFields(body, ['address'])
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
