# 2026-08-29 — Robust pull script with audit logging (client-server sync issue)

## Request
"on the client server, pulling from GitHub is not syncing properly. can i
see the logs of applied changes. i want 100% accuracy when pulling."

## Root cause
This machine has 13 tracked files sitting locally MODIFIED but uncommitted
right now (`checkpoint.json`, `e2e/pages/*.js` x6, `e2e/specs/*.spec.js`
x3, `frontend/src/pages/Quality.jsx`, `frontend/src/pages/Reports.jsx`,
`playwright.config.js`) -- the other concurrently-active agent/dev's
in-progress work, correctly left untouched here. Confirmed at least two of
those files (`playwright.config.js`, `Reports.jsx`) have active recent
upstream commit history. The moment origin advances on any of those same
files while local edits sit uncommitted, `git pull` either hard-refuses or
silently produces a confusing merge -- that mechanism, not a network/git
bug, is what "not syncing properly" actually is.

## Fix
Rewrote the pull tooling:
- `pull_from_github.bat` is now a 2-line wrapper calling
  `pull_from_github.ps1` (PowerShell, still launched by double-click, no
  extra install needed on Windows 10/11).
- The script REFUSES to pull at all if `git status` shows anything
  uncommitted -- prints the exact file list and 3 remediation options
  (commit / `git checkout --` / `git stash`).
- If clean: fetches, prints+logs the exact incoming commit list
  (`git log --oneline HEAD..origin/main`) BEFORE pulling.
- Tries `git pull --ff-only` first, falls back to a regular pull only if
  needed, and says which happened.
- After pulling, prints+logs `git diff --stat` of exactly what changed.
- Every run writes a permanent timestamped log to
  `pull_logs\pull_<date>_<time>.log` (folder gitignored) -- this is the
  "logs of applied changes" the user asked for, kept forever, reviewable
  any time.

## Verification
- `git fetch origin`, confirmed no divergence before commit.
- Committed only `pull_from_github.bat`, `pull_from_github.ps1`,
  `.gitignore`. Confirmed all 13 in-progress files untouched before/after.
- Commit: `a70dc4f` on top of `4742356`.

## Still needed from user
- Resolve (commit, discard, or stash) the 13 pending uncommitted files on
  the client server soon -- until then, the NEW script will correctly
  refuse every pull attempt. That's the fix working as intended, not a
  new problem.
- Push this fix from your own machine (as always, this sandbox has no
  GitHub credentials).
