# Production Planning (PPC) & Slitting-Rewinding — Architecture, Data Model & Phased Implementation Plan

---

## 1. Executive Overview & The 2-Stage Manufacturing Architecture

Paper manufacturing at MK Paper Mill operates across two sequential, physically decoupled production stages. The software architecture models this through strict **Mother-to-Child Reel Genealogy** and **ACID-enforced Mass Balance Reconciliation**:

```
               ┌────────────────────────────────────────────────────────┐
               │           Customer Sales Orders (Tons, Sizes)          │
               └──────────────────────────┬─────────────────────────────┘
                                          │
                                          ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ STAGE 1: Production Planning & Control (PPC)                                           │
│  • Grade Conversion: Order Tonnage (MT) ➔ Total Reels Required (Gw)                    │
│  • 1D-Cutting Stock Optimization: Combines order widths into Cutting Patterns          │
│  • Set-Repetition Math: Solves for (Pattern × K Sets) to satisfy all order demands     │
│  • Target: Machine Deckle Utilization ≥ 98.0%, Edge Trim Loss (T) ≤ 2.0%              │
└─────────────────────────────────────────┬──────────────────────────────────────────────┘
                                          │  [Production Plan & Knife Setup Matrix]
                                          ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ PAPER MACHINE (PM01): Mother Reel Formation                                            │
│  • Produces Parent Jumbo Roll (e.g. Deckle: 2650 mm, Gross: 4,500 kg, Tag: JMB-001)    │
│  • Captured in `jumbo_reels` with PM operational metrics (GSM, BF, Speed, Moisture)    │
└─────────────────────────────────────────┬──────────────────────────────────────────────┘
                                          │  [Parent Jumbo Roll Transferred to Rewinder Stand]
                                          ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ STAGE 2: Slitting & Rewinding Console (Shopfloor Execution)                            │
│  • Mounts Mother Reel (JMB-001) onto Rewinder / Slitter                                │
│  • Dynamic N-Cut Knives: Sets [Cut 1, Cut 2, Cut 3, ... Cut N] across deckle           │
│  • Physical Scale Authority: Weighs each finished slit reel (H) at the weighbridge     │
│  • Direct Scrap Capture: Logs Edge Trim (T), Rewinder Broke & Core Scrap               │
│  • ACID Mass Balance Gate: Reconciles |W_jumbo - (Σ H + T + Broke + Core)| ≤ 0.5%      │
│  • Auto-Generates Unique Child Barcodes & Updates Sales Order Fulfillment              │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Dynamic N-Cut Schema & Complete Normalized DDL

To eliminate hardcoded 5-cut limits and fully support machines running 6–12+ narrow slitting knives, the schema employs a dynamic child table (`ppc_pattern_cuts`) and separate mother-child roll entities.

### Core Normalized Tables

1. **`ppc_production_plans`**: Master planning batch defining target run dates, machine, paper grade (GSM/BF), and total planned tonnage.
2. **`ppc_slitting_patterns`**: Pattern headers detailing planned trim ($T$), deckle width utilization, and total sets scheduled ($K$).
3. **`ppc_pattern_cuts`**: Dynamic child cut positions ($1 \dots N$) mapping knife position and width to specific customer sales order lines.
4. **`jumbo_reels`**: Parent rolls off the Paper Machine, capturing pope reel gross/net weight and reconciliation status.
5. **`slit_reels`**: Finished customer rolls off the rewinder with weighbridge actual weights and barcode genealogy.
6. **`slitting_waste_log`**: Physical edge trim ($T$), splice broke, and core scrap accounting linked directly to the hydrapulper furnish loop.

---

## 3. Mathematical & Algorithmic Specifications

### A. Grade Conversion: Order Tonnage $\rightarrow$ Total Reels ($G_w$)

1. **Theoretical Reel Weight from Outer Diameter ($D$) & Core ($d$):**
   $$W_{\text{single}} (\text{kg}) = \frac{\pi \times (D^2 - d^2)}{4} \times \text{Width (m)} \times \rho_{\text{apparent}}$$
   *(Standard Kraft Paper Density $\rho \approx 0.70 \text{ to } 0.85 \text{ g/cm}^3$)*

2. **Theoretical Reel Weight from Target Length ($L$):**
   $$W_{\text{single}} (\text{kg}) = \frac{\text{Width (m)} \times \text{Length (m)} \times \text{GSM}}{1000}$$

3. **Reels Required per Order Size ($G_w$):**
   $$G_w = \left\lceil \frac{\text{Order Demand (MT)} \times 1000}{W_{\text{single}} (\text{kg})} \right\rceil$$

---

### B. Pattern Repetition & Set Multiplier Math ($K_w$)

Let $n_w$ be the count of knife cut positions allocated to width $w$ in a specific slitting pattern:

$$\text{Sets Required for Width } w = K_w = \left\lceil \frac{G_w}{n_w} \right\rceil$$

$$\text{Total Pattern Width } W_{\text{total}} = \sum_{j=1}^N w_j \leq \text{Usable Machine Deckle } (W_{\text{max}})$$

$$\text{Planned Trim Loss } (T) = W_{\text{max}} - W_{\text{total}} \quad (\text{Target: } T \leq 2.0\% \text{ of } W_{\text{max}})$$

---

### C. Scale Authority & Yield Variance KPI

The physical scale at the rewinder is the single source of truth for finished weights:

$$\text{Yield Variance \%} = \left( \frac{\sum_{i=1}^N H_{\text{actual}, i} - \sum_{i=1}^N H_{\text{planned}, i}}{\sum_{i=1}^N H_{\text{planned}, i}} \right) \times 100$$

- **Normal Range:** $\pm 1.5\%$
- **Deviation Alert ($> 2\%$):** Flags moisture drift, stock consistency deviation, or scale miscalibration.

---

### D. Enforced Mass Balance Tolerance Band ($\pm 0.5\%$)

$$\Delta W = \left| W_{\text{jumbo\_net}} - \left( \sum_{i=1}^N H_{\text{actual}, i} + T_{\text{trim\_kg}} + W_{\text{broke\_kg}} + W_{\text{core\_kg}} \right) \right|$$

$$\text{Allowed Tolerance } \varepsilon_{\text{max}} = 0.005 \times W_{\text{jumbo\_net}}$$

- **If $\Delta W \leq \varepsilon_{\text{max}}$:** `reconciliation_status` $\rightarrow$ `'BALANCED'`. Slit reels unlocked for QA & dispatch.
- **If $\Delta W > \varepsilon_{\text{max}}$:** `reconciliation_status` $\rightarrow$ `'VARIANCE_HELD'`. Downstream warehouse movement locked until a Plant Head (L4+) submits an `override_reason`.

---

## 4. Phased Implementation Roadmap

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 PHASED ROLLOUT PLAN                                    │
├─────────────────────────┬─────────────────────────┬────────────────────────────────────┤
│ Phase                   │ Scope & Deliverables    │ Validation Criteria                │
├─────────────────────────┼─────────────────────────┼────────────────────────────────────┤
│ PHASE 1                 │ Database Foundation &   │ • 6 normalized tables created      │
│ Genealogy Foundation    │ Genealogy Tracking      │ • Mother-to-Child FK constraints   │
│                         │                         │ • Barcode generation logic wired   │
├─────────────────────────┼─────────────────────────┼────────────────────────────────────┤
│ PHASE 2                 │ Slitting-Rewinding      │ • Dynamic N-Cut Knife UI           │
│ Shopfloor Capture &     │ Touchscreen Console &   │ • Scale weight capture authority   │
│ Mass Balance Gate       │ Reconciliation Trigger  │ • ±0.5% Mass balance ACID trigger  │
├─────────────────────────┼─────────────────────────┼────────────────────────────────────┤
│ PHASE 3                 │ PPC Planning Studio &   │ • Pending Order Backlog Matrix     │
│ Planning Studio         │ Set Multiplier Engine   │ • Grade Conversion Engine (Gw)     │
│                         │                         │ • Dynamic Pattern Builder (Kw sets)│
├─────────────────────────┼─────────────────────────┼────────────────────────────────────┤
│ PHASE 4                 │ Algorithmic 1D-CSP      │ • Greedy FFD / Column Generation   │
│ Optimization & Analytics│ Deckle Solver & DPR/    │ • Auto-Trim minimization (< 2%)    │
│                         │ WhatsApp Reporting      │ • DPR & WhatsApp Yield Digest      │
└─────────────────────────┴─────────────────────────┴────────────────────────────────────┘
```

### Phase Details

#### Phase 1: Database Foundation & Mother-Child Genealogy
- Execute DDL migration (`db/migration_ppc_slitting_foundation.sql`).
- Establish `jumbo_reels` and `slit_reels` entities.
- Implement barcode structure: Parent `MK-JMB-YYYYMMDD-PM1-001` $\rightarrow$ Child `MK-FIN-YYYYMMDD-001-A`.

#### Phase 2: Slitting-Rewinding Console & Mass Balance Gate
- Build `SlittingConsole.jsx` for shopfloor operators.
- Implement dynamic knife entry table ($Cut_1 \dots Cut_N$).
- Integrate direct scale weight capture with automated sticker print.
- Activate PostgreSQL ACID trigger for $\pm 0.5\%$ mass balance verification.
- Auto-credit edge trim ($T$) to hydrapulper scrap inventory.

#### Phase 3: PPC Planning Studio & Set Multiplier Engine
- Build `PpcPlanning.jsx` for production managers.
- Ingest unfulfilled sales orders (GSM, BF, Widths, MT).
- Implement interactive deckle visualizer and pattern repetition calculator ($K_w$).
- Link completed cut reels directly to sales order fulfillment status.

#### Phase 4: Algorithmic 1D-CSP Deckle Optimizer & Reporting
- Implement 1D Cutting Stock Problem (1D-CSP) optimization heuristic.
- Provide 1-click auto-deckle combination suggestions minimizing trim waste.
- Integrate yield variance and slitting scrap KPIs into Daily Production Report (DPR) and WhatsApp Executive Digest.
