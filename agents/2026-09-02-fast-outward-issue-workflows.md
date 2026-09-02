# Fast Outward Issue Workflows (Job Work, Return to Party, Inter Store Transfer)

**Date**: 2026-09-02  
**Scope**: Store Management > New Outward (Issue) / Fast Outward Issue Desk  
**Status**: 100% Tested & Verified  

---

## 1. Overview & Objective
Implemented the structured **Fast Outward Issue** 3-mode engine in **Store Management**:
1. **🏭 Mode 1: JOB WORK**: Issue material to outside job workers / repair / lathe vendors with auto-generated Returnable Gate Pass (`GP-JW-YYYYMMDD-XXXX`), unit rates, machine/section allocation, and live stock deduction.
2. **↩️ Mode 2: RETURN TO PARTY (RTV)**: Return QC-rejected, defective, or excess material directly to suppliers against GRN history with vendor GRN material lookup (`GET /api/store/vendors/:vendorId/grn-materials`), automated debit calculations, and RTV Gate Pass generation (`GP-RTV-YYYYMMDD-XXXX`).
3. **🔄 Mode 3: INTER STORE TRANSFER (STO)**: Move stock between mill stores / sub-stores / departments with Store Issue Number (`STO-YYYYMMDD-XXXX`), date, target department, and stock ledger handover.

---

## 2. Multi-Agent Coordination Map

| Agent | Responsibility | Implementation Deliverables |
|---|---|---|
| **Agent 1: DB & Ledger Guard** | Atomicity & Constraints | Pessimistic locking (`FOR UPDATE`), stock ledger recording (`job_work`, `return_to_vendor`, `transfer`), and foreign key integrity. |
| **Agent 2: Backend API Engine** | Dynamic Routes & Gate Passes | Added `GET /api/store/vendors/:vendorId/grn-materials`, enhanced `POST /api/store/outward` and `PUT/DELETE /api/store/outward/:id` in `backend/src/routes/store.js`. |
| **Agent 3: Frontend Flow Specialist** | Modern UI & Dynamic Forms | Segmented 3-tier mode switcher, SearchableSelect dropdowns for party, GRN materials, departments, and M/S in `frontend/src/pages/Store.jsx`. |
| **Agent 4: Verification & Audit** | Invariant & Flow Testing | Comprehensive test suite `backend/scripts/test_fast_outward_workflows.js` (20/20 tests passed). |

---

## 3. Automated Test Results
- `test_fast_outward_workflows.js`: **20/20 PASS**
- `test_complete_store_user_lifecycle_flow.js`: **23/23 PASS**
- Frontend Production Build: **0 Errors / Compiled Successfully**
