<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **mill** (5103 symbols, 9081 relationships, 252 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/mill/context` | Codebase overview, check index freshness |
| `gitnexus://repo/mill/clusters` | All functional areas |
| `gitnexus://repo/mill/processes` | All execution flows |
| `gitnexus://repo/mill/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

---

## Machine & Section Specifications

Full per-section equipment specs, operating parameters, instrumentation, and safety requirements:
`Documentation/22_Machine_Specifications_Master.md`

Covers all 21 sections (PULP → COMPRESSORS) + Store, with:
- Equipment tag registry (`{SECTION_CODE}-{TYPE}-{NNN}`)
- Operating parameter ranges per section
- KPI targets mapped to `section_kpi_snapshots.kpi_data` keys
- Controls, instrumentation, utilities, safety per section
- Universal spec fields all `section_equipment` rows must capture

See also `.cursorrules` §28 for condensed quick-reference table.

---

## HRMS Module (Ph16)

Full spec + DB schema + API routes + payroll engine:
`Documentation/23_HRMS_Complete.md`

**Role matrix (HRMS):**
- L5 Admin / `dept_code='HR' && L3+` (HR Admin) → full HRMS superuser
- L4 Plant Head → approve payroll, read all
- L3 Dept Head → own dept only: leaves, attendance, appraisal
- L2 Supervisor → mark attendance, view team
- L1 Employee → self-service: own payslip, leave, attendance

**Key guard pattern in `routes/hr.js`** (no named middleware — logic inlined per-route, ~6 call sites, consistent semantics):
- HR Admin check: `isHRAdmin = req.user.dept_code==='HR' && role_level>=3` OR `role_level>=4`
- Dept-or-HR access: L3+ dept head (own dept) OR HR Admin OR L4+
- Dept isolation: all list queries auto-filter `department_id` unless `canSeeAll`
- Payroll approval: `requireLevel(4)` minimum — HR Admin cannot approve own payroll
- `req.user.emp_id` is the field populated by auth middleware (not `employee_id` — that key doesn't exist on `req.user`)

**Phase:** Ph16-A through Ph16-L. Build after Ph15 Plant Sections.
**Migration:** `db/migration_hrms_ph16.sql`
**Cursorrules section:** §29 HRMS MODULE

---

## Checkpoint Auto-Update Rule

**MUST update `checkpoint.json` at the end of every work session that changes any of:**
- A phase status (core, feature, deploy)
- A migration (applied or created)
- A backend route file (new endpoints, bug fixes)
- A frontend page or component (new features, status changes)

### How to update

1. Set `lastDone.date` to today's date (ISO format).
2. Set `lastDone.summary` to one concise sentence covering what changed this session.
3. For each phase touched: update `status` (`"done"` / `"in_work"` / `"proposed"`) and ensure it matches `phaseStatus.js`.
4. For each migration applied: add entry to `migrations[]` array with `"status": "done"`.

### Keep phaseStatus.js in sync

After updating `checkpoint.json`, also update `frontend/src/data/phaseStatus.js`:
- Match `status` field: `"Done"` / `"In Work"` / `"Planned"`
- Match `progress` (0–100)
- Update `summary` and `items[]` to reflect what actually shipped

### Rule

Never finish a session without doing both updates. If checkpoint is stale, fix it before moving on.
