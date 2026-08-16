import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Mail, Lock, ArrowRight, Eye, EyeOff, AlertCircle } from 'lucide-react'

export default function Login() {
  const { login } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [focusedField, setFocusedField] = useState(null)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await login(form.email, form.password)
    if (!res.success) setError(res.message || 'Invalid credentials. Please try again.')
    setLoading(false)
  }

  return (
    <div style={S.bg}>
      {/* ── Left panel — brand ── */}
      <div style={S.leftPanel}>
        <div style={S.leftContent}>
          <div style={S.logoMark}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect x="4" y="11" width="32" height="4" rx="2" fill="#f4c84b"/>
              <rect x="4" y="19" width="32" height="4" rx="2" fill="#f4c84b" fillOpacity=".65"/>
              <rect x="4" y="27" width="22" height="4" rx="2" fill="#f4c84b" fillOpacity=".35"/>
            </svg>
          </div>
          <h1 style={S.leftTitle}>MK Paper Mill</h1>
          <p style={S.leftSub}>Enterprise Resource Planning</p>

          <div style={S.statsRow}>
            {[
              { n: '36+', label: 'Modules' },
              { n: '3', label: 'Shifts' },
              { n: '24/7', label: 'Monitoring' },
            ].map(s => (
              <div key={s.label} style={S.statCard}>
                <div style={S.statNum}>{s.n}</div>
                <div style={S.statLabel}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={S.featureList}>
            {['Real-time Production Tracking', 'HRMS & Payroll Management', 'Inventory & Supply Chain', 'Maintenance & CMMS'].map(f => (
              <div key={f} style={S.featureItem}>
                <span style={S.featureDot} />
                <span style={S.featureText}>{f}</span>
              </div>
            ))}
          </div>

          <div style={S.versionTag}>v1.0 · Production Build</div>
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div style={S.rightPanel}>
        <div style={S.card}>
          {/* Header */}
          <div style={S.cardHeader}>
            <h2 style={S.cardTitle}>Welcome back</h2>
            <p style={S.cardSub}>Sign in to your account to continue</p>
          </div>

          {/* Quick login */}
          <div style={S.quickSection}>
            <div style={S.quickHeader}>⚡ Quick Login Presets</div>
            <div style={S.quickGrid}>
              {[
                { label: '📦 Store Head', email: 'head.store@mkpapermill.com', password: 'Head@1234' },
                { label: '📋 Store Desk', email: 'store@mkpapermill.com', password: 'Store@1234' },
                { label: '⚙️ Admin', email: 'admin@mkpapermill.com', password: 'Admin@1234' },
                { label: '🏭 Plant Head', email: 'planthead@mkpapermill.com', password: 'Plant@1234' },
              ].map(acc => (
                <button
                  key={acc.email}
                  type="button"
                  style={{
                    ...S.quickBtn,
                    ...(form.email === acc.email ? S.quickBtnActive : {})
                  }}
                  onClick={() => {
                    setForm({ email: acc.email, password: acc.password })
                    setError('')
                  }}
                >
                  {acc.label}
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={S.form}>
            <div style={S.field}>
              <label style={S.label}>Email address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={{ ...S.fieldIcon, color: focusedField === 'email' ? '#f4c84b' : '#a1a1aa' }} />
                <input
                  id="login-email"
                  style={{ ...S.input, ...(focusedField === 'email' ? S.inputFocused : {}) }}
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="admin@mkpapermill.com"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div style={S.field}>
              <label style={S.label}>Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ ...S.fieldIcon, color: focusedField === 'password' ? '#f4c84b' : '#a1a1aa' }} />
                <input
                  id="login-password"
                  style={{ ...S.input, ...(focusedField === 'password' ? S.inputFocused : {}), paddingRight: 42 }}
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#a1a1aa', padding: 2, display: 'flex', alignItems: 'center' }}
                  onClick={() => setShowPassword(s => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={S.errorBox}>
                <AlertCircle size={14} style={{ flexShrink: 0, color: '#dc2626' }} />
                {error}
              </div>
            )}

            <div style={{ textAlign: 'right', marginBottom: 16, marginTop: -4 }}>
              <a href="mailto:admin@mkpapermill.com?subject=Password Reset Request" style={{ fontSize: 12, color: '#a1a1aa', textDecoration: 'none' }}>
                Forgot password? Contact admin
              </a>
            </div>

            <button
              id="login-submit"
              style={{ ...S.submitBtn, opacity: loading ? 0.75 : 1 }}
              disabled={loading}
              type="submit"
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={S.spinner} />
                  Signing in...
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  Sign In
                  <ArrowRight size={16} />
                </span>
              )}
            </button>
          </form>

          <div style={S.footer}>MK Paper Mill ERP · All rights reserved</div>
        </div>
      </div>
    </div>
  )
}

const S = {
  bg: {
    minHeight: '100vh',
    display: 'flex',
    fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
  },

  /* ── Left dark panel ── */
  leftPanel: {
    width: 420,
    flexShrink: 0,
    background: 'linear-gradient(160deg, #111113 0%, #1a1a1d 60%, #0f0f11 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 40px',
    position: 'relative',
    overflow: 'hidden',
  },
  leftContent: {
    position: 'relative',
    zIndex: 1,
  },
  logoMark: {
    width: 64, height: 64,
    background: 'linear-gradient(135deg, #2a2a2d, #1c1c1f)',
    border: '1px solid rgba(244,200,75,.25)',
    borderRadius: 18,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
    boxShadow: '0 0 40px rgba(244,200,75,.12), 0 20px 50px rgba(0,0,0,.5)',
  },
  leftTitle: {
    fontSize: 30,
    fontWeight: 800,
    color: 'rgba(255,255,255,.95)',
    letterSpacing: '-.04em',
    lineHeight: 1.1,
    marginBottom: 8,
  },
  leftSub: {
    fontSize: 13.5,
    color: 'rgba(255,255,255,.38)',
    fontWeight: 500,
    marginBottom: 36,
  },
  statsRow: {
    display: 'flex',
    gap: 12,
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    background: 'rgba(255,255,255,.05)',
    border: '1px solid rgba(255,255,255,.08)',
    borderRadius: 14,
    padding: '14px 10px',
    textAlign: 'center',
  },
  statNum: {
    fontSize: 22,
    fontWeight: 800,
    color: '#f4c84b',
    letterSpacing: '-.03em',
    marginBottom: 3,
  },
  statLabel: {
    fontSize: 10.5,
    fontWeight: 600,
    color: 'rgba(255,255,255,.3)',
    textTransform: 'uppercase',
    letterSpacing: '.06em',
  },
  featureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginBottom: 40,
  },
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  featureDot: {
    width: 6, height: 6,
    borderRadius: '50%',
    background: '#f4c84b',
    boxShadow: '0 0 8px rgba(244,200,75,.5)',
    flexShrink: 0,
  },
  featureText: {
    fontSize: 13.5,
    color: 'rgba(255,255,255,.6)',
    fontWeight: 500,
  },
  versionTag: {
    fontSize: 11,
    color: 'rgba(255,255,255,.2)',
    fontWeight: 500,
    letterSpacing: '.04em',
  },

  /* ── Right form panel ── */
  rightPanel: {
    flex: 1,
    background: '#f0ece3',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 24px',
    overflowY: 'auto',
  },
  card: {
    background: '#ffffff',
    borderRadius: 24,
    padding: '40px 36px',
    width: '100%',
    maxWidth: 440,
    boxShadow: '0 24px 60px rgba(0,0,0,.1), 0 4px 16px rgba(0,0,0,.06)',
  },
  cardHeader: {
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: 800,
    color: '#18181b',
    letterSpacing: '-.03em',
    marginBottom: 5,
  },
  cardSub: {
    fontSize: 13.5,
    color: '#71717a',
    fontWeight: 500,
  },

  /* Quick login */
  quickSection: {
    background: '#faf9f5',
    border: '1px solid rgba(0,0,0,.07)',
    borderRadius: 16,
    padding: '14px 16px',
    marginBottom: 24,
  },
  quickHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 10.5,
    fontWeight: 700,
    color: '#a1a1aa',
    textTransform: 'uppercase',
    letterSpacing: '.08em',
    marginBottom: 10,
  },
  quickGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  quickBtn: {
    padding: '5px 12px',
    background: '#ffffff',
    border: '1px solid rgba(0,0,0,.08)',
    borderRadius: 999,
    fontSize: 11.5,
    fontWeight: 600,
    color: '#52525b',
    cursor: 'pointer',
    transition: 'all .12s',
    fontFamily: 'inherit',
  },
  quickBtnActive: {
    background: '#18181b',
    color: '#f4c84b',
    border: '1px solid #18181b',
    boxShadow: '0 4px 10px rgba(0,0,0,.2)',
  },

  /* Form fields */
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 7,
  },
  label: {
    fontSize: 12.5,
    fontWeight: 700,
    color: '#3f3f46',
    letterSpacing: '.01em',
  },
  fieldIcon: {
    position: 'absolute',
    left: 14,
    top: '50%',
    transform: 'translateY(-50%)',
    transition: 'color .15s',
    pointerEvents: 'none',
    zIndex: 1,
  },
  input: {
    width: '100%',
    padding: '12px 14px 12px 40px',
    borderWidth: 1.5,
    borderStyle: 'solid',
    borderColor: 'rgba(0,0,0,.1)',
    borderRadius: 12,
    fontSize: 14,
    color: '#18181b',
    outline: 'none',
    transition: 'border-color .15s, box-shadow .15s',
    background: '#fafafa',
    fontFamily: 'inherit',
    fontWeight: 500,
  },
  inputFocused: {
    borderColor: '#f4c84b',
    background: '#fff',
    boxShadow: '0 0 0 3px rgba(244,200,75,.14)',
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'rgba(220,38,38,.06)',
    border: '1px solid rgba(220,38,38,.15)',
    color: '#dc2626',
    padding: '11px 14px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
  },
  submitBtn: {
    background: 'linear-gradient(135deg, #1c1c1f, #2a2a2d)',
    color: '#ffffff',
    border: 'none',
    padding: '14px',
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: 4,
    boxShadow: '0 8px 24px rgba(0,0,0,.2), 0 2px 6px rgba(0,0,0,.12)',
    letterSpacing: '-.01em',
    transition: 'all .18s',
    fontFamily: 'inherit',
  },
  spinner: {
    width: 16, height: 16,
    border: '2px solid rgba(255,255,255,.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    display: 'inline-block',
    animation: 'spin .7s linear infinite',
  },

  footer: {
    textAlign: 'center',
    marginTop: 28,
    paddingTop: 20,
    borderTop: '1px solid rgba(0,0,0,.06)',
    fontSize: 11.5,
    color: '#a1a1aa',
    fontWeight: 500,
  },
}
