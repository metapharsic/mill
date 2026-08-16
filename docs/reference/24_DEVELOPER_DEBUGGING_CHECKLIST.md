# MK Paper Mill ERP — Developer Debugging Checklist

> **AI INSTRUCTION:** Read this when debugging a system failure, implementing integration tests, 
> or diagnosing database / communication issues. Do not skip steps.

---

## 🛠️ Step-by-Step Diagnostic Sequence

```
 📊 DIAGNOSTIC FLOW
 ┌──────────────────────┐
 │ 1. Test Database     │ ◄─── node backend/check-db.js
 └──────────┬───────────┘
            ▼
 ┌──────────────────────┐
 │ 2. Test API Directly │ ◄─── curl -I -H "Authorization: Bearer..."
 └──────────┬───────────┘
            ▼
 ┌──────────────────────┐
 │ 3. Inspect Network   │ ◄─── DevTools Network Tab (Status/JSON)
 └──────────┬───────────┘
            ▼
 ┌──────────────────────┐
 │ 4. Verify Kafka Bus  │ ◄─── node backend/broadcast_now.js
 └──────────┬───────────┘
            ▼
 ┌──────────────────────┐
 │ 5. Run Selenium E2E  │ ◄─── node test_selenium_indent.js
 └──────────────────────┘
```

---

## 1. Test Database Connectivity (DB Layer)

Confirm that the Node.js application process can read the database tables:

```bash
cd backend
node check-db.js
```

### Expected Output:
A printed list of all active tables in the public database schema (e.g., `reels`, `users`, `materials`, `indents`).
*   **If it fails:** Verify your local `.env` variables (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`).

---

## 2. Test API Directly (Backend Layer)

Verify backend router configuration and authorization gates from the CLI using `curl`.

### A. Check Public Health Status:
```bash
curl -i http://localhost:5000/api/health
```
*Expected: HTTP 200 OK with `{ "success": true }`.*

### B. Authenticate & Obtain Token:
```bash
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"ADMIN_PASS"}' | jq -r .token)
```

### C. Test Protected Route with Authorization:
```bash
curl -i -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/users
```
*Expected: HTTP 200 OK listing users.*
*   **If HTTP 401 Unauthorized:** The JWT signature is invalid or token has expired.
*   **If HTTP 403 Forbidden:** The authenticated user has insufficient role levels (requires L5 for `/api/users`).

---

## 3. Check Frontend Network Calls (UI Layer)

Inspect UI requests using the browser's developer tools:

1.  Press `F12` (or `Cmd + Opt + I` on Mac) and navigate to the **Network** tab.
2.  Filter request list by `Fetch/XHR` or input `/api` in filter box.
3.  Trigger the UI action (e.g. click "Approve Indent") and observe the network call:
    *   **Status 401:** Check if `localStorage` has a valid token string (`localStorage.getItem('token')`).
    *   **Status 403:** The user lacks permission (e.g. non-STORE worker calling store issue).
    *   **Status 500:** Internal Server Error. Check the PM2 console logs: `pm2 logs mk-erp-backend`.

---

## 4. Verify Event Propagation (Kafka Broker Layer)

If telemetry charts or correlations do not update, check the Kafka event broker stream.

### A. Run Broadcast Integration Test:
This utility script connects to the local Kafka broker, writes a test payload to all topics, consumes the message back to verify execution, and exits.

```bash
cd backend
node broadcast_now.js
```

### Expected Output:
```
🔌 Connecting to Kafka broker...
✅ Connected!
🚀 Broadcasting to all topics...

  Tracked: mkpm.dpr.events
  Tracked: mkpm.telemetry.readings
  Tracked: mkpm.quality.lab
  Tracked: mkpm.events.all
  Tracked: mkpm.events.critical

🎯 Broadcast verified: 5/5 topics confirmed.
```
*   **If it fails to connect:** Verify the Kafka service is running (`docker ps` or `sudo systemctl status kafka`) and check `KAFKA_BROKERS` in `.env`.

---

## 5. Run Integration Tests E2E (Application Layer)

Verify that critical multi-step workflows (PIIMAS indent, login authorization, data validation) execute correctly end-to-end:

```bash
# Run headless (ideal for background check)
node test_selenium_indent.js

# Run visible (opens browser window to inspect actions)
env HEADLESS=false node test_selenium_indent.js
```

Ensure the output prints `✅` for all test phases and terminates with exit code `0`.
