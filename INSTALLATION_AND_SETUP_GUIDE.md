# Installation & Setup Guide - Local Development

**Version:** 1.0  
**Last Updated:** April 2, 2026  
**Estimated Setup Time:** 30-45 minutes

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Detailed Setup](#detailed-setup)
4. [Environment Configuration](#environment-configuration)
5. [Database Setup](#database-setup)
6. [Credential Management](#credential-management)
7. [Verification & Testing](#verification--testing)
8. [Troubleshooting](#troubleshooting)

---

## ✅ Prerequisites

### System Requirements
- **OS:** Windows 10+, macOS 10.15+, or Ubuntu 20.04+
- **RAM:** 8GB minimum (16GB recommended)
- **Disk:** 10GB free space
- **CPU:** Dual-core processor (quad-core recommended)

### Required Software

#### 1. Python 3.10+
```powershell
# Check if installed
python --version

# If not installed, download from:
# https://www.python.org/downloads/

# Add to PATH during installation (Windows)
# Verify: python --version
```

#### 2. Node.js & npm (v18+)
```powershell
# Check if installed
node --version
npm --version

# If not installed, download from:
# https://nodejs.org/

# Verify installation
node --version  # Should be v18+
npm --version   # Should be v8+
```

#### 3. Git
```powershell
# Check if installed
git --version

# If not installed:
# https://git-scm.com/download/windows
```

#### 4. PostgreSQL 14+ (for local database, optional)
```powershell
# For local database testing
# Download from: https://www.postgresql.org/download/

# OR use remote database (recommended for development)
# Connection string provided in .env file
```

#### 5. VS Code (Optional but recommended)
```powershell
# Download from: https://code.visualstudio.com/
# Recommended extensions:
# - Python (Microsoft)
# - Prettier
# - ESLint
```

---

## 🚀 Quick Start

### One-Command Setup (Windows)

```powershell
# From project root
.\run_talentflow.bat
```

This script automatically:
1. Activates Python virtual environment
2. Installs Python dependencies
3. Installs Node.js dependencies
4. Starts FastAPI backend (port 8005)
5. Starts Next.js frontend (port 3000)

### Stop Services
```powershell
taskkill /F /IM python.exe
taskkill /F /IM node.exe
```

---

## 🔧 Detailed Setup

### Step 1: Clone Repository

```powershell
# Clone project
git clone <repository-url> TALENTFLOW
cd TALENTFLOW

# Or if already cloned
cd TALENTFLOW
```

### Step 2: Python Environment Setup

#### Windows

```powershell
# Create virtual environment
python -m venv .venv

# Activate virtual environment
.venv\Scripts\Activate.ps1

# If PowerShell execution policy error, run:
# Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Verify activation (should show (.venv) prefix)
```

#### macOS / Linux

```bash
# Create virtual environment
python3 -m venv .venv

# Activate virtual environment
source .venv/bin/activate

# Verify activation (should show (.venv) prefix)
```

### Step 3: Install Python Dependencies

```powershell
# Ensure venv is active (should see (.venv) prefix)

# Install backend dependencies
cd apps/api
pip install -r requirements.txt
cd ../..

# Verify installation
python -c "import fastapi; print(fastapi.__version__)"
```

**Key dependencies:**
- FastAPI (web framework)
- SQLAlchemy (database ORM)
- psycopg2 (PostgreSQL driver)
- google-generativeai (Gemini API)
- python-dotenv (environment variables)
- pydantic (data validation)

### Step 4: Install Node.js Dependencies

```powershell
# Frontend dependencies
cd apps/web
npm install
cd ../..

# Verify installation
npm --version
node --version
```

**Key dependencies:**
- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4.0
- axios (HTTP client)

---

## ⚙️ Environment Configuration

### Step 1: Create .env File

```powershell
# From project root
cp .env.example .env

# Open .env file and fill in values
# Use your favorite editor (VS Code, Notepad++, etc.)
```

### Step 2: Configure Database

```env
# .env file

# AWS RDS PostgreSQL (Production/Staging)
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@YOUR_RDS_ENDPOINT:5432/talentflow

# Example (DO NOT USE IN PRODUCTION):
# DATABASE_URL=postgresql://postgres:password@localhost:5432/talentflow
```

**To get RDS connection string:**
1. Login to AWS Console
2. Go to RDS > Databases > talentflow-db
3. Copy "Endpoint" and "Port"
4. Construct: `postgresql://username:password@endpoint:5432/dbname`

### Step 3: Configure AWS Credentials

```env
# AWS Configuration
AWS_ACCESS_KEY_ID=YOUR_AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=YOUR_AWS_SECRET_ACCESS_KEY
AWS_REGION=ap-south-1
S3_BUCKET_NAME=talentflow-files
```

**To get AWS credentials:**
1. AWS Console → IAM → Users → Your user
2. "Access keys" → Create access key
3. Download CSV or copy key/secret
4. Store securely (never commit to git)

### Step 4: Configure AI APIs

```env
# Google Gemini API
GOOGLE_API_KEY=YOUR_GEMINI_API_KEY

# Groq API (optional fallback)
GROQ_API_KEY=YOUR_GROQ_API_KEY
```

**To get API keys:**
1. **Gemini:** https://aistudio.google.com/apikey
2. **Groq:** https://console.groq.com/keys

### Step 5: Configure Email (AWS SES)

```env
# AWS SES Configuration
SES_REGION=ap-south-1
SES_SENDER_EMAIL=noreply@talentflow.com
```

**Note:** SES sender email must be verified in AWS console

### Step 6: Configure JWT

```env
# JWT Secret (generate a random 32+ character string)
JWT_SECRET=your_super_secret_key_at_least_32_characters_long

# Example generation:
# python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### Step 7: Complete .env File Template

```env
# ===== DATABASE =====
DATABASE_URL=postgresql://user:pass@host:5432/talentflow
PYTHONPATH=.

# ===== AWS =====
AWS_ACCESS_KEY_ID=YOUR_KEY
AWS_SECRET_ACCESS_KEY=YOUR_SECRET
AWS_REGION=ap-south-1
S3_BUCKET_NAME=talentflow-files

# ===== AI APIs =====
GOOGLE_API_KEY=YOUR_GEMINI_KEY
GROQ_API_KEY=YOUR_GROQ_KEY

# ===== EMAIL/SES =====
SES_REGION=ap-south-1
SES_SENDER_EMAIL=noreply@talentflow.com

# ===== JWT =====
JWT_SECRET=generate_random_32_char_string

# ===== BACKEND =====
BACKEND_PORT=8005
BACKEND_HOST=127.0.0.1
DEBUG=true

# ===== FRONTEND =====
NEXT_PUBLIC_API_URL=http://localhost:8005
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ===== LOGGING =====
LOG_LEVEL=INFO
```

---

## 🗄️ Database Setup

### Option 1: Use Remote AWS RDS (Recommended for Development)

```powershell
# No setup needed!
# Database URL in .env already points to AWS RDS
# Migrations run automatically on first API start
```

**Verify connection:**
```powershell
# From apps/api directory
python -c "from src.core.database import get_engine; engine = get_engine(); print('✅ Database connected')"
```

### Option 2: Use Local PostgreSQL

```powershell
# 1. Install PostgreSQL
# Download from: https://www.postgresql.org/download/

# 2. Create local database
# Open pgAdmin or psql:
createdb talentflow

# 3. Update .env
DATABASE_URL=postgresql://postgres:password@localhost:5432/talentflow

# 4. Verify connection
psql -U postgres -d talentflow -c "SELECT 1;"
```

### Database Migrations

```powershell
# Migrations run automatically on FastAPI startup
# If manual migration needed:

cd apps/api
python -c "from src.core.database import init_db; init_db()"
```

---

## 🔐 Credential Management

### Recommended Approach

1. **Never commit .env file**
   ```
   # .gitignore should contain:
   .env
   .env.local
   .env.*.local
   ```

2. **Use .env.example for reference**
   ```powershell
   # This file is committed to git
   # Shows required variables (without values)
   ```

3. **Share credentials securely**
   - Use 1Password, LastPass, or similar
   - Share via secure channels only
   - Rotate credentials regularly

### credential Storage (Team Development)

```
Option 1: Use .env.local (git-ignored)
Option 2: Use environment variables (set in terminal)
Option 3: Use AWS Secrets Manager (production)
Option 4: Use .env file in secure location
```

### Export Environment Variables (Linux/macOS)

```bash
export DATABASE_URL=postgresql://...
export AWS_ACCESS_KEY_ID=...
export GOOGLE_API_KEY=...

# Verify
echo $DATABASE_URL
```

---

## ✅ Verification & Testing

### Step 1: Verify Python Setup

```powershell
# Activate venv (if not already)
.venv\Scripts\Activate.ps1

# Check imports
python -c "import sqlalchemy; print('✅ SQLAlchemy OK')"
python -c "import fastapi; print('✅ FastAPI OK')"
python -c "import google.generativeai; print('✅ Gemini API OK')"
python -c "import psycopg2; print('✅ PostgreSQL driver OK')"
```

### Step 2: Verify Node.js Setup

```powershell
# Check versions
npm --version  # Should be v8+
node --version  # Should be v18+

# Check Next.js
cd apps/web
npm list next  # Should show version 16+
```

### Step 3: Start Backend

```powershell
cd apps/api

# Set environment
$env:PYTHONPATH="."
$env:DATABASE_URL="postgresql://..."  # Or from .env

# Start server
python -m uvicorn src.main:app --host 127.0.0.1 --port 8005 --reload
```

**Expected output:**
```
INFO:     Uvicorn running on http://127.0.0.1:8005
INFO:     Application startup complete
```

**Test backend:**
```powershell
# In new terminal
curl http://localhost:8005/health

# Should return:
# {"status":"healthy","timestamp":"2026-04-02T..."}
```

### Step 4: Start Frontend

```powershell
cd apps/web

# Start development server
npm run dev
```

**Expected output:**
```
▲ Next.js 16.0.1
  - Local:        http://localhost:3000
  - Environments: .env.local
```

**Access frontend:**
Open browser → http://localhost:3000

You should see TalentFlow homepage.

### Step 5: Test API Connection

```powershell
# Get API health
curl http://localhost:8005/health

# Test authentication (create account)
curl -X POST http://localhost:8005/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!",
    "role": "candidate"
  }'
```

---

## 🐛 Troubleshooting

### Issue 1: "Python not found"

**Solution:**
```powershell
# Verify installation
python --version

# If not found, reinstall Python:
# https://www.python.org/downloads/
# Check "Add Python to PATH" during installation
```

### Issue 2: "Module not found" errors

**Solution:**
```powershell
# Ensure venv is activated
.venv\Scripts\Activate.ps1

# Verify prompt shows (.venv):

# Reinstall dependencies
pip install -r apps/api/requirements.txt --force-reinstall
```

### Issue 3: "Database connection failed"

**Solution:**
```powershell
# 1. Verify DATABASE_URL in .env
cat .env | findstr DATABASE_URL

# 2. Check credentials
# Ensure username and password are correct

# 3. Test connection manually
python -c "import psycopg2; psycopg2.connect('postgresql://...')"

# 4. If using AWS RDS:
# - Verify security group allows your IP
# - Check RDS endpoint is correct
```

### Issue 4: "Port 8005 already in use"

**Solution:**
```powershell
# Find process using port
netstat -ano | findstr :8005

# Kill process
taskkill /PID <PID> /F

# Or use different port:
python -m uvicorn src.main:app --host 127.0.0.1 --port 8006
```

### Issue 5: "npm install hangs"

**Solution:**
```powershell
# Clear npm cache
npm cache clean --force

# Try again
npm install

# If still issues, delete node_modules and try:
rm -r apps/web/node_modules
npm install
```

### Issue 6: "CORS errors in browser"

**Solution:**
- CORS is enabled for all origins in development
- If still getting errors, check browser console for details
- Backend logs should show CORS headers being sent

### Issue 7: "Environment variables not loading"

**Solution:**
```powershell
# 1. Verify .env file exists in project root
ls .env

# 2. Verify variables are in correct format
cat .env | head -5

# 3. Restart backend/frontend after editing .env
```

### Issue 8: "API calls returning 401 Unauthorized"

**Solution:**
```powershell
# 1. Ensure you've signed up/logged in
# 2. Check JWT_SECRET is set in .env
# 3. Verify token is being sent in requests
# 4. Check browser console for auth errors
```

---

## 📱 Testing the Setup

### 1. Create Candidate Account

```
1. Open http://localhost:3000
2. Click "Signup" → "Candidate"
3. Enter: email@example.com, password
4. Click "Signup"
5. Enter OTP (check terminal logs for OTP)
6. Create profile
```

### 2. Create Recruiter Account

```
1. Go to http://localhost:3000
2. Click "Signup" → "Recruiter"
3. Enter company email
4. Follow onboarding
5. Create company profile
```

### 3. Test Core Features

- **For Candidates:**
  - Upload resume
  - Take assessment
  - Browse jobs
  - Apply to jobs
  
- **For Recruiters:**
  - Post job
  - View applications
  - Search candidates
  - Send messages

---

## 📝 Manual Testing Checklist

```
Backend Services:
☐ API health check (/health)
☐ Database connection
☐ AWS S3 connection
☐ Email (SES) working
☐ Gemini API accessible

Frontend Features:
☐ Pages load without errors
☐ API calls successful
☐ Responsive design works
☐ Forms submit correctly

Authentication:
☐ Signup process works
☐ Login process works
☐ JWT tokens generated
☐ Protected routes require auth

Features:
☐ Job posting works
☐ Resume upload works
☐ Assessment starts
☐ Chat messaging works
☐ Recommendations show jobs
```

---

## 🎓 Next Steps

After setup is complete:

1. **Review Documentation**
   - Read PROJECT_COMPLETE_FLOW.md
   - Read CANDIDATE_DASHBOARD_GUIDE.md
   - Read RECRUITER_DASHBOARD_GUIDE.md

2. **Explore Codebase**
   - Backend: apps/api/src/main.py
   - Frontend: apps/web/src/app/layout.tsx
   - Database: apps/api/src/models/

3. **Make Test Changes**
   - Modify a component
   - Add a new API endpoint
   - Execute migrations

4. **Run Tests**
   - Python tests: `pytest apps/api/tests/`
   - TypeScript: `npm run lint` (in apps/web)

---

## 🔗 Useful Links

- **FastAPI Docs:** http://localhost:8005/docs
- **Next.js Docs:** https://nextjs.org/docs
- **Tailwind CSS:** https://tailwindcss.com/
- **PostgreSQL:** https://www.postgresql.org/docs/
- **SQLAlchemy:** https://docs.sqlalchemy.org/

---

## 📞 Support

For issues:
1. Check troubleshooting section above
2. Review error logs in terminal
3. Check browser console (F12)
4. Review project documentation

---

## ✅ Conclusion

Your TalentFlow development environment is now ready!

- ✅ All dependencies installed
- ✅ Database configured
- ✅ APIs running locally
- ✅ Frontend accessible
- ✅ Ready to develop and test

Happy coding! 🚀
