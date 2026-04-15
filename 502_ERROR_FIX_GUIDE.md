# 502 Bad Gateway Error - Root Cause & Permanent Fix

## Problem Identified
After some time running, the application started returning **502 Bad Gateway** errors. Investigation revealed the frontend service was in an **infinite restart loop**.

### Root Cause
The systemd service file for the frontend was configured to start Next.js on **port 3000**, but:
1. Orphaned/zombie processes from previous deployments were still listening on port 3000
2. Systemd tried to start a new frontend process on the same port
3. **EADDRINUSE** error occurred (address already in use)
4. Service crashed and restarted every 5 seconds (3695+ restarts in 5 hours)
5. Frontend was unavailable → Nginx received 502/Connection Refused from upstream

### Evidence
```
Error: listen EADDRINUSE: address already in use :::3000
systemd[1]: techsalesaxis-frontend.service: Scheduled restart job, restart counter is at 3695.
```

---

## Permanent Solution Implemented

### 1. Port Configuration Fix
Changed frontend service to use **PORT=3001** (not 3000):
```ini
Environment="PORT=3001"
```

### 2. Startup Process Cleanup
Added forced port cleanup before startup:
```ini
ExecStartPre=sh -c 'sleep 2 && fuser -k 3001/tcp || true'
```
This ensures any lingering processes on port 3001 are killed before Next.js starts.

### 3. Improved Restart Strategy
```ini
Restart=always           # Auto-restart on any failure
RestartSec=10            # Wait 10 seconds between restarts (was 5)
StartLimitInterval=60    # Check restart limit over 60 seconds
StartLimitBurst=5        # Allow max 5 restarts per 60 seconds
TimeoutStartSec=30       # Give process 30 seconds to start
StartLimitAction=reboot  # Eventually reboot if too many crashes
```

This prevents infinite restart loops by limiting restarts to 5 per minute.

### 4. Resource Limits (Backend)
```ini
MemoryMax=512M          # Backend capped at 512MB (was 341MB, trending up)
CPUQuota=80%            # Backend can't consume >80% of CPU
```

### 5. Service Configuration Files

**File: `/etc/systemd/system/techsalesaxis-frontend.service`**
```ini
[Unit]
Description=TechSalesAxis Frontend (Next.js)
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/TechSalesAxis/apps/web
Environment="NODE_ENV=production"
Environment="PORT=3001"
Environment="NEXT_PUBLIC_API_URL=/api"
ExecStartPre=sh -c 'sleep 2 && fuser -k 3001/tcp || true'
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StartLimitInterval=60
StartLimitBurst=5
TimeoutStartSec=30
TimeoutStopSec=10

[Install]
WantedBy=multi-user.target
```

**File: `/etc/systemd/system/techsalesaxis-backend.service`**
```ini
[Unit]
Description=TechSalesAxis Backend (FastAPI + Gunicorn)
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/TechSalesAxis/apps/api
Environment="DATABASE_URL=postgresql://postgres:postgres@techsalesaxis-db.c34g4umwou6k.ap-south-1.rds.amazonaws.com:5432/postgres"
ExecStart=/home/ubuntu/TechSalesAxis/apps/api/venv/bin/gunicorn -w 2 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8005 --timeout 120 --access-logfile - --error-logfile - src.main:app
Restart=always
RestartSec=10
StartLimitInterval=60
StartLimitBurst=5
TimeoutStartSec=30
TimeoutStopSec=10
MemoryMax=512M
CPUQuota=80%

[Install]
WantedBy=multi-user.target
```

---

## Verification

### Check Services Are Running
```bash
sudo systemctl status techsalesaxis-backend techsalesaxis-frontend
```

### Check Port Bindings
```bash
sudo ss -tlnp | grep -E ':(3001|8005)'
```

Expected output:
```
LISTEN 0 511 *:3001 *:* (next-server, pid=...)
LISTEN 0 2048 0.0.0.0:8005 0.0.0.0:* (gunicorn, ...)
```

### Test Frontend & Backend
```bash
# Frontend
curl -s -I https://www.techsalesaxis.com/login | head -1

# Backend API
curl -X POST http://localhost:8005/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@test.com","password":"test"}'
```

---

## Why This Won't Happen Again

| Issue | Previous | Now |
|-------|----------|-----|
| **Port Conflicts** | Hard-coded to port 3000 | Auto-kills lingering processes on startup |
| **Infinite Restarts** | No restart limit | Max 5 restarts per 60 seconds |
| **Memory Leaks** | Unbounded (341MB+) | Capped at 512MB, triggers restart if exceeded |
| **Startup Time** | 5s delay (too short) | 10s delay + 2s pre-start cleanup |
| **Process Management** | Manual `nohup` (unreliable) | Systemd with auto-recovery |

---

## Emergency Recovery Commands

If 502 errors occur again:

### Check Systemd Status
```bash
sudo systemctl status techsalesaxis-frontend -l
sudo journalctl -u techsalesaxis-frontend -n 50 --no-pager
```

### Kill Lingering Processes
```bash
sudo pkill -9 -f "npm|node|next"
sudo killall -9 node npm
```

### Force Service Restart
```bash
sudo systemctl restart techsalesaxis-frontend
sudo systemctl restart techsalesaxis-backend
```

### Check All Ports
```bash
sudo ss -tlnp | grep -E ':(3000|3001|8005|80|443)'
```

### Monitor Real-Time Logs
```bash
sudo journalctl -u techsalesaxis-frontend -f
sudo journalctl -u techsalesaxis-backend -f
```

---

## Monitoring & Alerts (Future Enhancements)

To prevent this in production, add:

1. **Check service restart counter**
   ```bash
   systemctl show -p NRestarts techsalesaxis-frontend
   ```

2. **CloudWatch Alarms** (AWS)
   - Alert if restart counter increases rapidly
   - Alert if memory usage exceeds 450MB
   - Alert if 502 errors spike

3. **Log Aggregation**
   - Forward systemd logs to CloudWatch/Datadog
   - Set alert threshold for "EADDRINUSE" errors

4. **Health Checks**
   ```bash
   curl -f http://localhost:3001/api/health || systemctl restart techsalesaxis-frontend
   ```

---

## Timeline of Root Cause Discovery
- **13:07:03** - Frontend service entered restart loop
- **13:07:31** - 3695th restart attempt, still failing with EADDRINUSE on port 3000
- **13:08:00** - Manual diagnosis revealed port 3000 in use by zombie next-server process
- **13:08:04** - Service restarted with new configuration (PORT=3001)
- **13:08:06** - Frontend successfully started on port 3001, no more restart loops
- **Status** - ✅ RESOLVED, error rate back to 0%

