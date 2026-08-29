# 2026-08-29 — Store.jsx DC-based invoice-match refinement

## Request (from a handwritten note on a Store.jsx screenshot)
"When we receive the invoice we should take a DC number and party name for
reference. Only stock (qty) should be view-only, rates should be edit-only,
and for every DC we select via tick mark. Then we enter only value and tax
amount to match the invoice qty and value."

## What existed before this
`frontend/src/pages/Store.jsx`'s Inward modal had a "Ref Document" dropdown
(PO# / Invoice / DC# / Gate Pass) where picking "DC" just swapped in a plain
free-text `reference_id` input — no real DC entity, no tick-mark selection,
no editable pricing. The PO-based batch-inward table (the same screen area)
had Qty editable but Unit Rate/Disc%/GST% permanently read-only — the exact
inverse of what the user's paper process needs. Separately, an unrelated
earlier session this same day had built a full `inbound_dc` /
`inbound_dc_items` backend (`backend/src/routes/inboundDc.js`) plus a
standalone `frontend/src/pages/InboundDC.jsx` page for a "receive now, match
invoice later" workflow — migration not yet run, page not yet used.

## Decision: build this into Store.jsx, backed by `inbound_dc`
The user chose to fix the existing Store.jsx screen rather than adopt the
separate InboundDC.jsx page. The `inbound_dc` table (status `received` =
goods physically in but invoice not yet matched) is exactly the paper pile
the user tick-marks against an invoice, so it was used as the backing data
source instead of PO items — a much better fit than trying to bolt tick-mark
multi-select onto the PO-locked batch grid.

## Changes

**frontend/src/pages/Store.jsx**
- New state: `inboundDcs`, `dcDetails`, `dcTicked`, `dcLineEdits`,
  `dcPartyName`, `dcInvoiceNumber`, `dcInvoiceTotal`, `dcMatching`.
- `loadOpenInboundDcs()` fetches `GET /inbound-dc?status=received` then the
  full item detail of each; defaults each line's editable rate to the
  material catalog price (0 disc, 0 tax amount) as a starting point only.
- New card rendered when Ref Document = "DC #": Party Name + Vendor Invoice
  Number + Invoice Total (₹) inputs, then a table of every open DC's items —
  a tick-mark checkbox per DC (row-spanned across its lines), Qty rendered
  view-only, Unit Rate / Disc% / Tax Amount as editable number inputs, and a
  per-line computed value. A footer shows the live computed total across
  ticked lines with a green "✓ Matches Invoice" / red "✕ Mismatch" pill
  against the entered Invoice Total (tolerance ₹1), plus the submit button.
- `handleMatchAndCreateGrn()` loops the ticked DC ids, calling
  `POST /inbound-dc/:id/match-invoice` then `POST /inbound-dc/:id/grn` for
  each, sending the edited rate/disc/tax-amount per line as overrides.
- Verified with `@babel/parser` (no bundler available in this sandbox —
  esbuild's binary is the wrong platform) — parses clean.

**backend/src/routes/inboundDc.js**
- `POST /:id/match-invoice` now also accepts and stores `party_name` and
  `invoice_total` (both optional, `COALESCE`d so re-matching doesn't clobber
  an existing value with a blank).
- `POST /:id/grn` now accepts `items: [{ id, unit_price, discount_pct,
  gst_amount }]` (keyed by `inbound_dc_items.id`) and `party_name`. When an
  override is present for a line it is used as the authoritative
  post-invoice-match figure instead of the stale catalog `unit_price`;
  falls back to catalog price / 0 disc / 0 tax only when no override is
  sent, so the original no-invoice-yet behaviour still works untouched.
  `grn_items` insert now also writes `discount_pct` and a back-derived
  `gst_pct` (from the entered tax amount ÷ taxable value) alongside the
  existing `taxable_amount`/`total_amount`.
- `party_name` has **no column on `grn`** — checked the live INSERT column
  lists in `purchase.js`, `store.js`, `inventory.js`, and `dev.js` before
  writing this, none has it. Rather than invent an unverified schema change,
  it's folded into `grn.remarks` as `Party Name: <x> | <existing remarks>`;
  the durable copy lives on `inbound_dc.party_name`.

**backend/scripts/migrate_inbound_dc.js** (still NOT run against the DB)
- Amended (not a new script — the original migration for this table had
  never been run yet either, so extending it in place avoids a second
  migration for the same not-yet-existing table) to add `party_name TEXT`
  and `invoice_total NUMERIC(14,2)` to `inbound_dc`, both via the same
  `ADD COLUMN IF NOT EXISTS` idempotent pattern already used for
  `matched_by`/`matched_at`.

**Projects_Requirement/inbound_dc_workflow.md** — appended a "Refinement"
section describing this change and its InboundDC.jsx redundancy note.

## Verification
- `node --check` on `migrate_inbound_dc.js` and `inboundDc.js` — pass.
- `@babel/parser` parse of the full `Store.jsx` — pass (no live dev server
  or bundler available in this sandbox to actually render the modal).
- No live DB access from this sandbox (`ECONNREFUSED 127.0.0.1:5432`), same
  limitation as every other backend change this session — migration and
  route behaviour are logic-verified only, not run against real data.

## Now-likely-redundant: `frontend/src/pages/InboundDC.jsx`
Its "Pending Invoice Match" and "Matched — Ready for GRN" tabs duplicate what
Store.jsx now does inline. Its "Receive DC" tab (creating a DC + provisional
stock bump) is still the only place that action happens, so the page isn't
fully dead. Left in place, App.jsx/Sidebar.jsx/permissions.js wiring
untouched — flagged for the user to decide whether to remove it.

## Still open
1. Run the (updated, still unrun) `node backend/scripts/migrate_inbound_dc.js`
   against the real DB, then restart the backend.
2. Rebuild/redeploy the frontend.
3. User decision: keep or remove `InboundDC.jsx` (and its nav/route entries)
   now that its match/GRN tabs are superseded.
