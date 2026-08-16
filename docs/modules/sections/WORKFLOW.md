# Plant Sections Module — Full Workflow & Rules

## Overview
Real-time monitoring of all plant sections via process readings, KPI snapshots (hourly cron),
and section alarms. Each section belongs to a department and has restricted write access per dept.

## Key Files
| File | Purpose |
|---|---|
| `backend/src/routes/sections.js` | All section endpoints (368 lines) |
| `backend/src/routes/telemetry.js` | Real-time telemetry data (separate route) |
| `frontend/src/pages/PlantSection.jsx` | Single section view |
| `frontend/src/pages/AllSections.jsx` | All-sections dashboard |

## Database Tables
| Table | Purpose |
|---|---|
| `plant_sections` | Section master (code, name, icon, sort_order, dept) |
| `section_process_readings` | Process parameter readings per section per shift |
| `section_alarms` | Active and historical alarms |
| `section_kpi_snapshots` | Hourly KPI aggregations (from cron) |

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/sections` | L1+ | List all active sections with sort_order |
| GET | `/sections/all/kpi-snapshot` | L1+ | KPI + alarm counts for all sections |
| GET | `/sections/:code` | L1+ | Single section detail |
| GET | `/sections/:code/readings` | L1+ | Process readings for section (filter: date, shift) |
| POST | `/sections/:code/readings` | L1+ + dept check | Log process readings |
| GET | `/sections/:code/alarms` | L1+ | Section alarms (active + resolved) |
| POST | `/sections/:code/alarms` | L3+ | Create alarm |
| PUT | `/sections/:code/alarms/:id/resolve` | L2+ | Resolve alarm |
| GET | `/sections/:code/kpi-history` | L1+ | Historical KPI snapshots |

## Section Codes and Departments

### Production Department (PROD)
| Code | Name |
|---|---|
| PULPMILL | Pulp Mill |
| CENTRICLEANER | Centri Cleaner |
| WIRE | Wire Section |
| PRESS | Press Section |
| UNIRUN | Unirun |
| PRE_DRYER | Pre-Dryer |
| SIZE_PRESS | Size Press |
| POST_DRYER | Post-Dryer |
| CALENDER | Calender |
| POPE_REEL | Pope Reel |
| REWINDER | Rewinder |
| CRANES | Cranes (also MAINT) |

### QC/Lab Department
| Code | Name |
|---|---|
| LAB | Laboratory |
| SIZE_KITCHEN | Size Kitchen |
| STARCH_KITCHEN | Starch Kitchen |

### Utilities Department (UTIL)
| Code | Name |
|---|---|
| BOILER | Boiler House |
| STEAM_COND | Steam Condensate |
| ETP | Effluent Treatment Plant |
| COMPRESSORS | Compressors |
| VACUUM | Vacuum System |

### Store Department
| Code | Name |
|---|---|
| STORE | Store |

## Section Write Access Control (hasSectionWriteAccess)
Write access to process readings is department-restricted:
| User Dept | Can Write To Sections |
|---|---|
| PROD | PULPMILL, CENTRICLEANER, WIRE, PRESS, UNIRUN, PRE_DRYER, SIZE_PRESS, POST_DRYER, CALENDER, POPE_REEL, REWINDER, CRANES |
| QC/QA/LAB | LAB, SIZE_PRESS, SIZE_KITCHEN, STARCH_KITCHEN, POPE_REEL |
| UTIL | BOILER, STEAM_COND, ETP, COMPRESSORS, VACUUM |
| MAINT | CRANES, COMPRESSORS, BOILER, VACUUM |
| STORE | STORE |
| L5/Admin | All sections |

## Process Reading Fields (varies by section)
Common fields across sections:
| Field | Description |
|---|---|
| `date` | Reading date |
| `shift_type` | Day/Night |
| `reading_time` | Exact timestamp |
| `tag_name` | Parameter tag (e.g., SPEED_MPM, STEAM_PRESS) |
| `value` | Numeric reading |
| `unit` | Unit of measure |

BOILER-specific tags:
- `BOILER_PRESS` (bar), `BOILER_TEMP` (°C), `COAL_FEED_RATE` (KG/H), `STEAM_FLOW` (MT/H)

ETP-specific tags:
- `ETP_PH`, `ETP_FLOW` (KL/H), `COD_LEVEL` (mg/L), `BOD_LEVEL` (mg/L), `TSS` (mg/L)

Paper Machine tags:
- `SPEED_MPM`, `STEAM_PRESS`, `STEAM_TEMP`, `MOISTURE_OUT`, `GSM_OUT`, `CONSISTENCY_IN`

## KPI Snapshot (Hourly Cron)
Runs every 1 hour via `setInterval` in `server.js`:
1. For each active section
2. Aggregates: `AVG(value)` per `tag_name` for last hour
3. Stores JSONB blob in `section_kpi_snapshots.kpi_data`
4. Previous snapshots retained (no purge) — history queryable

```sql
-- What cron does per section:
SELECT tag_name, AVG(value) AS avg_value, unit
FROM section_process_readings
WHERE section_id = $1
  AND reading_time >= NOW() - INTERVAL '1 hour'
GROUP BY tag_name, unit
```

## Alarm System
### Alarm Types
| Type | Severity | Action |
|---|---|---|
| Critical | Immediate attention | Shown in red on all dashboards |
| Warning | Monitor closely | Shown in yellow |
| Info | Informational | Shown in blue |

### Alarm Fields
| Field | Description |
|---|---|
| `section_id` | Which section |
| `alarm_type` | Critical/Warning/Info |
| `tag_name` | Which parameter triggered alarm |
| `threshold_value` | The limit that was exceeded |
| `actual_value` | Value that triggered alarm |
| `message` | Human-readable description |
| `resolved_at` | NULL = still active; set = resolved |
| `resolved_by` | Who resolved it |

### Active Alarms Dashboard
`GET /sections/all/kpi-snapshot` returns `criticalAlarms` + `warningAlarms` count per section.
Used by AllSections.jsx dashboard to show plant health overview.

## All-Sections KPI Snapshot Response
```json
{
  "data": [
    {
      "sectionCode": "BOILER",
      "name": "Boiler House",
      "icon": "flame",
      "kpiData": { "BOILER_PRESS": 8.5, "BOILER_TEMP": 210, "COAL_FEED_RATE": 1200 },
      "snapshotTime": "2026-07-17T00:00:00Z",
      "criticalAlarms": 0,
      "warningAlarms": 1
    }
  ]
}
```

## Rules
1. Process reading write: must be from correct department (hasSectionWriteAccess check)
2. L5/Admin bypasses department restriction
3. Alarm creation: L3+ only (controlled — too many false alarms are noise)
4. Alarm resolution: L2+ (supervisor/manager can close alarms)
5. KPI snapshot: auto-generated by cron — do NOT manually modify
6. ETP readings: compliance-critical — same rules as utility module

## Common Query Patterns
```sql
-- Latest readings per tag for a section
SELECT DISTINCT ON (tag_name) tag_name, value, unit, reading_time
FROM section_process_readings
WHERE section_id = $1
ORDER BY tag_name, reading_time DESC;

-- Active critical alarms across plant
SELECT ps.name AS section, sa.alarm_type, sa.message, sa.actual_value, sa.tag_name
FROM section_alarms sa
JOIN plant_sections ps ON ps.id = sa.section_id
WHERE sa.resolved_at IS NULL AND sa.alarm_type = 'Critical'
ORDER BY sa.created_at ASC;

-- KPI trend for a section
SELECT snapshot_time, kpi_data
FROM section_kpi_snapshots
WHERE section_id = $1 AND snapshot_time >= NOW() - INTERVAL '24 hours'
ORDER BY snapshot_time ASC;
```
