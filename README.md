# TalentFlow: AI-Driven Talent Acquisition (AWS Native)

A sophisticated platform for high-assurance recruitment using OpenAI/Gemini for behavioral analysis and biometric/behavioral verification (Nuclear Ban). Now fully decoupled from Supabase and running on AWS-native infrastructure.

## Project Structure

- apps/api: FastAPI backend (Python 3.11+)
- apps/web: Next.js 16 + Tailwind CSS 4 frontend
- docs/: Authoritative architectural and schema documentation
- infra/: AWS Infrastructure for RDS and S3
- packages/shared/: Shared enums and markdown schema references

## Key Systems

### 1. High-Assurance Assessment Engine

- Adaptive Priority Pipeline: Dynamically sequences questions based on candidate data.
- Strategic Recruiter Auditor: Dynamic 125-question bank for recruiters.
- Unbiased Semantic Scoring: Powered by Gemini 2.0 Flash.
- Nuclear Ban: Integrity monitoring (tab switching) to ensure assessment validity.

### 2. AWS-Native Auth & Infrastructure

- AWS SES: Replaces legacy Supabase Auth for high-deliverability OTP and Password Reset emails.
- AWS RDS (Postgres): Primary database for user metadata and profiles.
- AWS S3: Handles all persistent storage (Resumes, Photos).
- FastAPI Auth: Custom JWT-based authentication system.

## Development Setup

### Run Both Together (Recommended)
Run the unified runner from the project root:
.\run_talentflow.bat

### Backend (FastAPI)
# If you are already in apps/api, just run:
$env:PYTHONPATH="."
$env:DATABASE_URL="postgresql://postgres:tX6v2KraCehQkZR@talentflow-db.cjymcuai297y.ap-southeast-2.rds.amazonaws.com:5432/talentflow"
C:/Python314/python.exe -m uvicorn src.main:app --host 127.0.0.1 --port 8000 --reload

### Frontend (Next.js)
cd apps/web
npm run dev

### Task kill
taskkill /F /IM python.exe; taskkill /F /IM node.exe

## Security Model
- Application-Level RBAC: FastAPI handles Role-Based Access Control and authentication logic.
- Path Guarding: Backend-driven redirection based on onboarding_step.

## Production Checklist

### Pre-Live Checks
1. SES Sandbox: Request production access in AWS SES Console.
2. S3 CORS: Ensure your S3 bucket allows the frontend production domain.
3. Environment Sync: Sync DATABASE_URL, JWT_SECRET, and GOOGLE_API_KEY to production.
4. Schema Sync: Run python sync_aws_schema.py on the production RDS once.

### Deployment Guide (AWS)
- Backend: AWS App Runner or EC2 (Dockerized).
- Frontend: Vercel (Preferred) or AWS Amplify.
- Database: Managed AWS RDS PostgreSQL Service.
- Storage: AWS S3 Bucket.
