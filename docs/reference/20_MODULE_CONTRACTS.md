# MK Paper Mill ERP — Module Contracts & Boundaries

> **AI INSTRUCTION:** Read this before introducing new tables, cross-module updates, 
> or modifying event structures. Respect the data boundaries and API/event versioning rules below.

---

## 1. CRM/OMS vs. Core ERP Boundaries

This system separates commercial operations (Customer Relations, Sales Order Entry, Fulfillment) from physical inventory and production.

```
       [ COMMERCIAL / OMS ]                 [ MANUFACTURING / ERP ]
 ┌──────────────────────────────┐       ┌──────────────────────────────┐
 │ Customers & Credit Control   │       │ Pulp & Chemical Consumption  │
 ├──────────────────────────────┤       ├──────────────────────────────┤
 │ Sales Orders (GSM/Width/MT)  │       │ Reel Production & GSM Slicing│
 ├──────────────────────────────┤       ├──────────────────────────────┤
 │ Dispatch Orders & E-way Bills│       │ QC Testing & Pass/Fail Holds │
 └──────────────┬───────────────┘       └──────────────┬───────────────┘
                │                                      │
                │                                      │
                ▼                                      ▼
         [ DISPATCH GATE ]                       [ FG STORE ]
     (Verify approved reels;                 (Store reels only if
      mark reels as Dispatched)               quality_status = 'Approved')
```

### A. Sales & Dispatch (Commercial / OMS Equivalent)
*   **Data Owned:** `customers`, `sales_orders`, `dispatch_orders`, `dispatch_items`.
*   **Write Permission:** Level 3+ (Sales / Dispatch dept).
*   **Responsibilities:**
    *   Customer master records & credit limits.
    *   Sales Order (SO) creation, target GSM/Width/Weight (MT), pricing.
    *   Dispatch planning, vehicle weight logs (tare/gross/net), LR, and E-way bill assignment.
    *   Marking reels as `'Dispatched'`.
*   **Dependency Limits:** Cannot update `reels` columns other than `status` (to `'Dispatched'`) and `sales_order_id`.

### B. Production (Manufacturing / MPS)
*   **Data Owned:** `reels` (base details), `shifts`, `downtime_entries`, `daily_production_reports`, `dpr_gsm_breakup`, `dpr_chemical_lines`, `dpr_downtime_lines`.
*   **Write Permission:** Level 1+ (Operators / Production dept).
*   **Responsibilities:**
    *   Shift logs (opening/closing shifts).
    *   Reel creation, weight logging (gross/net weight), machine speed, raw text GSM/BF entries.
    *   Machine downtime tracking (categorization & duration).
*   **Dependency Limits:** Cannot mark a reel's `quality_status` as `'Approved'` or `'Rejected'` (this belongs exclusively to the Quality module).

### C. Quality (Inspection / QA)
*   **Data Owned:** `quality_tests`, `lab_tests` (process laboratory).
*   **Write Permission:** Level 2+ (QC / Lab dept).
*   **Responsibilities:**
    *   Physical paper tests (moisture, burst factor, Cobb index, brightness, caliper).
    *   Setting `reels.quality_status` (`'Approved'`, `'Rejected'`, `'Hold'`).
    *   Setting `reels.status` to `'In Warehouse'` or `'Rejected'`.
*   **Dependency Limits:** Cannot modify reel dimensions (GSM, width, weight) — must flag discrepancies and mark test as `'Fail'`.

### D. Inventory & Store (Stock / WMS)
*   **Data Owned:** `materials`, `material_categories`, `stock_ledger`, `installed_assets`.
*   **Write Permission:** Level 2+ (STORE department via `requireStore` middleware).
*   **Responsibilities:**
    *   GRN receiving against purchase orders.
    *   Internal store issues, returns, and adjustments.
    *   Warehouse rack locations (`reels.rack_location`).

---

## 2. Event-Driven Contracts

### Payload Structure Rules
Every event published to Kafka MUST follow the standardized envelope:

```json
{
  "$schema": "https://erp.mkpapermill.com/schemas/events/v1.json",
  "version": "1.0.0",
  "eventId": "uuid-v4-string",
  "timestamp": "ISO-8601-Timestamp",
  "actorId": 12,
  "event": "domain.entity.action",
  "payload": {}
}
```

### Event Names & Payloads Catalog

#### 1. Sales Order Confirmed
*   **Topic:** `mkpm.events.all`
*   **Event Key:** `sales.order.confirmed`
*   **Payload:**
    ```json
    {
      "orderId": 451,
      "soNumber": "SO-20260717-0004",
      "customerId": 82,
      "totalValue": 450000.00,
      "items": [
        { "grade": "KRAFT", "gsm": 120, "widthMm": 2100, "qtyMt": 15.5 }
      ]
    }
    ```

#### 2. Stock Ledger Issue (Stock Deduction)
*   **Topic:** `mkpm.events.critical` (if value > ₹1,00,000) or `mkpm.events.all`
*   **Event Key:** `stock.issue.completed`
*   **Payload:**
    ```json
    {
      "ledgerId": 88021,
      "materialId": 412,
      "materialCode": "CHEM-STARCH-01",
      "qtyIssued": 500.00,
      "uom": "KG",
      "value": 15000.00,
      "departmentId": 3,
      "referenceType": "indent",
      "referenceId": 981
    }
    ```

#### 3. Reel Quality Test Certified
*   **Topic:** `mkpm.events.all`
*   **Event Key:** `quality.test.certified`
*   **Payload:**
    ```json
    {
      "testId": 8912,
      "reelId": 45091,
      "reelNumber": "MK-20260717-PM1-029",
      "result": "Pass",
      "certifiedBy": 4,
      "parameters": {
        "gsm": 80.2,
        "moisturePct": 7.4,
        "burstFactor": 22
      }
    }
    ```

---

## 3. Event Versioning Policy

To prevent downstream subscribers (reporting engines, SCADA synchronization, external accounting platforms) from breaking:

1.  **Semantic Versioning:**
    *   **Major version bump (e.g., v1 to v2):** When a field is removed, renamed, or its data type changes incompatibly.
    *   **Minor version bump (e.g., v1.0 to v1.1):** When new optional fields are added to the payload.
2.  **Compatibility Rule:** All event handlers must safely handle additional fields without throwing parsing exceptions (robustness principle).
3.  **Deprecation Policy:** Major version changes must support side-by-side execution or maintain fallback parsing for at least 30 days before dropping older schemas.
