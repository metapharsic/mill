# PM2 Setup — MK Paper Mill ERP

## Install PM2 + logrotate

```bash
npm install -g pm2
pm2 install pm2-logrotate
```

## Configure logrotate

```bash
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss
pm2 set pm2-logrotate:rotateInterval '0 2 * * *'   # rotate 2am daily
```

## Start app

```bash
cd /opt/mkerp
node scripts/preflight.js          # must pass before going live
pm2 start ecosystem.config.js
pm2 save
pm2 startup                        # follow printed command to enable on boot
```

## Useful commands

```bash
pm2 status                         # process list
pm2 logs mk-erp-backend            # tail logs
pm2 restart mk-erp-backend         # zero-downtime restart
pm2 monit                          # live CPU/mem dashboard
```

## Nightly backup cron

```bash
chmod +x /opt/mkerp/scripts/backup.sh
crontab -e
# Add:
# 0 2 * * * /opt/mkerp/scripts/backup.sh >> /var/log/mkerp-backup.log 2>&1
```

Backups land in `/var/backups/mkerp/`. Keeps 14 days. Override with env:
- `BACKUP_DIR` — target directory
- `KEEP_DAYS` — retention (default 14)
- `DB_NAME` / `DB_USER` — if different from defaults
