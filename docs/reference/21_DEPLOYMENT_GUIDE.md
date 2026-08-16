# MK Paper Mill ERP — Deployment Playbook

> **AI INSTRUCTION:** Read this before modifying the process configuration (`ecosystem.config.js`), 
> Nginx sample scripts, or adding system startup requirements.

---

## 1. System Requirements

*   **Operating System:** Ubuntu 22.04 LTS (Recommended) / Windows Server 2022.
*   **Runtime:** Node.js v20.x or higher, npm v10.x.
*   **Database:** PostgreSQL 15.x.
*   **Broker (Optional):** Apache Kafka v3.x (with Zookeeper or KRaft).

---

## 2. Server Installation & Configuration

### A. Install PM2 & Logrotate
PM2 acts as the production process manager. Install it globally along with the automatic log rotation plugin:

```bash
sudo npm install -g pm2
pm2 install pm2-logrotate
```

Configure PM2 logrotate thresholds to prevent disk exhaustion:
```bash
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss
pm2 set pm2-logrotate:rotateInterval '0 2 * * *'   # Rotate daily at 2:00 AM
```

### B. PM2 Ecosystem Startup
The application uses two processes managed via [ecosystem.config.js](file:///c:/Project/MK%20Paper%20Mill/ecosystem.config.js):
1.  **`mk-erp-backend`**: Core API server (`backend/src/server.js`) serving routes on port 5000.
2.  **`mk-erp-indexer`**: Automated indexer daemon (`scripts/auto-update-indexer.js`) that runs `node .gitnexus/run.cjs analyze` every 1 hour, writing status updates to `logs/indexer-update.log`.

```bash
cd /opt/mkerp

# Run preflight tests (verifies DB connection, schema migration status, folder permissions)
node scripts/preflight.js

# Launch applications
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

Follow the printed commands from `pm2 startup` to configure the systemd unit.

---

## 3. Nginx Reverse Proxy Config

Configure Nginx as a reverse proxy, handling SSL termination, static frontend assets, and Gzip compression.

Save this config to `/etc/nginx/sites-available/mkerp` and symlink to `sites-enabled`:

```nginx
# HTTP to HTTPS redirect
server {
    listen 80;
    server_name erp.mkpapermill.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name erp.mkpapermill.com;

    # SSL Certs (Let's Encrypt path example)
    ssl_certificate /etc/letsencrypt/live/erp.mkpapermill.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/erp.mkpapermill.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 1000;

    # Static Frontend Assets
    location / {
        root /opt/mkerp/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API Proxied to Node
    location /api/ {
        proxy_pass http://127.0.0.1:5000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static Uploads Directories
    location /uploads/ {
        alias /opt/mkerp/backend/uploads/;
        expires 7d;
        add_header Cache-Control "public, no-transform";
    }
}
```

---

## 4. PostgreSQL Nightly Backup Strategy

A nightly backup shell script logs output and saves compressed database dumps to a backup directory.

### Backup Script (`/opt/mkerp/scripts/backup.sh`)
```bash
#!/bin/bash
# Backup Configuration
BACKUP_DIR=${BACKUP_DIR:-"/var/backups/mkerp"}
KEEP_DAYS=${KEEP_DAYS:-14}
DB_NAME=${DB_NAME:-"mk_paper_mill"}
DB_USER=${DB_USER:-"postgres"}

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="$BACKUP_DIR/db_backup_${DB_NAME}_${TIMESTAMP}.sql.gz"

# Create directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Perform compressed pg_dump
pg_dump -U "$DB_USER" -h localhost "$DB_NAME" | gzip > "$FILENAME"

# Delete backups older than KEEPDAYS
find "$BACKUP_DIR" -name "db_backup_${DB_NAME}_*.sql.gz" -mtime +"$KEEP_DAYS" -exec rm {} \;

echo "[$(date)] Backup completed: $FILENAME"
```

### Enable Backup via Cron
Make script executable and add to crontab:
```bash
chmod +x /opt/mkerp/scripts/backup.sh
sudo crontab -e
```
Add the following line to run the backup daily at 2:00 AM:
```cron
0 2 * * * /opt/mkerp/scripts/backup.sh >> /var/log/mkerp-backup.log 2>&1
```
Confirm retention logs inside `/var/log/mkerp-backup.log`.
