import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, BellOff, Lock, LogOut, Menu } from 'lucide-react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { canAccess } from './data/permissions'
import ForceChangePassword from './pages/ForceChangePassword'
import Login from './pages/Login'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Placeholder from './pages/Placeholder'
import Customers from './pages/Customers'
import Materials from './pages/Materials'
import Users from './pages/Users'
import Vendors from './pages/Vendors'
import Grades from './pages/Grades'
import Machines from './pages/Machines'
import Production from './pages/Production'
import DailyReport from './pages/DailyReport'
import Phases from './pages/Phases'
import MasterData from './pages/MasterData'
import Inventory from './pages/Inventory'
import Indent from './pages/Indent'
import Purchase from './pages/Purchase'
import Quality from './pages/Quality'
import Maintenance from './pages/Maintenance'
import Sales from './pages/Sales'
import Utility from './pages/Utility'
import Reports from './pages/Reports'
import HR from './pages/HR'
import Finance from './pages/Finance'
import RawMaterial from './pages/RawMaterial'
import Store from './pages/Store'
import Scrap from './pages/Scrap'
import Packing from './pages/Packing'
import FGWarehouse from './pages/FGWarehouse'
import Security from './pages/Security'
import Laboratory from './pages/Laboratory'
import EHS from './pages/EHS'
import Admin from './pages/Admin'
import AllSections from './pages/AllSections'
import PlantSection from './pages/PlantSection'
import ChemicalStore from './pages/ChemicalStore'
import StoreDashboard from './pages/StoreDashboard'

// Plant-section keys — must stay in sync with the 'Plant Sections' group in Sidebar.jsx.
// They are routed as /sections/<code> and rendered by AllSections / PlantSection.
const SECTION_KEYS = ['sections-all','sections-pulp','sections-centri','sections-wire','sections-vacuum',
  'sections-press','sections-unirun','sections-predryer','sections-sizepress','sections-sizekitchen',
  'sections-postdryer','sections-calender','sections-pope','sections-rewinder','sections-starchkitchen',
  'sections-steamcond','sections-etp','sections-boiler','sections-lab','sections-cranes',
  'sections-compressors','sections-store']

const NAV_KEYS = ['dashboard','production','daily-report','quality','maintenance','utility','grades','machines',
  'rawmaterial','inventory','materials','chemicals','store','store-dashboard','indent','scrap',
  'purchase','customers','vendors','sales','dispatch','finance',
  'packing','fgwarehouse','hr','security','laboratory','ehs',
  'reports','phases','masterdata','admin','users',
  ...SECTION_KEYS]

function AccessDenied({ onNavigate }) {
  return (
    <div style={{padding:60,textAlign:'center',color:'#64748b'}}>
      <div style={{marginBottom:16,display:'flex',justifyContent:'center'}}>
        <Lock size={48} strokeWidth={1.5} style={{color:'#a1a1aa'}} />
      </div>
      <div style={{fontSize:18,fontWeight:700,color:'#18181b',marginBottom:8}}>Access Denied</div>
      <div style={{fontSize:13,color:'#71717a',marginBottom:20}}>You don't have permission to view this page.</div>
      <button
        style={{padding:'9px 20px',borderRadius:10,border:'none',cursor:'pointer',background:'#18181b',color:'#f4c84b',fontSize:13.5,fontWeight:700}}
        onClick={() => onNavigate ? onNavigate('dashboard') : (window.location.href = '/dashboard')}
      >Go to Dashboard</button>
    </div>
  )
}


const MODULES = [
  'production','quality','maintenance','utility',
  'rawmaterial','inventory','store','indent','scrap',
  'purchase','sales','dispatch','finance',
  'packing','fgwarehouse',
  'hr','security','laboratory','ehs',
  'admin','users',
]

const PAGE_COMPONENTS = {
  dashboard: Dashboard,
  production: Production,
  'daily-report': DailyReport,
  customers: Customers,
  materials: Materials,
  users: Users,
  vendors: Vendors,
  grades: Grades,
  machines: Machines,
  phases: Phases,
  masterdata: MasterData,
  inventory: Inventory,
  indent: Indent,
  purchase: Purchase,
  quality: Quality,
  maintenance: Maintenance,
  sales: Sales,
  dispatch: Sales,
  utility: Utility,
  reports: Reports,
  hr: HR,
  finance: Finance,
  rawmaterial: RawMaterial,
  store: Store,
  'store-dashboard': StoreDashboard,
  scrap: Scrap,
  packing: Packing,
  fgwarehouse: FGWarehouse,
  security: Security,
  laboratory: Laboratory,
  ehs: EHS,
  admin: Admin,
  chemicals: ChemicalStore,
}

const PAGE_TITLES = {
  dashboard:'Dashboard', production:'Production', 'daily-report':'Daily Report', quality:'Quality', maintenance:'Maintenance',
  utility:'Utility', grades:'Grades', machines:'Machines', rawmaterial:'Raw Material Store',
  inventory:'Inventory', materials:'Materials', chemicals:'Chemical Store', store:'Store Management',
  'store-dashboard':'Store Dashboard',
  indent:'Indent / PIIMAS', scrap:'Scrap Management', purchase:'Purchase', customers:'Customers',
  vendors:'Vendors', sales:'Sales', dispatch:'Dispatch', finance:'Finance', packing:'Packing',
  fgwarehouse:'FG Warehouse', hr:'HR & Payroll', security:'Security', laboratory:'Laboratory',
  ehs:'EHS', reports:'Reports & Analytics', phases:'Phases', masterdata:'Master Data', admin:'Administration',
  users:'User Management',
}

const API_BASE = import.meta.env.VITE_API_URL || ''
async function apiFetch(path, opts = {}) {
  const token = localStorage.getItem('mk_token')
  const res = await fetch(`${API_BASE}/api/hr${path}`, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers },
    ...opts,
  })
  return res.json().catch(() => ({ success: false }))
}

function AppShell() {
  const { user, loading, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notifs, setNotifs]         = useState([])
  const [unread, setUnread]         = useState(0)
  const [notifOpen, setNotifOpen]   = useState(false)
  const [notifError, setNotifError] = useState(false)
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifLastUpdated, setNotifLastUpdated] = useState(null)

  // Derive active key from URL route path
  const rawPath = location.pathname.toLowerCase().replace(/\/$/, '')
  let active = 'dashboard'
  if (rawPath.startsWith('/sections/')) {
    active = `sections-${rawPath.replace('/sections/', '')}`
  } else if (rawPath.length > 1) {
    active = rawPath.substring(1)
  }

  // Page authorization — deliberately uses canAccess, NOT filterNav: filterNav also
  // strips keys that are merely hidden from the sidebar (e.g. 'chemicals'), which
  // would make those pages unreachable by URL as well.
  const allowedKeys = new Set(
    user ? NAV_KEYS.filter(k => canAccess(k, user)) : []
  )

  useEffect(() => {
    if (location.pathname === '/' || location.pathname === '') {
      navigate('/dashboard', { replace: true })
    }
  }, [location.pathname, navigate])

  const handleNavigate = (key) => {
    setMobileOpen(false)
    let targetPath = '/dashboard'
    if (key.startsWith('sections-')) {
      targetPath = `/sections/${key.replace('sections-', '')}`
    } else if (key !== 'dashboard') {
      targetPath = `/${key}`
    }
    navigate(targetPath)
  }

  // Permission check
  useEffect(() => {
    if (!user || active === 'dashboard') return
    if (!allowedKeys.has(active)) navigate('/dashboard', { replace: true })
  }, [user, active, navigate])

  // Notification polling (every 60s when user is logged in)
  useEffect(() => {
    if (!user) return
    const fetchNotifs = (isManual = false) => {
      if (isManual) setNotifLoading(true)
      apiFetch('/notifications')
        .then(r => {
          if (r.success) {
            setNotifs(r.data || [])
            setUnread(r.unreadCount || 0)
            setNotifError(false)
            setNotifLastUpdated(new Date())
          } else {
            setNotifError(true)
          }
        })
        .catch(() => setNotifError(true))
        .finally(() => setNotifLoading(false))
    }
    fetchNotifs()
    const t = setInterval(fetchNotifs, 60_000)
    return () => clearInterval(t)
  }, [user])

  const markAllRead = async () => {
    await apiFetch('/notifications/read-all', { method: 'PUT' })
    setNotifs(prev => prev.map(n => ({ ...n, isRead: true })))
    setUnread(0)
  }

  const markRead = async (id) => {
    await apiFetch(`/notifications/${id}/read`, { method: 'PUT' })
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
    setUnread(prev => Math.max(0, prev - 1))
  }

  // Close notif panel on outside click
  useEffect(() => {
    if (!notifOpen) return
    const h = () => setNotifOpen(false)
    window.addEventListener('click', h)
    return () => window.removeEventListener('click', h)
  }, [notifOpen])

  if (loading) {
    return (
      <div style={styles.splash}>
        <div style={styles.splashContent}>
          <div style={styles.splashRing}>
            <div style={styles.splashLogo}>M</div>
          </div>
          <div style={styles.splashText}>MK Paper Mill</div>
          <div style={styles.splashSub}>Enterprise Resource Planning</div>
          <div style={styles.splashLoader}>
            <div style={styles.splashLoaderBar} />
          </div>
        </div>
      </div>
    )
  }

  if (!user) return <Login />
  if (user.must_change_password) return <ForceChangePassword />

  const renderPage = () => {
    if (active !== 'dashboard' && !allowedKeys.has(active)) return <AccessDenied onNavigate={handleNavigate} />
    if (active === 'sections-all') return <AllSections />
    if (active.startsWith('sections-')) {
      const code = active.replace('sections-', '').toUpperCase()
      return <PlantSection sectionCode={code} />
    }
    const PageComponent = PAGE_COMPONENTS[active]
    if (PageComponent) return <PageComponent onNavigate={handleNavigate} />
    if (MODULES.includes(active)) return <Placeholder module={active} onNavigate={handleNavigate} />
    return <Dashboard onNavigate={handleNavigate} />
  }

  return (
    <div style={styles.shell}>
      <Sidebar
        active={active}
        onNavigate={handleNavigate}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(c => !c)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div style={styles.main}>
        <header style={styles.topbar} className="glass">
          <div style={styles.crumb}>
            <button className="mobile-only" style={{ ...styles.iconBtn, width: 34, height: 34, marginRight: 6 }} title="Toggle menu" onClick={() => setMobileOpen(o => !o)}>
              <Menu size={16} strokeWidth={2} />
            </button>
            <div style={styles.crumbDot} />
            <span style={{ ...styles.crumbRoot, cursor: 'pointer' }} onClick={() => handleNavigate('dashboard')}>MK Paper Mill</span>
            <span style={styles.crumbSep}>/</span>
            <span style={styles.crumbActive}>
              {active === 'sections-all' ? 'All Plant Sections' :
               active.startsWith('sections-') ? `Plant Section — ${active.replace('sections-', '').toUpperCase()}` :
               (PAGE_TITLES[active] || 'Workspace')}
            </span>
          </div>
          <div style={styles.topActions}>
            <span style={styles.livePill}>
              <span style={{ ...styles.liveDot }} className="live-dot" />
              System Live
            </span>
            <div style={{ position: 'relative' }}>
              <button
                style={styles.iconBtn}
                title="Notifications"
                onClick={e => { e.stopPropagation(); setNotifOpen(o => !o) }}
              >
                <Bell size={16} strokeWidth={1.8} />
                {unread > 0 && (
                  <span style={styles.notifBadge}>{unread > 9 ? '9+' : unread}</span>
                )}
              </button>
              {notifOpen && (
                <div style={styles.notifPanel} onClick={e => e.stopPropagation()}>
                  <div style={styles.notifHeader}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <Bell size={14} strokeWidth={2} style={{color:'#f4c84b'}} />
                      <span style={{ fontWeight: 700, fontSize: 13, color:'#18181b' }}>Notifications</span>
                      {notifLastUpdated && !notifError && (
                        <span style={{ fontSize: 10, color: '#a1a1aa', fontWeight: 500 }}>
                          · {Math.round((Date.now() - notifLastUpdated) / 60000) < 1 ? 'just now' : `${Math.round((Date.now() - notifLastUpdated) / 60000)}m ago`}
                        </span>
                      )}
                    </div>
                    {unread > 0 && !notifError && (
                      <button style={styles.notifMarkAll} onClick={markAllRead}>Mark all read</button>
                    )}
                  </div>
                  <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                    {notifError ? (
                      <div style={{ padding: '28px 16px', textAlign: 'center' }}>
                        <BellOff size={24} strokeWidth={1.5} style={{ color: '#fca5a5', display:'block', margin:'0 auto 8px' }} />
                        <div style={{ color: '#b91c1c', fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Could not load notifications</div>
                        <button
                          style={{ fontSize: 11.5, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                          onClick={() => { setNotifError(false); apiFetch('/notifications').then(r => { if (r.success) { setNotifs(r.data || []); setUnread(r.unreadCount || 0); setNotifLastUpdated(new Date()); setNotifError(false) } else setNotifError(true) }).catch(() => setNotifError(true)) }}
                        >
                          {notifLoading ? 'Retrying…' : 'Retry'}
                        </button>
                      </div>
                    ) : notifs.length === 0 ? (
                      <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                        <BellOff size={28} strokeWidth={1.5} style={{color:'#d4d4d8', display:'block', margin:'0 auto 8px'}} />
                        <div style={{ color: '#a1a1aa', fontSize: 12, marginTop: 8 }}>You're all caught up!</div>
                      </div>
                    ) : notifs.map(n => (
                      <div
                        key={n.id}
                        style={{ ...styles.notifItem, background: n.isRead ? '#fff' : 'rgba(244,200,75,.06)', borderLeft: n.isRead ? '3px solid transparent' : '3px solid #f4c84b' }}
                        onClick={() => !n.isRead && markRead(n.id)}
                      >
                        <div style={{ fontWeight: n.isRead ? 500 : 700, fontSize: 12.5, color: '#18181b' }}>{n.title}</div>
                        {n.message && <div style={{ fontSize: 11.5, color: '#71717a', marginTop: 3, lineHeight: 1.5 }}>{n.message}</div>}
                        <div style={{ fontSize: 10.5, color: '#a1a1aa', marginTop: 5 }}>
                          {new Date(n.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button style={styles.iconBtn} title="Logout" onClick={logout}><LogOut size={16} strokeWidth={1.8} /></button>
          </div>
        </header>
        <div style={styles.content} className="sb-scroll">
          <div key={active} className="page-enter" onAnimationEnd={e => { e.currentTarget.classList.remove('page-enter') }}>
            {renderPage()}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}

const styles = {
  // ── Splash screen ──────────────────────────────
  splash: {
    minHeight: '100vh',
    background: 'linear-gradient(150deg, #111113 0%, #1c1c1f 45%, #0f0f11 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashContent: {
    textAlign: 'center',
    animation: 'fadeIn .5s ease both',
  },
  splashRing: {
    width: 88,
    height: 88,
    borderRadius: 24,
    background: 'linear-gradient(135deg, #2a2a2d, #1c1c1f)',
    border: '1px solid rgba(244,200,75,.3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 20px',
    boxShadow: '0 0 40px rgba(244,200,75,.18), 0 20px 50px rgba(0,0,0,.5)',
  },
  splashLogo: {
    fontSize: 38,
    fontWeight: 900,
    color: '#f4c84b',
    letterSpacing: '-2px',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  splashText: {
    color: 'rgba(255,255,255,.92)',
    fontSize: '22px',
    fontWeight: 800,
    marginBottom: '6px',
    letterSpacing: '-.03em',
  },
  splashSub: {
    color: 'rgba(255,255,255,.35)',
    fontSize: '13px',
    fontWeight: 500,
    marginBottom: 28,
  },
  splashLoader: {
    width: 180,
    height: 3,
    background: 'rgba(255,255,255,.08)',
    borderRadius: 999,
    margin: '0 auto',
    overflow: 'hidden',
  },
  splashLoaderBar: {
    height: '100%',
    width: '40%',
    background: 'linear-gradient(90deg, transparent, #f4c84b, transparent)',
    borderRadius: 999,
    animation: 'shimmer 1.4s infinite',
    backgroundSize: '200% 100%',
  },

  // ── App shell ──────────────────────────────────
  shell: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
  },
  main: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    background: 'linear-gradient(160deg, #eae6dc 0%, #f0ece3 50%, #f5f0e6 100%)',
    backgroundAttachment: 'fixed',
  },

  // ── Topbar ─────────────────────────────────────
  topbar: {
    height: 60,
    flexShrink: 0,
    borderBottom: '1px solid rgba(0,0,0,.07)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    position: 'relative',
    zIndex: 10,
  },
  crumb: {
    display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
  },
  crumbDot: {
    width: 7, height: 7, borderRadius: '50%',
    background: 'linear-gradient(135deg, #f4c84b, #e8a73b)',
    boxShadow: '0 0 8px rgba(244,200,75,.5)',
    flexShrink: 0,
  },
  crumbRoot: { color: '#a1a1aa', fontWeight: 600 },
  crumbSep:  { color: '#d4d4d8', fontSize: 16, lineHeight: 1 },
  crumbActive: { color: '#18181b', fontWeight: 700, letterSpacing: '-.01em' },
  topActions: { display: 'flex', alignItems: 'center', gap: 8 },
  livePill: {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    background: '#18181b',
    color: 'rgba(255,255,255,.88)',
    borderRadius: 999,
    padding: '6px 13px',
    fontSize: 11.5, fontWeight: 600,
    boxShadow: '0 4px 12px rgba(0,0,0,.2)',
    letterSpacing: '.01em',
  },
  liveDot: {
    width: 7, height: 7, borderRadius: '50%',
    background: '#f4c84b',
    boxShadow: '0 0 0 2px rgba(244,200,75,.3)',
  },
  iconBtn: {
    position: 'relative',
    width: 38, height: 38,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(255,255,255,.75)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(0,0,0,.07)',
    borderRadius: 12,
    color: '#3f3f46',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,.06)',
  },
  notifBadge: {
    position: 'absolute', top: -2, right: -2,
    background: '#dc2626', color: '#fff',
    fontSize: 9, fontWeight: 800, lineHeight: 1,
    borderRadius: 999, padding: '2px 5px',
    minWidth: 16, textAlign: 'center',
    boxShadow: '0 2px 6px rgba(220,38,38,.4)',
  },

  // ── Notification panel ─────────────────────────
  notifPanel: {
    position: 'absolute', top: 46, right: 0, zIndex: 1000,
    width: 340,
    background: '#fff',
    border: '1px solid rgba(0,0,0,.08)',
    borderRadius: 18,
    boxShadow: '0 20px 50px rgba(0,0,0,.18), 0 4px 12px rgba(0,0,0,.06)',
    overflow: 'hidden',
    animation: 'slideDown .2s var(--ease) both',
  },
  notifHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 18px',
    borderBottom: '1px solid rgba(0,0,0,.06)',
    background: '#fafaf9',
  },
  notifMarkAll: {
    background: 'rgba(244,200,75,.12)',
    border: 'none',
    cursor: 'pointer',
    color: '#b45309',
    fontSize: 11, fontWeight: 700,
    padding: '4px 10px',
    borderRadius: 999,
  },
  notifItem: {
    padding: '12px 18px',
    borderBottom: '1px solid rgba(0,0,0,.04)',
    cursor: 'pointer',
    transition: 'background .12s',
  },

  // ── Main content area ──────────────────────────
  content: {
    flex: 1,
    overflow: 'auto',
    padding: 0,
  },
}
