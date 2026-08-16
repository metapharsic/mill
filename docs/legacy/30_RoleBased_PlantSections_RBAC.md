# Plant Sections Department-Based RBAC (Ph26)
# Stack: Node.js/Express + React/Vite + PostgreSQL
# Last updated: 2026-07-06

This document details the department-based role authorization mapping implemented for the 21 Plant Sections to ensure operators only log/edit values in their assigned sections, while keeping all sections viewable (read-only) for all authenticated employees.

---

## 1. Permission Matrix Mapping

| Department Code (`dept_code`) | Associated Plant Sections | Permitted Operations |
|:---|:---|:---|
| **`PROD`** (Production) | PULPMILL, CENTRICLEANER, WIRE, PRESS, UNIRUN, PRE_DRYER, SIZE_PRESS, POST_DRYER, CALENDER, POPE_REEL, REWINDER, CRANES | **Write** (Log readings, raise/resolve alarms, edit equipment) |
| **`QC`** / **`QA`** / **`LAB`** (Quality) | LAB, SIZE_PRESS, SIZE_KITCHEN, STARCH_KITCHEN, POPE_REEL | **Write** (Log readings, raise/resolve alarms, edit equipment) |
| **`UTIL`** (Utility) | BOILER, STEAM_COND, ETP, COMPRESSORS, VACUUM | **Write** (Log readings, raise/resolve alarms, edit equipment) |
| **`MAINT`** (Maintenance) | CRANES, COMPRESSORS, BOILER, VACUUM | **Write** (Log readings, raise/resolve alarms, edit equipment) |
| **`STORE`** (Store) | STORE | **Write** (Log readings, raise/resolve alarms, edit equipment) |
| **`Admin`** / **`Level >= 5`** | ALL 21 Sections | **Write** (All operations) |
| **Any other logged-in user** | ALL Sections | **View Only** (Read-only data access) |

---

## 2. Backend Implementation (`backend/src/routes/sections.js`)

A helper function `hasSectionWriteAccess(user, sectionCode)` validates the `user.dept_code` against the mapped section codes. If unauthorized, the API throws `403 Forbidden` response.

Endpoints guarded:
- `POST /api/sections/:code/readings` (Log sensor reading)
- `POST /api/sections/:code/alarms` (Raise critical/warning alarm)
- `POST /api/sections/:code/equipment` (Register new equipment asset)

---

## 3. Frontend Implementation (`frontend/src/pages/PlantSection.jsx`)

- Fetches active user details from `AuthContext` via `useAuth()`.
- Implements `hasWriteAccess()` validation corresponding to backend logic.
- Dynamically hides the following form cards for read-only users:
  - **"Add Equipment"** form under the Equipment tab.
  - **"Log Process Reading"** form under the Readings tab.
  - **"Raise Alarm"** form under the Alarms tab.
  - **"Acknowledge"** and **"Resolve"** actions on active alarm cards.
- Non-owners see all charts and listings, but cannot perform modifying actions.
