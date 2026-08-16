# MK Paper Mill ERP — Notification System

> **AI INSTRUCTION:** Read this before implementing or extending any feature that requires
> alerting users. Ensure that in-app notification records are written correctly in database transactions
> and target the appropriate role level or department staff.

---

## 1. Table Schema: `notifications`

The in-app notification system uses a single table created automatically in [server.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/server.js#L146).

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(50) DEFAULT 'info',                              -- info, warning, critical
  title      VARCHAR(200) NOT NULL,
  message    TEXT,
  ref_table  VARCHAR(50),                                             -- reference entity name (e.g. 'indents', 'stock_ledger')
  ref_id     INTEGER,                                                 -- reference ID (e.g. indent_id)
  is_read    BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Optimize for user-facing reads & polling queries
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read, created_at DESC);
```

---

## 2. API Endpoints

All endpoints are hosted on the HR/Employee routes path (configured inside `backend/src/routes/hr.js`):

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/hr/notifications` | Level 1+ | List notifications for the authenticated user. Fetches all unread, or all notifications if query param `?all=1` is provided. Includes total unread count. |
| PUT | `/api/hr/notifications/read-all` | Level 1+ | Marks all notifications as read for the authenticated user (`is_read = true`). |
| PUT | `/api/hr/notifications/:id/read` | Level 1+ | Marks a single notification as read (`is_read = true`). Restricted to user's own notification. |

---

## 3. UI Integration & Polling

* **Location:** Controlled in `frontend/src/App.jsx`.
* **Mechanism:** Long-polling on boot and then repeating every 60 seconds:
  ```javascript
  // App.jsx - Polling trigger
  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    const timer = setInterval(fetchNotifications, 60000);
    return () => clearInterval(timer);
  }, [user]);
  ```
* **Unread Badge:** The navbar displays a badge containing the `unread` count.
* **Notification Drawer:** Clicking the drawer lists the user's notifications. Clicking a single notification:
  1. Sends a `PUT /api/hr/notifications/:id/read` request to mark it read.
  2. Updates local navbar state (`unread -= 1`).
  3. Uses `setActive()` to navigate the user directly to the referenced page (e.g. `indent`, `store`) matching `ref_table`.

---

## 4. System Notification Triggers

Notifications are generated either **synchronously** inside route handlers or **asynchronously** via background crons:

### A. High-Value Inventory Transactions (Synchronous)
* **Trigger:** Stock movement value > ₹1,00,000 OR quantity > 50% of current stock in one transaction.
* **Targets:** 
  1. Store Department Heads (Store department + Role Level >= 3)
  2. Plant Administrators (Role Level >= 4)
* **Type:** `critical`
* **File:** [inventory.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/inventory.js#L20)

### B. Machine Breakdown / Maintenance Checklist (Synchronous)
* **Trigger:** Logging a breakdown or critical bearing checklist anomaly.
* **Targets:**
  1. Maintenance Department Heads (Maintenance department + Role Level >= 3)
  2. Plant Administrators (Role Level >= 4)
* **Type:** `critical`
* **File:** [maintenance.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/maintenance.js#L416)

### C. PIIMAS Ack Overdue (Background Cron)
* **Schedule:** Runs every 2 hours in [server.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/server.js#L160).
* **Trigger:** An indent in `'Issued'` status has items pending acknowledgment (`ack_status = 'pending'`) for > 24 hours.
* **Action:**
  1. Finds the department head of the indent raiser (Role Level >= 3 in that dept) and Plant Head (Role Level >= 4).
  2. Dedupes alerts (skips if a notification was sent for the same indent in the last 24h).
  3. Pushes a `warning` notification.
  4. **Overdue Status Escalation:** If the indent is pending ack for > 48 hours, the cron updates the indent remarks with `[Auto-escalated: ack overdue >48h]`.

---

## 5. Code Pattern for Pushing a Notification

When writing to a database within an endpoint transaction, insert the notification before committing the transaction:

```javascript
// Within an active pool client transaction
await client.query(`
  INSERT INTO notifications (user_id, type, title, message, ref_table, ref_id)
  VALUES ($1, $2, $3, $4, $5, $6)
`, [targetUserId, 'info', 'Leave Approved', 'Your casual leave has been approved by HOD.', 'leaves', leaveId]);
```
