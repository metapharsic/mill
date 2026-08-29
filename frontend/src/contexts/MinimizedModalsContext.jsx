import React, { createContext, useCallback, useContext, useState } from 'react'

const MinimizedModalsContext = createContext(null)

/**
 * Global registry of minimized modals, rendered as a taskbar (MinimizedTabsBar).
 * A minimized modal is NOT unmounted by this context — callers are expected to
 * keep the modal's own state alive and simply hide its UI (display:none-style)
 * while it is minimized, then flip it back visible on restore.
 */
export function MinimizedModalsProvider({ children }) {
  const [items, setItems] = useState([]) // { id, title, restore }

  const minimize = useCallback((id, title, restore) => {
    setItems(prev => {
      const rest = prev.filter(it => it.id !== id)
      return [...rest, { id, title, restore }]
    })
  }, [])

  const close = useCallback((id) => {
    setItems(prev => prev.filter(it => it.id !== id))
  }, [])

  const restore = useCallback((id) => {
    setItems(prev => {
      const entry = prev.find(it => it.id === id)
      if (entry) entry.restore?.()
      return prev.filter(it => it.id !== id)
    })
  }, [])

  return (
    <MinimizedModalsContext.Provider value={{ items, minimize, close, restore }}>
      {children}
    </MinimizedModalsContext.Provider>
  )
}

export function useMinimizedModals() {
  const ctx = useContext(MinimizedModalsContext)
  if (!ctx) throw new Error('useMinimizedModals must be used within a MinimizedModalsProvider')
  return ctx
}
