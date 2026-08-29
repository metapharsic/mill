# 2026-08-29 — Inbound DC + Invoice Match: test coverage

## Request
Add Playwright E2E test(s), backend unit tests, integration tests, test
artifacts (trace/screenshot/HTML report), and a "db sync" check for the
Inbound DC + Invoice Match feature built earlier the same day (commits on
top of `adde1b6`), without touching any file another concurrently-editing
agent was known to own: `checkpoint.json` (edited locally only, not staged),
`e2e/pages/*.js` and `e2e/specs/*.spec.js` (existing files), `Quality.jsx`,
`Reports.jsx`, `playwright.config.js`, `pull_logs/`.

## What was built

**Playwright E2E** — `e2e/pages/InboundDcPage.js` (new page object, imports
`BasePage`/existing pattern, doesn't touch `LoginPage.js`/`StorePage.js`)
and `e2e/specs/inbound_dc_invoice_match.spec.js` (new spec, 5 test cases):
card renders on Ref Document = "DC #", table-or-empty-state fallback,
tick+edit+matching total shows the green pill, a deliberately wrong total
shows the red pill, and submit exercises the two real network calls
(`match-invoice`, `grn`) and asserts they succeed. Tests needing a live
`status='received'` DC self-skip with a clear message rather than failing
in environments with no such row. Confirmed `playwright.config.js`'s
`testDir: './e2e/specs'` has no `testMatch` restriction, so the new spec is
picked up automatically — no config edit was needed or made.

**Backend unit tests** — extracted the DC line-total / match-comparison
formula (previously copy-pasted between Store.jsx's client preview and
`inboundDc.js`'s GRN route) into a new pure module
`backend/src/utils/dcInvoiceMatch.js` (`computeLineValue`,
`computeSelectedTotal`, `compareToInvoiceTotal`), wired it into
`inboundDc.js`'s `POST /:id/grn` in place of the inline formula (same
output, now shared/tested), and wrote
`backend/scripts/test_dc_invoice_match_unit.js` — 13 cases, plain
`node:assert` (no jest/mocha/vitest exists anywhere in this repo; every
other `backend/scripts/test_*.js` already uses this same convention). Ran
it here: **13 passed, 0 failed**.

**Integration / "db sync" test** —
`backend/scripts/test_inbound_dc_integration.js`: connects via the same
`pool` pattern as other scripts, verifies every column
`migrate_inbound_dc.js` is supposed to add actually exists on `inbound_dc`
/ `inbound_dc_items` (the requested "db sync" check), then exercises the
receive→match→grn SQL lifecycle (stock bump, ledger insert, status
transitions, GRN creation, provisional→grn ledger re-tag, no duplicate
ledger row) — entirely inside one transaction that is unconditionally
rolled back, so it is safe on a shared DB and leaves nothing behind. This
sandbox has no DB (`ECONNREFUSED`, exit 0, no assertions run) — syntax
checked only; user runs it for real where Postgres is reachable.

**Artifacts** — already fully enabled by the existing (untouched)
`playwright.config.js`: `trace: 'retain-on-failure'`, `screenshot:
'only-on-failure'`, `video: 'retain-on-failure'`, `html` reporter to
`playwright-report/`. Documented the CLI flags to force them on
every run instead of editing the shared config.

**Docs** — appended a "Testing" section to
`Projects_Requirement/inbound_dc_workflow.md` with run commands for all
three layers and what the db-sync check verifies. Appended one `openItems`
entry to `checkpoint.json` (local file edit only — never staged/committed,
per instruction).

## Bug found and fixed
`Store.jsx` defined `loadOpenInbounDcs` (line 926, missing a "d") but the
`useEffect` gating on `reference_type === 'DC'` called
`loadOpenInboundDcs()` — a `ReferenceError` on every attempt to populate the
match card, meaning the feature as originally committed could never
actually load any DC to tick. Fixed with a one-line rename so the new E2E
tests (and the real feature) can function. Also noted, not fixed: the
submit button's loading-state label is `'Processing₦'` (stray currency
glyph, likely meant `'Processing…'`) — cosmetic, flagged in the docs
Testing section, left for a human call.

## Files touched
- NEW `e2e/pages/InboundDcPage.js`
- NEW `e2e/specs/inbound_dc_invoice_match.spec.js`
- NEW `backend/src/utils/dcInvoiceMatch.js`
- NEW `backend/scripts/test_dc_invoice_match_unit.js`
- NEW `backend/scripts/test_inbound_dc_integration.js`
- EDIT `backend/src/routes/inboundDc.js` (GRN route now calls the shared
  `computeLineValue` helper instead of an inline duplicate formula; same
  output)
- EDIT `frontend/src/pages/Store.jsx` (one-line typo fix, line 926)
- EDIT `Projects_Requirement/inbound_dc_workflow.md` (appended Testing
  section)
- EDIT `checkpoint.json` (local only, not staged/committed)

Nothing in the off-limits list (`checkpoint.json` git-tracking,
`e2e/pages/*.js` existing files, `e2e/specs/*.spec.js` existing files,
`Quality.jsx`, `Reports.jsx`, `playwright.config.js`, `pull_logs/`,
`*_to_delete_write_test*`) was staged, committed, or destructively
modified.
