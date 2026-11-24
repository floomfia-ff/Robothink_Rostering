// Keeps Tab inside an open dialog.
//
// Dialog.jsx had this and the other two windows did not, so with "Clear all coaches in 26-Oct to 1-Nov?" open,
// four Tabs put focus on the Venues button behind the backdrop - still clickable, on a confirmation whose other
// button empties the week. A dialog that takes focus has to keep it until it closes.
//
// Not a hook, so it can live outside a component file and stay out of the fast-refresh lint rule.

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Call from a dialog's onKeyDown with the element that wraps it. */
export function trapTab(event, container) {
  if (event.key !== 'Tab' || !container) return
  const items = [...container.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement)
  if (!items.length) return
  const first = items[0]
  const last = items.at(-1)
  // Focus already outside (a stray click, or a trap added after it escaped): bring it back.
  if (!container.contains(document.activeElement)) {
    event.preventDefault()
    return first.focus()
  }
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}
