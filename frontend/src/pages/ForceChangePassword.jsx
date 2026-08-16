import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function ForceChangePassword() {
  const { user, token, logout } = useAuth()
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.next !== form.confirm) {
      setError('New passwords do not match')
      return
    }
    if (form.next.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ current_password: form.current, new_password: form.next }),
    })
    const data = await res.json()
    setLoading(false)
    if (data.success) {
      // Reload — server cleared must_change_password, fresh /me will return false
      window.location.reload()
    } else {
      setError(data.message || 'Failed to change password')
    }
  }

  return (
    <div style={bg}>
      <div style={card}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={badge}>!</div>
          <h2 style={{ margin: '12px 0 4px', fontSize: 22, fontWeight: 700, color: '#1b1b1d' }}>
            Password Change Required
          </h2>
          <p style={{ color: '#8a8a90', fontSize: 14 }}>
            Hello <strong>{user?.name}</strong> — your account requires a new password before you can continue.
          </p>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="Current Password" type="password" value={form.current}
            onChange={v => setForm(f => ({ ...f, current: v }))} />
          <Field label="New Password" type="password" value={form.next}
            onChange={v => setForm(f => ({ ...f, next: v }))} />
          <Field label="Confirm New Password" type="password" value={form.confirm}
            onChange={v => setForm(f => ({ ...f, confirm: v }))} />
          {error && <div style={errBox}>{error}</div>}
          <button style={{ ...btn, opacity: loading ? 0.7 : 1 }} disabled={loading} type="submit">
            {loading ? 'Saving…' : 'Set New Password'}
          </button>
          <button type="button" style={logoutBtn} onClick={logout}>Sign out</button>
        </form>
      </div>
    </div>
  )
}

function Field({ label, type, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#3a3a3e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        required
        style={{ padding: '11px 14px', border: '1.5px solid #ecebe5', borderRadius: 8, fontSize: 15, background: '#f6f5f0', color: '#1b1b1d', outline: 'none' }}
      />
    </div>
  )
}

const bg = {
  minHeight: '100vh',
  background: 'linear-gradient(135deg, #1b1b1d 0%, #1e3a5f 50%, #1b1b1d 100%)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
}
const card = {
  background: '#fff', borderRadius: 16, padding: '40px 36px',
  width: '100%', maxWidth: 400, boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
}
const badge = {
  width: 48, height: 48, borderRadius: '50%',
  background: '#fef3c7', border: '2px solid #f59e0b',
  color: '#b45309', fontSize: 24, fontWeight: 700,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}
const errBox = {
  background: '#fef2f2', border: '1px solid #fecaca',
  color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13,
}
const btn = {
  background: 'linear-gradient(135deg, #1b1b1d, #1b1b1d)',
  color: '#fff', border: 'none', padding: 14, borderRadius: 8,
  fontSize: 15, fontWeight: 600, cursor: 'pointer',
}
const logoutBtn = {
  background: 'none', border: 'none', color: '#a0a0a6',
  fontSize: 13, cursor: 'pointer', textAlign: 'center',
}
