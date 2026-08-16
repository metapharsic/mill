# MK Paper Mill ERP — Documentation Index

> **AI INSTRUCTION:** Read these docs IN ORDER (01 -> 24) before writing any code.
> Start with 01_ARCHITECTURE.md. This gives you ~80% of what you need to write correct code.
> Then check the relevant module in /modules/ for module-specific rules.

---

## Core Docs (Read in this order)

| # | File | Purpose | Read When |
|---|---|---|---|
| 01 | [01_ARCHITECTURE.md](01_ARCHITECTURE.md) | System overview, tech stack, constraints | **ALWAYS — read first** |
| 02 | [02_DEPENDENCY_MAP.md](02_DEPENDENCY_MAP.md) | All packages and env vars | Adding packages, checking what exists |
| 03 | [03_DATABASE_SCHEMA.md](03_DATABASE_SCHEMA.md) | Full DB table reference | Writing any DB queries |
| 04 | [04_API_CONTRACTS.md](04_API_CONTRACTS.md) | All API endpoints | Adding/modifying APIs |
| 05 | [05_WORKFLOWS.md](05_WORKFLOWS.md) | End-to-end business process flows | Building features that cross modules |
| 06 | [06_MODULE_CATALOG.md](06_MODULE_CATALOG.md) | Module inventory and routing | Navigating the codebase |
| 07 | [07_BUSINESS_ROLES.md](07_BUSINESS_ROLES.md) | Auth, permissions, role matrix | Any auth/permission logic |
| 08 | [08_DECISION_LOG.md](08_DECISION_LOG.md) | Why decisions were made | Before proposing architectural changes |
| 09 | [09_CODING_STANDARDS.md](09_CODING_STANDARDS.md) | Code style rules | Before writing any code |
| 10 | [10_LOG_TOOL_MAP.md](10_LOG_TOOL_MAP.md) | Logging, monitoring, debug tools | Debugging, troubleshooting |
| 11 | [database/11_MIGRATION_SEQUENCE.md](database/11_MIGRATION_SEQUENCE.md) | PostgreSQL migrations sequence | Creating new tables or columns |
| 12 | [frontend/12_FRONTEND_COMPONENT_MAP.md](frontend/12_FRONTEND_COMPONENT_MAP.md) | Component, page & state map | Developing or altering frontend pages |
| 13 | [reference/13_INTEGRATION_MAP.md](reference/13_INTEGRATION_MAP.md) | Shared tables & event-flow map | Coordinating actions between modules |
| 14 | [reference/14_MASTER_DATA_REFERENCE.md](reference/14_MASTER_DATA_REFERENCE.md) | Lookups, roles, and numbers dictionary | Referencing codes, categories, formats |
| 15 | [reference/15_KAFKA_EVENTS_CATALOG.md](reference/15_KAFKA_EVENTS_CATALOG.md) | Event broadcast topics and payloads | Modifying data mutating API endpoints |
| 16 | [reference/16_NOTIFICATION_SYSTEM.md](reference/16_NOTIFICATION_SYSTEM.md) | In-app notification triggers and API | Implementing user notifications or cron alerts |
| 17 | [security/17_SECURITY_MODEL.md](security/17_SECURITY_MODEL.md) | Auth tokens, levels & PII masking | Working with authentication or HR details |
| 18 | [reference/18_MODULE_DEPENDENCY_TREE.md](reference/18_MODULE_DEPENDENCY_TREE.md) | Granular code import & route tree | Refactoring modules or checking imports |
| 19 | [reference/19_COMMON_PITFALLS_AND_GOTCHAS.md](reference/19_COMMON_PITFALLS_AND_GOTCHAS.md) | Common development gotchas & pitfalls | Debugging, auditing database/connection leaks |
| 20 | [reference/20_MODULE_CONTRACTS.md](reference/20_MODULE_CONTRACTS.md) | Core module data & event contracts | Restructuring module limits, events, payloads |
| 21 | [reference/21_DEPLOYMENT_GUIDE.md](reference/21_DEPLOYMENT_GUIDE.md) | PM2, Nginx, and database backup playbook | Configuring production hosting environments |
| 22 | [reference/22_TESTING_STRATEGY.md](reference/22_TESTING_STRATEGY.md) | E2E Selenium & role smoke test checklists | Verifying stability and permissions post-deploy |
| 23 | [reference/23_PRODUCT_ROADMAP.md](reference/23_PRODUCT_ROADMAP.md) | Short & long-term development milestones | Planning new features or integrations |
| 24 | [reference/24_DEVELOPER_DEBUGGING_CHECKLIST.md](reference/24_DEVELOPER_DEBUGGING_CHECKLIST.md) | Developer debugging step sequence | Troubleshooting DB, API, UI, or Kafka events |

---

## Module-Specific Docs (`/modules/`)

Each module folder contains a `WORKFLOW.md` with module-specific rules, tables, and patterns.

| Module | Folder | Key Rules |
|---|---|---|
| Production | [modules/production/](modules/production/WORKFLOW.md) | Reel lifecycle, DPS import |
| Quality | [modules/quality/](modules/quality/WORKFLOW.md) | Test params, L3+ approve |
| Maintenance | [modules/maintenance/](modules/maintenance/WORKFLOW.md) | CMMS, bearing checks, photo uploads |
| Inventory | [modules/inventory/](modules/inventory/WORKFLOW.md) | GRN flow, stock ledger |
| Indent / PIIMAS | [modules/indent/](modules/indent/WORKFLOW.md) | **requireStore + store_indent_log** |
| Store | [modules/store/](modules/store/WORKFLOW.md) | Stock deduction rules |
| Purchase | [modules/purchase/](modules/purchase/WORKFLOW.md) | PO flow, vendor rules |
| Sales | [modules/sales/](modules/sales/WORKFLOW.md) | SO lifecycle, dispatch |
| HR & Payroll | [modules/hr/](modules/hr/WORKFLOW.md) | is_hr_admin, payroll flow |
| Finance | [modules/finance/](modules/finance/WORKFLOW.md) | L4+ payment confirm |
| Utility | [modules/utility/](modules/utility/WORKFLOW.md) | Readings, ETP compliance |
| Laboratory | [modules/laboratory/](modules/laboratory/WORKFLOW.md) | Chemical tests |
| EHS | [modules/ehs/](modules/ehs/WORKFLOW.md) | Incidents, compliance |
| Security | [modules/security/](modules/security/WORKFLOW.md) | Gate log, visitor tracking |
| Chemicals | [modules/chemicals/](modules/chemicals/WORKFLOW.md) | requireStore, dosing |
| Scrap | [modules/scrap/](modules/scrap/WORKFLOW.md) | Scrap types, disposal |
| FG Warehouse | [modules/warehouse/](modules/warehouse/WORKFLOW.md) | Rack locations, FIFO |
| Reports | [modules/reports/](modules/reports/WORKFLOW.md) | Report types, formats |
| Admin | [modules/admin/](modules/admin/WORKFLOW.md) | L5 only, soft deletes |
| Plant Sections | [modules/sections/](modules/sections/WORKFLOW.md) | KPI cron, alarms |
| DPS Import | [modules/dpsImport/](modules/dpsImport/WORKFLOW.md) | Ingestion parameters, date & running hours conversion |
| Telemetry & SCADA | [modules/telemetry/](modules/telemetry/WORKFLOW.md) | Process sensors, vacuum correlation, boiler efficiency |

---

## Quick Reference

### The 7 Non-Negotiable Rules
1. `requireStore` on all stock-deduction routes
2. `store_indent_log` in same transaction as indent state change
3. Run `codegraph_impact` before editing any function
4. Never string-concatenate SQL — always parameterized
5. Never hard-delete users/materials — use `is_active=false`
6. JWT_SECRET >= 32 chars in production
7. Never create new pg Pool — always import from `db/pool.js`

### Key File Locations
| What | Where |
|---|---|
| DB pool | `backend/src/db/pool.js` |
| Auth middleware | `backend/src/middleware/auth.js` |
| All routes mounted | `backend/src/server.js` |
| Frontend routing | `frontend/src/App.jsx` |
| Permissions/nav | `frontend/src/data/permissions.js` |
| DB schema baseline | `db/schema.sql` |
| Migrations | `db/migration_*.sql` |

### Role Level Quick Check
| Level | Role | Key Power |
|---|---|---|
| 1 | Operator | View + Enter |
| 2 | Supervisor | + L1 Approve |
| 3 | Manager | + L2 Approve, PO Create |
| 4 | Plant Head | + L3 Approve, Payment |
| 5 | Admin | Everything |

---

*Documentation created: 2026-07-17*
*Update these docs when making significant changes to the system.*
