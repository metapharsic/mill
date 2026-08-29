# 2026-08-29 — Indent edit data-loss fix + backdate investigation

## Request
"PO,PR,GRN, Indent, ETC is not saving the updated item, infact modified
one are saving. and enable me to update the above items for back dated
aswell."

## Investigation across PO / Indent / GRN
- **PO**: already fixed earlier this session (commit 529c33f) -- correct
  end-to-end now, edited existing items save properly.
- **GRN** (`purchase.js` + `store.js` PUT handlers): already does proper
  UPDATE-in-place matched by id/material_id. No bug found.
- **Indent** (`indent.js` `PUT /:id`): found the SAME class of bug as the
  pre-fix PO route -- `DELETE FROM indent_items` then re-INSERT everything,
  not carrying forward `issued_qty`, `ack_status`, `batch_no` for lines
  that already existed. Status gating (blocked once Issued/Closed/
  Rejected/Cancelled) limits today's practical blast radius, but this is
  exactly the kind of bug that matches "updated item not saving correctly"
  once any edit touches an indent that already had partial issue/ack
  activity.

## Fix
Applied the same carry-forward-by-`material_id` pattern used in the PO fix:
snapshot existing `issued_qty`/`ack_status`/`batch_no` before the delete,
carry them into the re-inserted rows. `node --check` passed.

## Backdating
Checked thoroughly: NOTHING in the code blocks past dates on PO, Indent,
or GRN updates today -- no `min=` attribute on any date input in
Purchase.jsx/Indent.jsx/Store.jsx, no backend validation rejecting a past
date anywhere in purchase.js/indent.js/store.js. Backdating already works
as-is. If the user is still hitting a block somewhere in the actual UI,
that needs a specific screen/error reproduced to investigate further --
nothing found via code review.

## Verification
- Commit `0874036` on top of `0f014fa`, only `backend/src/routes/indent.js`
  touched.
- Confirmed the other agent's in-progress files (checkpoint.json, e2e/*,
  Quality.jsx, Reports.jsx, playwright.config.js, pull_logs/,
  _to_delete_write_test*) remained untouched.

## Still needed from user
- **Restart the backend** for the indent.js fix to take effect (no hot
  reload).
- If backdating is still blocked somewhere specific, point to the exact
  screen/field/error message so it can be pinned down precisely.
- Push from own machine.
