import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import RequireAdmin from './components/RequireAdmin.jsx'
import RosterDashboard from './components/RosterDashboard.jsx'

// Nothing below RequireAdmin renders, and no roster data is fetched, until an
// admin is signed in. See components/RequireAdmin.jsx.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RequireAdmin>
      <RosterDashboard />
    </RequireAdmin>
  </StrictMode>,
)
