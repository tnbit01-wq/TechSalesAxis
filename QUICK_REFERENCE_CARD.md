# 🚀 QUICK REFERENCE CARD - TechSalesAxis Deployment

## One-Page Quick Guide

---

## 📍 Production URL
🌐 **https://www.techsalesaxis.com**

---

## 🔐 To SSH Into Server
```bash
ssh -i "$env:USERPROFILE\Desktop\EC2-creds\TechSalesAxis-Mumbai-Key.pem" ubuntu@13.235.42.95
```

---

## 🛠️ To Make Changes (Most Common)

### Step 1: Edit Code Locally
```bash
cd ~/TALENTFLOW
# Make your changes in apps/api/src/ or apps/web/src/
```

### Step 2: Test Locally
```bash
# Frontend: npm run build (should succeed)
# Backend: python -c "from src.main import app" (should not error)
```

### Step 3: Commit & Push
```bash
git add apps/api/src apps/web/src
git commit -m "feat: describe what changed"
git push origin main
```

### Step 4: Deploy to Production
```bash
ssh -i key.pem ubuntu@13.235.42.95
cd /home/ubuntu/TechSalesAxis
git pull origin main

# If backend changed:
cd apps/api && pip install -r requirements.txt

# If frontend changed:
cd ../web && npm install && npm run build

# Restart both
sudo systemctl restart techsalesaxis-backend techsalesaxis-frontend
```

### Step 5: Verify
```bash
curl -I https://www.techsalesaxis.com/login  # Should be 200
```

---

## 🚨 If Something Breaks

### Frontend Not Loading / 502 Error?
```bash
ssh -i key.pem ubuntu@13.235.42.95
sudo systemctl restart techsalesaxis-frontend
sudo journalctl -u techsalesaxis-frontend -n 50
```

### Backend Not Responding?
```bash
sudo systemctl restart techsalesaxis-backend
sudo journalctl -u techsalesaxis-backend -n 50
```

### Services Keep Restarting?
```bash
sudo pkill -9 npm node next  # Kill all processes
sudo fuser -k 3001/tcp       # Free port 3001
sudo systemctl restart techsalesaxis-frontend
```

### Check Email Sending
```bash
grep -i email /var/log/talentflow-health-check.log
```

---

## 📊 Service Status Commands

```bash
# Check both services
sudo systemctl status techsalesaxis-frontend techsalesaxis-backend

# Check if running
systemctl is-active techsalesaxis-frontend
systemctl is-active techsalesaxis-backend

# Check ports
sudo ss -tlnp | grep -E ':(3001|8005)'

# Check memory usage
systemctl show -p MemoryCurrent techsalesaxis-backend

# Check logs (last 20 lines)
sudo journalctl -u techsalesaxis-frontend -n 20
sudo journalctl -u techsalesaxis-backend -n 20

# Check for 502 errors
grep "502" /var/log/nginx/access.log | tail

# Health check
tail -50 /var/log/talentflow-health-check.log
```

---

## 📦 What's Where

| Item | Location |
|------|----------|
| Frontend Code | `apps/web/src/` |
| Backend Code | `apps/api/src/` |
| Production Frontend | `/home/ubuntu/TechSalesAxis/apps/web/` |
| Production Backend | `/home/ubuntu/TechSalesAxis/apps/api/` |
| Frontend Service | `/etc/systemd/system/techsalesaxis-frontend.service` |
| Backend Service | `/etc/systemd/system/techsalesaxis-backend.service` |
| Nginx Config | `/etc/nginx/sites-enabled/default` |
| Health Check | `/opt/talentflow/check-service-health.sh` |
| Logs | `/var/log/talentflow-health-check.log` |
| Database | AWS RDS PostgreSQL (`techsalesaxis-db.c34g4umwou6k...`) |

---

## 🔄 Services Status

| Service | Port | Status | Auto-Restart |
|---------|------|--------|--------------|
| Frontend | 3001 | Running ✅ | Yes |
| Backend | 8005 | Running ✅ | Yes |
| Nginx | 80/443 | Running ✅ | System |
| Health Check | - | Running ✅ | Every 10 min |

---

## 📧 Email Configuration

- **Service**: Zeptomail
- **Status**: ✅ Configured
- **API Key**: In `/home/ubuntu/TechSalesAxis/apps/api/.env`
- **Domain**: mail.techsalesaxis.com
- **Sender Email**: noreply@techsalesaxis.com

---

## 📚 Documentation

- **[DEPLOYMENT_DOCUMENTATION_INDEX.md](DEPLOYMENT_DOCUMENTATION_INDEX.md)** - Start here
- **[DEPLOYMENT_COMPLETE_SUMMARY.md](DEPLOYMENT_COMPLETE_SUMMARY.md)** - Full details
- **[COMPLETE_DEPLOYMENT_GUIDE.md](COMPLETE_DEPLOYMENT_GUIDE.md)** - Detailed reference

---

## ⚡ Fast Commands

```bash
# SSH + pull + restart (fastest deployment)
ssh -i "$env:USERPROFILE\Desktop\EC2-creds\TechSalesAxis-Mumbai-Key.pem" ubuntu@13.235.42.95 \
  "cd /home/ubuntu/TechSalesAxis && git pull origin main && cd apps/web && npm install && npm run build && cd /home/ubuntu/TechSalesAxis && sudo systemctl restart techsalesaxis-backend techsalesaxis-frontend"

# Check if site is up
curl -I https://www.techsalesaxis.com/

# View real-time logs
ssh -i key.pem ubuntu@13.235.42.95 \
  "sudo journalctl -u techsalesaxis-backend -f"
```

---

## 🎯 Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| 502 error | `sudo systemctl restart techsalesaxis-frontend` |
| Port in use | `sudo fuser -k 3001/tcp` |
| Service won't start | Kill orphaned process: `sudo pkill -9 npm` |
| High memory | Service auto-restarts (512MB limit) |
| Logs not showing | `sudo systemctl status` or `journalctl -u <service>` |
| Email not sending | Check `.env` has ZEPTOMAIL keys |
| Need to SSH | `ssh -i key.pem ubuntu@13.235.42.95` |

---

## 🆘 Emergency Commands (Last Resort)

```bash
# Stop everything
sudo systemctl stop techsalesaxis-frontend techsalesaxis-backend

# Kill all processes
sudo pkill -9 npm node next gunicorn

# Free ports
sudo fuser -k 3001/tcp
sudo fuser -k 8005/tcp

# Restart services
sudo systemctl restart techsalesaxis-frontend techsalesaxis-backend

# Wait and check
sleep 5
sudo systemctl status techsalesaxis-frontend techsalesaxis-backend
```

---

## ✅ Pre-Deployment Checklist

Before pushing code to production:

- [ ] Code tested locally
- [ ] No hardcoded URLs (use env vars)
- [ ] No hardcoded secrets
- [ ] Frontend builds: `npm run build`
- [ ] Backend imports: `python -c "from src.main import app"`
- [ ] Git committed: `git push origin main`
- [ ] Ready to deploy: Verify on production

---

## 📞 Key Contacts

- **Production URL**: https://www.techsalesaxis.com
- **Git Repository**: https://github.com/tnbit01-wq/TechSalesAxis
- **EC2 Server**: 13.235.42.95
- **Database**: AWS RDS PostgreSQL (ap-south-1)
- **Email Service**: Zeptomail

---

**Keep this card handy for quick reference!**

Last Updated: April 15, 2026  
Status: ✅ LIVE & OPERATIONAL
