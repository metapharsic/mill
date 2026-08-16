# Indent / PIIMAS Module — Full Workflow & Rules

## Overview
PIIMAS = Plant Internal Inventory Management & Acknowledgment System.
Multi-level approval indent system for internal material requisition with Kafka event streaming,
tier-based approval (value-driven), and mandatory fitment acknowledgment.

## Key Files
| File | Purpose |
|---|---|
| `backend/src/routes/indent.js` | All indent endpoints (433 lines) |
| `frontend/src/pages/Indent.jsx` | Indent UI (41KB — complex) |
| DB: `indents` + `indent_items` | Core tables |
| DB: `indent_audit_log` | Every state transition logged |
| DB: `approval_matrix` | Tier/value-based approval rules |

## Database Tables
| Table | Purpose |
|---|---|
| `indents` | Indent headers |
| `indent_items` | Line items (material_id, required_qty, issued_qty, ack_status) |
| `indent_audit_log` | Full audit: action, old/new status, user_id |
| `approval_matrix` | Tier rules: min_value, max_value → tier, required_level |

## Indent Number Format
Auto-generated with advisory lock: `IND-YYYYMMDD-{4-digit seq}`
Advisory lock: `pg_advisory_xact_lock(hashtext('indent-{date}'))` prevents duplicate seq on concurrent create.

## Full Status Flow
```
Draft → Submitted → L1 Approved → Approved → Issued → Closed
                 ↘ Rejected (at Submitted or L1 Approved stage)
```
Note: L3 endpoint is a no-op alias to L2 (backwards compat).

## Value-Based Tier System
Approval tiers are driven by `approval_matrix` table:
| Tier | Value Range | Required Level | Notes |
|---|---|---|---|
| 1 | < ₹10,000 | L3 (Store Head) | Auto-Approved after L1 |
| 2 | ₹10,000–₹1,00,000 | L3 + L4 | L1 + L2 both required |
| 3 | > ₹1,00,000 | L4 (Plant Head) | All 3 levels required |
| Emergency | Urgent + age > 2h | L2 | Fast-track single approval |

Total value = `SUM(required_qty × materials.unit_price)`.

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/indent` | L1+ | List indents (filter: status, dept, page, limit) |
| GET | `/indent/:id` | L1+ | Single indent + items |
| GET | `/indent/:id/tier` | L1+ | Tier info + approval matrix |
| GET | `/indent/analytics/summary` | L2+ | Analytics dashboard (by dept, top parts, pending ack) |
| GET | `/indent/calendar` | L1+ | Calendar view (month/year) |
| GET | `/indent/my-acks` | L1+ | Pending acknowledgments for logged-in user |
| POST | `/indent` | L1+ | Create indent (Draft) — uses advisory seq lock |
| PUT | `/indent/:id/submit` | L1+ | Draft → Submitted (raiser only) |
| PUT | `/indent/:id/approve/l1` | L3+STORE or L4+ | Submitted → L1 Approved (Store Head) |
| PUT | `/indent/:id/approve/l2` | L4+ | L1 Approved → Approved (Plant Head) |
| PUT | `/indent/:id/approve/l3` | L4+ | Alias for L2 (backwards compat) |
| PUT | `/indent/:id/reject` | L2+ (same dept) or L4+ | Reject at any stage |
| PUT | `/indent/:id/issue` | L2+ | Approved → Issued (stock deduction ACID) |
| PUT | `/indent/items/:itemId/acknowledge` | L1+ | Mark item fitment done |
| PUT | `/indent/:id/close` | L3+ | Manual close Issued → Closed |

## CRITICAL: Issue Route (Stock Deduction)
The issue route (`PUT /:id/issue`) MUST:
1. Check `status = 'Approved'` (with `FOR UPDATE` row lock)
2. For each item: deduct from `materials.current_stock`
3. Insert into `stock_ledger` (type='issue', reference_type='indent')
4. Update `indent_items.issued_qty`, `ack_status='pending'`
5. Update `indent.status='Issued'`, `issued_by`, `issued_at`, `total_value`
6. Insert into `indent_audit_log`
All inside a single ACID transaction (BEGIN...COMMIT/ROLLBACK).

**Note:** The issue route currently uses `requireLevel(2)` but convention says `requireStore` should be on it — if adding new stock-deduction routes, always use `requireStore`.

## Acknowledgment Flow
After issue:
- Each `indent_item.ack_status = 'pending'`
- Dept HOD/user marks: `PUT /indent/items/:itemId/acknowledge`
  - Records: fitment_date, observations, kpi_before, kpi_after, photo_url
  - Sets: `ack_status = 'done'`
- When ALL items acked: indent auto-closes (`status = 'Closed'`)
- Kafka event published: `indent.closed` or `indent.item_acknowledged`

## Self-Approval Prevention
- L1 approval: cannot approve own indent (unless L4+)
- L2 approval: cannot approve own indent OR own L1 approval (unless L5)
- Reject: can only reject own-dept indents (unless L4+)

## PIIMAS Escalation (Background Cron — server.js)
Runs every 2 hours:
1. Finds indents: `status='Issued'`, `ack_status='pending'`, issued > 24h ago
2. For each: inserts notification for dept_head (role_level≥3 in dept) + L4+
3. Dedup: skip if notified for same indent within last 24h
4. If > 48h: appends `[Auto-escalated: ack overdue >48h]` to `indents.remarks`

## Kafka Events Published
| Event | Trigger |
|---|---|
| `indent.created` | POST / |
| `indent.submitted` | PUT /:id/submit |
| `indent.approved_l1` | PUT /:id/approve/l1 |
| `indent.approved` | PUT /:id/approve/l2 |
| `indent.rejected` | PUT /:id/reject |
| `indent.issued` | PUT /:id/issue |
| `indent.item_acknowledged` | PUT /items/:itemId/acknowledge |
| `indent.closed` | When all items acked OR manual close |

Topic: `mkpm.indent.events`

## Item Fields
| Field | Description |
|---|---|
| `material_id` | FK → materials |
| `required_qty` | Requested quantity |
| `approved_qty` | Approved quantity (can differ) |
| `issued_qty` | Actually issued quantity |
| `uom` | Unit of measure |
| `purpose` | Why this item is needed |
| `current_stock` | Snapshot of stock at indent creation time |
| `component_position` | Machine position (for maintenance indents) |
| `reason_code` | Why material is needed (reason code) |
| `ack_status` | pending / done |
| `fitment_date` | When item was installed |
| `observations` | Installation observations |
| `kpi_before` / `kpi_after` | Performance metric before/after install |
| `photo_url` | Photo evidence of installation |
| `batch_no` | Batch number of issued item |
| `unit_price` / `line_value` | Cost tracking |

## Rules
- Draft indents: only raiser can edit/submit
- Once Submitted: raiser cannot edit (needs rejection + re-create)
- Partial issue allowed: `issued_qty ≤ required_qty` per item
- Indent number NEVER manually set — always auto-generated with advisory lock
- NEVER hard-delete indents — status Cancelled or Rejected only
- Tier is computed at L2 approval time from live material prices

## Common Pitfalls
- Forgetting `FOR UPDATE` on indent row before issue → phantom concurrent issue
- Not writing `indent_audit_log` → missing audit trail
- Setting `issued_qty > required_qty` → cap at required_qty server-side
- Not publishing Kafka event → silent failure (Kafka is optional, wrapped in try-catch)
