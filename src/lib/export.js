// Excel export in the supervisor's roster layout: two columns per day (text + count),
// coloured venue headers, WCP / DV / OTHERS sections, yellow totals, shaded OFF / X availability.
import { baseCoaches, coachDay, countedCoaches, dayTotals, isWeekend } from './roster.js'

const TONE = { mon: 'FFCCCCFF', tue: 'FFDDF2D0', wed: 'FFF2CCF2', thu: 'FFCCECFF', fri: 'FFFCE4D6' }
const GREY = 'FFD9D9D9'
const LIGHT = 'FFE7E6E6'
const DARK = 'FF808080'
const BLACK = 'FF000000'
const YELLOW = 'FFFFFF00'
const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })
const thin = { style: 'thin' }

// `coaches` = active coaches (availability rows); `everyone` also has inactive ones still placed in blocks.
export function buildRosterSheet(wb, week, coaches, everyone = coaches) {
  const ws = wb.addWorksheet(week.label.replace(/[\\/?*[\]:]/g, '-'))
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  ws.columns = [{ width: 16 }, ...week.days.flatMap(() => [{ width: 24 }, { width: 4 }])]

  const byId = Object.fromEntries(everyone.map((c) => [c.id, c]))
  const name = (c) => (c.role === 'lead' ? '*' : c.role === 'shadow' ? '#' : '') + (byId[c.id]?.name ?? c.id)
  const names = (list) => list.map(name).join('/')
  const text = (i) => 2 + 2 * i
  const count = (i) => 3 + 2 * i
  const lastCol = count(week.days.length - 1)
  let r = 0

  const put = (row, col, value, { bold, bg, color, center } = {}) => {
    const c = ws.getCell(row, col)
    c.value = value
    if (bold || color) c.font = { bold, color: color && { argb: color } }
    if (bg) c.fill = fill(bg)
    if (center) c.alignment = { horizontal: 'center' }
  }
  const merged = (row, from, to, value, style) => {
    if (to > from) ws.mergeCells(row, from, row, to)
    put(row, from, value, { center: true, bold: true, ...style })
  }

  // Header: day, date, report times
  r = 1
  put(r, 1, '* Lead Coach', { bold: true })
  week.days.forEach((d, i) => merged(r, text(i), count(i), d.label))
  r = 2
  put(r, 1, '# Shadow', { bold: true })
  week.days.forEach((d, i) => merged(r, text(i), count(i), d.date))
  r = 3
  const wk = week.days.map((d, i) => (isWeekend(d.key) ? -1 : i)).filter((i) => i >= 0)
  if (wk.length) merged(r, text(wk[0]), count(wk.at(-1)), 'Interns report to WCP at 10am / Part Timers report 30 mins before lesson starts')
  week.days.forEach((d, i) => isWeekend(d.key) && merged(r, text(i), count(i), '9am to 4pm'))

  // Venue bands: weekday lessons show slots + students; weekend programmes list one coach per row.
  const columns = week.days.map((d) => d.blocks.filter((b) => b.kind !== 'other'))
  const bands = Math.max(0, ...columns.map((c) => c.length))
  for (let n = 0; n < bands; n++) {
    const blocks = columns.map((c) => c[n])
    r++
    blocks.forEach((b, i) => merged(r, text(i), count(i), b?.name ?? '', { bg: (b && TONE[week.days[i].key]) || GREY }))
    const rows = Math.max(2, ...blocks.map((b) => (b?.kind === 'lesson' ? b.slots.length : b?.kind === 'program' ? b.coaches.length : 0)))
    for (let k = 0; k < rows; k++) {
      r++
      put(r, 1, 'No of Students')
      blocks.forEach((b, i) => {
        if (b?.kind === 'lesson' && b.slots[k]) {
          put(r, text(i), b.slots[k].time.replace(/:/g, ''))
          put(r, count(i), Number(b.slots[k].students) || 0)
        } else if (b?.kind === 'program' && b.coaches[k]) put(r, text(i), name(b.coaches[k]))
      })
    }
    // Builds under the times: what the students are making, slot by slot.
    const builds = blocks.map((b) => (b?.kind === 'lesson' && !b.noLesson ? b.slots.flatMap((s) => s.builds ?? []) : []))
    for (let k = 0; k < Math.max(0, ...builds.map((l) => l.length)); k++) {
      r++
      builds.forEach((l, i) => {
        if (!l[k]) return
        put(r, text(i), l[k].build)
        put(r, count(i), Number(l[k].students) || 0)
      })
    }
    r++
    put(r, 1, 'Coaches', { bold: true })
    blocks.forEach((b, i) => {
      if (b?.kind !== 'lesson') return
      put(r, text(i), b.noLesson ? 'No Lesson' : names(b.coaches), { bold: true })
      if (!b.noLesson) put(r, count(i), countedCoaches(b), { bold: true })
    })
    r++
  }

  // WCP / DV / OTHERS
  for (const base of ['WCP', 'DV', 'OTHERS']) {
    r++
    merged(r, 2, lastCol, base, { bg: GREY })
    r++
    put(r, 1, 'Coaches', { bold: true })
    week.days.forEach((d, i) => {
      const list = base === 'OTHERS' ? (d.blocks.find((b) => b.kind === 'other')?.coaches ?? []) : baseCoaches(week, d.key, base, coaches)
      put(r, text(i), names(list), { bold: true })
      put(r, count(i), list.filter((c) => c.role !== 'shadow').length, { bold: true })
    })
    r++
  }

  // Totals
  const totals = week.days.map((d) => dayTotals(week, d.key, coaches))
  r++
  put(r, 1, 'Total Coaches', { bold: true })
  totals.forEach((t, i) => put(r, count(i), t.assigned, { bold: true, bg: YELLOW }))
  const gridEnd = r
  r += 2
  put(r, 1, 'Coaches Available', { bold: true })
  totals.forEach((t, i) => put(r, count(i), t.available, { bold: true }))

  // Availability: name + 1 when working, OFF dark grey, X black.
  for (const c of coaches) {
    r++
    const shade = c.employment_type === 'intern' ? LIGHT : undefined
    put(r, 1, c.name, { bg: shade })
    week.days.forEach((d, i) => {
      const { status } = coachDay(week, d.key, c)
      if (status === 'off' || status === 'unavailable') {
        const bg = status === 'off' ? DARK : BLACK
        put(r, text(i), status === 'off' ? 'OFF' : 'X', { bg, color: 'FFFFFFFF' })
        put(r, count(i), null, { bg })
      } else {
        put(r, text(i), c.name, { bg: shade })
        put(r, count(i), status === 'assigned' ? 1 : null, { bg: shade })
      }
    })
  }

  for (let row = 1; row <= r; row++) {
    if (row > gridEnd && row < gridEnd + 2) continue // gap between totals and availability
    for (let col = 2; col <= lastCol; col++) ws.getCell(row, col).border = { top: thin, left: thin, bottom: thin, right: thin }
  }
  return ws
}

// The sheet as rows of cells for drawing the picture, so it matches the Excel file exactly.
// A merged range becomes one cell with `span`; colours come back as '#RRGGBB'.
export function sheetCells(ws) {
  const hex = (argb) => argb && `#${argb.slice(2)}`
  const rows = []
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = []
    for (let c = 1; c <= ws.columnCount; c++) {
      const cell = ws.getCell(r, c)
      if (cell.isMerged && cell.master.address !== cell.address) {
        row.at(-1).span++
        continue
      }
      row.push({
        value: cell.value ?? '', span: 1, bg: hex(cell.fill?.fgColor?.argb), bold: !!cell.font?.bold,
        color: hex(cell.font?.color?.argb), center: cell.alignment?.horizontal === 'center', border: !!cell.border?.top,
      })
    }
    rows.push(row)
  }
  return rows
}

export async function sheetFor(week, coaches, everyone) {
  const { default: ExcelJS } = await import('exceljs') // loaded only on export / picture
  return buildRosterSheet(new ExcelJS.Workbook(), week, coaches, everyone)
}

export async function downloadXlsx(week, coaches, everyone) {
  const { workbook } = await sheetFor(week, coaches, everyone)
  const blob = new Blob([await workbook.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  Object.assign(document.createElement('a'), { href: url, download: `roster-${week.id}.xlsx` }).click()
  URL.revokeObjectURL(url)
}
