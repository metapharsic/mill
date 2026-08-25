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
  Search, Cpu, CheckCircle2, ChevronDown, Activity,
} from 'lucide-react'

const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: null },
  { key: 'reports', label: 'Reports & Analytics', icon: BarChart3, group: null },

  // Operations
  { key: 'production', label: 'Production', icon: Factory, group: 'Operations' },
  { key: 'daily-report', label: 'Daily Report', icon: ClipboardList, group: 'Operations' },
  { key: 'quality', label: 'Quality', icon: BadgeCheck, group: 'Operations' },
  { key: 'maintenance', label: 'Maintenance', icon: Wrench, group: 'Operations' },
  { key: 'utility', label: 'Utility', icon: Zap, group: 'Operations' },
  { key: 'grades', label: 'Grades', icon: FileText, group: 'Operations' },

  // Materials & Store
  { key: 'materials', label: 'Materials Master', icon: FlaskConical, group: 'Materials & Inventory' },
  { key: 'rawmaterial', label: 'Raw Material Store', icon: Package, group: 'Materials & Inventory' },
  { key: 'inventory', label: 'Inventory', icon: Boxes, group: 'Materials & Inventory' },

  { key: 'store', label: 'Store Management', icon: StoreIcon, group: 'Store & Indent' },
  { key: 'store-dashboard', label: 'Store Dashboard', icon: BarChart3, group: 'Store & Indent' },
  { key: 'store-reports', label: 'Store Analytics & Reports', icon: FileText, group: 'Store & Indent' },
  { key: 'indent', label: 'Indent / PIIMAS', icon: ClipboardList, group: 'Store & Indent' },

  // Commercial
  { key: 'purchase', label: 'Purchase', icon: ShoppingCart, group: 'Commercial' },
  { key: 'vendors', label: 'Vendors', icon: Building2, group: 'Commercial' },
  { key: 'customers', label: 'Customers', icon: Users, group: 'Commercial' },
  { key: 'sales', label: 'Sales', icon: Briefcase, group: 'Commercial' },
  { key: 'dispatch', label: 'Dispatch', icon: Truck, group: 'Commercial' },
  { key: 'scrap', label: 'Scrap Management', icon: Recycle, group: 'Commercial' },
  { key: 'finance', label: 'Finance', icon: Wallet, group: 'Commercial' },

  // Warehouse
  { key: 'packing', label: 'Packing', icon: PackageCheck, group: 'Warehouse' },
  { key: 'fgwarehouse', label: 'FG Warehouse', icon: Warehouse, group: 'Warehouse' },

  // People & Safety
  { key: 'hr', label: 'HR & Payroll', icon: UsersRound, group: 'People' },
  { key: 'security', label: 'Security', icon: ShieldCheck, group: 'People' },
  { key: 'laboratory', label: 'Laboratory', icon: Microscope, group: 'People' },
  { key: 'ehs', label: 'EHS', icon: HardHat, group: 'People' },

  // Plant & Machines Overview & Register
  { key: 'sections-all', label: 'All Sections (Overview)', icon: Globe, group: 'Plant & Machines' },
  { key: 'machines', label: 'Machine Register', icon: Cog, group: 'Plant & Machines' },

  // System & Multi-Agent Engine
  { key: 'checkpoint', label: 'Multi-Agent Checkpoint', icon: Cpu, group: 'System', isAgentItem: true },
  { key: 'phases', label: 'Phases & Build Status', icon: Layers, group: 'System' },
  { key: 'masterdata', label: 'Master Data', icon: Database, group: 'System' },
  { key: 'admin', label: 'Administration', icon: Settings, group: 'System' },
  { key: 'users', label: 'User Management', icon: UserCog, group: 'System' },

  // Plant Sections (Nested Sub-Items)
  { key: 'sections-pulp', label: 'Pulp Mill', icon: Layers, group: 'Plant & Machines', isSection: true },
  { key: 'sections-centri', label: 'Centricleaner', icon: RefreshCcw, group: 'Plant & Machines', isSection: true },
  { key: 'sections-wire', label: 'Wire Section', icon: Grid2X2, group: 'Plant & Machines', isSection: true },
  { key: 'sections-vacuum', label: 'Vacuum', icon: Wind, group: 'Plant & Machines', isSection: true },
  { key: 'sections-press', label: 'Press Section', icon: ArrowDownUp, group: 'Plant & Machines', isSection: true },
  { key: 'sections-unirun', label: 'Unirun', icon: ArrowRight, group: 'Plant & Machines', isSection: true },
  { key: 'sections-predryer', label: 'Pre Dryer', icon: Flame, group: 'Plant & Machines', isSection: true },
  { key: 'sections-sizepress', label: 'Size Press', icon: Ruler, group: 'Plant & Machines', isSection: true },
  { key: 'sections-sizekitchen', label: 'Size Kitchen', icon: ChefHat, group: 'Plant & Machines', isSection: true },
  { key: 'sections-postdryer', label: 'Post Dryer', icon: Sun, group: 'Plant & Machines', isSection: true },
  { key: 'sections-calender', label: 'Calender', icon: Disc, group: 'Plant & Machines', isSection: true },
  { key: 'sections-pope', label: 'Pope Reel', icon: Circle, group: 'Plant & Machines', isSection: true },
  { key: 'sections-rewinder', label: 'Rewinder', icon: RotateCw, group: 'Plant & Machines', isSection: true },
  { key: 'sections-starchkitchen', label: 'Starch Kitchen', icon: FlaskConical, group: 'Plant & Machines', isSection: true },
  { key: 'sections-steamcond', label: 'Steam & Condensate', icon: Droplets, group: 'Plant & Machines', isSection: true },
  { key: 'sections-boiler', label: 'Boiler', icon: Thermometer, group: 'Plant & Machines', isSection: true },
  { key: 'sections-compressors', label: 'Compressors', icon: Fan, group: 'Plant & Machines', isSection: true },
  { key: 'sections-cranes', label: 'Cranes', icon: HardHat, group: 'Plant & Machines', isSection: true },
  { key: 'sections-etp', label: 'ETP', icon: Leaf, group: 'Plant & Machines', isSection: true },
  { key: 'sections-lab', label: 'Lab Section', icon: Microscope, group: 'Plant & Machines', isSection: true },
  { key: 'sections-store', label: 'Store Section', icon: StoreIcon, group: 'Plant & Machines', isSection: true },
]

const GROUPS = [
  'Operations',
  'Materials & Inventory',
  'Store & Indent',
  'Commercial',
  'Warehouse',
  'People',
  'Plant & Machines',
  'System'
]

export default function Sidebar({ active, onNavigate, collapsed, onToggle, mobileOpen, onCloseMobile }) {
  const { user, logout } = useAuth()

  const isCurrentSectionActive = active && active.startsWith('sections-') && active !== 'sections-all'

  const [expandedGroups, setExpandedGroups] = useState(
    new Set(['Operations', 'Materials & Inventory', 'Store & Indent', 'Commercial', 'Warehouse', 'People', 'Plant & Machines', 'System'])
  )
  const [plantSectionsOpen, setPlantSectionsOpen] = useState(isCurrentSectionActive)
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
        style={{ ...S.sidebar, width: collapsed ? 68 : 256 }}
      >
        {/* ── Brand Header ── */}
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
          <button onClick={onToggle} style={S.toggleBtn} className="nav-item" title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        {/* ── Search Bar ── */}
        {!collapsed && (
          <div style={S.searchWrap}>
            <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,.35)', pointerEvents: 'none' }} />
            <input
              style={S.searchInput}
              placeholder="Search ERP modules..."
              value={menuSearch}
              onChange={e => setMenuSearch(e.target.value)}
              aria-label="Search navigation"
            />
            {menuSearch && (
              <button
                style={S.clearSearchBtn}
                onClick={() => setMenuSearch('')}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* Search Result Count */}
        {!collapsed && menuSearch && (
          <div style={{ padding: '0 16px 6px', fontSize: 10.5, color: 'rgba(255,255,255,.35)', fontWeight: 500 }}>
            {filteredNav.length === 0 ? 'No modules found' : `${filteredNav.length} module${filteredNav.length !== 1 ? 's' : ''} found`}
          </div>
        )}

        {/* ── Navigation Tree ── */}
        <nav style={S.nav} className="sb-scroll">
          {/* Top-Level Items (Dashboard, Reports) */}
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

          {/* Grouped Modules */}
          {GROUPS.map(group => {
            const groupItems = filteredNav.filter(n => n.group === group)
            if (groupItems.length === 0) return null

            const isGroupOpen = expandedGroups.has(group) || !!q

            // Separate normal items vs nested section items in Plant & Machines
            const normalItems = group === 'Plant & Machines'
              ? groupItems.filter(n => !n.isSection)
              : groupItems

            const sectionItems = group === 'Plant & Machines'
              ? groupItems.filter(n => n.isSection)
              : []

            const isAnySectionActive = sectionItems.some(s => s.key === active)
            const showSectionsSubMenu = plantSectionsOpen || isAnySectionActive || !!q

            return (
              <div key={group} style={S.groupContainer}>
                {!collapsed && (
                  <button
                    style={S.groupBtn}
                    onClick={() => toggleGroup(group)}
                    aria-expanded={isGroupOpen}
                  >
                    <span style={S.groupLabel}>{group}</span>
                    <span style={{ ...S.groupChevron, transform: isGroupOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>›</span>
                  </button>
                )}

                {(collapsed || isGroupOpen) && (
                  <>
                    {/* Normal group items */}
                    {normalItems.map(item => {
                      const Icon = item.icon
                      const isActive = active === item.key
                      const isAgentItem = item.isAgentItem

                      return (
                        <button
                          key={item.key}
                          id={`nav-${item.key}`}
                          className="nav-item"
                          style={{
                            ...S.navItem,
                            ...(isActive ? S.navActive : {}),
                            ...(isAgentItem && !isActive ? S.agentNavItem : {})
                          }}
                          onClick={() => handleItemClick(item.key)}
                          title={collapsed ? item.label : undefined}
                        >
                          <span style={{
                            ...S.navIcon,
                            ...(isActive ? S.navIconActive : {}),
                            ...(isAgentItem && !isActive ? { color: '#f4c84b' } : {})
                          }}>
                            <Icon size={16} strokeWidth={isActive ? 2.5 : 1.8} />
                          </span>
                          {!collapsed && (
                            <span style={{ ...S.navLabel, ...(isAgentItem && !isActive ? { color: 'rgba(255,255,255,.9)', fontWeight: 600 } : {}) }}>
                              {item.label}
                            </span>
                          )}
                          {!collapsed && isAgentItem && (
                            <span style={S.liveMiniPill} title="6/6 Multi-Agents Online">
                              <span style={S.miniDot} />
                              LIVE
                            </span>
                          )}
                          {!collapsed && isActive && <span style={S.activeDot} />}
                        </button>
                      )
                    })}

                    {/* Plant Sections Sub-Accordion (Only inside Plant & Machines) */}
                    {group === 'Plant & Machines' && sectionItems.length > 0 && !collapsed && (
                      <div style={S.subAccordionWrap}>
                        <button
                          style={S.subAccordionToggle}
                          onClick={() => setPlantSectionsOpen(o => !o)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Layers size={14} style={{ color: isAnySectionActive ? '#f4c84b' : 'rgba(255,255,255,.4)' }} />
                            <span style={{ ...S.subAccordionLabel, color: isAnySectionActive ? '#f4c84b' : 'rgba(255,255,255,.7)' }}>
                              Plant Sections
                            </span>
                            <span style={S.subAccordionBadge}>{sectionItems.length}</span>
                          </div>
                          <span style={{ ...S.groupChevron, fontSize: 13, transform: showSectionsSubMenu ? 'rotate(90deg)' : 'rotate(0deg)' }}>›</span>
                        </button>

                        {showSectionsSubMenu && (
                          <div style={S.subItemsList}>
                            {sectionItems.map(s => {
                              const SIcon = s.icon
                              const isSActive = active === s.key
                              return (
                                <button
                                  key={s.key}
                                  id={`nav-${s.key}`}
                                  className="nav-item"
                                  style={{
                                    ...S.navItem,
                                    ...S.subNavItem,
                                    ...(isSActive ? S.navActive : {})
                                  }}
                                  onClick={() => handleItemClick(s.key)}
                                >
                                  <span style={{ ...S.navIcon, width: 16, height: 16, ...(isSActive ? S.navIconActive : {}) }}>
                                    <SIcon size={13} strokeWidth={isSActive ? 2.5 : 1.8} />
                                  </span>
                                  <span style={S.navLabel}>{s.label}</span>
                                  {isSActive && <span style={S.activeDot} />}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}

          {/* No Results */}
          {!collapsed && menuSearch && filteredNav.length === 0 && (
            <div style={{ padding: '24px 16px', textAlign: 'center' }}>
              <Search size={20} strokeWidth={1.5} style={{ color: 'rgba(255,255,255,.15)', display: 'block', margin: '0 auto 8px' }} />
              <div style={{ color: 'rgba(255,255,255,.35)', fontSize: 12 }}>No modules match<br /><strong style={{ color: 'rgba(255,255,255,.6)' }}>"{menuSearch}"</strong></div>
              <button style={{ marginTop: 10, fontSize: 11, color: '#f4c84b', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setMenuSearch('')}>Clear search</button>
            </div>
          )}
        </nav>

        {/* ── Multi-Agent Live Banner (Restricted to Admin / Developer) ── */}
        {!collapsed && (user?.role_level >= 5 || user?.role === 'Admin') && (
          <div
            style={S.agentFooterBanner}
            onClick={() => handleItemClick('checkpoint')}
            title="Open Multi-Agent Diagnostics Engine"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={S.agentPulseDot} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={S.agentBannerTitle}>6/6 AGENTS ACTIVE</span>
                <span style={S.agentBannerSub}>System & Schema In Sync</span>
              </div>
            </div>
            <ChevronRight size={13} style={{ color: 'rgba(255,255,255,.3)' }} />
          </div>
        )}

        {/* ── User Footer ── */}
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
    transition: 'width .22s cubic-bezier(.22,.61,.36,1)',
    flexShrink: 0,
    overflow: 'hidden',
    borderRight: '1px solid var(--sb-border)',
    position: 'relative',
  },
  header: {
    padding: '16px 14px 12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 64,
    borderBottom: '1px solid var(--sb-border)',
    gap: 8,
  },
  brand: {
    display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden',
  },
  brandMark: {
    width: 36, height: 36,
    background: 'linear-gradient(135deg, #2a2a2d, #1c1c1f)',
    border: '1px solid rgba(244,200,75,.25)',
    borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 4px 12px rgba(0,0,0,.4)',
  },
  brandName: {
    color: 'rgba(255,255,255,.94)',
    fontWeight: 700,
    fontSize: 13.5,
    lineHeight: 1.2,
    letterSpacing: '-.01em',
    whiteSpace: 'nowrap',
  },
  brandSub: {
    color: 'rgba(255,255,255,.35)',
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: '.02em',
  },
  toggleBtn: {
    background: 'rgba(255,255,255,.07)',
    border: '1px solid rgba(255,255,255,.09)',
    color: 'rgba(255,255,255,.5)',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  searchWrap: {
    position: 'relative',
    padding: '8px 12px',
    borderBottom: '1px solid var(--sb-border)',
  },
  searchInput: {
    width: '100%',
    padding: '6px 10px 6px 28px',
    fontSize: 12,
    fontWeight: 500,
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,.1)',
    background: 'rgba(255,255,255,.06)',
    color: 'rgba(255,255,255,.85)',
    outline: 'none',
    fontFamily: 'inherit',
  },
  clearSearchBtn: {
    position: 'absolute',
    right: 18,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'rgba(255,255,255,.4)',
    fontSize: 11,
    padding: 2,
  },
  nav: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 10px',
  },
  divider: {
    height: 1,
    background: 'var(--sb-border)',
    margin: '4px 4px 6px',
  },
  groupContainer: {
    marginBottom: 4,
  },
  groupBtn: {
    width: '100%',
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,.3)',
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.08em',
    padding: '10px 8px 3px',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  groupLabel: { letterSpacing: '.07em' },
  groupChevron: {
    fontSize: 14,
    lineHeight: 1,
    color: 'rgba(255,255,255,.25)',
    transition: 'transform .15s ease',
    display: 'inline-block',
  },
  navItem: {
    position: 'relative',
    width: '100%',
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,.55)',
    cursor: 'pointer',
    padding: '7px 10px',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    fontSize: 12.5,
    fontWeight: 500,
    textAlign: 'left',
    marginBottom: 1,
    fontFamily: 'inherit',
    transition: 'background .12s, color .12s',
  },
  subNavItem: {
    padding: '6px 10px 6px 14px',
    fontSize: 12,
    color: 'rgba(255,255,255,.45)',
  },
  agentNavItem: {
    background: 'rgba(244,200,75,.04)',
    border: '1px solid rgba(244,200,75,.12)',
  },
  navActive: {
    background: 'rgba(244,200,75,.14)',
    color: '#f4c84b',
    fontWeight: 600,
  },
  navIcon: {
    flexShrink: 0,
    width: 18, height: 18,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'rgba(255,255,255,.38)',
    borderRadius: 6,
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
  liveMiniPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    background: 'rgba(244,200,75,.18)',
    border: '1px solid rgba(244,200,75,.35)',
    color: '#f4c84b',
    fontSize: 9,
    fontWeight: 800,
    padding: '1px 5px',
    borderRadius: 4,
    letterSpacing: '0.04em',
  },
  miniDot: {
    width: 4,
    height: 4,
    borderRadius: 999,
    background: '#f4c84b',
  },
  subAccordionWrap: {
    marginTop: 2,
    marginBottom: 4,
    paddingLeft: 4,
  },
  subAccordionToggle: {
    width: '100%',
    background: 'rgba(255,255,255,.03)',
    border: '1px solid rgba(255,255,255,.06)',
    borderRadius: 8,
    padding: '6px 10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
  },
  subAccordionLabel: {
    fontSize: 11.5,
    fontWeight: 600,
  },
  subAccordionBadge: {
    fontSize: 10,
    fontWeight: 700,
    background: 'rgba(255,255,255,.08)',
    padding: '1px 5px',
    borderRadius: 999,
    color: 'rgba(255,255,255,.5)',
  },
  subItemsList: {
    paddingLeft: 8,
    marginTop: 3,
    borderLeft: '1px solid rgba(255,255,255,.08)',
    marginLeft: 12,
  },
  agentFooterBanner: {
    margin: '4px 10px 8px',
    padding: '8px 10px',
    background: 'linear-gradient(135deg, rgba(244,200,75,.1), rgba(244,200,75,.03))',
    border: '1px solid rgba(244,200,75,.25)',
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    transition: 'background .15s',
  },
  agentPulseDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    background: '#4ade80',
    boxShadow: '0 0 8px #4ade80',
  },
  agentBannerTitle: {
    fontSize: 10,
    fontWeight: 800,
    color: '#f4c84b',
    letterSpacing: '0.04em',
  },
  agentBannerSub: {
    fontSize: 9.5,
    color: 'rgba(255,255,255,.4)',
  },
  userFooter: {
    padding: '10px 12px',
    borderTop: '1px solid var(--sb-border)',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minHeight: 58,
  },
  avatar: {
    width: 32, height: 32,
    background: 'linear-gradient(135deg, #f4c84b, #e8a73b)',
    borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#1b1b1d',
    fontWeight: 800,
    fontSize: 13,
    flexShrink: 0,
    boxShadow: '0 3px 8px rgba(244,200,75,.3)',
  },
  userName: {
    color: 'rgba(255,255,255,.88)',
    fontSize: 12, fontWeight: 600,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  userRole: {
    color: 'rgba(255,255,255,.35)',
    fontSize: 10.5, fontWeight: 500,
    whiteSpace: 'nowrap',
    textTransform: 'capitalize',
  },
  logoutBtn: {
    background: 'rgba(255,255,255,.07)',
    border: '1px solid rgba(255,255,255,.09)',
    color: 'rgba(255,255,255,.4)',
    cursor: 'pointer',
    padding: '7px',
    borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
}
