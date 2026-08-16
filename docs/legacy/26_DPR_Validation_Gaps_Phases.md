# DPR Validation — Gaps, Capture Audit & Phase Roadmap

Validation of the app against the mill's real **Daily Production Report** (the
WhatsApp PM/C report) and general capture integrity. Answers: *what do we lag, what
must be captured that isn't.* Findings are grouped into build phases (Ph17 / Ph18).

> Method: checked capture-at-source (does the app record each report number where
> it is produced?) against live DB + routes + frontend forms — not assumptions.

---

## 1. What already works (validated ✅)

- **DPR artifact + engine** (Ph17-A/B/C, Done): consolidated report, assembler pulls
  reels + utility + chemical + furnish, all per-ton ratios server-side, verified
  exact against the real 29/06 report (Starch 30.30, Power 237.27, Steam 1.66, Husk 0.290).
- **Feeder tables**: `furnish_mix_log`, `downtime_reason_codes`, `dpr_grade_standards`.
- **Capture forms exist** for reels, shifts, downtime, chemical-consumption, utility.
- **Variance vs standard** (ALERT/OK) computed per chemical + power/steam/husk/yield.

---

## 2. Gaps found (the lag)

### 🔴 Must-fix — report cannot go auto without these
| # | Gap | Detail |
|---|-----|--------|
| 1 | **Capture side empty / no adoption** | reels=0, shifts=0, chemical=0, utility=0 rows. Forms exist but unused → report still hand-typed. Needs a fast one-screen daily entry + rollout. |
| 2 | **Furnish has no entry form** | Backend + autofill ready, but 0 frontend pages. Raw Material/Pulp dept can't log local/OCC furnish. |
| 3 | **Downtime not coded at capture** | `POST /downtime` saves free-text `reason`, ignores `downtime_reason_codes` master → no clean MTBF / equipment rollup. |
| 4 | **reels missing BF/deckle** | Grade = GSM/BF (140/22). reels has `gsm`+`width_mm` but no `bf` → can't rebuild grade code, GSM-wise loses the /22 /20 /18 split. |

### 🟡 Should-fix — accuracy holes
| # | Gap | Detail |
|---|-----|--------|
| 5 | **Standards only `DEFAULT`** | One global norm for all grades; report implies per-grade targets. |
| 6 | **3 chemicals not in materials master** | Deformer, SE Bond 102, Sigmaexor ETP absent (Starch/PAC/Surface/Coagulant/Retention present). |
| 7 | **Boiler semantics wrong** | Husk stored in `utility_readings.coal_consumed_kg` (coal≠husk). No feed-water, flue-gas temp, boiler efficiency. |
| 8 | **No variance ALERTS** | `notifications` table exists (HR) but Starch +2.3 / Power +7.27 notify nobody. |
| 9 | **No shift split in DPR** | Report is "day + night"; DPR per-day only, `shifts` empty → lose per-shift accountability. |

### 🟢 Nice / future
| # | Gap | Detail |
|---|-----|--------|
| 10 | **No cost impact (₹)** | No power/husk/chemical rates → no cost/ton. |
| 11 | **Reject/trim reasons thin** | `reject_pct` per reel exists, but no reason why finish < gross. |
| 12 | **No instrument feed** | QCS scanner, weighbridge, energy meter, steam flow — all manual. |

### ⚠️ Open security bugs (not DPR, but real — from HRMS validation)
| # | Gap | Detail |
|---|-----|--------|
| 13 | **Cross-dept leave approval** | `/leaves/:id/approve` is L2+ with no dept guard (any supervisor approves any dept). Breaks rule #6. |
| 14 | **F&F without clearance gate** | `/separation/:id/complete` settles money + deactivates at L3 with no `clearance_items` check. Breaks rule #10. |

---

## 3. Phase roadmap

### Ph17 — Daily Performance Statement (hardening)
| Phase | Scope | Gaps | Status |
|-------|-------|------|--------|
| Ph17-A | DPR artifact + engine | — | ✅ Done |
| Ph17-B | Feeder artifacts + variance | — | ✅ Done |
| Ph17-C | Daily Report UI + sidebar | — | ✅ Done |
| **Ph17-D** | **Capture completion** — furnish form, downtime reason-code dropdown, reel BF/deckle, reject reason | 2,3,4,11 | ⬜ Planned |
| **Ph17-E** | **Grade & master fidelity** — per-grade standards, add 3 chemicals to master | 5,6 | ⬜ Planned |
| **Ph17-F** | **Utility/boiler depth** — husk/feed-water/flue/efficiency fields, per-shift DPR split | 7,9 | ⬜ Planned |
| **Ph17-G** | **Alerts & cost** — variance → notifications, cost impact ₹/ton | 8,10 | ⬜ Planned |
| **Ph17-H** | **Daily capture screen + adoption** — one-screen fast entry, drive form usage | 1 | ⬜ Planned |
| **Ph17-I** | **Live instrument feed** — QCS/weighbridge/meter, hourly snapshot, WebSocket, 07:00 auto-publish | 12 | ⬜ Planned |

### Ph18 — HR Security Fixes
| Phase | Scope | Gaps | Status |
|-------|-------|------|--------|
| **Ph18-A** | Cross-dept leave approval guard (`/leaves/:id/approve`) | 13 | ⬜ Planned |
| **Ph18-B** | F&F clearance gate + L4 on `/separation/:id/complete` | 14 | ⬜ Planned |

---

## 4. Recommended order
1. **Ph17-D** (capture holes) + **Ph18-A/B** (security) first — highest value / lowest effort.
2. **Ph17-E/F** (fidelity) next — makes variance trustworthy.
3. **Ph17-G/H** — alerts + adoption make it operational.
4. **Ph17-I** — instrument integration, when hardware/budget ready.
