import { Calendar, Gear, MapPin, Users } from './coachIcons.jsx'

// The site's top bar: RoboThink branding, the section tabs and the Admin link (to the feedback site).
// Animations live in index.css (rt-*) and switch off under prefers-reduced-motion.
const TABS = [
  ['roster', 'Weekly Roster', Calendar],
  ['profiles', 'Coach Profiles', Users],
  ['venues', 'Venues', MapPin],
]
const ADMIN_URL = 'https://robothink-student-feedback.vercel.app/admin'

const ITEM = 'rt-rise group inline-flex h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 sm:px-5 sm:text-[15px]'
const IDLE = 'text-slate-800 hover:-translate-y-0.5 hover:bg-white hover:text-indigo-700 hover:shadow-md hover:shadow-indigo-100'
const ACTIVE = 'rt-glow bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-500 text-white shadow-lg shadow-indigo-500/30'
const ICON = 'h-5 w-5 shrink-0 transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-110'

export default function TopNav({ tab, setTab }) {
  return (
    <header className="mx-auto max-w-[1700px] px-4 pt-4 print:hidden">
      <div className="rt-rise relative rounded-[2rem] border border-white bg-gradient-to-r from-white via-indigo-50/60 to-sky-50/70 shadow-lg shadow-indigo-100/70 ring-1 ring-indigo-100/70">
        <Decorations />

        <div className="relative flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <Robot className="rt-float hidden h-14 w-14 shrink-0 sm:block" />
            <img src="/robothink-logo.png" alt="RoboThink" className="h-10 w-auto shrink-0 sm:h-12" />
            <span aria-hidden="true" className="hidden h-10 w-px bg-gradient-to-b from-transparent via-indigo-200 to-transparent sm:block" />
            <span className="truncate text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">Roster Admin</span>
          </div>

          {/* phones: a 2 x 2 grid under the brand; wider screens: one row right after the title */}
          <nav role="tablist" aria-label="Sections" className="grid w-full grid-cols-2 gap-1.5 md:flex md:w-auto md:items-center md:gap-1">
            {TABS.map(([key, label, Icon], i) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                style={{ animationDelay: `${120 + i * 70}ms` }}
                className={`${ITEM} ${tab === key ? ACTIVE : IDLE}`}
              >
                <Icon className={ICON} />
                {label}
              </button>
            ))}
            <a href={ADMIN_URL} style={{ animationDelay: '330ms' }} className={`${ITEM} ${IDLE}`}>
              <Gear className={`${ICON} group-hover:rotate-45`} />
              Admin
            </a>
          </nav>
        </div>
      </div>
    </header>
  )
}

// Circuit traces, floating spheres and a slow gear, all behind the content and never clickable.
function Decorations() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-clip rounded-[2rem]">
      <svg viewBox="0 0 420 80" className="rt-drift absolute right-24 top-0 hidden h-full w-[360px] text-indigo-200 2xl:block" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M10 62h70l26-26h90l22-22h80" />
        <path d="M60 74h110l18-18h120" />
        <path d="M250 40h60l14 14h60" />
        <circle cx="10" cy="62" r="3" fill="currentColor" />
        <circle cx="398" cy="14" r="3" fill="currentColor" />
        <circle cx="308" cy="56" r="3" fill="currentColor" />
        <circle cx="384" cy="54" r="3" fill="currentColor" />
      </svg>
      <span className="rt-bob absolute right-[14%] top-2 hidden h-4 w-4 rounded-full bg-gradient-to-br from-violet-300 to-violet-600 shadow-md shadow-violet-400/50 xl:block" />
      <span className="rt-bob absolute right-[9%] bottom-3 hidden h-3.5 w-3.5 rounded-full bg-gradient-to-br from-amber-200 to-orange-500 shadow-md shadow-orange-400/50 xl:block" style={{ animationDelay: '-2s' }} />
      <span className="rt-bob absolute bottom-2 right-[30%] hidden h-2.5 w-2.5 rounded-full bg-gradient-to-br from-sky-200 to-sky-500 2xl:block" style={{ animationDelay: '-4s' }} />
      <Gear className="rt-spin absolute -right-5 -top-5 hidden h-20 w-20 text-indigo-300/70 xl:block" />
      <div className="absolute -left-10 -top-16 h-40 w-64 rounded-full bg-sky-100/70 blur-2xl" />
    </div>
  )
}

// Friendly RoboThink robot: white shell, dark visor with smiling cyan eyes, waving arm.
function Robot({ className }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="rt-shell" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dbe4ff" />
        </linearGradient>
        <linearGradient id="rt-visor" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1e293b" />
          <stop offset="1" stopColor="#0f172a" />
        </linearGradient>
      </defs>
      <ellipse cx="32" cy="61" rx="14" ry="2.5" fill="#6366f1" opacity=".15" />
      {/* antenna */}
      <path d="M32 6v7" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
      <circle cx="32" cy="5" r="3" fill="#3b82f6" />
      {/* waving arm */}
      <g className="rt-wave" style={{ transformOrigin: '13px 44px' }}>
        <path d="M13 44c-5-3-7-9-5-14" stroke="url(#rt-shell)" strokeWidth="6" strokeLinecap="round" fill="none" />
        <circle cx="8" cy="29" r="3.5" fill="#60a5fa" />
      </g>
      {/* body */}
      <rect x="18" y="40" width="28" height="18" rx="9" fill="url(#rt-shell)" stroke="#c7d2fe" />
      <circle cx="32" cy="49" r="4" fill="none" stroke="#60a5fa" strokeWidth="2" />
      {/* head */}
      <rect x="12" y="12" width="40" height="30" rx="14" fill="url(#rt-shell)" stroke="#c7d2fe" />
      <rect x="8" y="22" width="5" height="10" rx="2.5" fill="#60a5fa" />
      <rect x="51" y="22" width="5" height="10" rx="2.5" fill="#60a5fa" />
      <rect x="17" y="18" width="30" height="18" rx="9" fill="url(#rt-visor)" />
      <g className="rt-blink" style={{ transformOrigin: '32px 26px' }} stroke="#5eead4" strokeWidth="2.5" strokeLinecap="round" fill="none">
        <path d="M22 26q3-3.5 6 0" />
        <path d="M36 26q3-3.5 6 0" />
      </g>
      <path d="M28 31q4 3 8 0" stroke="#5eead4" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M19 17q4-3 9-3" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".8" />
    </svg>
  )
}
