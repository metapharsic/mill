// Dept-to-pages map. user.department = exact dept name from DB.
// role_level: 5=Admin, 4=PlantHead, 3=Manager(DeptHead), 2=Supervisor, 1=Operator

// Pages every authenticated user sees
const PUBLIC = new Set(['dashboard', 'indent', 'reports', 'checkpoint', 'agents'])

// Dedicated whitelist for Store Management department
const STORE_NAV = new Set([
  'dashboard', 'store', 'store-dashboard', 'materials', 'inventory', 'indent', 'rawmaterial', 'purchase', 'vendors', 'reports', 'checkpoint', 'agents',
])

// Minimum level required (anyone >= level sees it, regardless of dept)
const LEVEL_GATE = {
  users:      5,
  admin:      5,
  masterdata: 4,
  phases:     4,
  grades:     3,
  machines:   3,
  checkpoint: 1,
  agents:     1,
  hr:         1,  // all employees: self-service payslip / leave / attendance
}

// Dept-restricted pages: array = allowed dept names, true = all
const DEPT_GATE = {
  production:        ['Production'],
  'daily-report':    ['Production', 'Utility', 'Quality'],
  quality:           ['Quality', 'Laboratory'],
  maintenance:       ['Maintenance'],
  utility:           ['Utility'],
  rawmaterial:       ['Raw Material Store', 'Store Management'],
  inventory:         ['Inventory', 'Store Management', 'Raw Material Store'],
  store:             ['Store Management', 'Inventory', 'Raw Material Store'],
  'store-dashboard': ['Store Management', 'Inventory', 'Raw Material Store', 'Purchase'],
  materials:         ['Store Management', 'Inventory', 'Purchase', 'Raw Material Store'],
  purchase:        ['Purchase', 'Store Management'],
  customers:       ['Sales', 'Commercial'],
  vendors:         ['Purchase', 'Store Management'],
  sales:           ['Sales', 'Commercial'],
  dispatch:        ['Dispatch', 'Sales', 'Finished Goods Warehouse', 'Commercial'],
  finance:         ['Finance'],
  packing:         ['Packing'],
  fgwarehouse:     ['Finished Goods Warehouse', 'Dispatch', 'Sales'],
  security:        ['Security'],
  laboratory:      ['Laboratory', 'Quality'],
  ehs:             ['EHS'],
  scrap:           ['Scrap Management', 'Commercial', 'Administration'],
}

// Keys deliberately hidden from the sidebar but still reachable by direct URL.
// NOTE: this is a *navigation* rule only — it must never be used for page
// authorization, or the page becomes unreachable entirely.
const NAV_HIDDEN = new Set(['chemicals'])

// Can this user open this page (by URL or by nav click)?
// Nav visibility is a separate, stricter question — see filterNav below.
export function canAccess(key, user) {
  if (!user) return false
  const lvl = user.role_level || 1
  const dept = user.department || ''

  {
    // 2. Admin sees all
    if (lvl >= 5) return true

    // 3. Plant Head sees all departmental and operational pages (except hidden chemicals)
    if (lvl >= 4) {
      if (LEVEL_GATE[key] !== undefined) return lvl >= LEVEL_GATE[key]
      return true
    }

    // 4. Store Management department isolation
    if (dept === 'Store Management' || dept === 'Store' || dept === 'Inventory') {
      return STORE_NAV.has(key)
    }

    // 5. Plant sections: strictly for Production department
    if (key.startsWith('sections-')) {
      return dept === 'Production'
    }

    // 6. Public pages
    if (PUBLIC.has(key)) return true

    // 7. Level-gated pages
    if (LEVEL_GATE[key] !== undefined) {
      return lvl >= LEVEL_GATE[key]
    }

    // 8. Department-gated pages
    const rule = DEPT_GATE[key]
    if (rule === undefined) return false
    if (rule === true) return true
    return rule.includes(dept)
  }
}

// Sidebar rendering: everything the user may access, minus deliberately hidden keys.
export function filterNav(navItems, user) {
  if (!user) return []
  return navItems.filter(({ key }) => !NAV_HIDDEN.has(key) && canAccess(key, user))
}
