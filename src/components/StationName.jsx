// Station codes as on the MRT map, in each line's colour. Interchanges show every code.
// shortcut: only the stations our coaches and preschools use; a station not listed shows its name with no badge, add it here when needed.
const LINE = { NS: '#D42E12', EW: '#009645', CC: '#FA9E0D', DT: '#005EC4', TE: '#9D5B25', NE: '#9900AA', PW: '#748477', ST: '#748477' }
const CODES = {
  'jurong east': ['NS1', 'EW24'], newton: ['NS21', 'DT11'], redhill: ['EW18'], braddell: ['NS18'], bayshore: ['TE29'],
  samudera: ['PW4'], 'king albert park': ['DT6'], dover: ['EW22'], 'one-north': ['CC23'], 'tanjong pagar': ['EW15'],
  woodlands: ['NS9', 'TE2'], 'boon lay': ['EW27'], 'bukit batok': ['NS2'], canberra: ['NS12'], hougang: ['NE14'],
  novena: ['NS20'], sengkang: ['NE16', 'STC'], serangoon: ['NE12', 'CC13'], yishun: ['NS13'],
}
const codesOf = (station) => CODES[station.toLowerCase().replace(/\b[ml]rt\b/g, '').trim()] ?? []

export default function StationName({ station, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 py-0.5 pl-1 pr-2.5 text-xs font-semibold text-slate-700 ${className}`}>
      <span className="inline-flex shrink-0 overflow-hidden rounded-full empty:hidden">
        {codesOf(station).map((code) => (
          <span key={code} className="px-1 py-px text-[10px] font-bold leading-tight text-white" style={{ background: LINE[code.slice(0, 2)] }}>{code}</span>
        ))}
      </span>
      <span className="truncate">{station}</span>
    </span>
  )
}
