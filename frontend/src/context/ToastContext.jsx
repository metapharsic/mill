import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

const ICONS = {
  success: <CheckCircle size={16} strokeWidth={2} />,
  error:   <XCircle    size={16} strokeWidth={2} />,
  warning: <AlertTriangle size={16} strokeWidth={2} />,
  info:    <Info       size={16} strokeWidth={2} />,
}

const COLORS = {
  success: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', icon: '#16a34a' },
  error:   { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c', icon: '#dc2626' },
  warning: { bg: '#fffbeb', border: '#fde68a', text: '#92400e', icon: '#d97706' },
  info:    { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', icon: '#2563eb' },
}

let toastIdCounter = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current[id])
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 320)
  }, [])

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++toastIdCounter
    setToasts(prev => [...prev.slice(-4), { id, message, type, exiting: false }])
    if (duration > 0) {
      timers.current[id] = setTimeout(() => dismiss(id), duration)
    }
    return id
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ addToast, dismiss }}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

function ToastStack({ toasts, onDismiss }) {
  if (toasts.length === 0) return null
  return (
    <div style={S.stack} aria-live="polite" aria-atomic="false">
      {toasts.map(t => (
        <div
          key={t.id}
          role="alert"
          style={{
            ...S.toast,
            background:   COLORS[t.type]?.bg     || '#fff',
            borderColor:  COLORS[t.type]?.border || '#e4e4e7',
            animation: t.exiting ? 'toastOut .3s ease forwards' : 'toastIn .25s ease forwards',
          }}
        >
          <span style={{ color: COLORS[t.type]?.icon, flexShrink: 0, display: 'flex' }}>
            {ICONS[t.type]}
          </span>
          <span style={{ ...S.msg, color: COLORS[t.type]?.text }}>{t.message}</span>
          <button
            style={S.close}
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss notification"
          >
            <X size={13} strokeWidth={2.5} />
          </button>
        </div>
      ))}
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}

const S = {
  stack: {
    position: 'fixed',
    top: 20,
    right: 20,
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    pointerEvents: 'none',
    maxWidth: 380,
  },
  toast: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '12px 14px',
    borderRadius: 12,
    border: '1px solid',
    boxShadow: '0 8px 24px rgba(0,0,0,.10), 0 2px 6px rgba(0,0,0,.06)',
    pointerEvents: 'all',
    minWidth: 260,
    maxWidth: 380,
  },
  msg: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: 500,
    lineHeight: 1.45,
    marginTop: 0,
  },
  close: {
    flexShrink: 0,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#a1a1aa',
    padding: 2,
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    marginTop: 1,
  },
}
