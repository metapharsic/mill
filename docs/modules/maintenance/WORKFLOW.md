# Maintenance (CMMS) Module — Full Workflow & Rules

## Overview
Computerized Maintenance Management System. Covers Preventive (PM), Predictive (PdM),
Breakdown (BM), and Lubrication maintenance. Includes bearing checks with photo uploads,
equipment master, spare parts tracking, Excel import, and Kafka event streaming.

## Key Files
| File | Purpose |
|---|---|
| `backend/src/routes/maintenance.js` | All maintenance endpoints (575 lines) |
| `frontend/src/pages/Maintenance.jsx` | Maintenance UI (46KB) |
| Uploads dir: `backend/uploads/maintenance/` | Bearing scan photos (jpg/png/pdf, max 10MB) |

## Database Tables
| Table | Purpose |
|---|---|
| `maintenance_schedule` | Recurring PM/PdM tasks per machine |
| `maintenance_logs` | Completed work records |
| `equipment` | Equipment master (motors, pumps, gearboxes) |
| `equipment_bearing_checks` | Bearing reading rounds |
| `bearing_check_details` | Individual bearing readings per round |
| `motor_electrical_specs` | Motor electrical parameters (from seeded data) |
| `machine_positions` | Named positions on machines (for spare tracking) |

## API Endpoints

### Schedule
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/maintenance/schedule` | L1+ | List schedules (filter: machine_id, status, page, limit) |
| POST | `/maintenance/schedule` | L3+ | Create maintenance schedule |
| PUT | `/maintenance/schedule/:id` | L3+ | Update schedule |
| PUT | `/maintenance/schedule/:id/complete` | L2+ | Mark done → auto-compute next_due, create log |
| PUT | `/maintenance/schedule/:id/skip` | L3+ | Skip occurrence → push next_due by freq_days |

### Logs
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/maintenance/logs` | L1+ | Maintenance work log |
| POST | `/maintenance/logs` | L2+ | Log ad-hoc work (breakdown, emergency) |

### Equipment
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/maintenance/equipment` | L1+ | Equipment list |
| POST | `/maintenance/equipment` | L3+ | Add equipment |
| PUT | `/maintenance/equipment/:id` | L3+ | Update equipment |

### Bearing Checks
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/maintenance/bearing-rounds` | L1+ | List bearing check rounds |
| POST | `/maintenance/bearing-rounds` | L2+ | Create new check round |
| PUT | `/maintenance/bearing-rounds/:id/scan` | L2+ | Upload photo for a round (multer) |
| POST | `/maintenance/bearing-rounds/:id/readings` | L2+ | Add readings to a round |

### Excel Import
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/maintenance/import/equipment` | L3+ | Import equipment from Excel (xlsx, memory storage) |

### Other
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/maintenance/overdue` | L1+ | All overdue schedules |
| GET | `/maintenance/stats` | L1+ | Dashboard stats |

## Schedule Complete Flow (ACID)
```
PUT /schedule/:id/complete:
  BEGIN
    SELECT * FROM maintenance_schedule WHERE id=$1 FOR UPDATE
    next_due = completedDate + frequency_days
    UPDATE maintenance_schedule SET last_done, next_due, status='Scheduled'
    INSERT INTO maintenance_logs (..., status='Completed')
  COMMIT
```

## Maintenance Types
| Type | Description |
|---|---|
| Preventive | Fixed-interval scheduled servicing |
| Predictive | Condition-based (vibration, temp readings) |
| Breakdown | Emergency response to failure |
| Lubrication | Greasing/oiling schedule |

## Schedule Status Values
| Status | Meaning |
|---|---|
| Scheduled | Upcoming, not yet started |
| In Progress | Work started |
| Done | Completed this occurrence (auto-transitions to Scheduled for next) |
| Overdue | Past next_due and not started |
| Cancelled | Permanently cancelled |

## Priority Levels
| Priority | Urgency |
|---|---|
| Critical | Immediate action required |
| High | Within 24 hours |
| Medium | Within 1 week (default) |
| Low | Planned, flexible |

## Bearing Check Fields
| Field | Description |
|---|---|
| bearing_point_id | Which bearing is being checked |
| temperature | Bearing temperature (°C) |
| vibration_mm_s | Vibration velocity (mm/s) |
| noise_level | dB or qualitative (Low/Medium/High) |
| rpm | Shaft RPM at reading time |
| scan_photo_url | Uploaded thermal scan photo |
| remarks | Observations, anomalies |

Alert thresholds (configure per equipment):
- Temperature > 80°C → Warning; > 100°C → Critical
- Vibration > 4.5 mm/s → Warning; > 7.1 mm/s → Critical

## Spare Parts on Maintenance Log
`spare_parts_used` is stored as JSONB array:
```json
[
  { "item": "Bearing 6205", "qty": 2, "unit": "NOS", "rate": 450 },
  { "item": "V-Belt B-45", "qty": 1, "unit": "NOS", "rate": 280 }
]
```

## File Upload Config
- Directory: `backend/uploads/maintenance/`
- Max size: 10MB
- Allowed types: jpg, jpeg, png, pdf (bearing scans, maintenance photos)
- Filename: `{timestamp}_{safe_originalname}`
- Served at: `/uploads/maintenance/` (static middleware in server.js)

## Equipment Seeding
- Pre-seeded from `db/migration_bearing_equipment_seed.sql` and `db/migration_equipment_seed_ph17f.sql`
- Motor electrical specs from `db/seed_motor_electrical_specs.sql`
- Do NOT re-run seed files — they use `INSERT ... ON CONFLICT DO NOTHING`

## Excel Import (Equipment)
- Uses multer memoryStorage (not disk — parsed in memory, discarded after)
- XLSX parsed via `require('xlsx')`
- Max file size: 5MB
- Expected columns: equipment_name, machine_id, type, location, etc.

## Kafka Events Published
| Event | Trigger |
|---|---|
| `maintenance.schedule.created` | POST /schedule |
| `maintenance.schedule.updated` | PUT /schedule/:id |
| (more events may be added) | — |

Topic: `TOPICS.EVENTS_ALL`

## Rules
1. L3+ to create/update schedule (managers plan maintenance)
2. L2+ to mark complete / log work (supervisors can close out tasks)
3. L3+ to skip a scheduled occurrence (planned skip requires manager sign-off)
4. Only jpg/png/pdf for scan uploads — enforced by multer fileFilter
5. `next_due = last_done + frequency_days` computed server-side on complete
6. Breakdown maintenance logged via POST /logs directly (no schedule required)
7. Overdue tasks: `next_due < CURRENT_DATE AND status='Scheduled'`

## Common Query Patterns
```sql
-- Overdue preventive maintenance
SELECT ms.*, m.name AS machine
FROM maintenance_schedule ms
LEFT JOIN machines m ON m.id = ms.machine_id
WHERE ms.next_due < CURRENT_DATE AND ms.status = 'Scheduled'
ORDER BY ms.next_due ASC;

-- Monthly maintenance costs
SELECT SUM(cost) AS total_cost, COUNT(*) AS jobs
FROM maintenance_logs
WHERE DATE_TRUNC('month', date) = DATE_TRUNC('month', CURRENT_DATE);

-- Top breakdown machines
SELECT m.name, COUNT(*) AS breakdowns
FROM maintenance_logs ml
JOIN machines m ON m.id = ml.machine_id
WHERE ml.maintenance_type = 'Breakdown'
  AND ml.date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY m.name ORDER BY breakdowns DESC;
```
