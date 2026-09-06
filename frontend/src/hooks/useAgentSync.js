import { useEffect } from 'react'

const SYNC_EVENT_NAME = 'mk_agent_data_sync'

/**
 * Multi-Agent Real-Time Data Sync Bus
 * Broadcasts data state updates across Store, Inventory, Purchase, Indent, and Finance modules.
 */
export function emitAgentSync(eventPayload = {}) {
  try {
    const event = new CustomEvent(SYNC_EVENT_NAME, {
      detail: {
        timestamp: new Date().toISOString(),
        ...eventPayload
      }
    })
    window.dispatchEvent(event)
  } catch (err) {
    console.error('Failed to emit agent sync event:', err)
  }
}

export function useAgentSync(onSyncCallback) {
  useEffect(() => {
    if (!onSyncCallback) return
    const handler = (e) => {
      onSyncCallback(e.detail)
    }
    window.addEventListener(SYNC_EVENT_NAME, handler)
    return () => window.removeEventListener(SYNC_EVENT_NAME, handler)
  }, [onSyncCallback])
}
