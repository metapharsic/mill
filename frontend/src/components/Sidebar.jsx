import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { filterNav } from '../data/permissions'
import { LOGO_SRC } from '../utils/logo'
import {
  LayoutDashboard, Factory, BadgeCheck, Wrench, Zap, FileText, Cog,
  Package, Boxes, FlaskConical, TestTubes, Store as StoreIcon, ClipboardList, Recycle,
  ShoppingCart, Users, Building2, Briefcase, Truck, Wallet,
  PackageCheck, Warehouse, UsersRound, ShieldCheck, Microscope, HardHat,
  BarChart3, Layers, Database, Settings, UserCog, Power, ChevronLeft, ChevronRight,
  Globe, RefreshCcw, Grid2X2, Wind, ArrowDownUp, ArrowRight, Flame, Ruler,
  ChefHat, Sun, Disc, Circle, RotateCw, Droplets, Leaf, Thermometer, Fan,
  Search, TrendingUp,
} from 'lucide-react'

const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: null },
  { key: 'reports', label: 'Reports & Analytics', icon: BarChart3, group: null },
  { key: 'production', label: 'Production', icon: Factory, group: 'Operations' },
  { key: 'daily-report', label: 'Daily Report', icon: ClipboardList, group: 'Operations' },
  { key: 'quality', label: 'Quality', icon: BadgeCheck, group: 'Operations' },
  { key: 'maintenance', label: 'Maintenance', icon: Wrench, group: 'Operations' },
  { key: 'utility', label: 'Utility', icon: Zap, group: 'Operations' },
  { key: 'grades', label: 'Grades', icon: FileText, group: 'Operations' },
  { key: 'machines', label: 'Machines', icon: Cog, group: 'Operations' },
  { key: 'rawmaterial', label: 'Raw Material Store', icon: Package, group: 'Materials' },
  { key: 'inventory', label: 'Inventory', icon: Boxes, group: 'Materials' },
  { key: 'materials', label: 'Materials', icon: FlaskConical, group: 'Materials' },
  { key: 'store', label: 'Store Management', icon: StoreIcon, group: 'Materials' },
  { key: 'store-dashboard', label: 'Store Dashboard', icon: BarChart3, group: 'Materials' },
  { key: 'indent', label: 'Indent / PIIMAS', icon: ClipboardList, group: 'Materials' },
  { key: 'purchase', label: 'Purchase', icon: ShoppingCart, group: 'Commercial' },
  { key: 'scrap', label: 'Scrap Management', icon: Recycle, group: 'Commercial' },
  { key: 'customers', label: 'Customers', icon: Users, group: 'Commercial' },
  { key: 'vendors', label: 'Vendors', icon: Building2, group: 'Commercial' },
  { key: 'sales', label: 'Sales', icon: Briefcase, group: 'Commercial' },
  { key: 'dispatch', label: 'Dispatch', icon: Truck, group: 'Commercial' },
  { key: 'finance', label: 'Finance', icon: Wallet, group: 'Commercial' },
  { key: 'packing', label: 'Packing', icon: PackageCheck, group: 'Warehouse' },
  { key: 'fgwarehouse', label: 'FG Warehouse', icon: Warehouse, group: 'Warehouse' },
  { key: 'hr', label: 'HR & Payroll', icon: UsersRound, group: 'People' },
  { key: 'security', label: 'Security', icon: ShieldCheck, group: 'People' },
  { key: 'laboratory', label: 'Laboratory', icon: Microscope, group: 'People' },
  { key: 'ehs', label: 'EHS', icon: HardHat, group: 'People' },
  { key: 'phases', label: 'Phases', icon: Layers, group: 'System' },
  { key: 'masterdata', label: 'Master Data', icon: Database, group: 'System' },
  { key: 'admin', label: 'Administration', icon: Settings, group: 'System' },
  { key: 'users', label: 'User Management', icon: UserCog, group: 'System' },
  { key: 'sections-all',           label: 'All Sections',        icon: Globe,        group: 'Plant Sections' },
  { key: 'sections-pulp',          label: 'Pulp Mill',           icon: Layers,       group: 'Plant Sections' },
  { key: 'sections-centri',        label: 'Centricleaner',       icon: RefreshCcw,   group: 'Plant Sections' },
  { key: 'sections-wire',          label: 'Wire Section',        icon: Grid2X2,      group: 'Plant Sections' },
  { key: 'sections-vacuum',        label: 'Vacuum',              icon: Wind,         group: 'Plant Sections' },
  { key: 'sections-press',         label: 'Press Section',       icon: ArrowDownUp,  group: 'Plant Sections' },
  { key: 'sections-unirun',        label: 'Unirun',              icon: ArrowRight,   group: 'Plant Sections' },
  { key: 'sections-predryer',      label: 'Pre Dryer',           icon: Flame,        group: 'Plant Sections' },
  { key: 'sections-sizepress',     label: 'Size Press',          icon: Ruler,        group: 'Plant Sections' },
  { key: 'sections-sizekitchen',   label: 'Size Kitchen',        icon: ChefHat,      group: 'Plant Sections' },
  { key: 'sections-postdryer',     label: 'Post Dryer',          icon: Sun,          group: 'Plant Sections' },
  { key: 'sections-calender',      label: 'Calender',            icon: Disc,         group: 'Plant Sections' },
  { key: 'sections-pope',          label: 'Pope Reel',           icon: Circle,       group: 'Plant Sections' },
  { key: 'sections-rewinder',      label: 'Rewinder',            icon: RotateCw,     group: 'Plant Sections' },
  { key: 'sections-starchkitchen', label: 'Starch Kitchen',      icon: FlaskConical, group: 'Plant Sections' },
  { key: 'sections-steamcond',     label: 'Steam & Condensate',  icon: Droplets,     group: 'Plant Sections' },
  { key: 'sections-etp',           label: 'ETP',                 icon: Leaf,         group: 'Plant Sections' },
  { key: 'sections-boiler',        label: 'Boiler',              icon: Thermometer,  group: 'Plant Sections' },
  { key: 'sections-lab',           label: 'Lab',                 icon: Microscope,   group: 'Plant Sections' },
  { key: 'sections-cranes',        label: 'Cranes',              icon: HardHat,      group: 'Plant Sections' },
  { key: 'sections-compressors',   label: 'Compressors',         icon: Fan,          group: 'Plant Sections' },
  { key: 'sections-store',         label: 'Store Section',       icon: StoreIcon,    group: 'Plant Sections' },
]

const groups = ['Operations', 'Materials', 'Commercial', 'Warehouse', 'People', 'System', 'Plant Sections']

export default function Sidebar({ active, onNavigate, collapsed, onToggle, mobileOpen, onCloseMobile }) {
  const { user, logout } = useAuth()

  const [expandedGroups, setExpandedGroups] = useState(
    new Set(['Operations', 'Materials', 'Commercial', 'Warehouse', 'People', 'System'])
  )
  const [menuSearch, setMenuSearch] = useState('')

  const handleItemClick = (key) => {
    onCloseMobile?.()
    onNavigate(key)
  }

  const toggleGroup = g => setExpandedGroups(prev => {
    const next = new Set(prev)
    next.has(g) ? next.delete(g) : next.add(g)
    return next
  })

  const visibleNAV = filterNav(NAV, user)
  const q = menuSearch.toLowerCase()
  const filteredNav = visibleNAV.filter(n => !q || n.label.toLowerCase().includes(q))

  return (
    <>
      {mobileOpen && (
        <div
          className="sidebar-backdrop mobile-only"
          onClick={onCloseMobile}
        />
      )}
      <div
        className={`sidebar-drawer ${mobileOpen ? 'mobile-drawer-open' : ''}`}
        style={{ ...S.sidebar, width: collapsed ? 68 : 248 }}
      >

      {/* ── Brand header ── */}
      <div style={S.header}>
        {!collapsed && (
          <div style={S.brand}>
            <div style={{ ...S.brandMark, overflow: 'hidden', padding: 2, background: '#fff', border: '1px solid rgba(255,255,255,.2)' }}>
              <img src={LOGO_SRC} alt="Sri M K Paper Mills" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div>
              <div style={S.brandName}>Sri M K Paper Mills</div>
              <div style={S.brandSub}>Enterprise ERP Platform</div>
            </div>
          </div>
        )}
        {collapsed && (
          <div style={{ ...S.brandMark, margin: '0 auto', overflow: 'hidden', padding: 2, background: '#fff', border: '1px solid rgba(255,255,255,.2)' }}>
            <img src={LOGO_SRC} alt="Sri M K Paper Mills" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
        )}
        <button onClick={onToggle} style={S.toggleBtn} className="nav-item">
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>

      {/* ── Search ── */}
      {!collapsed && (
        <div style={S.searchWrap}>
          <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,.3)', pointerEvents: 'none' }} />
          <input
            style={S.searchInput}
            placeholder="Search menu..."
            value={menuSearch}
            onChange={e => setMenuSearch(e.target.value)}
            aria-label="Search navigation"
          />
          {menuSearch && (
            <button
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.4)', padding: 2, display: 'flex', alignItems: 'center' }}
              onClick={() => setMenuSearch('')}
              aria-label="Clear search"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M6 4.586L10.243.343l1.414 1.414L7.414 6l4.243 4.243-1.414 1.414L6 7.414l-4.243 4.243-1.414-1.414L4.586 6 .343 1.757 1.757.343z"/></svg>
            </button>
          )}
        </div>
      )}
      {/* Search result count */}
      {!collapsed && menuSearch && (
        <div style={{ padding: '0 16px 6px', fontSize: 10.5, color: 'rgba(255,255,255,.28)', fontWeight: 500 }}>
          {filteredNav.length === 0 ? 'No results' : `${filteredNav.length} module${filteredNav.length !== 1 ? 's' : ''} found`}
        </div>
      )}

      {/* ── Nav ── */}
      <nav style={S.nav} className="sb-scroll">
        {/* Top-level Nav Items (Dashboard, Reports) */}
        {filteredNav.filter(n => n.group === null).map(item => {
          const Icon = item.icon
          const isActive = active === item.key
          return (
            <button
              key={item.key}
              className="nav-item"
              style={{ ...S.navItem, ...(isActive ? S.navActive : {}) }}
              onClick={() => handleItemClick(item.key)}
              title={collapsed ? item.label : undefined}
            >
              <span style={{ ...S.navIcon, ...(isActive ? S.navIconActive : {}) }}>
                <Icon size={16} strokeWidth={isActive ? 2.5 : 1.8} />
              </span>
              {!collapsed && <span style={S.navLabel}>{item.label}</span>}
              {!collapsed && isActive && <span style={S.activeDot} />}
            </button>
          )
        })}

        {/* Divider */}
        {!collapsed && <div style={S.divider} />}

        {groups.map(group => {
          const groupItems = filteredNav.filter(n => n.group === group)
          if (groupItems.length === 0) return null
          const isOpen = expandedGroups.has(group) || !!q
          return (
            <div key={group}>
              {!collapsed && (
                <button
                  style={S.groupBtn}
                  onClick={() => toggleGroup(group)}
                  aria-expanded={isOpen}
                  aria-label={`${group} navigation group`}
                >
                  <span style={S.groupLabel}>{group}</span>
                  <span style={{ ...S.groupChevron, transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>›</span>
                </button>
              )}
              {(collapsed || isOpen) && groupItems.map(item => {
                const Icon = item.icon
                const isActive = active === item.key
                return (
                  <button
                    key={item.key}
                    id={`nav-${item.key}`}
                    className="nav-item"
                    style={{ ...S.navItem, ...(isActive ? S.navActive : {}) }}
                    onClick={() => handleItemClick(item.key)}
                    title={collapsed ? item.label : undefined}
                  >
                    <span style={{ ...S.navIcon, ...(isActive ? S.navIconActive : {}) }}>
                      <Icon size={16} strokeWidth={isActive ? 2.5 : 1.8} />
                    </span>
                    {!collapsed && <span style={S.navLabel}>{item.label}</span>}
                    {!collapsed && isActive && <span style={S.activeDot} />}
                  </button>
                )
              })}
            </div>
          )
        })}
        {/* No results */}
        {!collapsed && menuSearch && filteredNav.length === 0 && (
          <div style={{ padding: '24px 16px', textAlign: 'center' }}>
            <Search size={20} strokeWidth={1.5} style={{ color: 'rgba(255,255,255,.15)', display: 'block', margin: '0 auto 8px' }} />
            <div style={{ color: 'rgba(255,255,255,.28)', fontSize: 12 }}>No modules match<br /><strong style={{color:'rgba(255,255,255,.4)'}}>"{menuSearch}"</strong></div>
            <button style={{ marginTop: 10, fontSize: 11, color: '#f4c84b', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setMenuSearch('')}>Clear search</button>
          </div>
        )}
      </nav>

      {/* ── User footer ── */}
      <div style={S.userFooter}>
        {!collapsed ? (
          <>
            <div style={S.avatar}>{user?.name?.[0]?.toUpperCase() || 'U'}</div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={S.userName}>{user?.name}</div>
              <div style={S.userRole}>{user?.role}</div>
            </div>
            <button onClick={logout} style={S.logoutBtn} title="Logout">
              <Power size={15} />
            </button>
          </>
        ) : (
          <button onClick={logout} style={{ ...S.logoutBtn, margin: '0 auto' }} title="Logout">
            <Power size={15} />
          </button>
        )}
      </div>
    </div>
  </>
)
}

const S = {
  sidebar: {
    height: '100vh',
    background: 'var(--sb-bg)',
    display: 'flex',
    flexDirection: 'column',
    transition: 'width .25s cubic-bezier(.22,.61,.36,1)',
    flexShrink: 0,
    overflow: 'hidden',
    borderRight: '1px solid var(--sb-border)',
    position: 'relative',
  },
  header: {
    padding: '18px 14px 14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 68,
    borderBottom: '1px solid var(--sb-border)',
    gap: 8,
  },
  brand: {
    display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden',
  },
  brandMark: {
    width: 38, height: 38,
    background: 'linear-gradient(135deg, #2a2a2d, #1c1c1f)',
    border: '1px solid rgba(244,200,75,.25)',
    borderRadius: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 4px 12px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.06)',
  },
  brandName: {
    color: 'rgba(255,255,255,.92)',
    fontWeight: 700,
    fontSize: 13.5,
    lineHeight: 1.2,
    letterSpacing: '-.01em',
    whiteSpace: 'nowrap',
  },
  brandSub: {
    color: 'rgba(255,255,255,.32)',
    fontSize: 10.5,
    fontWeight: 500,
    letterSpacing: '.02em',
  },
  toggleBtn: {
    background: 'rgba(255,255,255,.07)',
    border: '1px solid rgba(255,255,255,.09)',
    color: 'rgba(255,255,255,.4)',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: 9,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  searchWrap: {
    position: 'relative',
    padding: '10px 12px',
    borderBottom: '1px solid var(--sb-border)',
  },
  searchInput: {
    width: '100%',
    padding: '7px 10px 7px 30px',
    fontSize: 12.5,
    fontWeight: 500,
    borderRadius: 9,
    border: '1px solid rgba(255,255,255,.1)',
    background: 'rgba(255,255,255,.06)',
    color: 'rgba(255,255,255,.8)',
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color .15s, background .15s',
  },
  nav: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 10px',
  },
  divider: {
    height: 1,
    background: 'var(--sb-border)',
    margin: '4px 4px 8px',
  },
  groupBtn: {
    width: '100%',
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,.28)',
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.1em',
    padding: '14px 8px 4px',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  groupLabel: { letterSpacing: '.08em' },
  groupChevron: {
    fontSize: 16,
    lineHeight: 1,
    color: 'rgba(255,255,255,.2)',
    transition: 'transform .18s ease',
    display: 'inline-block',
  },
  navItem: {
    position: 'relative',
    width: '100%',
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,.5)',
    cursor: 'pointer',
    padding: '8px 10px',
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 13,
    fontWeight: 500,
    textAlign: 'left',
    marginBottom: 2,
    fontFamily: 'inherit',
  },
  navActive: {
    background: 'rgba(244,200,75,.13)',
    color: '#f4c84b',
    fontWeight: 600,
  },
  navIcon: {
    flexShrink: 0,
    width: 20, height: 20,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'rgba(255,255,255,.35)',
    borderRadius: 6,
    transition: 'color .15s',
  },
  navIconActive: {
    color: '#f4c84b',
  },
  navLabel: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    flex: 1,
    letterSpacing: '-.01em',
  },
  activeDot: {
    width: 5, height: 5,
    borderRadius: 999,
    background: '#f4c84b',
    flexShrink: 0,
    boxShadow: '0 0 6px rgba(244,200,75,.6)',
  },
  userFooter: {
    padding: '12px 14px',
    borderTop: '1px solid var(--sb-border)',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minHeight: 62,
  },
  avatar: {
    width: 34, height: 34,
    background: 'linear-gradient(135deg, #f4c84b, #e8a73b)',
    borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#1b1b1d',
    fontWeight: 800,
    fontSize: 13.5,
    flexShrink: 0,
    boxShadow: '0 4px 10px rgba(244,200,75,.35)',
  },
  userName: {
    color: 'rgba(255,255,255,.85)',
    fontSize: 12.5, fontWeight: 600,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  userRole: {
    color: 'rgba(255,255,255,.3)',
    fontSize: 11, fontWeight: 500,
    whiteSpace: 'nowrap',
    textTransform: 'capitalize',
  },
  logoutBtn: {
    background: 'rgba(255,255,255,.07)',
    border: '1px solid rgba(255,255,255,.09)',
    color: 'rgba(255,255,255,.4)',
    cursor: 'pointer',
    padding: '8px',
    borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
}
