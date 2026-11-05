import { useState } from 'react'
import { RosterProvider } from '../context/RosterContext.jsx'
import AvailabilityPanel from './AvailabilityPanel.jsx'
import CoachProfiles from './CoachProfiles.jsx'
import CoachSwapModal from './CoachSwapModal.jsx'
import HeaderControls from './HeaderControls.jsx'
import TopNav from './TopNav.jsx'
import VenueProfiles from './VenueProfiles.jsx'
import WeeklyGrid from './WeeklyGrid.jsx'

export default function RosterDashboard() {
  const [tab, setTab] = useState('roster')
  return (
    <RosterProvider>
      <div className="min-h-screen bg-gradient-to-b from-indigo-50/60 via-slate-50 to-slate-100">
        <TopNav tab={tab} setTab={setTab} />

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
