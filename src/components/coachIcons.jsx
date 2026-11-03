// Small inline icons for the Coach Profiles page (the project has no icon library).
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
// Filled head-and-shoulders avatar
export const Person = ({ className = 'h-7 w-7' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}><circle cx="12" cy="8" r="4.2" /><path d="M3.8 21c0-4.2 3.6-6.6 8.2-6.6s8.2 2.4 8.2 6.6Z" /></svg>
)
