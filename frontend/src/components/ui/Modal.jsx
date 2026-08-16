import React, { useEffect, useRef } from 'react'
import { X, AlertTriangle } from 'lucide-react'

/**
 * Base Modal — overlay + card, closes on Escape and backdrop click.
 *
 * Props:
 *   open       {boolean}    — show/hide
 *   onClose    {function}   — called when user dismisses
 *   title      {string}     — header title
 *   width      {number}     — max card width in px (default 520)
 *   children   {ReactNode}  — body content
 *   footer     {ReactNode}  — optional footer (buttons etc.)
 *   closeLabel {string}     — close button aria-label (default "Close")
 */
export function Modal({ open, onClose, title, width = 520, children, footer, closeLabel = 'Close' }) {
  const dialogRef = useRef(null)

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open, onClose])

  // Trap focus inside modal
  useEffect(() => {
    if (!open) return
    const el = dialogRef.current
    if (!el) return
    const focusable = el.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const first = focusable[0]
    const last  = focusable[focusable.length - 1]
    const trap = (e) => {
      if (e.key !== 'Tab') return
      if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
        e.preventDefault();
        (e.shiftKey ? last : first)?.focus()
      }
    }
    document.addEventListener('keydown', trap)
    first?.focus()
    return () => document.removeEventListener('keydown', trap)
  }, [open])

  // Prevent body scroll while open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div
      style={S.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}
      aria-modal="true"
      role="dialog"
      aria-label={title}
    >
      <div ref={dialogRef} style={{ ...S.card, maxWidth: width }}>
        {/* Header */}
        <div style={S.header}>
          <span style={S.title}>{title}</span>
          <button style={S.closeBtn} onClick={onClose} aria-label={closeLabel}>
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* Body */}
        <div style={S.body}>
          {children}
        </div>

        {/* Footer */}
        {footer && <div style={S.footer}>{footer}</div>}
      </div>
    </div>
  )
}

/**
 * ConfirmModal — wraps Modal with a standard confirm/cancel pattern.
 *
 * Props:
 *   open           {boolean}
 *   onClose        {function}
 *   onConfirm      {function}   — called when user confirms
 *   title          {string}
 *   message        {string}     — body text
 *   confirmLabel   {string}     — confirm button text (default "Confirm")
 *   cancelLabel    {string}     — cancel button text (default "Cancel")
 *   danger         {boolean}    — red confirm button
 *   reasonRequired {boolean}    — shows a required reason textarea
 *   reasonLabel    {string}     — label for reason field (default "Reason")
 *   reasonRef      {ref}        — ref to reason input for parent access
 */
export function ConfirmModal({
  open, onClose, onConfirm, title = 'Are you sure?', message,
  confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  danger = false, reasonRequired = false, reasonLabel = 'Reason',
  loading = false,
}) {
  const [reason, setReason] = React.useState('')
  const canConfirm = !reasonRequired || reason.trim().length >= 3

  const handleConfirm = () => {
    if (!canConfirm) return
    onConfirm?.(reason.trim() || undefined)
  }

  // Reset reason when modal opens
  useEffect(() => { if (open) setReason('') }, [open])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width={420}
      footer={
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button style={S.btnSecondary} onClick={onClose} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            style={danger ? S.btnDanger : S.btnPrimary}
            onClick={handleConfirm}
            disabled={!canConfirm || loading}
          >
            {loading ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      }
    >
      {message && (
        <div style={S.confirmMsg}>
          <AlertTriangle size={18} style={{ color: danger ? '#dc2626' : '#d97706', flexShrink: 0 }} />
          <p style={{ margin: 0, color: '#3f3f46', fontSize: 14, lineHeight: 1.55 }}>{message}</p>
        </div>
      )}
      {reasonRequired && (
        <div style={{ marginTop: message ? 16 : 0 }}>
          <label style={S.label}>
            {reasonLabel} <span style={S.required} aria-hidden="true">*</span>
          </label>
          <textarea
            style={S.textarea}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Enter a reason (required)…"
            rows={3}
            autoFocus
          />
          {reason.length > 0 && reason.trim().length < 3 && (
            <div style={S.fieldError}>Please enter at least 3 characters.</div>
          )}
        </div>
      )}
    </Modal>
  )
}

const S = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 5000,
    background: 'rgba(0,0,0,.45)',
    backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 20,
    animation: 'fadeIn .18s ease both',
  },
  card: {
    background: '#fff',
    borderRadius: 20,
    boxShadow: '0 32px 80px rgba(0,0,0,.22), 0 8px 24px rgba(0,0,0,.10)',
    width: '100%',
    animation: 'scaleIn .2s cubic-bezier(.22,.61,.36,1) both',
    overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '18px 20px 16px',
    borderBottom: '1px solid rgba(0,0,0,.07)',
  },
  title: {
    fontSize: 15, fontWeight: 700, color: '#18181b', letterSpacing: '-.01em',
  },
  closeBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#71717a', borderRadius: 8, padding: 4,
    display: 'flex', alignItems: 'center',
    transition: 'color .15s, background .15s',
  },
  body: {
    padding: '20px',
  },
  footer: {
    padding: '14px 20px 18px',
    borderTop: '1px solid rgba(0,0,0,.06)',
    background: '#fafaf9',
  },
  confirmMsg: {
    display: 'flex', gap: 12, alignItems: 'flex-start',
    background: '#fffbeb', border: '1px solid #fde68a',
    borderRadius: 10, padding: '12px 14px',
  },
  label: {
    display: 'block', fontSize: 13, fontWeight: 600, color: '#3f3f46', marginBottom: 6,
  },
  required: { color: '#dc2626' },
  textarea: {
    width: '100%', boxSizing: 'border-box',
    padding: '10px 12px', borderRadius: 10,
    border: '1px solid #d4d4d8', fontSize: 13.5, lineHeight: 1.5,
    resize: 'vertical', outline: 'none', fontFamily: 'inherit',
    transition: 'border-color .15s',
  },
  fieldError: {
    fontSize: 12, color: '#dc2626', marginTop: 5,
  },
  btnPrimary: {
    padding: '9px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
    background: '#18181b', color: '#f4c84b', fontSize: 13.5, fontWeight: 700,
    transition: 'opacity .15s',
  },
  btnDanger: {
    padding: '9px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
    background: '#dc2626', color: '#fff', fontSize: 13.5, fontWeight: 700,
  },
  btnSecondary: {
    padding: '9px 20px', borderRadius: 10,
    border: '1px solid #d4d4d8', cursor: 'pointer',
    background: '#fff', color: '#3f3f46', fontSize: 13.5, fontWeight: 600,
  },
}
