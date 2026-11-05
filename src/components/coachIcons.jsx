// Small inline icons (the project has no icon library).
const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }

export const Pencil = ({ className = 'h-4 w-4' }) => (
  <svg {...base} className={className}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
)
export const GradCap = ({ className = 'h-5 w-5' }) => (
  <svg {...base} className={className}><path d="M22 10 12 5 2 10l10 5 10-5Z" /><path d="M6 12v5c3 2.5 9 2.5 12 0v-5" /></svg>
)
export const Briefcase = ({ className = 'h-5 w-5' }) => (
  <svg {...base} className={className}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /><path d="M2 13h20" /></svg>
)
export const UserPlus = ({ className = 'h-5 w-5' }) => (
  <svg {...base} className={className}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M16 11h6" /></svg>
)
export const Close = ({ className = 'h-5 w-5' }) => (
  <svg {...base} className={className}><path d="M18 6 6 18M6 6l12 12" /></svg>
)
export const Info = ({ className = 'h-5 w-5' }) => (
  <svg {...base} className={className}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
)
export const School = ({ className = 'h-7 w-7' }) => (
  <svg {...base} className={className}><path d="M3 21h18" /><path d="M5 21V10l7-5 7 5v11" /><path d="M10 21v-5h4v5" /><path d="M9 11h.01M15 11h.01" /></svg>
)
export const MapPin = ({ className = 'h-5 w-5' }) => (
  <svg {...base} className={className}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
)
// Filled head-and-shoulders avatar
export const Person = ({ className = 'h-7 w-7' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}><circle cx="12" cy="8" r="4.2" /><path d="M3.8 21c0-4.2 3.6-6.6 8.2-6.6s8.2 2.4 8.2 6.6Z" /></svg>
)
// Roster header
export const Calendar = ({ className = 'h-5 w-5' }) => (
  <svg {...base} className={className}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
)
export const CalendarClock = ({ className = 'h-8 w-8' }) => (
  <svg {...base} className={className}><path d="M21 10V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5" /><path d="M16 2v4M8 2v4M3 10h18" /><circle cx="17" cy="17" r="5" /><path d="M17 15v2l1.5 1" /></svg>
)
export const ArrowLeft = ({ className = 'h-5 w-5' }) => (
  <svg {...base} className={className}><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
)
export const ArrowRight = ({ className = 'h-5 w-5' }) => (
  <svg {...base} className={className}><path d="M5 12h14M12 5l7 7-7 7" /></svg>
)
export const ChevronDown = ({ className = 'h-4 w-4' }) => (
  <svg {...base} className={className}><path d="m6 9 6 6 6-6" /></svg>
)
export const Plus = ({ className = 'h-4 w-4' }) => (
  <svg {...base} className={className}><path d="M12 5v14M5 12h14" /></svg>
)
export const Trash = ({ className = 'h-4 w-4' }) => (
  <svg {...base} className={className}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" /></svg>
)
export const Undo = ({ className = 'h-4 w-4' }) => (
  <svg {...base} className={className}><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-15-6.7L3 13" /></svg>
)
export const Download = ({ className = 'h-4 w-4' }) => (
  <svg {...base} className={className}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
)
export const CheckCircle = ({ className = 'h-4 w-4' }) => (
  <svg {...base} className={className}><circle cx="12" cy="12" r="10" /><path d="m8 12 3 3 5-6" /></svg>
)
export const Alert = ({ className = 'h-4 w-4' }) => (
  <svg {...base} className={className}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></svg>
)
export const Sparkle = ({ className = 'h-4 w-4' }) => (
  <svg {...base} className={className}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2" /></svg>
)
export const Search = ({ className = 'h-4 w-4' }) => (
  <svg {...base} className={className}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
)
export const Eraser = ({ className = 'h-4 w-4' }) => (
  <svg {...base} className={className}><path d="m7 21-4.3-4.3a1 1 0 0 1 0-1.4l10-10a1 1 0 0 1 1.4 0l5.6 5.6a1 1 0 0 1 0 1.4L13 21" /><path d="M22 21H7M5 11l9 9" /></svg>
)
