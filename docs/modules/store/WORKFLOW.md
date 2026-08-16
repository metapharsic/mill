# Store Management Module — Full Workflow & Rules

## Overview
Central store for all materials (spares, consumables, raw materials). Handles issue requests,
approval, stock deduction, serialized asset tracking, GRN receiving, stock adjustments, and returns.

## Key Files
| File | Purpose |
|---|---|
| `backend/src/routes/store.js` | All store endpoints (572 lines) |
| `backend/src/middleware/helpers.js` | `requireAuth`, `requireLevel`, `requireStore`, `ar` |
| `frontend/src/pages/Store.jsx` | Store UI |

## Database Tables
| Table | Purpose |
|---|---|
| `store_issues` | Issue requests (pending → issued/rejected/cancelled) |
| `stock_ledger` | All movements (GRN, Issue, Return, Adjustment, Scrap) |
| `materials` | Item master with `current_stock` cache |
| `installed_assets` | Auto-created for serialized items when issued |
| `machine_positions` | Machine positions (where spares are installed) |
| `store_indent_log` | Audit log for indent-linked stock deductions |

## Store Issue Number Format
Auto-generated: `SI-YYYYMMDD-{4-digit seq}` (seq resets daily)
Example: `SI-20260717-0001`

## Issue Request Flow
```
POST /issues (any user) → store_issues.status = 'Pending'
       ↓
PUT /issues/:id/approve (L2+ — store approve with optional substitute_material_id)
       ↓
  - Check stock: current_stock >= quantity
  - Deduct: materials.current_stock -= quantity
  - Insert: stock_ledger (type=Issue, reference_type=StoreIssue)
  - Update: store_issues.status = 'Issued'
  - If material.is_serialized: auto-create installed_assets record
       ↓
PUT /issues/:id/reject (L2+) → store_issues.status = 'Rejected'
PUT /issues/:id/cancel (raiser, if Pending only)
```

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/store/rawmaterials` | L1+ | Raw materials with low-stock flag |
| GET | `/store/issues` | L1+ | List issue requests (filter: from, to, status) |
| POST | `/store/issues` | L1+ | Create issue request (any user) |
| PUT | `/store/issues/:id/approve` | L2+ | Approve issue → deduct stock (ACID) |
| PUT | `/store/issues/:id/reject` | L2+ | Reject issue request |
| PUT | `/store/issues/:id/cancel` | L1+ (raiser) | Cancel pending issue |
| GET | `/store/grn` | L1+ | List GRNs |
| POST | `/store/grn` | L2+ | Create GRN from purchase order |
| PUT | `/store/grn/:id/approve` | L3+ | Approve GRN (updates stock) |
| GET | `/store/stock` | L1+ | Current stock levels |
| GET | `/store/ledger` | L1+ | Stock ledger entries (filter: material_id, date) |
| POST | `/store/adjustment` | requireStore + L3+ | Manual stock adjustment |
| POST | `/store/return` | requireStore + L2+ | Material return from dept |
| GET | `/store/installed-assets` | L1+ | Installed serialized assets |
| PUT | `/store/installed-assets/:id` | L2+ | Update asset status/life |

## Serialized Items (Installed Assets)
When `materials.is_serialized = true`:
- On issue approval: `installed_assets` record auto-created
- Asset number: `AST-YYYYMMDD-{4-digit seq}`
- Tracks: serial_number, batch_number, machine_id, position_id, install date, expected lifespan
- Status: In Service → Replaced / Written Off
- Enables lifespan tracking and replacement scheduling (feeds Maintenance module)

## High-Value Transaction Notifications
Trigger: value > ₹1,00,000 OR qty > 50% of current stock in one transaction.
Action:
1. INSERT notification for all STORE dept L3+ and org-wide L4+
2. Publish Kafka event to `TOPICS.EVENTS_CRIT`

## Stock Ledger Entry Types
| Type | Trigger | Effect |
|---|---|---|
| GRN | GRN approved | in_qty += accepted_qty |
| Issue | Store issue approved | out_qty += issued_qty |
| Return | Material returned from dept | in_qty += returned_qty |
| Transfer | Between locations/stores | net zero (two entries) |
| Adjustment | Manual correction | in or out depending on +/- |
| Scrap | Written off | out_qty += scrapped_qty |

## Issue Request Fields
| Field | Description |
|---|---|
| `materialId` | FK → materials |
| `departmentId` | Requesting department |
| `quantity` | Requested quantity |
| `purpose` | Why material is needed |
| `indent_type` | Consumable / Capital / Maintenance |
| `machine_id` | Which machine it's for (optional) |
| `position_id` | Machine position (optional) |
| `justification` | Business justification |
| `required_by_date` | When needed |
| `estimated_value` | Cost estimate |

## Issue Options (on approval)
| Option | Behavior |
|---|---|
| `full` | Issue exact requested quantity |
| `partial` | Issue less than requested qty |
| `substitute` | Issue different material (substitute_material_id) |

## CRITICAL Rules
1. Stock check: `current_stock >= quantity` BEFORE deduction — throw if insufficient
2. Always deduct from `materials.current_stock` AND insert `stock_ledger` in SAME transaction
3. `store_indent_log` (in indent.js issue route) must be written in same tx as deduction
4. requireStore middleware on ALL deduction routes (`/issues/:id/approve`, `/adjustment`, `/return`)
5. NEVER manually set `materials.current_stock` without stock_ledger entry
6. `installed_assets` creation in SAME transaction as deduction (for serialized items)

## Shift Tracking
From `migration_store_shift_tracking.sql`:
- Store transactions tagged with shift (Day 06:00-18:00, else Night)
- Shift auto-derived from time-of-day unless explicitly provided

## Low Stock Logic
- `lowStock` flag returned in `/rawmaterials`: `current_stock <= min_stock`
- Reorder alert: `current_stock <= reorder_level` (separate alert level)
- System does NOT block issue if stock goes below min — only warns

## Kafka Events Published
| Event | Trigger |
|---|---|
| `store.issue.created` | POST /issues |
| `stock.inward.high` or `stock.outward.high` | High-value transaction |

Topic: `TOPICS.EVENTS_ALL` and `TOPICS.EVENTS_CRIT`
