import { useLayoutEffect, useRef, useState } from 'react'
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

const ITEM = 'rt-rise group relative z-10 inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 sm:px-4'
const IDLE = 'text-slate-700 hover:bg-slate-100 hover:text-indigo-700'
const ICON = 'h-[18px] w-[18px] shrink-0'
// One row of tabs. Shared by the real bar and the white copy inside the pill, so the two cannot drift apart.
const ROW = 'grid w-full grid-cols-2 gap-1.5 md:flex md:w-auto md:items-center md:gap-1'

// `ghost`: the copy that lives inside the pill. Same markup and classes, so it lays out identically, but white,
// unreachable by the keyboard and invisible to a screen reader.
function TabRow({ tab, setTab, ghost = false }) {
  return (
    <>
      {TABS.map(([key, label, Icon], i) => (
        <button
          key={key}
          type="button"
          {...(ghost
            ? { tabIndex: -1, 'aria-hidden': true }
            : { 'aria-current': tab === key ? 'page' : undefined, 'data-current': tab === key, onClick: () => setTab(key) })}
          style={{ animationDelay: `${120 + i * 70}ms` }}
          className={`${ITEM} ${ghost ? 'text-white' : tab === key ? 'text-white' : IDLE}`}
        >
          <Icon className={ICON} />
          {label}
        </button>
      ))}
      <a
        {...(ghost ? { tabIndex: -1, 'aria-hidden': true } : { href: FEEDBACK_URL })}
        style={{ animationDelay: '400ms' }}
        className={`${ITEM} ${ghost ? 'text-white' : IDLE} col-span-2 md:col-span-1`}
      >
        <Gear className={ICON} />
        Feedback
      </a>
    </>
  )
}

export default function TopNav({ tab, setTab }) {
  const nav = useRef(null)
  const [pill, setPill] = useState(null) // the current tab's box, and the whole bar's, in nav coordinates

  // Measured from offsetLeft / offsetTop rather than getBoundingClientRect, which would include the entrance
  // animation's transform and put the pill 8px high on the first paint. Re-measured whenever the bar changes
  // size, because the tabs reflow from one row to a two-column grid.
  useLayoutEffect(() => {
    const bar = nav.current
    if (!bar) return
    const measure = () => {
      const on = bar.querySelector('[data-current="true"]')
      if (!on) return setPill(null)
      setPill({ left: on.offsetLeft, top: on.offsetTop, width: on.offsetWidth, height: on.offsetHeight, barW: bar.offsetWidth, barH: bar.offsetHeight })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(bar)
    return () => ro.disconnect()
  }, [tab])

  return (
    <header className="mx-auto max-w-[1700px] px-4 pt-4 print:hidden">
      <div className="rt-rise rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-2.5 sm:px-5">
          {/* The brand reads once: the logo is the mark, and "Roster Admin"
              says which of the two sites you are on. Still bold, but at text
              size rather than the extrabold heading it was - at that weight a
              label was competing with the logo next to it. */}
          <div className="flex min-w-0 cursor-default items-center gap-3 select-none">
            <img src="/robothink-logo.png" alt="RoboThink" className="h-8 w-auto shrink-0 sm:h-9" />
            <span aria-hidden="true" className="hidden h-6 w-px bg-slate-200 sm:block" />
            <span className="truncate text-sm font-semibold text-slate-900">Roster Admin</span>
          </div>

          {/* phones: a 2 x 2 grid under the brand; wider screens: one row straight
              after the label. Pushing them to the far right left a gulf across the
              middle of the bar on a wide window. */}
          <nav ref={nav} aria-label="Sections" className={`relative ${ROW}`}>
            {/* The lit pill moves to whichever tab is current, on transform so the move is composited and does
                not fight the page re-render happening behind it at the same moment.

                It carries a white copy of the whole row, counter-translated so it lands exactly over the real
                one. The pill is rounded and clips what overflows, so the copy shows only through the pill:
                letters turn white as it crosses them instead of staying dark on indigo, which was the one part
                of this that looked unfinished. A transition never runs on an element's first values, so none of
                this flies in from the corner on load. */}
            {pill && (
              <span
                aria-hidden="true"
                className="rt-pill absolute left-0 top-0 overflow-hidden rounded-full bg-indigo-600"
                style={{ transform: `translate3d(${pill.left}px, ${pill.top}px, 0)`, width: pill.width, height: pill.height }}
              >
                <span
                  className={`rt-pill absolute left-0 top-0 ${ROW}`}
                  style={{ transform: `translate3d(${-pill.left}px, ${-pill.top}px, 0)`, width: pill.barW, height: pill.barH }}
                >
                  <TabRow tab={tab} ghost />
                </span>
              </span>
            )}
            <TabRow tab={tab} setTab={setTab} />
          </nav>
        </div>
      </div>
    </header>
  )
}
