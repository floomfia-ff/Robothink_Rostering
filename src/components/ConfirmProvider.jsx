import { createContext, useCallback, useContext, useRef, useState } from 'react'
import ConfirmDialog from './ConfirmDialog.jsx'

// One "Are you sure?" window for the whole site, in its own style instead of the browser's grey pop-up.
//   const confirm = useConfirm()
//   if (await confirm({ title: 'Delete this week?', body: '…', confirmLabel: 'Delete week' })) deleteWeek()
const ConfirmContext = createContext(async () => false)

export function ConfirmProvider({ children }) {
  const [ask, setAsk] = useState(null)
  const answer = useRef(null)

  const confirm = useCallback(
    (opts) =>
      new Promise((resolve) => {
        answer.current = resolve
        setAsk(opts)
      }),
    [],
  )
  // The first answer wins: Remove answers yes, then the window closing would answer no.
  const settle = (value) => {
    answer.current?.(value)
    answer.current = null
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {ask && (
        <ConfirmDialog
          title={ask.title}
          confirmLabel={ask.confirmLabel}
          onConfirm={() => settle(true)}
          onClose={() => {
            settle(false)
            setAsk(null)
          }}
        >
          {ask.body}
        </ConfirmDialog>
      )}
    </ConfirmContext.Provider>
  )
}

export const useConfirm = () => useContext(ConfirmContext)
