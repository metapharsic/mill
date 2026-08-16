# MK Paper Mill ERP — Frontend Component Map

> **AI INSTRUCTION:** Read this before adding any new UI page, component, or API call.
> Do not duplicate existing pages. Follow the established nav key + PAGE_COMPONENTS pattern.

---

## Architecture: No Router

This app uses **state-based navigation** (no React Router):
```
App.jsx → active state (string key) → PAGE_COMPONENTS[active] → renders page
```
There are **no `<Route>` components**, no URL changes, no browser history.

---

## Entry Point

```
frontend/src/main.jsx      → mounts <App /> into #root
frontend/src/App.jsx       → AuthProvider wrapper → AppInner
AppInner                   → Login → ForceChangePassword → Shell (sidebar + page)
```

---

## App.jsx State

```javascript
// Core state in AppInner
const [active, setActive] = useState('dashboard')   // current page key
const [user, setUser]     = useState(null)           // logged-in user object
const [notifications, setNotifications] = useState([])   // unread notifications
const [unread, setUnread] = useState(0)              // notification badge count
```

Notification poll: `useEffect` with `setInterval(60000)` → `GET /api/hr/notifications`

---

## Navigation: `data/permissions.js`

```javascript
// filterNav(user) — returns nav items the user can see
// Based on: role_level, dept_code, is_hr_admin
import { filterNav } from './data/permissions'
```

Nav is filtered server-side by role. Items not in user's permitted set are hidden from sidebar.

---

## PAGE_COMPONENTS Map

The complete mapping of nav key → component. **Add new pages here.**

```javascript
// From App.jsx
const PAGE_COMPONENTS = {
  dashboard:    Dashboard,        // Overview KPIs + charts
  production:   Production,       // Shifts, reels, downtime entry
  'daily-report': DailyReport,    // DPR form + history
  quality:      Quality,          // QC test entry + results
  maintenance:  Maintenance,      // CMMS schedule, logs, bearing checks
  utility:      Utility,          // Energy/utility readings
  inventory:    Inventory,        // GRN, materials, stock ledger
  indent:       Indent,           // PIIMAS indent workflow
  store:        Store,            // Store issues, stock management
  purchase:     Purchase,         // POs, vendor management
  sales:        Sales,            // Sales orders
  dispatch:     Sales,            // ← Same component as sales (alias)
  finance:      Finance,          // Payments, ledger
  hr:           HR,               // Employee, attendance, payroll, leaves
  scrap:        Scrap,            // Scrap logging
  packing:      Packing,          // Packing records (FG packaging)
  fgwarehouse:  FGWarehouse,      // Finished goods warehouse
  security:     Security,         // Gate management, visitors
  laboratory:   Laboratory,       // Lab tests (chemical/process)
  ehs:          EHS,              // EHS incidents, permits
  admin:        Admin,            // User/role/dept administration
  chemicals:    ChemicalStore,    // Chemical store management
  reports:      Reports,          // Cross-module reports + CSV export
  customers:    Customers,        // Customer master data
  vendors:      Vendors,          // Vendor master data
  materials:    Materials,        // Material master data
  users:        Users,            // User management (subset of admin)
  grades:       Grades,           // Paper grades
  machines:     Machines,         // Machine master data
  phases:       Phases,           // Production phases (reference)
  masterdata:   MasterData,       // Combined master data management
  shifts:       Production,       // ← Alias → Production page
  downtime:     Production,       // ← Alias → Production page
  grn:          Inventory,        // ← Alias → Inventory page
  stockledger:  Inventory,        // ← Alias → Inventory page
  'all-sections': AllSections,    // Plant sections KPI overview
  section:      PlantSection,     // Single plant section detail
}
```

---

## Page Files (frontend/src/pages/)

| File | Size | Purpose | Primary APIs |
|---|---|---|---|
| `App.jsx` | Core | Shell + routing + auth | `/hr/notifications` (poll 60s) |
| `Dashboard.jsx` | 26 KB | KPI overview, charts | `/production/oee`, `/production/summary`, `/sections/all/kpi-snapshot` |
| `Production.jsx` | 64 KB | **Largest prod page.** Shifts, reels, downtime, OEE display | `/production/shifts`, `/production/reels`, `/production/downtime`, `/production/oee` |
| `DailyReport.jsx` | 17 KB | DPR form + history list | `/production/daily-report`, `/production/daily-report/autofill` |
| `HR.jsx` | 114 KB | **Largest file.** Employee lifecycle, attendance, payroll, leaves, loans | `/hr/employees`, `/hr/attendance`, `/hr/payroll`, `/hr/leaves`, `/hr/holidays`, `/hr/loans` |
| `Maintenance.jsx` | 45 KB | CMMS: schedule, logs, bearing, equipment | `/maintenance/schedule`, `/maintenance/logs`, `/maintenance/equipment`, `/maintenance/bearing-rounds` |
| `Indent.jsx` | 41 KB | PIIMAS: indent CRUD + approval workflow + ack | `/indent`, `/indent/:id/tier`, `/indent/my-acks`, `/indent/calendar` |
| `Utility.jsx` | 27 KB | Energy readings + summary | `/utility/readings`, `/utility/summary` |
| `Store.jsx` | 24 KB | Store issues + GRN + stock | `/store/issues`, `/store/grn`, `/store/rawmaterials`, `/store/ledger` |
| `ChemicalStore.jsx` | 25 KB | Chemical inventory + dosing + MSDS | `/chemicals/inventory`, `/chemicals/transactions`, `/chemicals/dosing-report` |
| `Materials.jsx` | 26 KB | Material master CRUD | `/inventory/materials`, `/inventory/categories` |
| `Admin.jsx` | 31 KB | User, role, dept management + audit log | `/admin/users`, `/admin/roles`, `/admin/departments`, `/admin/audit-log` |
| `Finance.jsx` | 19 KB | Ledger + payments + outstanding | `/finance/ledger`, `/finance/payments`, `/finance/outstanding` |
| `Inventory.jsx` | 17 KB | GRN + materials + ledger | `/inventory/grn`, `/inventory/materials`, `/inventory/ledger` |
| `Sales.jsx` | 19 KB | Sales orders + dispatch | `/sales/orders`, `/sales/customers`, `/sales/dispatch` |
| `Purchase.jsx` | 19 KB | POs + vendors + GRN | `/purchase/orders`, `/purchase/vendors` |
| `Quality.jsx` | 12 KB | QC tests + stats | `/quality/tests`, `/quality/stats` |
| `Machines.jsx` | 20 KB | Machine master CRUD | `/production/machines` |
| `Customers.jsx` | 14 KB | Customer master CRUD | `/sales/customers` |
| `Vendors.jsx` | 15 KB | Vendor master CRUD | `/purchase/vendors` |
| `Reports.jsx` | 12 KB | Cross-module reports + CSV | `/reports/production`, `/reports/inventory`, `/reports/quality` |
| `EHS.jsx` | 12 KB | Incidents + permits + inspections | `/ehs/incidents`, `/ehs/permits`, `/ehs/inspections` |
| `Laboratory.jsx` | 12 KB | Lab tests | `/lab/tests`, `/lab/summary` |
| `Security.jsx` | 11 KB | Gate logs + visitors + passes | `/security/gate-logs`, `/security/visitors`, `/security/gate-passes` |
| `Scrap.jsx` | 10 KB | Scrap records | `/scrap` |
| `Grades.jsx` | 10 KB | Grade master CRUD | `/production/grades` |
| `RawMaterial.jsx` | 10 KB | Raw material view | `/store/rawmaterials` |
| `FGWarehouse.jsx` | 6 KB | FG reel inventory | `/warehouse/reels`, `/warehouse/packing`, `/warehouse/grades` |
| `Packing.jsx` | 9 KB | Packing records | `/warehouse/packing` |
| `AllSections.jsx` | 5 KB | Plant sections overview dashboard | `/sections/all/kpi-snapshot`, `/sections` |
| `PlantSection.jsx` | 23 KB | Single section: readings + alarms + KPI | `/sections/:code`, `/sections/:code/readings`, `/sections/:code/alarms` |
| `Login.jsx` | 7 KB | Login form | `/auth/login` |
| `ForceChangePassword.jsx` | 4 KB | Forced password change | `/auth/change-password` |
| `MasterData.jsx` | 13 KB | Combined master data hub | Multiple master data APIs |
| `Phases.jsx` | 6 KB | Phase reference view | `/production/phases` |
| `Placeholder.jsx` | 5 KB | Used for nav items without a page yet | — |
| `Users.jsx` | 16 KB | User management | `/admin/users` |

---

## Shared Components (frontend/src/components/)

| File | Purpose |
|---|---|
| `Sidebar.jsx` | Navigation sidebar — reads `filterNav(user)` to render items |

---

## Auth Context (frontend/src/context/)

Located at: `frontend/src/data/AuthContext.jsx` (note: in `data/`, not `context/`)

```javascript
// AuthProvider / useAuth hook
const { user, login, logout } = useAuth()

// user object shape (from /api/auth/me):
{
  id, name, email, role, role_level, department, dept_code,
  is_hr_admin, emp_id, is_dept_head, must_change_password, shift
}
```

---

## API Utility (frontend/src/data/useApi.js)

```javascript
// Shared API fetch helper (in data/, not hooks/)
async function apiFetch(path, opts = {}) {
  const token = localStorage.getItem('token')
  const res = await fetch(`/api${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    },
    ...opts
  })
  return res.json()
}
```

> All pages use this pattern — never create new `fetch` calls without the Bearer token header.

---

## Permissions (frontend/src/data/permissions.js)

```javascript
// filterNav(user) — filters sidebar items based on user.role_level + user.dept_code
// Permission keys match nav keys in PAGE_COMPONENTS
```

---

## Key Frontend Rules

1. **No React Router** — use `setActive('key')` to navigate. Pass it as prop to pages that need sub-navigation.
2. **No `useContext` for most state** — most pages receive `user` + `setActive` as props from App.jsx
3. **All API calls**: include `Authorization: Bearer ${token}` header
4. **Token storage**: `localStorage.getItem('token')` / `localStorage.setItem('token', ...)`
5. **Adding a new page**:
   - Create `frontend/src/pages/NewPage.jsx`
   - Import in `App.jsx`
   - Add to `PAGE_COMPONENTS` map
   - Add to `data/permissions.js` with access rules
   - Add to sidebar in `components/Sidebar.jsx`
6. **Never hardcode user checks** — use `user.role_level >= N` or `user.dept_code === 'X'`
7. **CSS**: vanilla CSS in `frontend/src/styles/` — no Tailwind, no inline style objects if avoidable
