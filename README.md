# TalentFlow: Verified Talent Marketplace

A sophisticated AI-driven recruitment platform where both **candidates and companies are verified**, creating a trust-based hiring ecosystem powered by AI assessment, resume parsing, and fair hiring practices.

---

## 📋 Documentation Guide

**START HERE** → Read these two documents first:

1. **[PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md)** ⭐
   - Complete technical and non-technical breakdown of all implemented features
   - Database schema, API reference, architecture
   - User workflows (candidate & recruiter)
   - **Use this for:** Developer onboarding, future reference, feature lookup

2. **[BRAND_AND_MARKETING_SUMMARY.md](BRAND_AND_MARKETING_SUMMARY.md)** 🎨
   - One-line pitch, brand pillars, USPs
   - Video scripts, logo concepts, target markets
   - Competitive positioning, messaging guidelines
   - **Use this for:** Logo design, video creation, marketing talks

---

## 🚀 Quick Start

### Project Structure
```
TALENTFLOW/
├── apps/
│   ├── api/              # FastAPI backend (Python)
│   │   └── src/          # Core API logic
│   └── web/              # Next.js 16 frontend (React/TypeScript)
├── docs/                 # Reference SQL schemas only (legacy kept)
├── infra/                # Infrastructure scripts
├── PROJECT_DOCUMENTATION.md    # ⭐ Master reference document
├── BRAND_AND_MARKETING_SUMMARY.md # 🎨 Marketing & branding guide
└── run_talentflow.bat    # Unified run script
```

### Development Setup

**One-Command Start:**
```powershell
# From project root
.\run_talentflow.bat
```

**Manual Setup:**
```powershell
# Terminal 1: Backend
cd apps/api
$env:PYTHONPATH="."
python -m uvicorn src.main:app --host 127.0.0.1 --port 8000 --reload

# Terminal 2: Frontend
cd apps/web
npm run dev
```

**Stop:**
```powershell
taskkill /F /IM python.exe
taskkill /F /IM node.exe
```

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16 + React 19 + TypeScript + Tailwind CSS 4.0 |
| **Backend** | FastAPI (Python 3.x) + SQLAlchemy ORM |
| **Database** | AWS RDS (PostgreSQL) in ap-south-1 (Mumbai) |
| **Auth** | Custom JWT (FastAPI + Secrets Manager) + AWS SES OTP |
| **AI** | Google Gemini 1.5 Flash + Groq Llama 3.3 (70B) |
| **Video** | Jitsi Meet (open-source) |
| **Storage** | AWS S3 (ap-south-1) + CloudFront CDN |
| **Email** | AWS SES for OTP, Password Reset, Notifications |

---

## ✨ Core Features (Implemented & Production-Ready)

### For Candidates
✅ AI-powered skill assessment (adaptive 6-16 questions)  
✅ Resume parsing & PDF generation  
✅ Trust score (0-100) with detailed feedback  
✅ AI-matched job recommendations  
✅ Virtual interview scheduling (Jitsi Meet)  
✅ Real-time messaging with recruiters  
✅ Career GPS (market intelligence)  
✅ Anti-cheat enforcement (tab-switch bans)  

### For Recruiters
✅ Company trust scoring (CPS: 0-100)  
✅ Dual hiring pipelines (Applied + AI-Recommended)  
✅ Global talent pool search (100% verified candidates)  
✅ AI-assisted job posting  
✅ Bulk candidate actions (shortlist, reject)  
✅ Interview scheduling & Jitsi integration  
✅ Market intelligence dashboard  
✅ Notification hub (Signal Center)  

---

## 🔐 Security

- **JWT Authentication:** Custom FastAPI JWT-based auth (no external auth provider)
- **OTP & Password Reset:** AWS SES for email delivery
- **Database Security:** AWS IAM roles + Security Groups + Secrets Manager
- **Anti-Cheat:** Tab-switch detection, permanent account blocks for violations
- **Data Encryption:** AES-256 for sensitive data at rest + TLS in transit
- **Audit Trail:** All actions timestamped and logged to RDS

---

## 📊 System Highlights

| Feature | Details |
|---------|---------|
| **Assessment Quality** | Gemini AI grades 0-6 per rubric dimension; 4 components average to 0-100 trust score |
| **Resume Parsing** | Groq Llama 3.3 real-time extraction + Gemini fallback |
| **Matching Algorithm** | Deterministic rules: skill % (20-50%), experience alignment (20-30%), score compatibility (20-40%) |
| **Interview Setup** | <2 minutes from shortlist to Jitsi link sent |
| **Application Filtering** | 90%+ noise reduction via trust gates |
| **Company Vetting** | 5 strategic questions (125-bank); CPS never decreases (MAX logic) |

---

## 🔧 Configuration

**Required Environment Variables:**
# AWS RDS Database
DATABASE_URL=postgresql://postgres:PASSWORD@RDS_ENDPOINT:5432/techsalesaxis

# AWS Services
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=ap-south-1
S3_BUCKET_NAME=techsalesaxis-files

# Authentication
JWT_SECRET=your_secure_jwt_secret

# AI APIs
GOOGLE_API_KEY=your_gemini_api_key
OPENROUTER_API_KEY=your_openrouter_key
```

Set in `.env` file in `apps/api` folder
Set in `.env` file in both `apps/api` and `apps/web`.

---

## 📚 For Different Roles

### Developers
→ Read **[PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md)** sections 7-11 (API, Architecture, Database)

### Product Managers
→ Read **[PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md)** sections 3-6 (Features, User Workflows)

### Designers / Branding
→ Read **[BRAND_AND_MARKETING_SUMMARY.md](BRAND_AND_MARKETING_SUMMARY.md)** (complete guide)

### HR / Recruiters
→ Read **[PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md)** section 4 (Recruiter Experience)

---

## ⚠️ Important Notes

⚠️ Important Notes

- **All old debug scripts have been removed** (they were testing artifacts)
- **All outdated documentation has been archived** (everything is in PROJECT_DOCUMENTATION.md now)
- **SQL schemas are in docs/ for reference only** (schema is enforced by actual code)
- **Development logs and migration scripts are not needed** (AWS migration is complete)

---

## 📋 AWS Migration Status (Completed March 2026)

### From Supabase to AWS-Native Architecture

**What Changed:**
| Component | Before (Supabase) | After (AWS) |
|-----------|-------------------|-----------|
| **Database** | Supabase PostgreSQL | AWS RDS PostgreSQL (ap-south-1) |
| **Authentication** | Supabase JWT + Auth | Custom FastAPI JWT + AWS Secrets Manager |
| **Email Delivery** | Supabase Auth emails | AWS SES (OTP, Password Reset, Notifications) |
| **File Storage** | Supabase Storage + S3 | AWS S3 only (ap-south-1) |
| **Real-time** | Supabase Realtime | FastAPI WebSockets + Database Polling |
| **Row-Level Security** | Supabase RLS Policies | Application-Layer Auth (FastAPI) |

**Migration Completed:**
✅ All Supabase references removed from codebase  
✅ AWS RDS PostgreSQL database created (ap-south-1)  
✅ Users table migrated with data only (other tables empty)  
✅ AWS S3 bucket created with folder structure  
✅ FastAPI configured for custom JWT authentication  
✅ AWS SES configured for email delivery  
✅ Environment variables updated to AWS format  
✅ Next.js config updated for S3 image domains  
✅ Python dependencies cleaned (removed supabase packages)  
✅ SQL migration scripts updated (removed Supabase-specific syntax)  

**No More Needed:**
❌ Supabase account  
❌ Supabase API keys  
❌ Supabase Storage  
❌ Supabase Auth (replaced by FastAPI JWT)  
❌ Row-Level Security policies (replaced by FastAPI middleware)  

**Current Configuration:**
```bash
# AWS RDS
DATABASE_URL=postgresql://postgres:PASSWORD@YOUR_ENDPOINT:5432/techsalesaxis
AWS_REGION=ap-south-1

# AWS S3
S3_BUCKET_NAME=techsalesaxis-files
AWS_ACCESS_KEY_ID=YOUR_KEY
AWS_SECRET_ACCESS_KEY=YOUR_SECRET

# Email & Auth
JWT_SECRET=your_secure_key
OPENAI_API_KEY=your_key
GOOGLE_API_KEY=your_key
```

**Database Locations:**
- **Endpoint:** ap-south-1 (Mumbai)
- **Region:** AWS RDS ap-south-1
- **Backup:** Automated daily snapshots (7-day retention)
- **Instance:** db.t4g.micro (scalable with Autoscaling Groups for production)
