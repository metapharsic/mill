# Security / Gate Module — Full Workflow & Rules

## Overview
Factory gate management: vehicle entry/exit, visitor registration, material gate passes,
and night shift security logs. Controls all material movement in/out of factory.

## Key Files
| File | Purpose |
|---|---|
| `backend/src/routes/security.js` | Security endpoints |
| `frontend/src/pages/Security.jsx` | Security UI |
| DB: `gate_logs`, `visitors`, `gate_passes` | Core tables |

## Database Tables
| Table | Purpose |
|---|---|
| `gate_logs` | Vehicle and personnel entry/exit |
| `visitors` | Visitor register |
| `gate_passes` | Material movement gate passes |
| `security_logs` | Shift-wise security incident log |

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/security/gate-logs` | L1+ | Gate entry/exit records (filter: date, type) |
| POST | `/security/gate-logs` | L1+ | Log gate entry |
| PUT | `/security/gate-logs/:id/exit` | L1+ | Record exit time |
| GET | `/security/visitors` | L1+ | Visitor register |
| POST | `/security/visitors` | L1+ | Register visitor |
| PUT | `/security/visitors/:id/exit` | L1+ | Record visitor exit |
| GET | `/security/gate-passes` | L1+ | Material gate passes |
| POST | `/security/gate-passes` | L3+ | Create gate pass (authorized outward movement) |
| PUT | `/security/gate-passes/:id/approve` | L3+ | Approve gate pass |
| GET | `/security/logs` | L1+ | Shift security log |
| POST | `/security/logs` | L1+ | Add security log entry |

## Gate Log Types
| Type | Description |
|---|---|
| Vehicle In | Truck/vehicle entry |
| Vehicle Out | Truck/vehicle exit |
| Dispatch | Outward goods vehicle |
| Delivery | Inward goods vehicle |
| Personnel | Employee entry/exit |
| Contractor | Contract worker entry/exit |

## Gate Log Fields
| Field | Description |
|---|---|
| `log_type` | Category (see above) |
| `vehicle_number` | Registration number |
| `driver_name` | Driver/person name |
| `purpose` | Reason for entry |
| `in_time` | Entry timestamp |
| `out_time` | Exit timestamp (set later) |
| `material_description` | What is being brought in/out |
| `weight_in_kg` | Weight (for material movements) |
| `remarks` | Security officer notes |
| `gate_pass_id` | FK → gate_passes (for authorized outward) |
| `security_officer` | FK → users |

## Visitor Register Fields
| Field | Description |
|---|---|
| `visitor_name` | Full name |
| `company` | Visitor's company |
| `mobile` | Contact number |
| `purpose` | Reason for visit |
| `host_employee_id` | FK → employees (who they're meeting) |
| `badge_number` | Visitor badge assigned |
| `in_time` | Entry time |
| `out_time` | Exit time (set later) |
| `id_proof_type` | Aadhar/PAN/DL etc |
| `id_proof_number` | ID number (masked in display) |
| `photo_url` | Optional visitor photo |

## Material Gate Pass (Outward)
Required for any material leaving the factory:
- Dispatch: linked to dispatch_order
- Return to Vendor: linked to purchase return
- Personal: employee taking company material out
- Scrap: authorized scrap disposal

### Gate Pass Fields
| Field | Description |
|---|---|
| `pass_type` | Dispatch / Return / Scrap / Personal |
| `authorized_by` | L3+ user who authorized |
| `material_description` | What is going out |
| `quantity` | Quantity leaving |
| `destination` | Where it's going |
| `vehicle_number` | Transport vehicle |
| `valid_until` | Pass expiry |
| `reference_type` | Dispatch / PO / Sales |
| `reference_id` | Source document ID |

## Rules
1. SEC dept staff handle day-to-day gate entries
2. Visitor ID proof number: collected but masked in display (last 4 digits only)
3. Material gate pass: L3+ authorization mandatory for outward movement
4. Dispatch vehicles: must have gate_pass_id before being allowed out
5. All overnight vehicles logged in security log
6. Visitor badges returned on exit — noted in visitor register
7. Night shift log: mandatory entry every 2 hours by security officer

## Visitor Log Rules
- All visitors must show ID proof
- Host employee must acknowledge visitor arrival
- Badge returned on exit — log out_time
- No visitor can remain after 10 PM without L4+ approval
- Contractors: separate register, must have work permit

## Integration with Sales
- Dispatch vehicle out: checks gate_pass linked to dispatch_order
- Gate officer records actual dispatch time and vehicle number
- This timestamp is the official "dispatch date" for logistics

## Common Query Patterns
```sql
-- Current visitors inside (not exited)
SELECT v.visitor_name, v.company, v.purpose, e.name AS host, v.in_time, v.badge_number
FROM visitors v
LEFT JOIN employees e ON e.id = v.host_employee_id
WHERE v.out_time IS NULL AND DATE(v.in_time) = CURRENT_DATE
ORDER BY v.in_time;

-- Vehicles still inside
SELECT gl.vehicle_number, gl.driver_name, gl.purpose, gl.in_time
FROM gate_logs gl
WHERE gl.out_time IS NULL AND DATE(gl.in_time) = CURRENT_DATE
ORDER BY gl.in_time;

-- Gate pass pending execution
SELECT gp.*, u.name AS authorized_by_name
FROM gate_passes gp
JOIN users u ON u.id = gp.authorized_by
WHERE gp.status = 'Approved' AND gp.valid_until >= CURRENT_DATE
ORDER BY gp.created_at;
```
