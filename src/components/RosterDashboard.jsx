import { useState } from 'react'
import { RosterProvider } from '../context/RosterContext.jsx'
import AvailabilityPanel from './AvailabilityPanel.jsx'
import CoachProfiles from './CoachProfiles.jsx'
import CoachSwapModal from './CoachSwapModal.jsx'
import HeaderControls from './HeaderControls.jsx'
import RulesTab from './RulesTab.jsx'
import TopNav from './TopNav.jsx'
import VenueProfiles from './VenueProfiles.jsx'
import WeeklyGrid from './WeeklyGrid.jsx'

export default function RosterDashboard() {
  const [tab, setTab] = useState('roster')
  return (
    <RosterProvider>
      {/* On the roster the page itself never scrolls: the roster box fills the rest of the screen and is the one
          thing that scrolls, so its headers can stay in view. Other tabs scroll like a normal page. */}
      <div className={`bg-gradient-to-b from-indigo-50/60 via-slate-50 to-slate-100 ${tab === 'roster' ? 'flex h-screen flex-col overflow-hidden print:block print:h-auto print:overflow-visible' : 'min-h-screen'}`}>
        <TopNav tab={tab} setTab={setTab} />

        <main className={`mx-auto w-full max-w-[1700px] p-4 print:p-0 ${tab === 'roster' ? 'flex min-h-0 flex-1 flex-col gap-4 print:block' : 'space-y-4'}`}>
          {tab === 'roster' ? (
            <>
              <HeaderControls />
              {/* one scroll area so the grid and availability columns stay aligned */}
              <div data-roster-scroll className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white print:overflow-visible print:rounded-none print:border-0">
                <WeeklyGrid />
                <AvailabilityPanel />
              </div>
              <CoachSwapModal />
            </>
          ) : tab === 'profiles' ? (
            <CoachProfiles />
          ) : tab === 'rules' ? (
            <RulesTab />
          ) : (
            <VenueProfiles />
          )}
        </main>
      </div>
    </RosterProvider>
  )
}
