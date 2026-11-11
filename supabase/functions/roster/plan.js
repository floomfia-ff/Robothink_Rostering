// Kept identical to RoboThink-Feedback supabase/functions/_shared/lessonPlan.js where they overlap (2026-11-12). A parser fix in one must be copied to the other.
//
// The sheet's shape, which the parser relies on:
//
//      A                      D     E          F           I onwards
//    ┌──────────────────────┬─────┬──────────┬───────────┬──────────────┐
//    │ ADVENTIST SCHOOLHOUSE│ WED │ Starts → │ 4-Feb-26  │              │  band
//    │ S/N  Name  Level …   │     │          │ Start Date│ 4-Feb-26 …   │  header
//    │ 1    Kwok Xin Ning … │     │          │ 4-Feb-26  │ L1-1A Scor…  │  student
//    │ …                    │     │          │           │              │
//    │ ADVENTIST … Total to Bill                                        │  end
//    └──────────────────────┴─────┴──────────┴───────────┴──────────────┘
//
//  A block starts at any row whose column D is a weekday, and ends at the
//  "Total to Bill" row. Columns A to C are merged on both of those rows, so
//  only column A carries the text.

export const TAB = 'Lesson Plan'
// Wide enough for the 120 weeks the curriculum runs to, so adding weeks to
// the plan never needs this function redeployed. BA stopped one column past
// week 44, which would have silently cut off anything added.
export const RANGE = 'A1:DZ800'
export const DOUBLES_TAB = 'Doubles'
export const DOUBLES_RANGE = 'A2:C200'

const COL_NAME = 1, COL_LEVEL = 2, COL_TIME = 3, COL_TYPE = 4,
      COL_START = 5, COL_END = 6, COL_TRIAL = 7
const COL_FIRST_DATE = 8                    // column I

const DAYS = new Set(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'])

// Sheets counts days from 30 December 1899. Asking for serial numbers rather
// than formatted text avoids having to parse "4-Feb-26", which would depend on
// the spreadsheet's locale rather than on anything we control.
const SHEETS_EPOCH = Date.UTC(1899, 11, 30)

export function serialToISO(value) {
  if (typeof value !== 'number' || !isFinite(value) || value <= 0) return ''
  const d = new Date(SHEETS_EPOCH + Math.round(value) * 86400000)
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    String(d.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

const text = (v) => (v === null || v === undefined ? '' : String(v).trim())

// "1600 - 1700", "16:00-17:00" and "1600-1700" all become "16:00 - 17:00".
export function normaliseTime(value) {
  const t = text(value)
  const m = t.match(/^(\d{1,2}):?(\d{2})\s*-\s*(\d{1,2}):?(\d{2})$/)
  if (!m) return t
  const hh = (h) => h.padStart(2, '0')
  return `${hh(m[1])}:${m[2]} - ${hh(m[3])}:${m[4]}`
}

// school|student|date for every recorded double. Read separately because the
// plan tab cannot say whether "A & B" is one build with an ampersand in its
// name — two of them have one — or two builds done in a session.
function doublesKey(school, student, date) {
  return `${school.trim().toLowerCase()}|${student.trim().toLowerCase()}|${date}`
}

export function readDoubles(rows) {
  const out = new Set()
  for (const row of rows || []) {
    const school = text((row || [])[0])
    const student = text((row || [])[1])
    const date = serialToISO((row || [])[2])
    if (school && student && date) out.add(doublesKey(school, student, date))
  }
  return out
}

// `count` is 2 where a child did two builds in one session to catch up. The
// cell holds both names joined by "&", and counting the cell would understate
// what they have actually done — which is the number the Builds tab shows.
export function parsePlan(rows, today, doubles) {
  const schools = []
  let i = 0

  while (i < rows.length) {
    const row = rows[i] || []
    const name = text(row[0])
    const day = text(row[3]).toUpperCase()

    // A school block opens on a row that names a school and a weekday. The
    // "Total to Bill" row also carries a name, so it is excluded explicitly.
    if (!name || !DAYS.has(day) || /total to bill/i.test(name)) { i++; continue }

    const classStart = serialToISO(row[5])
    const header = rows[i + 1] || []

    // Dates live on the header row, from column I. A column with no date is
    // past the end of this school's year.
    const dates = []
    for (let c = COL_FIRST_DATE; c < header.length; c++) dates.push(serialToISO(header[c]))

    const students = []
    let r = i + 2
    for (; r < rows.length; r++) {
      const line = rows[r] || []
      if (/total to bill/i.test(text(line[0]))) break

      // A student row carries an S/N in column A. The two class-time total
      // rows below the roster do not, but they do put "1600 - 1700" and "0"
      // in the name column - without this check each school gained two
      // children called after its class times.
      const sn = Number(text(line[0]))
      if (!Number.isInteger(sn) || sn <= 0) continue

      const studentName = text(line[COL_NAME])
      if (!studentName) continue                 // a spare numbered row

      const done = []
      let next = null
      let total = 0
      const upcoming = []

      for (let k = 0; k < dates.length; k++) {
        const build = text(line[COL_FIRST_DATE + k])
        if (!build) continue
        const date = dates[k]
        const count = date && doubles.has(doublesKey(name, studentName, date)) ? 2 : 1
        total += count
        const entry = { week: k + 1, date, build, count }
        if (date && date <= today) {
          done.push(entry)
        } else {
          upcoming.push(entry)
          if (!next) next = entry
        }
      }

      students.push({
        name: studentName,
        level: text(line[COL_LEVEL]),
        time: text(line[COL_TIME]),
        type: text(line[COL_TYPE]),
        start: serialToISO(line[COL_START]),
        end: serialToISO(line[COL_END]),
        trial: text(line[COL_TRIAL]),
        done, next, upcoming, total,
      })
    }

    schools.push({ name, day, classStart, students })
    i = r + 1
  }

  return schools
}
