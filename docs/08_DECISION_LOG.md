# MK Paper Mill ERP — Decision Log

> Records key architectural and design decisions, their rationale, and trade-offs.
> Add entries when making significant decisions — helps future AI and developers understand "why" not just "what".

---

## Decision Format

```
## [DEC-NNN] Title
- **Date:** YYYY-MM-DD
- **Decision:** What was decided
- **Context:** Why this decision was needed
- **Alternatives Considered:** Other options evaluated
- **Rationale:** Why this option was chosen
- **Consequences:** Trade-offs, limitations, follow-on work
```

---

## Decisions

### [DEC-001] No ORM — Raw pg Queries
- **Date:** Project start
- **Decision:** Use raw `pg` Pool queries instead of an ORM (Prisma/Sequelize/TypeORM)
- **Context:** ERP with complex multi-join queries, custom aggregations, and performance-critical paths
- **Alternatives Considered:** Prisma, Sequelize
- **Rationale:** Full SQL control needed for complex joins (reel+shift+grade+machine+quality in one query). ORMs add abstraction overhead and make complex aggregation queries harder to optimize.
- **Consequences:** All queries must be manually parameterized. Migrations managed via raw SQL files.

---

### [DEC-002] State-Based Routing (No URL Routing)
- **Date:** Project start
- **Decision:** Single `active` state in App.jsx instead of React Router URL-based navigation
- **Context:** SPA with sidebar navigation where all routes are behind auth
- **Alternatives Considered:** react-router URL routes (`/production`, `/hr`, etc.)
- **Rationale:** Simplifies auth guard (single component wrap), avoids direct URL access to protected pages, easier to manage active state for sidebar highlighting
- **Consequences:** Browser back/forward button does not work for navigation. No deep linking to specific module pages. Page refresh always returns to dashboard.

---

### [DEC-003] In-Memory Rate Limiting
- **Date:** Phase B
- **Decision:** Use in-memory `Map` for auth rate limiting instead of Redis
- **Context:** Brute force protection on `/api/auth/login`
- **Alternatives Considered:** `express-rate-limit` with Redis, `rate-limiter-flexible`
- **Rationale:** No additional infrastructure (Redis) required for single-server deployment. 50 attempts per IP per 15 min is sufficient for internal use.
- **Consequences:** Rate limit state resets on server restart. Does not work across multiple server instances (horizontal scaling). Accept these limitations for single-server deployment.

---

### [DEC-004] Inline Styles on Frontend
- **Date:** Project start
- **Decision:** Use JavaScript style objects (inline styles) on all React components
- **Context:** Choosing a styling approach for the SPA
- **Alternatives Considered:** Tailwind CSS, CSS Modules, styled-components, plain CSS files
- **Rationale:** Zero build configuration, no CSS specificity conflicts, component styles are co-located and self-documenting. Works with Vite without additional plugins.
- **Consequences:** Verbose component code. No CSS hover states (must use JS event handlers). Some CSS features (media queries, pseudo-elements) require alternative implementation.

---

### [DEC-005] JWT with 8-Hour Expiry (No Refresh Tokens)
- **Date:** Project start
- **Decision:** Single JWT access token, 8-hour expiry, no refresh token
- **Context:** Auth token strategy for shift-based factory workers
- **Alternatives Considered:** Short-lived access token + refresh token pair
- **Rationale:** Factory shifts are typically 8-12 hours. A single 8h token covers one shift. No need for complex refresh logic. Workers log in at shift start, session expires at shift end.
- **Consequences:** Token cannot be revoked without server-side session tracking. If token is stolen, attacker has up to 8h of access. Mitigated by HTTPS and internal network only.

---

### [DEC-006] requireStore Middleware (Store Access Guard)
- **Date:** Post-Phase 7
- **Decision:** All stock deduction routes MUST use `requireStore` middleware
- **Context:** Preventing unauthorized stock deductions — a major audit risk
- **Alternatives Considered:** Role-level check only (L3+)
- **Rationale:** Stock deductions should be restricted to the STORE department regardless of role level. A Manager in Production dept should not be able to issue materials from store.
- **Consequences:** New stock-deduction routes MUST explicitly add `requireStore`. This is enforced via AGENTS.md rule. Failure to add it is a security bug.

---

### [DEC-007] store_indent_log in Same Transaction
- **Date:** Phase 7
- **Decision:** Every indent state change that deducts stock must write to `store_indent_log` in the same DB transaction
- **Context:** Auditability of material movements — regulatory compliance
- **Alternatives Considered:** Async log after state change
- **Rationale:** If the log write fails after the state change commits, we have phantom stock deductions with no audit trail. Atomic transaction ensures both succeed or both fail.
- **Consequences:** Slightly slower (two writes in one tx). Much higher data integrity.

---

### [DEC-008] PIIMAS Escalation as Cron (Not Event-Driven)
- **Date:** Phase 7
- **Decision:** Run PIIMAS escalation every 2 hours via `setInterval` instead of event-driven notifications
- **Context:** Notifying dept heads when indent acks are overdue
- **Alternatives Considered:** Kafka event on indent status change, WebSocket push
- **Rationale:** Simpler implementation. Kafka is optional infrastructure. The 2h polling delay is acceptable for factory context (supervisors check in twice per shift).
- **Consequences:** Notifications may be delayed up to 2 hours. Duplicate notification guard (24h check) prevents spam.

---

### [DEC-009] Lucide React as Only Icon Library
- **Date:** Project start
- **Decision:** Only `lucide-react` for icons, no FontAwesome/Material Icons
- **Context:** Icon library selection for React SPA
- **Alternatives Considered:** FontAwesome, Material Icons, React Icons (bundled multi-library)
- **Rationale:** Tree-shakeable, consistent style, small bundle size, React-native (JSX).
- **Consequences:** If a specific icon isn't in lucide-react, use SVG or rethink the UI element rather than adding another library.

---

### [DEC-010] PostgreSQL Connection Pool Max=20
- **Date:** Project start
- **Decision:** pg Pool with `max: 20` connections
- **Context:** Single PostgreSQL server, single Node.js process
- **Rationale:** 20 connections is sufficient for typical concurrent request load on a factory ERP with <100 simultaneous users. High enough to not queue, low enough to not exhaust Postgres limits.
- **Consequences:** Under heavy load (e.g., bulk import), connection pool may queue. Monitor via Prometheus metrics.

---

### [DEC-011] Kafka as Optional Infrastructure
- **Date:** Project start
- **Decision:** Kafka integration is optional — system works without Kafka
- **Context:** Event streaming for real-time features
- **Rationale:** Not all deployment environments have Kafka. Core ERP functionality must work without it.
- **Consequences:** Kafka-dependent features (real-time telemetry streaming) degrade gracefully to polling when Kafka is unavailable.

---

### [DEC-012] must_change_password Force Gate
- **Date:** Phase B (security hardening)
- **Decision:** Server-side enforcement of password change for new/reset accounts
- **Context:** Security requirement — default/reset passwords must not be used
- **Rationale:** Client-side only gate can be bypassed. Server must block all API calls (except allowlisted 3 routes) when `must_change_password=true`.
- **Consequences:** Users with temp passwords are completely locked out until they change it. This is intentional.

---

## Pending Decisions

| ID | Topic | Status |
|---|---|---|
| DEC-P01 | Multi-server deployment strategy | Needs decision before scaling |
| DEC-P02 | Database backup strategy | Needs formalization |
| DEC-P03 | Telemetry: real-time WebSocket vs polling | Under evaluation |
| DEC-P04 | Mobile app strategy | Under discussion |

---

*Last updated: 2026-07-17 | Add new decisions as they are made*
