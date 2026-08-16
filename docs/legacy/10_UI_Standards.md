# UI Standards & Component Patterns

## Design Language
- Color: Dark theme (#0f172a bg, #1e293b cards, #94a3b8 muted text, #e2e8f0 primary text)
- Accent: Blue (#3b82f6) for primary actions
- Status colors: green=success, yellow=warning, red=error/critical, blue=info
- Font: system-ui / Inter
- Sidebar: 240px expanded, 64px collapsed

---

## 1. NUMBER FORMATTING (mandatory everywhere)

```js
// Always use these — never raw numbers in UI
const fmt = {
  weight:    (kg)  => `${Number(kg).toLocaleString('en-IN', {minimumFractionDigits:3, maximumFractionDigits:3})} KG`,
  tonnage:   (mt)  => `${Number(mt).toFixed(3)} MT`,
  currency:  (rs)  => `₹${Number(rs).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}`,
  gsm:       (g)   => `${Number(g).toFixed(1)} GSM`,
  pct:       (p)   => `${Number(p).toFixed(2)}%`,
  speed:     (s)   => `${Number(s).toFixed(0)} mpm`,
  pressure:  (p)   => `${Number(p).toFixed(2)} bar`,
  moisture:  (m)   => `${Number(m).toFixed(2)}%`,
  kl:        (k)   => `${Number(k).toFixed(3)} KL`,
  units:     (u)   => `${Number(u).toFixed(0)} units`,
  hours:     (h)   => `${Number(h).toFixed(1)} hrs`,
  mins:      (m)   => `${Math.round(m)} min`,
}
```

Indian currency: ₹1,24,500.00 (lakh/crore grouping via `en-IN` locale)

---

## 2. API CALL PATTERN

```jsx
// Standard fetch hook
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  fetch('/api/endpoint', {
    headers: { Authorization: `Bearer ${localStorage.getItem('mk_token')}` }
  })
    .then(r => r.json())
    .then(json => {
      if (json.success) setData(json.data);
      else setError(json.message);
    })
    .catch(e => setError(e.message))
    .finally(() => setLoading(false));
}, [deps]);

// All responses: { success: true/false, data: [...], total: 0, message: "" }
```

---

## 3. FORM SUBMISSION PATTERN

```jsx
const [saving, setSaving] = useState(false);
const [formError, setFormError] = useState(null);

const handleSubmit = async (e) => {
  e.preventDefault();
  setSaving(true);
  setFormError(null);
  try {
    const res = await fetch('/api/endpoint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('mk_token')}`
      },
      body: JSON.stringify(formData)
    });
    const json = await res.json();
    if (json.success) {
      // success: close modal, refresh list, show toast
    } else {
      setFormError(json.message);
    }
  } catch(e) {
    setFormError('Network error. Try again.');
  } finally {
    setSaving(false);
  }
};
```

---

## 4. STATUS BADGE COLORS

| Status | Color Class / Style |
|--------|-------------------|
| Open / Active / Pass / Approved | green (#22c55e) |
| Pending / Submitted / QC Pending | yellow (#eab308) |
| Closed / Dispatched / Delivered | blue (#3b82f6) |
| Rejected / Failed / Inactive | red (#ef4444) |
| In Production / In Progress | orange (#f97316) |
| Hold / Loading | purple (#a855f7) |
| Draft | gray (#6b7280) |

```jsx
const statusColor = {
  'Open': '#22c55e', 'Active': '#22c55e', 'Pass': '#22c55e', 'Approved': '#22c55e', 'In Warehouse': '#22c55e',
  'Pending': '#eab308', 'Submitted': '#eab308', 'QC Pending': '#eab308',
  'Closed': '#3b82f6', 'Dispatched': '#3b82f6', 'Delivered': '#3b82f6', 'Received': '#3b82f6',
  'Rejected': '#ef4444', 'Fail': '#ef4444', 'Inactive': '#ef4444', 'Overdue': '#ef4444',
  'In Production': '#f97316', 'In Progress': '#f97316', 'Partially Received': '#f97316',
  'Hold': '#a855f7', 'Loading': '#a855f7',
  'Draft': '#6b7280',
};
```

---

## 5. DROPDOWN PATTERN (must fetch from API)

```jsx
const [options, setOptions] = useState([]);

useEffect(() => {
  fetch('/api/production/machines', {
    headers: { Authorization: `Bearer ${localStorage.getItem('mk_token')}` }
  })
    .then(r => r.json())
    .then(json => { if (json.success) setOptions(json.data); });
}, []);

// Render
<select value={formData.machine_id} onChange={e => setFormData({...formData, machine_id: e.target.value})}>
  <option value="">-- Select Machine --</option>
  {options.map(m => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
</select>
```

**Never hardcode dropdown options** that exist in DB. Only static enums (shift_type, priority, categories with no DB table) may be hardcoded.

---

## 6. TABLE/LIST COMPONENT STANDARD

All list pages MUST have:
1. **Filter bar** — relevant filters per module (see per-module docs)
2. **Search input** — searches main identifier field
3. **Pagination** — 20 rows per page default, show total count
4. **Sort** — click column header toggles ASC/DESC
5. **Row actions** — Edit (pencil icon), View (eye icon), Deactivate (toggle) as applicable
6. **Export button** — CSV export: GET same endpoint with `?format=csv`

API pagination params: `?page=1&limit=20&sort=date&order=desc&search=`

```js
// Backend pagination pattern
const offset = (page - 1) * limit;
const rows = await pool.query(
  `SELECT ... FROM ... WHERE ... ORDER BY ${whitelist[sort]} ${order} LIMIT $1 OFFSET $2`,
  [limit, offset]
);
const count = await pool.query(`SELECT COUNT(*) FROM ... WHERE ...`);
res.json({ success: true, data: rows.rows, total: parseInt(count.rows[0].count) });
```

---

## 7. KPI CARD COMPONENT

```jsx
// Standard KPI card
<div style={{background:'#1e293b', borderRadius:8, padding:16, minWidth:160}}>
  <div style={{color:'#94a3b8', fontSize:12, marginBottom:4}}>{label}</div>
  <div style={{color:'#e2e8f0', fontSize:24, fontWeight:700}}>{value}</div>
  <div style={{color: trend > 0 ? '#22c55e' : '#ef4444', fontSize:11}}>
    {trend > 0 ? '▲' : '▼'} {Math.abs(trend)}% vs last month
  </div>
</div>
```

---

## 8. FORM LAYOUT STANDARD

- 2-column grid on desktop, 1-column on mobile (< 768px)
- Required fields: asterisk (*) after label
- Validation: show inline red text below field on blur
- Read-only fields: gray background, no border
- Auto-computed fields: blue background, italic label "(auto)"
- Sticky submit button at bottom of long forms
- Confirm dialog on destructive actions (delete, reject, cancel)

---

## 9. TOAST NOTIFICATIONS

```jsx
// Success
toast.success('Reel saved successfully');
// Error
toast.error('Failed to save: ' + json.message);
// Warning
toast.warn('Stock below reorder level after this issue');
```

Use `react-hot-toast` or similar. Position: top-right. Duration: 3s for success, 5s for error.

---

## 10. LOADING STATES

- **List pages:** skeleton rows (gray animated bars)
- **KPI cards:** number shows `—` while loading
- **Buttons while submitting:** disabled + spinner inside + label changes to "Saving..."
- **Dropdowns while loading options:** disabled + "Loading..." option

---

## 11. RESPONSIVE BREAKPOINTS

| Breakpoint | Width | Layout |
|-----------|-------|--------|
| Mobile | < 768px | 1-col, sidebar collapsed |
| Tablet | 768–1024px | 2-col, sidebar icons only |
| Desktop | > 1024px | full layout, sidebar expanded |

---

## 12. PAGE STRUCTURE STANDARD

```
┌─────────────────────────────────────────────────────┐
│ Page Header: Title + breadcrumb + primary action btn│
├─────────────┬───────────────────────────────────────┤
│ Filter Bar  │ [Search] [Filter1 ▾] [Filter2 ▾] [🔄]│
├─────────────┴───────────────────────────────────────┤
│ KPI Cards (if applicable) — 4-6 per row             │
├─────────────────────────────────────────────────────┤
│ Data Table / List                                   │
│   [Pagination: < 1 2 3 > | Showing 1-20 of 342]    │
└─────────────────────────────────────────────────────┘
```

---

## 13. SIDEBAR NAVIGATION GROUPS

```
⚙ OPERATIONS
  Dashboard
  Production MES
  Shifts

📦 MATERIALS
  Inventory
  GRN
  Material Issue
  Indent

🛒 PROCUREMENT
  Purchase Orders
  Vendors

✅ QUALITY
  QC Tests
  NCR

🔧 MAINTENANCE
  PM Schedule
  Maintenance Logs

💼 COMMERCIAL
  Sales Orders
  Dispatch
  Invoices

📊 ANALYTICS
  OEE Dashboard
  Utility
  Reports

👥 PEOPLE
  Employees
  Attendance

⚙ SYSTEM
  Users
  Master Data
  Audit Log
```

Active item: blue left border + blue text. Hover: slightly lighter bg.
