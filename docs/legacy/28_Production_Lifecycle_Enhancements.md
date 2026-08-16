# Production Lifecycle Enhancements (Ph24)
# Stack: Node.js/Express + React 18 + PostgreSQL
# Last updated: 2026-07-06

This document details the architecture, calculations, and interface guidelines for the Production Lifecycle Enhancements, focusing on OEE precision, real-time chemical efficiency alarms, and material tracking QR integration.

---

## 1. True 3-Factor OEE Standard

To align with modern TPM (Total Productive Maintenance) standards, Overall Equipment Effectiveness (OEE) is calculated using three independent factors:

```
OEE = Availability (A) × Performance (P) × Quality (Q)
```

### Mathematical Definitions

#### 1. Availability (A)
Measures downtime losses.
*   **Formula:** `running_minutes / (running_minutes + down_minutes)`
*   **Inputs:** `shifts.running_minutes`, `shifts.down_minutes`

#### 2. Performance (P)
Measures speed losses (running slower than design speed).
*   **Formula:** `average_speed / design_speed`
*   **Inputs:** `average_speed` (telemetry/operator input), `machines.design_speed_mpm` (default `300.00 m/min`)

#### 3. Quality (Q)
Measures yield losses (defects vs total produced).
*   **Formula:** `Approved_Reel_Weight_kg / Total_Reel_Weight_kg`
*   **Inputs:** `reels.weight_kg` where `status = 'Approved'` vs total `reels.weight_kg`.

### Database Schema Updates
```sql
ALTER TABLE machines ADD COLUMN IF NOT EXISTS design_speed_mpm NUMERIC(8,2) DEFAULT 300.00;
```

---

## 2. Specific Chemical Consumption Alerts (F4)

To prevent chemical overdosing and minimize raw material waste, we compare daily shift chemical consumption metrics (kg/Ton) directly against our grade standards.

### Alert Trigger Threshold
*   An alert is generated if:
    ```
    Actual_kg_per_Ton > (Standard_kg_per_Ton * 1.10)
    ```
*   Upon breach:
    1. A record is created in `chemical_limit_alerts`.
    2. A warning badge is displayed on the UI.
    3. A notification is published to the Kafka topic `mkpm.events.critical`.

### Database Schema
```sql
CREATE TABLE IF NOT EXISTS chemical_limit_alerts (
  id            SERIAL PRIMARY KEY,
  alert_date    DATE NOT NULL,
  chemical_id   INTEGER REFERENCES materials(id),
  actual_ratio  NUMERIC(10,3),
  standard_ratio NUMERIC(10,3),
  status        VARCHAR(20) DEFAULT 'Active',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 3. Printable Reel QR Code Slip (🧻)

To ensure full digital twin traceability throughout storage, shipping, and sales, each finished jumbo reel requires a physical QR code label attached.

### QR Code Content Layout
The generated QR Code string utilizes a standard JSON format:
```json
{
  "reelNumber": "REEL-20260706-001",
  "gsm": 120,
  "bf": 18,
  "weight": 1850,
  "machine": "PM2",
  "producedAt": "2026-07-06T00:30:00Z"
}
```

### Print Stylesheet Layout (`@media print`)
When printing, the UI hides all sidebar navigations, dashboard headers, and details grids, rendering only a standard `4in x 6in` thermal shipping label format.
