import React from 'react'
import { X, ChevronUp } from 'lucide-react'
import { useMinimizedModals } from '../contexts/MinimizedModalsContext'

/**
 * Fixed bottom taskbar listing currently-minimized modals.
 * Renders nothing when there are no minimized entries.
 */
export default function MinimizedTabsBar() {
  const { items, restore, close } = useMinimizedModals()

  if (!items.length) return null

  return (
    <div style={styles.bar}>
      {items.map(it => (
        <div key={it.id} style={styles.tab} onClick={() => restore(it.id)} title={`Restore ${it.title}`}>
          <ChevronUp size={13} strokeWidth={2.5} style={{ flexShrink: 0 }} />
          <span style={styles.label}>{it.title}</span>
          <button
            style={styles.closeBtn}
            onClick={(e) => { e.stopPropagation(); close(it.id) }}
            title={`Close ${it.title}`}
            aria-label={`Close ${it.title}`}
          >
            <X size={12} strokeWidth={2.5} />
          </button>
        </div>
      ))}
    </div>
  )
}

const styles = {
  bar: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 950,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    background: 'rgba(24,24,27,0.94)',
    backdropFilter: 'blur(8px)',
    borderTop: '1px solid rgba(244,200,75,0.25)',
    boxShadow: '0 -6px 18px rgba(0,0,0,.25)',
    overflowX: 'auto',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 8px 6px 10px',
    borderRadius: 9,
    background: 'rgba(244,200,75,0.12)',
    border: '1px solid rgba(244,200,75,0.3)',
    color: '#f4c84b',
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  label: {
    maxWidth: 180,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  closeBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 18,
    height: 18,
    borderRadius: 6,
    border: 'none',
    background: 'rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.75)',
    cursor: 'pointer',
    flexShrink: 0,
  },
}
