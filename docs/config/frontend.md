# Frontend — React / Vite

- **Framework:** React 18
- **Bundler/dev server:** Vite
- **Home:** `frontend/`
- **Dev port:** `5173` (Vite default) → http://localhost:5173
- **API base:** `/api` (calls hit backend on `:5000`; dev proxy or same-origin in prod)
- **Auth token:** `localStorage['mk_token']` sent as `Authorization: Bearer …`

## Build / run

| Action | Command (in `frontend/`) |
|--------|--------------------------|
| Dev server | `npm run dev` |
| Production build | `npm run build` → `frontend/dist/` |
| Preview build | `npm run preview` |

In production the backend serves `frontend/dist` statically (`server.js`, when
`NODE_ENV=production`), so the SPA and API share origin `:5000`.

## Structure

- `src/App.jsx` — shell + `renderPage` router (page key → component)
- `src/components/Sidebar.jsx` — nav (`NAV` array, grouped) + phase-status panel
- `src/pages/*.jsx` — one page per module (Production, HR, Store, DailyReport, …)
- `src/context/AuthContext` — user/session; `src/data/permissions` — `filterNav`

## How to modify
- **Add a page/tab:** add page component in `src/pages/`, register route in
  `App.jsx renderPage`, add a `NAV` entry in `Sidebar.jsx`, gate via `permissions`.
- **Change API base / proxy:** `vite.config.js` (dev proxy) / same-origin in prod.

## Change log
- 2026-07-05 — DailyReport page added (assembled report + autofill guard).
