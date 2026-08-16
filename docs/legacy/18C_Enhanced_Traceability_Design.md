# Enhanced Store, Indent & Installed Asset Traceability
# Design Spec — Supersedes 18B Part B for future build

> Status: DESIGN — not yet coded. P1 (18B) is live. This spec = next layer.

---

## Core Principle — No Anonymous Stock Movement

Every item — ₹2 screw to ₹5 lakh motor — has a permanent audit trail answering:
1. Who asked for it?
2. Why did they ask for it?
3. Who approved it?
4. Where exactly is it installed right now?
5. Which supplier and batch did it come from?
6. How much did it cost?
7. Has it subsequently failed?

---

## Traceability Chain (every step immutable)

```
Supplier Lot → GRN → Bin Location → Reserved for Indent
    → Issued → Installed on Machine Position
    → In Service → Failed/Removed → Scrap/Returned
```

Every arrow = one DB row. No gaps. Bidirectional query in both directions at any step.

---

## 1. Enhanced Indent — Mandatory Fields

| Field | Requirement | Purpose |
|-------|-------------|---------|
| indent_type | Mandatory | Breakdown / Preventive Maintenance / Modification / Capital / Consumable |
| reference_id | Mandatory link | FK to breakdown_events, maintenance_schedule, or work_orders |
| machine_id | Mandatory | Exact machine the part will be used on |
| position_id | Mandatory | Exact location on machine (e.g. PM1 / Dryer Section 5 / Drive End Bearing) |
| justification | Min 10 chars if estimated_value > ₹1000 | Permanent reason record |
| required_by_date | Mandatory | |
| priority | Low / Normal / High / Emergency | Emergency allows issue-first, approve-within-2h |

### Additional Indent Features
- **Duplicate detection**: flag if same part+machine+position already has open indent
- **Indent cloning**: one-click re-raise for same part+position
- **Comment thread**: `indent_comments` table — permanent conversation between requester, approver, store
- **Emergency bypass**: issue first, approval required within 2 hours (`approved_within` deadline field)
- **Backorder**: if out of stock, indent stays open. Auto-alert store when stock arrives via GRN

---

## 2. Enhanced Issuance — 4 Options Only

| Option | Code | What happens |
|--------|------|-------------|
| Full Issue | `full` | Issue all requested qty |
| Partial Issue | `partial` | Issue part now, balance stays on backorder |
| Substitute | `substitute` | Issue different part number — substitution logged permanently |
| Reject | `reject` | Return to requester with reason |

### Traceability at Issue Time

| Item Type | Action |
|-----------|--------|
| Serialized (motors, bearings, PLCs) | Scan/enter individual serial number → permanently linked to indent + machine + position |
| Batch tracked (oil, grease, chemicals) | Enter batch/lot number from GRN |
| Bulk consumables (screws, nuts) | Log quantity + batch number |

### Post-Issuance
- Requester must acknowledge receipt within 24 hours
- Auto-alert if issued but not acknowledged
- All serialized items auto-added to `installed_assets` registry

---

## 3. Installed Asset Registry (Digital Twin)

One row per serialized item, ever installed anywhere.

```
Asset ID:        AST-78945
Part Number:     BRG-6210-2RS
Serial Number:   FAG-240112987
──────────────────────────────────────────
Installed Date:  12 Jan 2024
Installed On:    PM-01, Dryer Section 3, D/E
Indent ID:       INDT-20240112-0001
Requested By:    Suresh (Maintenance)
Approved By:     Raj (Shift Supervisor)
Issued By:       Ramesh (Store)
Supplier:        SKF India
Lot Number:      L240012
GRN ID:          GRN-20240110-0002
Purchase Price:  ₹1,280
Current Status:  IN SERVICE
Days In Service: 47
──────────────────────────────────────────
```

Asset statuses: `In Service | Failed | Removed | Scrapped | Returned | In Store`

When part fails: retire it, log failure reason, record stays forever as machine history.

---

## 4. Root Cause Investigation Queries

### Bidirectional Traceability

| Query | Result |
|-------|--------|
| Click failed part | Full chain: Failure → Breakdown → Indent → Approval → Issue → GRN → PO → Supplier |
| Click supplier lot | Every part from that lot, where installed, how many failed |
| Click machine position | Full history of every part ever installed, duration, failure reason |
| Click part number | Consumption across all machines, avg lifespan, supplier performance |

### Automatic Investigation Flags
- Same part requested > 2 times for same machine+position within 90 days
- Part fails in < 50% of expected lifespan
- Indent approved outside normal approval matrix
- Emergency indents used > 3 times per week

---

## 5. Approval Matrix (value-based)

| Indent Value | Required Approver |
|-------------|------------------|
| < ₹1,000 | Shift Supervisor (level 2) |
| ₹1,000 – ₹10,000 | Department Manager (level 3) |
| ₹10,000 – ₹1,00,000 | Plant Head (level 4) |
| > ₹1,00,000 | Management (level 5) |
| Emergency Breakdown | Issue first, approve within 2 hours |

In DB: `approval_matrix` config table OR hardcoded thresholds in route logic with `estimated_value` on indent.

---

## 6. Additional Features

| Feature | Description |
|---------|-------------|
| Returnable Items | Tools, gauges, lifting equipment. Who has what, due date, overdue alerts |
| Stock Reservation | Stock reserved immediately on indent approval. No double-booking |
| Phantom Stock Alert | Flag when physical count vs system count differs > 5% |
| Gate Pass Integration | No item leaves plant gate without valid issue slip number |
| Dead Stock Analysis | Flag stock for decommissioned machines |

---

## 7. New DB Tables Required (future migration M7+)

| Table | Purpose |
|-------|---------|
| `machine_positions` | Exact positions on each machine (PM1/Dryer/Drive End Bearing etc.) |
| `indent_types` | Lookup: Breakdown, PM, Modification, Capital, Consumable |
| `indent_comments` | Comment thread on each indent (user_id, message, created_at) |
| `installed_assets` | One row per serialized item installed. Full lifecycle record |
| `asset_events` | Events on installed asset: Installed, Failed, Removed, Scrapped |
| `stock_reservations` | Reserved qty per material per approved indent |
| `approval_matrix` | Configurable value thresholds per dept/role |
| `backorders` | Open backorder per indent item, auto-alert on GRN arrival |
| `returnable_items` | Tools/equipment issued on loan with return due date |

---

## 8. Enhanced store_indents columns (beyond M5)

```sql
-- Add to store_indents in future migration:
indent_type       VARCHAR(30),         -- Breakdown | PM | Modification | Capital | Consumable
reference_id      INTEGER,             -- FK to breakdown_events / maintenance_schedule / work_orders
reference_type    VARCHAR(30),         -- 'Breakdown' | 'PM' | 'WorkOrder'
machine_id        INTEGER REFERENCES machines(id),
position_id       INTEGER REFERENCES machine_positions(id),
justification     TEXT,
estimated_value   NUMERIC(12,2),
required_by_date  DATE,
emergency_approve_deadline TIMESTAMP,  -- set when priority=Emergency
issue_option      VARCHAR(20),         -- full | partial | substitute | reject (set on issue)
substitute_material_id INTEGER REFERENCES materials(id),
acknowledged_at   TIMESTAMP,
acknowledged_by   INTEGER REFERENCES users(id),
```

---

## 9. Installed Asset Auto-Registration Logic

On `PUT /store/indents/:id/issue` — if item is serialized:
```js
// After stock deduction + ledger — inside SAME transaction:
await client.query(`
  INSERT INTO installed_assets
    (part_number, serial_number, material_id, machine_id, position_id,
     indent_id, requested_by, approved_by, issued_by,
     grn_item_id, lot_number, purchase_price, installed_at, status)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),'In Service')
`, [...])
```

Serialized = `materials.is_serialized = true` (new column on materials table).

---

## Build Checklist (future phases)

- [ ] M7: `machine_positions` table
- [ ] M8: `installed_assets` + `asset_events` tables
- [ ] M9: `indent_comments` + `stock_reservations` + `backorders` tables
- [ ] M10: `approval_matrix` config table + `returnable_items`
- [ ] Enhance `store_indents`: add mandatory fields (machine_id, position_id, indent_type, reference_id, etc.)
- [ ] Enhance `materials`: add `is_serialized`, `expected_lifespan_days`, `part_number` columns
- [ ] Route: `GET /store/assets` — Installed Asset Registry CRUD
- [ ] Route: `GET /store/assets/:id/trace` — full bidirectional trace
- [ ] Route: `GET /store/lots/:lotNumber/trace` — lot investigation
- [ ] Route: `GET /store/positions/:id/history` — position history
- [ ] Route: `POST /store/indents/:id/comment` — comment thread
- [ ] Route: `POST /store/assets/:id/retire` — fail/remove/scrap asset
- [ ] Route: `GET /store/alerts/investigation` — auto-flag queries
- [ ] Frontend: IndentForm with machine+position selectors
- [ ] Frontend: IssueDisk with serial/batch scan entry + 4 issuance options
- [ ] Frontend: Installed Asset Registry page
- [ ] Frontend: Root Cause Investigation dashboard (lot trace, position history)
- [ ] Frontend: Comment thread on indent detail view
