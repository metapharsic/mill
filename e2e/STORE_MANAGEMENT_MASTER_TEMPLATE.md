# 📦 Store Management & Inventory — Master Architecture & Playwright Template

> **Domain Specification:** Comprehensive architectural reference, category classification, transaction ledger rules, and Playwright test automation templates for MK Paper Mill Central Store Operations.

---

## 🏛️ 1. Store Master Hierarchy & Category Taxonomy

Based on the official mill store ledgers (`Projects_Requirement/8152026/stores.txt` and `Documentation/STORE INVENTORY SOFT COPY.xlsx`), the store inventory is partitioned into 7 major departmental stores:

```
                          ┌────────────────────────────────┐
                          │   MK PAPER MILL CENTRAL STORE  │
                          └───────────────┬────────────────┘
                                          │
       ┌──────────────┬──────────────┬────┴─────────┬──────────────┬──────────────┐
       │              │              │              │              │              │
┌──────▼─────┐ ┌──────▼─────┐ ┌──────▼─────┐ ┌──────▼─────┐ ┌──────▼─────┐ ┌──────▼─────┐
│ MECHANICAL │ │ ELECTRICAL │ │  CHEMICAL  │ │  CLOTHING  │ │ HYDRAULIC  │ │ GENERAL &   │
│   STORE    │ │   STORE    │ │   STORE    │ │  & FELTS   │ │ & PNEUMATIC│ │ STATIONERY  │
└────────────┘ └────────────┘ └────────────┘ └────────────┘ └────────────┘ └────────────┘
```

### 📋 Category Classification Breakdown

| Store Section | Sub-Categories / Item Groups | Units of Measurement (UOM) | Storage Location |
|---|---|---|---|
| **Mechanical Store** | `BEARINGS` (Spherical, Deep Groove, Pillow Block), `OIL SEALS`, `TYRE COUPLINGS & PIN BUSHES`, `PUMP SLEEVES`, `V-BELTS`, `WELDING RODS`, `CUTTING & GRINDING WHEELS`, `VALVES` (Butterfly, Ball, Gate), `GAUGES`, `SHAFTS & IMPELLERS`, `SS/MS PIPE FITTINGS`, `NOZZLES`, `COMPRESSOR SPARES`, `BOLTS, NUTS & WASHERS` | `NOS`, `SET`, `MTR`, `PKT`, `KG` | Rack M-01 to M-18 |
| **Electrical Store** | `CONTACTORS`, `RELAYS`, `MCBs & MCCBs`, `VFD DRIVE SPARES`, `MOTORS`, `CABLES & LUGS`, `SENSORS & PROXIMITY SWITCHES`, `CONTROL TRANSFORMERS` | `NOS`, `SET`, `MTR`, `COIL` | Rack E-01 to E-10 |
| **Chemical Store** | `STARCH`, `ALUM`, `ROSIN`, `LIQUID DYES`, `BIOCIDES`, `RETENTION AIDS`, `PAC`, `DEFOAMER`, `SLIMICIDE`, `CAUSTIC SODA` | `KG`, `LTR`, `BAG`, `DRUM` | Chemical Bay C-01 to C-06 |
| **Clothing & Felts** | `FORMING FABRICS`, `PRESS FELTS` (1st Press, 2nd Press), `DRYER SCREENS`, `CARRIER ROPES` | `NOS`, `MTR` | Machine Bay PM-01 |
| **Hydraulic & Pneumatic** | `HYDRAULIC HOSES`, `PNEUMATIC CYLINDERS`, `SOLENOID VALVES`, `FRL UNITS`, `QUICK CONNECTORS`, `SEAL KITS` | `NOS`, `SET` | Rack H-01 to H-04 |
| **General & Stationery** | `LUBRICANTS & GREASE`, `SAFETY PPE` (Helmets, Shoes, Gloves), `PRINTING PAPER`, `REGISTER BOOKS`, `OFFICE SUPPLIES` | `NOS`, `LTR`, `CAN`, `BOX` | Admin Store G-01 |

---

## ⚖️ 2. Core Store Business Invariants & Accounting Rules

1. **Atomic Stock Ledger Formula:**
   $$\text{Closing Balance} = \text{Opening Balance} + \sum \text{Inward (GRN / Fast-Inward)} - \sum \text{Outward (SIV / Transfer)}$$
2. **Zero Negative Stock Invariant:**
   - Outward stock deduction is strictly rejected if $\text{Requested Qty} > \text{Available Current Stock}$.
3. **`requireStore` Security Enforcement:**
   - Every route performing stock deduction requires authentication with `dept_code === 'STORE'` or `role_level >= 5` (Admin).
4. **Sequence Guard Workflow:**
   - Store Keeper cannot issue physical stock against an indent in `Submitted` status without Store Manager / Level 2 Approval (`sequence_violation: true`).
5. **Maker $\neq$ Checker Segregation:**
   - Department requesters cannot approve their own Indent or issue stock to themselves without supervisor/admin sign-off.

---

## 🎭 3. Playwright Store Management POM & Test Specifications

### Page Object Model (`e2e/pages/StorePage.js`)
```javascript
// @ts-check
const { BasePage } = require('./BasePage');
const { expect } = require('@playwright/test');

class StorePage extends BasePage {
  constructor(page) {
    super(page);
    this.inwardTab = page.locator('button:has-text("Inward"), button:has-text("GRN")').first();
    this.outwardTab = page.locator('button:has-text("Outward"), button:has-text("SIV")').first();
    this.stockLedgerTab = page.locator('button:has-text("Stock Ledger")').first();
    this.fastInwardBtn = page.locator('button:has-text("Fast Inward")').first();
    this.exportModalBtn = page.locator('button:has-text("Excel Master Export")').first();
  }
  async goto() { await this.navigateTo('/store'); await this.waitForReady(); }
  async filterByStore(storeType) { /* Section selection */ }
  async openFastInward() { /* Fast-inward modal trigger */ }
  async verifyA3ModalDates() { /* Regional date validation */ }
}
module.exports = { StorePage };
```

### Test Specification Matrix (`e2e/specs/store_inventory_flow.spec.js`)
| Scenario ID | Test Scenario Description | Expected Outcome |
|---|---|---|
| **`TC-STORE-01`** | Central Store Navigation & Dashboard Overview | Inward GRN & Outward SIV tabs loaded and accessible |
| **`TC-STORE-02`** | Inward Goods Receipt Notes (GRN) Verification | Multi-item vendor inwards rendered with correct prices & GST |
| **`TC-STORE-03`** | Fast-Inward (Direct Material Receipt without PO) | Stock balance incremented immediately and logged in `stock_ledger` |
| **`TC-STORE-04`** | Outward Store Issue Voucher (SIV) Allocation | Stock balance deducted atomically with `requireStore` guard |
| **`TC-STORE-05`** | Enterprise Inventory Excel & CSV Master Exporter | Multi-sheet Excel workbook export modal loads seamlessly |

---

## 🖨️ 4. Store Issue Slips & Print Vouchers

All Store Issue Slips (SIV), Goods Receipt Notes (GRN), and Requisitions render regional dates in `en-IN` format:
- **Date Format:** `DD/MM/YYYY` (e.g. `28/08/2026`)
- **Timestamp Format:** `DD/MM/YYYY, hh:mm A` (e.g. `28/08/2026, 03:00 pm`)
- **Mathematical Accuracy:** Base Value + CGST (9%) + SGST (9%) = Grand Total with zero rounding drift.
