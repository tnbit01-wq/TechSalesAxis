# 📋 COMPLETE DEPLOYMENT GUIDE - TechSalesAxis

**Last Updated**: April 15, 2026  
**Status**: Production Ready  
**Environment**: AWS EC2 (t3.small, Ubuntu 24.04, ap-south-1)  
**Domain**: https://www.techsalesaxis.com

---

## 🎯 Quick Reference

- **Frontend**: Next.js 16.2.3 (Port 3001)
- **Backend**: FastAPI + Gunicorn (Port 8005)
- **Reverse Proxy**: Nginx 1.24.0
- **Database**: AWS RDS PostgreSQL
- **Service Manager**: Systemd (auto-restart, auto-start)
- **Monitoring**: Health check script (every 10 min)

---

## 📋 Table of Contents

1. [Deployment Challenges Faced](#deployment-challenges-faced)
2. [Step-by-Step Deployment Process](#step-by-step-deployment-process)
3. [Packages & Dependencies](#packages--dependencies)
4. [Environment Configuration](#environment-configuration)
5. [Local Development Changes](#local-development-changes)
6. [Pre-Deployment Checklist](#pre-deployment-checklist)
7. [Post-Deployment Verification](#post-deployment-verification)
8. [Future Deployment Instructions](#future-deployment-instructions)
9. [Troubleshooting & Recovery](#troubleshooting--recovery)
10. [Monitoring & Alerts](#monitoring--alerts)

---

## 🚨 Deployment Challenges Faced

### Challenge 1: Hardcoded API URLs (50+ Instances)
**Problem**: Frontend code had hardcoded URLs pointing to `http://127.0.0.1:8000`, `localhost:8000`, `127.0.0.1:8005`  
**Root Cause**: Development URLs embedded in code without environment variable abstraction  
**Files Affected**:
- `src/lib/apiClient.ts`
- `src/app/onboarding/candidate/page.tsx`
- `src/components/BulkUploadAdmin.tsx`
- `src/components/AdminDashboard.tsx`
- `src/components/GlobalChatInterface.tsx`
- Multiple other component files

**Solution**: 
```bash
# Find all hardcoded URLs
grep -r "http://127\|http://localhost" src/

# Replace with environment variable approach
find src -exec sed -i "s#http://127.0.0.1:8005#/api#g" {} \;
```

**Prevention**: 
- Use `process.env.NEXT_PUBLIC_API_URL || "/api"` in all API calls
- Implement pre-commit hooks to prevent hardcoded URLs
- Run automated checks before deployment

---

### Challenge 2: Environment Variable Override (.env.local)
**Problem**: Login kept failing despite fixing code because `NEXT_PUBLIC_API_URL=http://localhost:8000` in `.env.local`  
**Root Cause**: Next.js precedence: `.env.local` > `.env` > defaults  
**Impact**: Production environment configuration was overridden by local development file

**Solution**:
```bash
# Remove the override file (should only exist in .gitignore, not deployed)
rm .env.local

# Ensure .env has correct production value
echo "NEXT_PUBLIC_API_URL=/api" > apps/web/.env

# Clear build cache and rebuild
rm -rf apps/web/.next
npm run build
```

**Prevention**: 
- Keep `.env.local` in `.gitignore` only
- Use environment-specific files: `.env.production`, `.env.development`
- Document that `.env.local` is local-only development file

---

### Challenge 3: Port Conflicts & Address Already in Use
**Problem**: `EADDRINUSE: address already in use :::3000` errors when starting frontend  
**Root Cause**: Orphaned Node/npm processes from previous deployments still using port 3000  
**Impact**: Frontend failed to start, timeout waiting for port to be available

**Solution**:
```bash
# Kill all orphaned processes
sudo pkill -9 -f "npm\|node\|next"

# Verify port is free
sudo lsof -i :3000
sudo ss -tlnp | grep 3000

# Start fresh
npm start
```

**Prevention**: 
- Use systemd `ExecStartPre` to force kill on port before startup
- Implement proper signal handling in applications
- Use systemd instead of `nohup` for process management

---

### Challenge 4: Nginx Upstream Port Mismatch
**Problem**: Nginx configured to forward to port 3000, but frontend running on port 3001  
**Root Cause**: Manual port change during troubleshooting without updating Nginx config  
**Impact**: Frontend connection refused errors, 502 Bad Gateway responses

**Solution**:
```nginx
# Update upstream definition
upstream frontend { 
    server localhost:3001;  # Changed from 3000
}
```

**Prevention**: 
- Document all port assignments in a central config
- Use configuration management (Ansible/Terraform)
- Verify all upstream definitions before deployment

---

### Challenge 5: API Endpoint Path Mismatch
**Problem**: Frontend sent `POST /api/auth/login`, backend returned 404  
**Root Cause**: Backend router registered with `/auth` prefix, so endpoint is `/auth/login`. Frontend adding extra `/api/` prefix  
**Impact**: All API calls failed with 404 errors

**Solution**:
```nginx
# Add Nginx rewrite rule to strip /api prefix
location /api/ {
    rewrite ^/api/(.*) /$1 break;
    proxy_pass http://backend;
}
```

**Prevention**: 
- Document backend endpoint structure clearly
- Ensure frontend and backend API paths align
- Test with actual HTTP requests before deployment

---

### Challenge 6: Service Persistence on EC2 Reboot
**Problem**: Services started with `nohup` crashed when SSH connection closed or EC2 rebooted  
**Root Cause**: `nohup` depends on persistent shell session; no auto-recovery on process crash  
**Impact**: 502 errors after reboot until manual intervention

**Solution**: Implement systemd service files
```ini
[Service]
Restart=always
RestartSec=10
WantedBy=multi-user.target  # Auto-start on boot
```

**Prevention**: 
- Always use process manager (systemd, supervisor, PM2)
- Implement health checks and auto-recovery
- Test service persistence after EC2 reboot

---

### Challenge 7: Frontend Infinite Restart Loop (502 Error)
**Problem**: Frontend service restarted 3695+ times in 5 hours, causing 502 errors  
**Root Cause**: Port 3000 occupied by zombie process; systemd kept trying to restart on port 3000 (original config)  
**Impact**: Frontend completely unavailable, all users seeing 502 errors

**Solution**:
1. Change frontend service to use PORT=3001
2. Add `ExecStartPre=sh -c 'fuser -k 3001/tcp || true'` to kill lingering processes
3. Add restart limits: `StartLimitBurst=5 StartLimitInterval=60`

**Prevention**: 
- Port-specific process cleanup on startup
- Restart rate limiting to prevent restart loops
- Automatic health monitoring to detect cascading issues

---

### Challenge 8: Memory Leaks & Resource Exhaustion
**Problem**: Backend memory grew from 318MB to 341MB+ over time  
**Root Cause**: Potential memory leak in Gunicorn/FastAPI workers or database connections  
**Impact**: Could lead to OOM kills, service crashes

**Solution**:
```ini
[Service]
MemoryMax=512M           # Hard limit
CPUQuota=80%             # CPU constraint
Restart=always           # Auto-restart if OOM
```

**Prevention**: 
- Monitor memory trends: `systemctl show -p MemoryCurrent <service>`
- Regular log analysis for memory-related issues
- Implement memory profiling in development

---

### Challenge 9: Email Configuration & SES Integration
**Problem**: Mail integration not configured on production; new credentials needed  
**Root Cause**: Mail services had development credentials; SES production access required separate configuration  
**Impact**: Email functionality unavailable on production

**Solution**: Deploy with production SES credentials in `.env`
```bash
ZEPTOMAIL_API_KEY=<production-key>
ZEPTOMAIL_DOMAIN=<production-domain>
AWS_REGION=ap-south-1
SENDER_EMAIL=noreply@techsalesaxis.com
```

**Prevention**: 
- Keep separate `.env` files per environment
- Document all required environment variables
- Test email functionality immediately after deployment

---

## 🔧 Step-by-Step Deployment Process

### Phase 1: Local Preparation (Before Committing)

**Step 1.1**: Update environment variables locally
```bash
# Update apps/api/.env (local copy, not in git)
NEXT_PUBLIC_API_URL=/api
DATABASE_URL=postgresql://user:password@host:5432/dbname
ZEPTOMAIL_API_KEY=<your-key>
ZEPTOMAIL_DOMAIN=<your-domain>
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>
AWS_REGION=ap-south-1
```

**Step 1.2**: Test locally
```bash
# Frontend
cd apps/web
npm install
npm run build
npm start  # Should start on port 3000

# Backend (in separate terminal)
cd apps/api
pip install -r requirements.txt
python -m uvicorn src.main:app --reload  # Should start on port 8000
```

**Step 1.3**: Run integration tests
```bash
# Test API endpoints
curl http://localhost:8000/auth/login -X POST -d '{"email":"test@example.com","password":"test"}'

# Test frontend loads
curl http://localhost:3000/login
```

---

### Phase 2: Git Commit & Push

**Step 2.1**: Stage source code changes
```bash
git add apps/api/src/**/*.py
git add apps/web/src/**/*.tsx
git add apps/web/src/lib/**/*.ts
```

**Step 2.2**: Commit with descriptive message
```bash
git commit -m "feat: deploy production fixes and optimizations

- Fix 50+ hardcoded API URLs in frontend components
- Remove .env.local override, use environment variables properly
- Update systemd services with restart limits and resource constraints
- Add health monitoring script for automatic recovery
- Configure Nginx rewrite rules for API path normalization
- Implement memory and CPU limits for backend service
- Add email integration configuration for production SES"
```

**Step 2.3**: Push to main branch
```bash
git push origin main
```

---

### Phase 3: Server Preparation (EC2)

**Step 3.1**: Connect to EC2 via SSH
```bash
ssh -i your-key.pem ubuntu@13.235.42.95
```

**Step 3.2**: Pull latest code
```bash
cd /home/ubuntu/TechSalesAxis
git pull origin main
```

**Step 3.3**: Update backend dependencies (if new packages added)
```bash
cd /home/ubuntu/TechSalesAxis/apps/api
source venv/bin/activate
pip install -r requirements.txt
```

**Step 3.4**: Create/update .env with production credentials
```bash
cat > .env << 'EOF'
DATABASE_URL=postgresql://postgres:password@techsalesaxis-db.c34g4umwou6k.ap-south-1.rds.amazonaws.com:5432/postgres
ZEPTOMAIL_API_KEY=<production-key>
ZEPTOMAIL_DOMAIN=<production-domain>
AWS_ACCESS_KEY_ID=<production-key>
AWS_SECRET_ACCESS_KEY=<production-secret>
AWS_REGION=ap-south-1
SENDER_EMAIL=noreply@techsalesaxis.com
JWT_SECRET=<production-jwt-secret>
JWT_ALGORITHM=HS256
EOF
```

**Step 3.5**: Update frontend build with production variables
```bash
cd /home/ubuntu/TechSalesAxis/apps/web
cat > .env.production << 'EOF'
NEXT_PUBLIC_API_URL=/api
EOF

npm install
npm run build
```

---

### Phase 4: Service Update & Restart (EC2)

**Step 4.1**: Update systemd service files
Backend service: `/etc/systemd/system/techsalesaxis-backend.service`
```ini
[Unit]
Description=TechSalesAxis Backend (FastAPI + Gunicorn)
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/TechSalesAxis/apps/api
Environment="DATABASE_URL=postgresql://..."
ExecStart=/home/ubuntu/TechSalesAxis/apps/api/venv/bin/gunicorn -w 2 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8005 --timeout 120 src.main:app
Restart=always
RestartSec=10
StartLimitInterval=60
StartLimitBurst=5
MemoryMax=512M
CPUQuota=80%

[Install]
WantedBy=multi-user.target
```

Frontend service: `/etc/systemd/system/techsalesaxis-frontend.service`
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

[Install]
WantedBy=multi-user.target
```

**Step 4.2**: Reload systemd and restart services
```bash
sudo systemctl daemon-reload
sudo systemctl enable techsalesaxis-backend techsalesaxis-frontend
sudo systemctl restart techsalesaxis-backend techsalesaxis-frontend
sleep 3
```

**Step 4.3**: Verify services running
```bash
sudo systemctl status techsalesaxis-backend techsalesaxis-frontend
sudo ss -tlnp | grep -E ':(3001|8005)'
```

---

### Phase 5: Nginx Configuration Update

**Step 5.1**: Verify Nginx upstream configuration
```bash
sudo cat /etc/nginx/sites-enabled/default | grep -A 5 "upstream"
```

Should show:
```nginx
upstream frontend { server localhost:3001; }
upstream backend { server localhost:8005; }
```

**Step 5.2**: Reload Nginx
```bash
sudo systemctl reload nginx
sudo systemctl status nginx
```

---

### Phase 6: Health Verification

**Step 6.1**: Deploy health check script
```bash
sudo cp check-service-health.sh /opt/talentflow/
sudo chmod +x /opt/talentflow/check-service-health.sh

# Setup cron job (runs every 10 minutes)
sudo bash -c 'echo "*/10 * * * * /opt/talentflow/check-service-health.sh" >> /var/spool/cron/crontabs/root'
```

**Step 6.2**: Run health check manually
```bash
sudo bash /opt/talentflow/check-service-health.sh
```

Expected output:
```
✅ Frontend service is running
✅ Frontend listening on port 3001
✅ Backend service is running
✅ Backend listening on port 8005
✅ Frontend /login responds with 200
✅ Backend /auth/login is responding
✅ Nginx is proxying correctly (no 502 errors)
```

---

## 📦 Packages & Dependencies

### Backend (Python)
**File**: `apps/api/requirements.txt`

**Core Packages**:
```
fastapi==0.104.0
uvicorn==0.24.0
sqlalchemy==2.0.0
psycopg2-binary==2.9.9
python-dotenv==1.0.0
pydantic==2.0.0
pydantic-settings==2.0.0
```

**Email & Notifications**:
```
zeptomail==1.0.0  # Email service (NEWLY ADDED)
python-multipart==0.0.6
```

**File Handling & Storage**:
```
boto3==1.28.0
python-multipart==0.0.6
```

**Authentication & Security**:
```
python-jose==3.3.0
passlib==1.7.4
python-multipart==0.0.6
```

**AI & ML**:
```
anthropic==0.7.0
openai==0.27.0
```

**Utilities**:
```
requests==2.31.0
```

**Manually Installed (Not in requirements.txt Initially)**:
- `zeptomail` - Email integration (added for mail functionality)
- `gunicorn` - Production WSGI server (installed separately)

**Installation**:
```bash
cd apps/api
pip install -r requirements.txt
pip install gunicorn  # Production server
pip install uvicorn   # Already included in requirements
```

---

### Frontend (Node.js)
**File**: `apps/web/package.json`

**Core Packages**:
```
next@16.2.3
react@19
react-dom@19
typescript@5
```

**UI & Styling**:
```
tailwindcss@3.3.0
shadcn-ui components
```

**HTTP Client**:
```
axios@1.6.0  # API calls (ensure this is used)
```

**State Management & Utilities**:
```
zustand@4.4.0  # State management
next-safe-action@5.4.0
```

**Installation**:
```bash
cd apps/web
npm install
npm run build
```

---

## ⚙️ Environment Configuration

### Where Files Should Be

**Local Development**:
```
apps/api/.env (local copy, in .gitignore)
apps/web/.env.local (local copy, in .gitignore)
```

**Production (EC2)**:
```
/home/ubuntu/TechSalesAxis/apps/api/.env
/home/ubuntu/TechSalesAxis/apps/web/.env.production
```

### Required Environment Variables

**Backend** (`apps/api/.env`):
```bash
# Database
DATABASE_URL=postgresql://postgres:password@techsalesaxis-db.c34g4umwou6k.ap-south-1.rds.amazonaws.com:5432/postgres

# Email (NEW - Mail Integration)
ZEPTOMAIL_API_KEY=<your-zeptomail-api-key>
ZEPTOMAIL_DOMAIN=mail.techsalesaxis.com
SENDER_EMAIL=noreply@techsalesaxis.com

# AWS (S3, SES)
AWS_ACCESS_KEY_ID=<your-aws-key>
AWS_SECRET_ACCESS_KEY=<your-aws-secret>
AWS_REGION=ap-south-1
AWS_S3_BUCKET=techsalesaxis-uploads

# JWT
JWT_SECRET=<your-jwt-secret-key>
JWT_ALGORITHM=HS256

# AI Services
ANTHROPIC_API_KEY=<your-anthropic-key>
OPENAI_API_KEY=<your-openai-key>

# Development (set to false in production)
DEBUG=False
```

**Frontend** (`apps/web/.env.production`):
```bash
NEXT_PUBLIC_API_URL=/api
NODE_ENV=production
```

### How to Update Production .env

**SSH into EC2**:
```bash
ssh -i your-key.pem ubuntu@13.235.42.95
```

**Edit backend .env**:
```bash
nano /home/ubuntu/TechSalesAxis/apps/api/.env
# Add or update variables
# Save: Ctrl+O, Enter, Ctrl+X
```

**Restart services to apply changes**:
```bash
sudo systemctl restart techsalesaxis-backend
```

---

## 💻 Local Development Changes

### Do You Need to Update Local Code?

**YES** - Update your local code with the same changes, but:

**Local .env differs from production**:
```bash
# apps/api/.env (LOCAL)
DATABASE_URL=postgresql://localhost/talentflow_dev  # Local DB
ZEPTOMAIL_API_KEY=<test-key>  # Test key
DEBUG=True  # Enable debugging
```

**Production .env**:
```bash
# On EC2 server
DATABASE_URL=postgresql://...@techsalesaxis-db.c34g4umwou6k.ap-south-1.rds.amazonaws.com:...  # AWS RDS
ZEPTOMAIL_API_KEY=<production-key>  # Production key
DEBUG=False  # Disable debugging
```

### Local Development Setup (Run This Once)

```bash
# 1. Pull latest code
cd ~/path/to/TALENTFLOW
git pull origin main

# 2. Backend setup
cd apps/api
pip install -r requirements.txt
python -m uvicorn src.main:app --reload  # Runs on 8000

# 3. Frontend setup (new terminal)
cd apps/web
npm install
npm run dev  # Runs on 3000

# 4. Test locally
curl http://localhost:8000/api/health
curl http://localhost:3000
```

### Important: Keep .env Local-Only

```bash
# .env should NEVER be in git
git status apps/api/.env  # Should show "not in git" (in .gitignore)

# If accidentally added, remove it:
git rm --cached apps/api/.env
git commit -m "Remove .env from git tracking"
```

---

## ✅ Pre-Deployment Checklist

Before pushing to production, verify all items:

### Code Quality
- [ ] Run linter: `npm run lint` (frontend)
- [ ] Run formatter: `black apps/api/` (backend)
- [ ] No hardcoded URLs or secrets in code
- [ ] All environment variables use process.env or os.environ
- [ ] No console.log or print statements left in production code
- [ ] API error messages don't expose internal details

### Testing
- [ ] Frontend builds without errors: `npm run build`
- [ ] Backend imports work: `python -c "from src.main import app"`
- [ ] All API endpoints tested: `curl http://localhost:8000/auth/login`
- [ ] File uploads work
- [ ] Email sending works (test with `test_zeptomail_final.py`)
- [ ] Database connection verified

### Git & Deployment
- [ ] All changes staged: `git status`
- [ ] Meaningful commit message written
- [ ] Commit pushed to main: `git push origin main`
- [ ] EC2 has SSH access ready
- [ ] Production .env file prepared (NOT in git)
- [ ] Database backups created

### Production Environment
- [ ] All environment variables in `/home/ubuntu/TechSalesAxis/apps/api/.env`
- [ ] Nginx config updated and tested
- [ ] Systemd service files in place
- [ ] Health check script deployed
- [ ] Cron job configured for monitoring

### Security
- [ ] .env is in .gitignore (not committed)
- [ ] Database credentials not hardcoded
- [ ] API keys from environment variables only
- [ ] CORS properly configured
- [ ] HTTPS certificate valid (Let's Encrypt)

---

## 🔄 Post-Deployment Verification

### Immediate Checks (Within 5 Minutes)

```bash
# SSH to server
ssh -i key.pem ubuntu@13.235.42.95

# 1. Services running?
sudo systemctl status techsalesaxis-backend techsalesaxis-frontend
# Expected: both "active (running)"

# 2. Ports bound correctly?
sudo ss -tlnp | grep -E ':(3001|8005)'
# Expected: 3001 (next-server), 8005 (gunicorn)

# 3. Frontend loads?
curl -I https://www.techsalesaxis.com/login
# Expected: HTTP/2 200 (not 502)

# 4. Backend responds?
curl -X POST http://localhost:8005/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@test.com","password":"test"}'
# Expected: 422 error (missing fields, but server responding)

# 5. No recent errors?
sudo journalctl -u techsalesaxis-backend -n 20
sudo journalctl -u techsalesaxis-frontend -n 20
# Expected: normal startup logs, no "ERROR" or "CRITICAL"
```

### Extended Checks (Over 24 Hours)

```bash
# 1. Monitor for unexpected restarts
systemctl show -p NRestarts techsalesaxis-frontend
systemctl show -p NRestarts techsalesaxis-backend
# Expected: low numbers, no constant increasing

# 2. Memory usage stable?
systemctl show -p MemoryCurrent techsalesaxis-backend
# Expected: Under 450MB, not growing continuously

# 3. No 502 errors in logs?
grep "502" /var/log/nginx/access.log | tail
# Expected: empty (no 502 errors)

# 4. Health check running?
tail -20 /var/log/talentflow-health-check.log
# Expected: recent timestamps, all checks ✅

# 5. Users can login?
# Test in browser: https://www.techsalesaxis.com/login
# Expected: Login page loads, can submit credentials
```

---

## 🚀 Future Deployment Instructions

### For Any Future Changes

#### Step 1: Local Development
```bash
# 1. Pull latest
git pull origin main

# 2. Make your changes
# Edit files in apps/api/src/ or apps/web/src/

# 3. Test locally
npm run build  # Frontend
python -c "from src.main import app"  # Backend

# 4. Verify your changes don't break existing functionality
```

#### Step 2: Commit & Push
```bash
# 1. Stage changes
git add apps/api/src/**/*.py
git add apps/web/src/**/*.tsx

# 2. Commit with clear message
git commit -m "feat: describe what changed

- Detail 1
- Detail 2"

# 3. Push to main
git push origin main
```

#### Step 3: Deploy to Production
```bash
# 1. SSH to server
ssh -i key.pem ubuntu@13.235.42.95

# 2. Pull latest code
cd /home/ubuntu/TechSalesAxis
git pull origin main

# 3. If backend changes:
cd apps/api
pip install -r requirements.txt  # Install any new dependencies

# 4. If frontend changes:
cd ../web
npm install && npm run build

# 5. Restart services
sudo systemctl restart techsalesaxis-backend techsalesaxis-frontend

# 6. Verify
sudo systemctl status techsalesaxis-backend techsalesaxis-frontend
curl -I https://www.techsalesaxis.com/login
```

#### Step 4: Post-Deployment
```bash
# Monitor logs for errors
sudo journalctl -u techsalesaxis-backend -f

# Run health check
sudo bash /opt/talentflow/check-service-health.sh
```

---

## 🐛 Troubleshooting & Recovery

### 502 Bad Gateway Error

**Diagnosis**:
```bash
# 1. Check if services running
sudo systemctl status techsalesaxis-frontend techsalesaxis-backend

# 2. Check if ports are bound
sudo ss -tlnp | grep -E ':(3001|8005)'

# 3. Check recent logs
sudo journalctl -u techsalesaxis-frontend -n 50
sudo journalctl -u techsalesaxis-backend -n 50
```

**Common Causes & Fixes**:

| Problem | Check | Fix |
|---------|-------|-----|
| Port already in use | `sudo lsof -i :3001` | `sudo fuser -k 3001/tcp` |
| Service crashed | `systemctl status` shows failed | `sudo systemctl restart techsalesaxis-frontend` |
| Memory exhausted | Check `MemoryCurrent` | Service auto-restarts via `Restart=always` |
| Database unreachable | Test: `psql --version` | Verify RDS security group allows EC2 |
| Nginx misconfigured | `sudo nginx -t` | Fix `/etc/nginx/sites-enabled/default` |

### Service in Restart Loop

**Symptoms**: Service status shows "activating..." repeatedly, 502 errors

**Fix**:
```bash
# 1. Stop the service
sudo systemctl stop techsalesaxis-frontend

# 2. Kill any lingering processes
sudo pkill -9 -f "npm\|node\|next"

# 3. Clear port
sudo fuser -k 3001/tcp 2>/dev/null || true

# 4. Start again
sudo systemctl start techsalesaxis-frontend

# 5. Monitor
sudo systemctl status techsalesaxis-frontend
```

### High Memory Usage

**Check**:
```bash
systemctl show -p MemoryCurrent techsalesaxis-backend
# Check trend over time
for i in {1..5}; do echo "$(date): $(systemctl show -p MemoryCurrent techsalesaxis-backend)"; sleep 5; done
```

**Fix**:
- Service will auto-restart due to `MemoryMax=512M`
- Review backend logs for memory leak
- Check if queries are not closing connections properly

### Email Not Sending

**Check**:
```bash
# Verify credentials
cat /home/ubuntu/TechSalesAxis/apps/api/.env | grep ZEPTOMAIL

# Test directly
python -c "
import requests
api_key = 'your-key'
response = requests.post('https://api.zeptomail.com/v1.1/email/send', 
    headers={'Authorization': f'Bearer {api_key}'},
    json={...})
print(response.status_code, response.json())
"
```

**Fix**:
- Verify API key is correct
- Check domain is verified in Zeptomail
- Test with `test_zeptomail_final.py` script
- Check backend logs: `sudo journalctl -u techsalesaxis-backend | grep -i email`

---

## 📊 Monitoring & Alerts

### Daily Monitoring Tasks

**Morning Check (5 min)**:
```bash
# SSH and run
ssh -i key.pem ubuntu@13.235.42.95 << 'EOF'
echo "=== Services ==="
systemctl is-active techsalesaxis-frontend && echo "Frontend: OK" || echo "Frontend: DOWN"
systemctl is-active techsalesaxis-backend && echo "Backend: OK" || echo "Backend: DOWN"

echo "=== Recent Errors ==="
sudo journalctl -u techsalesaxis-backend --since "1 hour ago" | grep -i error | head -3

echo "=== Check ===" 
grep "502" /var/log/nginx/access.log | wc -l | xargs -I {} echo "502 errors in 24h: {}"
EOF
```

### Weekly Monitoring Tasks

```bash
# Memory trend over week
systemctl show -p MemoryCurrent techsalesaxis-backend

# Restart count
systemctl show -p NRestarts techsalesaxis-backend

# Log size
du -sh /var/log/talentflow-health-check.log
```

### Monthly Maintenance

```bash
# Rotate logs
sudo logrotate -f /etc/logrotate.conf

# Review configuration
sudo systemctl show techsalesaxis-backend | grep -E "Restart|Memory|CPU"

# Test recovery
sudo systemctl stop techsalesaxis-frontend
# Should auto-restart within 10 seconds
sudo systemctl status techsalesaxis-frontend
```

### Automated Alerts (Optional Enhancement)

To set up email alerts for issues:
```bash
# Create alert script
cat > /opt/talentflow/alert-on-issues.sh << 'EOF'
#!/bin/bash
# Check if services running
if ! systemctl is-active --quiet techsalesaxis-frontend; then
    echo "Frontend down!" | mail -s "ALERT: TechSalesAxis Frontend Down" admin@techsalesaxis.com
fi
EOF

# Add to crontab
sudo crontab -e
# Add: */5 * * * * /opt/talentflow/alert-on-issues.sh
```

---

## 📝 Summary

This document covers all aspects of deploying TechSalesAxis to production:

1. **Learn from challenges**: Understanding what went wrong helps prevent future issues
2. **Follow the process**: Step-by-step instructions for consistent deployments
3. **Package management**: Know what dependencies are needed
4. **Environment configuration**: Separate local/production configs safely
5. **Pre-deployment**: Complete checklist before going live
6. **Post-deployment**: Verify everything works
7. **Future deployments**: Quick reference for making changes
8. **Troubleshooting**: Fixes for common issues
9. **Monitoring**: Keep systems healthy ongoing

---

## 🔗 Quick Links

- **Git Repository**: https://github.com/your-org/techsalesaxis
- **Production Server**: EC2 at 13.235.42.95
- **Production URL**: https://www.techsalesaxis.com
- **Database**: AWS RDS PostgreSQL (ap-south-1)
- **Email Service**: Zeptomail API
- **File Storage**: AWS S3

---

**Document Version**: 1.0  
**Last Updated**: 2026-04-15  
**Maintained By**: DevOps Team  
**Next Review**: 2026-05-15

