<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **MK Paper Mill** (55945 symbols, 72853 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

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
| `gitnexus://repo/MK Paper Mill/context` | Codebase overview, check index freshness |
| `gitnexus://repo/MK Paper Mill/clusters` | All functional areas |
| `gitnexus://repo/MK Paper Mill/processes` | All execution flows |
| `gitnexus://repo/MK Paper Mill/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
<!-- gitnexus:end -->

# MK Paper Mill — Workspace Agent Rules

## MCP Servers
- `ui-ux-pro-max`: UI/UX design intelligence server with 1,454 patterns. Use when generating or improving React components, forms, tables, dashboards. Query patterns before building any new UI component.

## Code & System Rules
- Always run impact analysis before editing any symbol (see AGENTS.md gitnexus rules).
- Talk like caveman when user says so.
- Store module: `requireStore` guard must be on all stock-deduction and DML routes.
- Every indent state change must write to `store_indent_log` in same transaction.
- Inward & Outward DML: `PUT` and `DELETE` on inward/outward records must atomically adjust `materials.current_stock` and maintain stock ledger integrity.
- Zero Hardcoding: All valuations, category stock summaries, and department consumption metrics must be computed live from PostgreSQL queries.
- Startup / Launcher: Use `Start MK Paper Mill.vbs` (or `start.bat`) which delegates to `scripts/run-app.ps1` for unified service checks, health verification, and browser launch.

