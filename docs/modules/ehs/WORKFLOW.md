# EHS Module — Full Workflow & Rules

## Overview
Environment, Health & Safety incident reporting, near-miss tracking, permit management,
inspection records, and regulatory compliance documentation.

## Key Files
| File | Purpose |
|---|---|
| `backend/src/routes/ehs.js` | EHS endpoints |
| `frontend/src/pages/EHS.jsx` | EHS UI |
| DB: `ehs_incidents`, `permits`, `inspections` | Core tables |

## Database Tables
| Table | Purpose |
|---|---|
| `ehs_incidents` | Incident and near-miss reports |
| `permits` | Work permits (hot work, confined space, etc.) |
| `inspections` | Safety inspections |
| `ehs_documents` | Compliance documents |

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/ehs/incidents` | L1+ | List incidents (filter: type, severity, from, to) |
| GET | `/ehs/incidents/:id` | L1+ | Single incident |
| POST | `/ehs/incidents` | L1+ | Report incident (any user) |
| PUT | `/ehs/incidents/:id` | L3+ | Classify/update incident |
| PUT | `/ehs/incidents/:id/close` | L3+ | Close investigation |
| GET | `/ehs/permits` | L1+ | List work permits |
| POST | `/ehs/permits` | L2+ | Issue work permit |
| PUT | `/ehs/permits/:id/approve` | L3+ | Approve permit |
| PUT | `/ehs/permits/:id/close` | L2+ | Close permit on work completion |
| GET | `/ehs/inspections` | L1+ | Safety inspection records |
| POST | `/ehs/inspections` | L2+ | Record inspection |
| GET | `/ehs/stats` | L2+ | EHS dashboard stats |

## Incident Types
| Type | LTI? | Notification |
|---|---|---|
| Near Miss | No | Dept head (same day) |
| First Aid | No | Dept head |
| Medical Treatment | No | Dept head + EHS Officer |
| Lost Time Incident (LTI) | YES | L4+ within 4 hours, CPCB/Factory Inspector |
| Dangerous Occurrence | YES | L4+ immediately, statutory notification |
| Environmental Non-compliance | No | L4+ + EHS Officer |
| Property Damage | No | L4+ |

## Incident Severity Levels
| Level | Criteria |
|---|---|
| Low | Near miss, first aid, no lost time |
| Medium | Medical treatment, restricted duty |
| High | LTI, dangerous occurrence, major damage |
| Critical | Fatality, major environmental release |

## Incident Fields
| Field | Description |
|---|---|
| `date` | Incident date |
| `time` | Incident time |
| `location` | Where it happened (plant area/section) |
| `incident_type` | Category (see above) |
| `severity` | Low/Medium/High/Critical |
| `description` | What happened |
| `immediate_cause` | Direct cause |
| `root_cause` | Root cause analysis |
| `injured_person_id` | FK → employees (if any) |
| `witnesses` | Witness names |
| `first_aid_given` | Boolean |
| `medical_attention` | Boolean |
| `lost_time_days` | Days of work lost |
| `corrective_action` | Actions taken |
| `preventive_action` | Actions to prevent recurrence |
| `status` | Open / Under Investigation / Closed |
| `reported_by` | FK → users |
| `investigated_by` | FK → users (EHS Officer) |
| `anonymous` | Boolean (anonymous reports allowed) |

## LTI Escalation Rule
If `incident_type = 'LTI'` OR `severity = 'Critical'`:
1. Auto-notify L4+ (Plant Head) via notification within 4 hours
2. EHS Officer must file statutory report
3. Factory Inspector notification per Factory Act

## Work Permit Types
| Type | Required For |
|---|---|
| Hot Work | Welding, cutting, grinding near flammable materials |
| Confined Space | Entry into tanks, vessels, pits |
| Height Work | Work at heights > 2 meters |
| Electrical | LV/HV electrical work |
| Chemical | Hazardous chemical handling |
| Excavation | Digging/trenching |

## Permit Flow
```
Request Permit → Supervisor Approves → Work Done → Permit Closed
```
Active permits: all work must cease if emergency (override to Close)

## Safety Inspection Fields
| Field | Description |
|---|---|
| `inspection_type` | Routine / Fire / Electrical / General |
| `inspector` | FK → users |
| `date` | Inspection date |
| `area` | Area inspected |
| `observations` | What was found |
| `action_required` | Corrective actions needed |
| `action_by_date` | Deadline for corrections |
| `status` | Open / Closed |

## Rules
1. Any user can report an incident (anonymous option supported)
2. L3+ EHS Officer classifies and investigates
3. LTI: L4+ notification mandatory within 4 hours
4. Permits: L3+ must approve before high-risk work begins
5. Near-miss reporting encouraged — no disciplinary action for honest reporting
6. Corrective actions tracked until closed — open incidents flagged in dashboard
7. Monthly EHS report: required for management review

## EHS KPIs
- LTIFR: Lost Time Injury Frequency Rate = (LTI × 1,000,000) / man-hours
- TRIR: Total Recordable Incident Rate
- Near Miss Ratio: near misses / incidents (target: >5:1)
- Days Without LTI: tracked and displayed on dashboard

## Common Query Patterns
```sql
-- Open incidents
SELECT i.date, i.incident_type, i.severity, i.location, i.description
FROM ehs_incidents i
WHERE i.status = 'Open'
ORDER BY i.severity DESC, i.date ASC;

-- Monthly safety statistics
SELECT DATE_TRUNC('month', date) AS month,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE incident_type = 'Near Miss') AS near_misses,
  COUNT(*) FILTER (WHERE incident_type = 'Lost Time Incident') AS ltis,
  SUM(lost_time_days) AS lost_days
FROM ehs_incidents
WHERE date >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY 1 ORDER BY 1;
```
