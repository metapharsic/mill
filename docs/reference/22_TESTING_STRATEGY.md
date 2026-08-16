# MK Paper Mill ERP — Testing Playbook & Strategy

> **AI INSTRUCTION:** Read this before submitting code changes or running verification steps.
> All pull requests should be tested using both automated Selenium scripts and role-based 
> manual checklists before going live.

---

## 1. Testing Philosophy & Matrix

To ensure stability across shift operations, the system relies on three tiers of verification:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TESTING MATRIX HIERARCHY                        │
│                                                                        │
│  E2E Automation (Selenium) ────► Validates PIIMAS flows & UI rendering │
│  Role-Based Smoke Tests  ─────► Validates multi-level permission checks│
│  API Sanity Tests        ─────► Verifies CORS, HTTPS redirect, & Health│
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Automated E2E Selenium Testing

The ERP includes an end-to-end integration test runner in the workspace root: [test_selenium_indent.js](file:///c:/Project/MK%20Paper%20Mill/test_selenium_indent.js).

### A. What It Tests (PIIMAS Module Flows):
1.  **Auth Login:** Performs user credential authentication (`head.prod@mkpapermill.com`).
2.  **Navigation:** Clicks sidebar triggers and waits for active page components to render.
3.  **List Verification:** Asserts that the Indents list table parses and displays headers.
4.  **Requisition form submission:** Validates form entry, locking raiser's department HOD fields, and submitting a draft.
5.  **Acknowledge Tab:** Confirms the PIIMAS item acknowledgment grid elements render.
6.  **Calendar Tab:** Asserts that the scheduling calendar loads correctly.

### B. Execution Setup:
First, install the Selenium webdriver dependency in the root directory:
```bash
npm install selenium-webdriver
```

Run tests headless (default CI/CD mode):
```bash
node test_selenium_indent.js
```

Run tests in headful mode (opens visible Google Chrome browser for debugging):
```bash
env HEADLESS=false node test_selenium_indent.js
```

*Set alternative target URL with environment variable:* `TEST_URL=http://your-server-ip:5173`

---

## 3. Manual Role-Based Smoke Tests

Run these checks after every server deployment to verify security configuration.

### A. Admin Checks (Level 5)
*   **Credentials:** Login as `admin`
*   Verify dashboard counts render numeric results (not `₹0` or empty).
*   Verify that `/dev/progress` (dev status dashboard) is **blocked/not public** in production builds.
*   Navigate to the Users section, add a temporary user, and soft-deactivate them.

### B. Plant Head Checks (Level 4)
*   **Credentials:** Login as a Plant Head account
*   Assert all department OEE summaries load.
*   Verify L2/L3 indent approvals can be signed off.
*   Confirm the Admin Panel sidebar item is hidden and `/api/admin/users` returns `403 Forbidden`.

### C. Store Head Checks (Level 3)
*   **Credentials:** Login as a Store Manager account
*   Navigate to the Store module. Verify that raw materials list displays stock.
*   Verify that raising and approving indent transactions succeeds.
*   Confirm that the Finance section is hidden from the sidebar.

### D. Operator / Staff Checks (Level 1)
*   **Credentials:** Login as a general operator account
*   Verify navigation redirects to the user's specific department landing page.
*   Confirm that all other department modules display "Access Denied" or are hidden.
*   Open the browser DevTools console and verify that requests to protected paths (e.g. `GET /api/admin/users`) return `401 Unauthorized`.

---

## 4. API & Nginx Sanity Checks

Verify API responses using curl commands from the command line:

```bash
BASE_URL="https://erp.mkpapermill.com"

# 1. Health check
curl -sf $BASE_URL/api/health || echo "FAIL: API Health endpoint down"

# 2. HTTP to HTTPS redirect verification
STATUS_REDIRECT=$(curl -o /dev/null -sw "%{http_code}" http://erp.mkpapermill.com)
if [ "$STATUS_REDIRECT" = "301" ]; then
  echo "PASS: Redirect configured"
else
  echo "FAIL: Redirect returned code $STATUS_REDIRECT"
fi

# 3. Unauthorized access block
STATUS_BLOCK=$(curl -o /dev/null -sw "%{http_code}" $BASE_URL/api/users)
if [ "$STATUS_BLOCK" = "401" ]; then
  echo "PASS: Unauthenticated route blocked"
else
  echo "FAIL: Unauthenticated route allowed access (HTTP $STATUS_BLOCK)"
fi
```

---

## 5. Post-Deployment Monitoring Logs

Verify server logs to confirm all application daemons are running correctly:

```bash
# Verify process status
pm2 status

# Verify logs for errors/stack traces
pm2 logs mk-erp-backend --lines 50

# Verify Nginx error log
tail -n 20 /var/log/nginx/mkerp_error.log

# Verify database backup completed successfully
tail -n 20 /var/log/mkerp-backup.log
```
