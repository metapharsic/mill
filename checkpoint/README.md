# Checkpoint History

Dated status snapshots, human-readable. The live machine-readable file the app itself
reads (`GET /api/dev/progress`) stays at the repo root: `../checkpoint.json` — don't
move it, server.js has that path hardcoded. This folder is the readable trail behind it;
add one file per significant session, don't overwrite old ones.

| Date | File | Summary |
|---|---|---|
| 2026-08-13 | [2026-08-13.md](./2026-08-13.md) | DB restore, port/env fixes, full-stack audit + fixes, hardcode audit + fixes, store workflow wiring, Mechanical sub-categorization + excel sync |
| 2026-08-20 | [2026-08-20.md](./2026-08-20.md) | Daily Stock Rollover engine, physical stock sync, Store Assistant role, sorting/sliding UI, searchable-dropdown rollout close-out, GRN/Indent edit-capability fixes, vendor CRUD verified + excel import tooling, a deep re-audit of the rollover + PR-PO-GRN-stock sync (4 bugs found), then a strict chain validation of Gate Pass/QC/AP Settlement (7 more bugs found, incl. QC double-counting stock and bills defaulting to full PO value) |
