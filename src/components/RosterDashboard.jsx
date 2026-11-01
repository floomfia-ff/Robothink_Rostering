import { useState } from 'react'
import { RosterProvider, useRoster } from '../context/RosterContext.jsx'
import AvailabilityPanel from './AvailabilityPanel.jsx'
import CoachProfiles from './CoachProfiles.jsx'
import CoachSwapModal from './CoachSwapModal.jsx'
import HeaderControls from './HeaderControls.jsx'
import VenueProfiles from './VenueProfiles.jsx'
import WeeklyGrid from './WeeklyGrid.jsx'

const TABS = [
  ['roster', 'Weekly Roster'],
  ['profiles', 'Coach Profiles'],
  ['venues', 'Venues'],
]

// Lives in the top bar so it works on every tab.
function UndoButton() {
  const { canUndo, undo } = useRoster()
  return (
    <button
      type="button"
      onClick={undo}
      disabled={!canUndo}
      className="ml-auto rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      ↶ Undo
    </button>
  )
}

export default function RosterDashboard() {
  const [tab, setTab] = useState('roster')
  return (
    <RosterProvider>
      <div className="min-h-screen bg-slate-100">
        <div className="border-b border-slate-200 bg-white print:hidden">
          <div className="mx-auto flex max-w-[1700px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
            <span className="flex items-center gap-2 font-bold text-slate-900">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-600 text-sm text-white">R</span>
              Roster Admin
            </span>
            <nav role="tablist" aria-label="Sections" className="flex gap-1">
              {TABS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                    tab === key ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
            <UndoButton />
          </div>
        </div>

        <main className="mx-auto max-w-[1700px] space-y-4 p-4 print:p-0">
          {tab === 'roster' ? (
            <>
              <HeaderControls />
              {/* one scroll area so the grid and availability columns stay aligned */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white print:overflow-visible print:rounded-none print:border-0">
                <WeeklyGrid />
                <AvailabilityPanel />
              </div>
              <CoachSwapModal />
            </>
          ) : tab === 'profiles' ? (
            <CoachProfiles />
          ) : (
            <VenueProfiles />
          )}
        </main>
      </div>
    </RosterProvider>
  )
}
