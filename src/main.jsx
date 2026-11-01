import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import RosterDashboard from './components/RosterDashboard.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RosterDashboard />
  </StrictMode>,
)
