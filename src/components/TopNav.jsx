import { Calendar, Gear, MapPin, Rules, Users } from './coachIcons.jsx'

// The site's top bar: RoboThink branding, the section tabs and the link to the
// feedback site.
//
// It used to carry a floating robot beside the logo, a slow-turning gear and
// drifting circuit traces behind the content, and a glow breathing under the
// active tab. All of it looped for ever, and most of it only drew at 1280px
// and up, so it was motion very few people saw and nobody asked for. The only
// animation left is the one-off rise as the bar arrives, staggered across the
// tabs; it answers the page loading and then stops.
//
// The robot went with the loops. It sat next to the RoboThink logo, which is
// already the brand mark, and everything it did - the wave, the blink, the
// float - was the part that looped.
const TABS = [
  ['roster', 'Weekly Roster', Calendar],
  ['profiles', 'Coach Profiles', Users],
  ['venues', 'Venues', MapPin],
  ['rules', 'Rules', Rules],
]
// Lands on the coach form, which is the thing you go there to fill in. That
// page's own header has an Admin link if the dashboard is what you wanted.
const FEEDBACK_URL = 'https://robothink-student-feedback.vercel.app'

const ITEM = 'rt-rise group inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 sm:px-4'
const IDLE = 'text-slate-700 hover:bg-slate-100 hover:text-indigo-700'
const ACTIVE = 'rt-rise bg-indigo-600 text-white'
const ICON = 'h-[18px] w-[18px] shrink-0'

export default function TopNav({ tab, setTab }) {
  return (
    <header className="mx-auto max-w-[1700px] px-4 pt-4 print:hidden">
      <div className="rt-rise rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-2.5 sm:px-5">
          {/* The brand reads once: the logo is the mark, and "Roster Admin"
              says which of the two sites you are on. It was set in extrabold
              at the same size as a heading, which made a label compete with
              the logo beside it. */}
          <div className="flex min-w-0 items-center gap-3">
            <img src="/robothink-logo.png" alt="RoboThink" className="h-8 w-auto shrink-0 sm:h-9" />
            <span aria-hidden="true" className="hidden h-6 w-px bg-slate-200 sm:block" />
            <span className="truncate text-sm font-medium text-slate-500">Roster Admin</span>
          </div>

          {/* phones: a 2 x 2 grid under the brand; wider screens: one row, pushed right */}
          <nav
            role="tablist"
            aria-label="Sections"
            className="grid w-full grid-cols-2 gap-1.5 md:ml-auto md:flex md:w-auto md:items-center md:gap-1"
          >
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
            <a href={FEEDBACK_URL} style={{ animationDelay: '400ms' }} className={`${ITEM} ${IDLE}`}>
              <Gear className={ICON} />
              Feedback
            </a>
          </nav>
        </div>
      </div>
    </header>
  )
}
