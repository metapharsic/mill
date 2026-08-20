# MK Paper Mill ERP — Smoke Test Checklist

Run after every deploy. Check each role. Exit 0 = safe to go live.

## Pre-test setup

- [ ] `https://erp.mkpapermill.com` loads (no cert warning)
- [ ] Login page renders (no blank screen / console error)
- [ ] HTTP → HTTPS redirect works (`curl -I http://erp.mkpapermill.com`)

---

## Role: Admin

Login: `admin@mkpapermill.com` / (Admin@1234)

- [ ] Dashboard loads, stats visible (not ₹0 / blank)
- [ ] User list loads → can create new user → can deactivate
- [ ] All sidebar modules visible and navigable
- [ ] `/dev/progress` accessible (dev dashboard, should NOT be public in prod)

---

## Role: Plant Head (Level 4)

Login: plant head credentials (`planthead@mkpapermill.com` / `Head@1234`)

- [ ] Dashboard loads
- [ ] Can view all department summaries
- [ ] Can approve store indents (if P1 coded)
- [ ] Cannot access Admin panel

---

## Role: Store Head (Level 3)

Login: store dept head credentials (`head.store@mkpapermill.com` / `Head@1234`)

- [ ] Store module loads
- [ ] Can raise store indent
- [ ] Can view indent status
- [ ] Cannot view Finance module

---

## Role: Finance Head (Level 3)

Login: finance dept credentials (`head.finance@mkpapermill.com` / `Head@1234`)

- [ ] Finance module loads
- [ ] Can view vouchers / ledger
- [ ] Cannot approve store indents (wrong dept)

---

## Role: Staff (Level 1)

Login: any staff account

- [ ] Can log in
- [ ] Can only see own-dept module
- [ ] Cannot access Admin or Plant Head views
- [ ] 401 on `GET /api/admin/users` (verify in browser devtools)

---

## API sanity (curl / Postman)

```bash
BASE=https://erp.mkpapermill.com

# Health
curl -sf $BASE/api/health || echo "FAIL: health endpoint"

# Auth
TOKEN=$(curl -sf -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mkpapermill.com","password":"ADMIN_PASS"}' | jq -r .token)
[ -n "$TOKEN" ] && echo "PASS: login" || echo "FAIL: login"

# Protected route (should 200)
curl -sf -H "Authorization: Bearer $TOKEN" $BASE/api/users | jq '.success' || echo "FAIL: /api/users"

# Unauthenticated (should 401)
STATUS=$(curl -o /dev/null -sw "%{http_code}" $BASE/api/users)
[ "$STATUS" = "401" ] && echo "PASS: unauth blocked" || echo "FAIL: unauth got $STATUS"
```

---

## Post-deploy monitoring

```bash
pm2 status                        # all processes online
pm2 logs mk-erp-backend --lines 50  # no crash stack traces
tail -20 /var/log/nginx/mkerp_error.log
tail -20 /var/log/mkerp-backup.log   # next morning, confirm backup ran
```

---

## Go-live gate

All of the above pass → update `checkpoint.json` D = done → notify team.
