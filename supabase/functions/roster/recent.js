// Which saved weeks the first load builds in full. Older ones come back as light stubs and load when opened.
import { addDays, currentMonday } from './logic.js'

export const RECENT_WEEKS = 8

// The oldest Monday that still counts as recent: this week's Monday minus 8 weeks.
export const recentCutoff = (now) => addDays(currentMonday(now), -7 * RECENT_WEEKS)

// Ids are 'YYYY-MM-DD', so plain string comparison orders them by date. Future weeks are always recent.
export const isRecent = (id, cutoff) => id >= cutoff
