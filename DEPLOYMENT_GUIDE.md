# TechSalesAxis Production Deployment Guide

**Last Updated:** April 14, 2026  
**Status:** ✅ Production Live at https://www.techsalesaxis.com  
**Environment:** AWS EC2 (t3.small, Ubuntu 24.04) in ap-south-1 (Mumbai)

---

## Table of Contents
1. [Deployment Challenges & Solutions](#challenges)
2. [Current Production Setup](#production-setup)
3. [Manually Installed Packages](#packages)
4. [Missing/Pending Items](#missing-items)
5. [Step-by-Step Deployment Process](#deployment-steps)
6. [Making Changes & Pushing to Production](#pushing-changes)
7. [Pre-Deployment Checklist](#checklist)
8. [Troubleshooting](#troubleshooting)

---

## Challenges & Solutions {#challenges}

### Challenge 1: Hardcoded API URLs in Frontend
**Problem:** Frontend had hardcoded URLs like `http://127.0.0.1:8000`, `http://localhost:8000` across multiple component files.

**Root Cause:** During development, API URLs were hardcoded in:
- `src/lib/apiClient.ts`
- `src/components/GlobalChatInterface.tsx`
- `src/components/BulkUploadAdmin.tsx`
- `src/app/admin/dashboard/page.tsx`
- `src/app/admin/settings/page.tsx`
- 6+ other component files

**Solution Applied:**
```bash
# Replaced all hardcoded URLs with `/api`
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s#http://127.0.0.1:8005#/api#g; s#http://localhost:8005#/api#g; s#http://127.0.0.1:8001#/api#g" {} +
```

**Lesson:** Always use environment variables for API URLs, never hardcode them.

---

### Challenge 2: Environment Variable Overrides (`.env.local`)
**Problem:** Frontend was still using `localhost:8000` in production even after fixing code.

**Root Cause:** `.env.local` file existed with `NEXT_PUBLIC_API_URL=http://localhost:8000`. In Next.js, `.env.local` has priority over `.env`.

**Solution:**
```bash
# Removed the local override file
rm .env.local

# Ensured .env has correct value
echo "NEXT_PUBLIC_API_URL=/api" > .env

# Verified no other override files
ls -la .env*
```

**Lesson:** Check `.env.local`, `.env.production`, `.env.development` files. Git should ignore `.env.local` to prevent conflicts.

---

### Challenge 3: Port Conflicts (Frontend)
**Problem:** Port 3000 was already in use, then port 3001 showed EADDRINUSE errors even after killing processes.

**Root Cause:** Multiple instances or orphaned processes still holding the port. Standard `pkill npm` wasn't aggressive enough.

**Solution:**
```bash
# Force kill all node/npm processes
pkill -9 -f "npm start"
pkill -9 -f "next"
pkill -9 node
sleep 3

# Verify ports are free
sudo lsof -i :3000
sudo lsof -i :3001

# Start frontend on expected port (3001)
PORT=3001 nohup npm start > frontend.log 2>&1 &
```

**Lesson:** Always check `sudo lsof -i :PORT` before starting services. Use `-9` flag aggressively.

---

### Challenge 4: Nginx Upstream Configuration
**Problem:** Login requests returned 404 "Not Found" errors.

**Root Cause:** Nginx upstreams for `frontend` and `backend` were not defined properly, or frontend was running on wrong port.

**Solution:**
```nginx
# Correct upstream definitions in /etc/nginx/sites-enabled/default
upstream frontend {
    server localhost:3001;  # Frontend on 3001, NOT 3000
}

upstream backend {
    server localhost:8005;
}

# API path routing with rewrite
location /api/ {
    rewrite ^/api/(.*) /$1 break;  # Strip /api prefix before forwarding
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

**Lesson:** Frontend and Nginx upstream ports MUST match. Always test with `curl http://localhost:PORT/health`.

---

### Challenge 5: API Endpoint Path Mismatch
**Problem:** Frontend sending requests to `/api/auth/login`, backend returning 404.

**Root Cause:** Backend router mounted at `/auth` prefix, so endpoint is just `/login`, not `/api/auth/login`. Frontend was adding extra `/api` prefix that Nginx wasn't stripping.

**Solution:** Added Nginx rewrite rule to strip `/api` prefix before forwarding to backend.

**Lesson:** Understand your backend router structure (`include_router(auth_router, prefix="/auth")`). Frontend path must match backend path + Nginx forwarding.

---

## Current Production Setup {#production-setup}

### Infrastructure
- **Compute:** AWS EC2 t3.small (1 vCPU, 2GB RAM, Ubuntu 24.04)
- **Region:** ap-south-1 (Mumbai)
- **Database:** AWS RDS PostgreSQL (endpoint: `techsalesaxis-db.c34g4umwou6k.ap-south-1.rds.amazonaws.com`)
- **Storage:** S3 bucket `techsalesaxis-storage`
- **Domain:** techsalesaxis.com (via GoDaddy DNS)
- **SSL:** Let's Encrypt (via Certbot, auto-renewal enabled)

### Service Architecture
```
User Browser (https://www.techsalesaxis.com)
    ↓
Nginx Reverse Proxy (port 80/443)
    ├→ / (port 3001) → Frontend (Next.js)
    └→ /api/* (port 8005) → Backend (FastAPI + Gunicorn)
```

### Running Services
| Service | Port | Process | Start Command |
|---------|------|---------|---------------|
| Frontend | 3001 | Next.js (npm start) | `PORT=3001 nohup npm start > frontend.log 2>&1 &` |
| Backend | 8005 | Gunicorn + Uvicorn | `gunicorn -w 2 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8005 src.main:app` |
| Nginx | 80/443 | Nginx | `sudo systemctl start nginx` |

---

## Manually Installed Packages {#packages}

### System Packages (Installed but not in requirements)
```bash
# Web Server
sudo apt install nginx

# SSL Certificate
sudo apt install certbot python3-certbot-nginx

# Node.js & npm
sudo apt install nodejs npm

# Python Build Tools (for dependencies)
sudo apt install python3-dev build-essential

# Package Manager Upgrades
sudo apt install pip
pip install --upgrade pip
```

### Python Packages Not Listed (Discovered during deployment)
The following were needed but may not be in `requirements.txt`:

```bash
# Backend dependencies verified:
pip install fastapi uvicorn gunicorn python-multipart
pip install sqlalchemy psycopg2-binary
pip install pydantic python-jose passlib
pip install httpx aiofiles
```

**Action Item:** Run this to update requirements.txt:
```bash
# On EC2, generate complete list
cd ~/TechSalesAxis/apps/api
pip freeze > requirements_complete.txt

# Compare with your current requirements.txt
diff requirements.txt requirements_complete.txt
```

### JavaScript/Node Packages
All npm packages are listed in `package.json`. Ensure you run:
```bash
npm install  # Installs all dependencies from package-lock.json
```

---

## Missing/Pending Items {#missing-items}

### 🔴 Critical (Should fix soon)
- [ ] **Database Backup Strategy** - No automated RDS backups configured
- [ ] **Monitoring & Alerts** - No CloudWatch alarms set up
- [ ] **Error Logging** - Application errors not being centrally logged
- [ ] **Rate Limiting** - No API rate limiting configured

### 🟡 Important (Nice to have)
- [ ] **API Documentation** - Swagger/OpenAPI docs endpoint
- [ ] **Health Check Endpoint** - Backend `/health` endpoint
- [ ] **Caching** - Redis caching not configured
- [ ] **Load Balancing** - Only single EC2 instance
- [ ] **Database Migrations** - No Alembic migrations setup
- [ ] **Environment Secrets** - Sensitive values hardcoded (need AWS Secrets Manager)

### 🟢 Optimization (Future improvements)
- [ ] **Cost Reduction** - Downgrade EC2 from t3.small to t3.micro
- [ ] **SEO** - Meta tags optimization
- [ ] **Performance** - Image optimization, lazy loading
- [ ] **CI/CD** - GitHub Actions for automatic deployment
- [ ] **Testing** - Unit tests, integration tests for backend

---

## Step-by-Step Deployment Process {#deployment-steps}

### First-Time Deployment (Already Done)

```bash
# 1. SSH into EC2
ssh -i "path/to/key.pem" ubuntu@13.235.42.95

# 2. Clone the repository
git clone <your-repo-url> ~/TechSalesAxis
cd ~/TechSalesAxis

# 3. Setup Backend
cd ~/TechSalesAxis/apps/api
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 4. Start Backend
nohup ~/.venv/bin/gunicorn -w 2 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8005 src.main:app > backend.log 2>&1 &

# 5. Setup Frontend
cd ~/TechSalesAxis/apps/web
npm install
echo "NEXT_PUBLIC_API_URL=/api" > .env
npm run build
PORT=3001 nohup npm start > frontend.log 2>&1 &

# 6. Configure Nginx
sudo tee /etc/nginx/sites-enabled/default > /dev/null <<'EOF'
upstream frontend {
    server localhost:3001;
}

upstream backend {
    server localhost:8005;
}

server {
    server_name techsalesaxis.com www.techsalesaxis.com;
    listen 80;

    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
    }

    location /api/ {
        rewrite ^/api/(.*) /$1 break;
        proxy_pass http://backend;
        proxy_http_version 1.1;
    }
}
EOF

sudo nginx -t
sudo systemctl reload nginx

# 7. Setup SSL
sudo certbot --nginx -d techsalesaxis.com -d www.techsalesaxis.com

# 8. Verify
curl https://www.techsalesaxis.com/login
```

---

## Making Changes & Pushing to Production {#pushing-changes}

### Scenario 1: Frontend Change (HTML/CSS/JavaScript)

```bash
# 1. On LOCAL machine - Make your changes
# Edit files in c:\Users\Admin\Desktop\Projects\TALENTFLOW\apps\web\src\

# 2. Commit and push to Git
cd c:\Users\Admin\Desktop\Projects\TALENTFLOW
git add .
git commit -m "Fix: Update login form styling"
git push origin main

# 3. On EC2 - Pull and deploy
ssh -i "key.pem" ubuntu@13.235.42.95 << 'DEPLOY'
cd ~/TechSalesAxis
git pull origin main

# Rebuild frontend
cd ~/TechSalesAxis/apps/web
npm run build

# Restart frontend
pkill -9 -f "npm start"
sleep 2
PORT=3001 nohup npm start > frontend.log 2>&1 &

# Verify
sleep 10
curl https://www.techsalesaxis.com | head -5
DEPLOY
```

### Scenario 2: Backend Change (Python/API)

```bash
# 1. On LOCAL machine - Make your changes
# Edit files in c:\Users\Admin\Desktop\Projects\TALENTFLOW\apps\api\src\

# 2. Test locally first!
cd c:\Users\Admin\Desktop\Projects\TALENTFLOW\apps\api
python -m pytest  # Run tests

# 3. Commit and push
git add .
git commit -m "Feature: Add new auth endpoint"
git push origin main

# 4. On EC2 - Pull and restart
ssh -i "key.pem" ubuntu@13.235.42.95 << 'DEPLOY'
cd ~/TechSalesAxis
git pull origin main

# If new dependencies added:
cd ~/TechSalesAxis/apps/api
source venv/bin/activate
pip install -r requirements.txt

# Restart backend
pkill -9 gunicorn
sleep 2
nohup ~/.venv/bin/gunicorn -w 2 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8005 src.main:app > backend.log 2>&1 &

# Verify
sleep 5
curl http://localhost:8005/health
DEPLOY
```

### Scenario 3: Environment Variable Change

```bash
# 1. Update .env files
# Create DIFFERENT .env files for LOCAL and PRODUCTION

# Local: c:\Users\Admin\Desktop\Projects\TALENTFLOW\apps\web\.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000  # For local development

# Production: should NOT be in Git
# On EC2, manually edit after deployment:
ssh -i "key.pem" ubuntu@13.235.42.95
echo "NEXT_PUBLIC_API_URL=/api" > ~/TechSalesAxis/apps/web/.env
```

---

## Pre-Deployment Checklist {#checklist}

### Before Pushing Code to Production

```
Code Quality
- [ ] No console.log() statements left (except critical errors)
- [ ] No hardcoded URLs or secrets
- [ ] No TODO comments left
- [ ] Code is formatted (Prettier/Black)
- [ ] No broken imports or unused variables

Testing
- [ ] Tested locally in development mode
- [ ] Tested the specific feature end-to-end
- [ ] Checked browser console for errors
- [ ] Verified API requests in Network tab
- [ ] Tested on different browsers (Chrome, Firefox, Safari)

Environment
- [ ] .env has correct API_URL (/api for production)
- [ ] No .env.local file committed to Git
- [ ] Database connection string is correct
- [ ] AWS credentials are valid
- [ ] S3 bucket access is working

Documentation
- [ ] Updated this DEPLOYMENT_GUIDE.md if relevant
- [ ] Added comments to complex code
- [ ] Updated README.md if needed

Security
- [ ] No sensitive data in code (keys, passwords, tokens)
- [ ] Auth tokens are securely stored
- [ ] CORS headers are configured correctly
- [ ] HTTPS is enforced

Performance
- [ ] Page load time is acceptable (<3 seconds)
- [ ] No memory leaks in frontend
- [ ] Backend response time is good (<500ms)
- [ ] Database queries are optimized
```

### After Pushing to Production

```
Verification
- [ ] Site loads without errors: https://www.techsalesaxis.com
- [ ] Login works correctly
- [ ] API calls return correct data
- [ ] No 500 errors in browser console
- [ ] Images load correctly
- [ ] Forms submit correctly

Monitoring
- [ ] Check backend logs: tail -50 ~/TechSalesAxis/apps/api/backend.log
- [ ] Check frontend logs: tail -50 ~/TechSalesAxis/apps/web/frontend.log
- [ ] Check Nginx logs: sudo tail -50 /var/log/nginx/error.log
- [ ] Verify service is running: ps aux | grep -E "npm|gunicorn"
- [ ] Check EC2 resources: Memory/CPU/Disk not at capacity

Rollback Plan (if something breaks)
- [ ] Have the previous Git commit ID ready
- [ ] Can quickly git revert if needed
- [ ] Know how to restart services
- [ ] Have database backup location noted
```

---

## Troubleshooting {#troubleshooting}

### Frontend not loading
```bash
# Check if npm process is running
ps aux | grep "npm start"

# Check frontend logs
tail -50 ~/TechSalesAxis/apps/web/frontend.log

# Check if Nginx can reach frontend
curl http://localhost:3001

# Verify port
sudo lsof -i :3001
```

### API returns 404
```bash
# Check if backend is running
ps aux | grep gunicorn

# Check backend logs for errors
tail -100 ~/TechSalesAxis/apps/api/backend.log

# Test backend directly
curl http://localhost:8005/auth/login -X POST

# Check Nginx rewrite rules
sudo grep -A 10 "location /api" /etc/nginx/sites-enabled/default
```

### Port already in use
```bash
# Find what's using the port
sudo lsof -i :3001

# Kill the process
sudo kill -9 <PID>

# Or kill all node processes
pkill -9 -f "node\|npm"
```

### SSL Certificate Expired
```bash
# Renew Let's Encrypt certificate
sudo certbot renew

# Or force renewal
sudo certbot renew --force-renewal

# Reload Nginx
sudo systemctl reload nginx
```

---

## Regular Maintenance

### Weekly
- [ ] Monitor disk usage: `df -h`
- [ ] Check logs for errors
- [ ] Verify SSL certificate expiry: `sudo certbot certificates`

### Monthly
- [ ] Update system packages: `sudo apt update && sudo apt upgrade`
- [ ] Review AWS costs
- [ ] Check database performance

### Quarterly
- [ ] Backup database
- [ ] Review and optimize slow queries
- [ ] Security audit

---

## Contact & Support

For deployment issues:
1. Check this guide's Troubleshooting section
2. Check application logs
3. Review the Challenges & Solutions section
4. Contact: [Your contact info]

---

**Remember:** Always test changes locally before pushing to production!
