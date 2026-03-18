# Production API Requirements & Services

**Last Updated:** March 6, 2026  
**Status:** Production Readiness Guide

---

## Overview

This document outlines all external API services required for TalentFlow's production deployment. All services listed are **production-grade, scalable, and independent of GitHub Copilot**.

---

## 1. Core Infrastructure (Required)

### 1.1 Supabase (Database & Auth)
- **Purpose**: PostgreSQL database, real-time subscriptions, authentication, file storage
- **Current Usage**: All user data, profiles, assessments, notifications, resume storage
- **Pricing**: 
  - Free tier: Up to 500MB database, 1GB file storage
  - Pro: $25/month (8GB database, 100GB storage)
  - Team: $599/month (Custom limits)
- **API Key Required**: 
  - `SUPABASE_URL` (Project URL)
  - `SUPABASE_ANON_KEY` (Public anon key)
  - `SUPABASE_SERVICE_ROLE_KEY` (Admin operations)
- **Scalability**: Auto-scaling, handles millions of rows
- **Setup**: Sign up at https://supabase.com
- **No GitHub Dependency**: ✅ Fully independent

---

## 2. AI/LLM Services (Optional but Recommended)

### 2.1 Google Gemini API (Primary Recommendation)
- **Purpose**: 
  - Resume parsing and extraction
  - Assessment question generation
  - AI chat interface (for conversational recruiting)
  - Psychometric analysis
- **Current Usage**: 
  - `resume_service.py` - Resume parsing with Gemini 2.0 Flash
  - `ai_intent.py` - Currently uses regex (can be upgraded to Gemini for NLP)
- **Pricing** (March 2026):
  - **Gemini 2.0 Flash**: FREE up to 1,500 requests/day
  - Gemini 1.5 Flash: $0.075 per 1M input tokens, $0.30 per 1M output tokens
  - Gemini 1.5 Pro: $1.25 per 1M input tokens, $5.00 per 1M output tokens
- **API Key Required**: `GOOGLE_API_KEY` (from Google AI Studio)
- **Scalability**: Rate limits up to 2,000 RPM on paid tiers
- **Setup**: https://aistudio.google.com/apikey
- **No GitHub Dependency**: ✅ Fully independent

### 2.2 Groq API (Fast Inference Alternative)
- **Purpose**: Ultra-fast LLM inference (optional fallback for resume parsing)
- **Current Usage**: Configured as fallback in `resume_service.py`
- **Pricing**:
  - **FREE tier**: 14,400 requests/day (Mixtral 8x7B, Llama 3)
  - Paid: Custom pricing for higher limits
- **API Key Required**: `GROQ_API_KEY`
- **Speed**: Up to 500 tokens/second (fastest in market)
- **Setup**: https://console.groq.com
- **No GitHub Dependency**: ✅ Fully independent

### 2.3 OpenRouter API (Multi-Model Gateway - Optional)
- **Purpose**: Access to 100+ LLM models through single API
- **Current Usage**: Configured as alternative fallback
- **Pricing**: Pay-per-token (varies by model)
  - Claude 3.5 Sonnet: $3/$15 per 1M tokens
  - GPT-4o: $2.50/$10 per 1M tokens
- **API Key Required**: `OPENROUTER_API_KEY`
- **Setup**: https://openrouter.ai/
- **No GitHub Dependency**: ✅ Fully independent

---

## 3. Current AI Implementation Status

### 3.1 Resume Parsing (`resume_service.py`)
**Status**: ✅ Production Ready  
**Dependencies**:
- Primary: Google Gemini API (for intelligent extraction)
- Fallback 1: Groq API (if Gemini fails)
- Fallback 2: OpenRouter API (if both fail)
- Fallback 3: Basic regex extraction (no API needed)

**Required for Production**: At least one of:
- `GOOGLE_API_KEY` (recommended - has free tier)
- `GROQ_API_KEY` (fast and free)
- `OPENROUTER_API_KEY` (most flexible)

### 3.2 AI Chat Interface (`ai_intent.py`)
**Status**: ✅ Production Ready (Regex-based, scalable)  
**Current Implementation**: Rules-based pattern matching (no external API)  
**Dependencies**: None (self-contained)

**Future Enhancement Options**:
- Integrate Gemini 2.0 Flash for natural language understanding
- Add function calling for dynamic candidate search
- Cost: ~$0 with free tier (1,500 daily conversations)

### 3.3 Assessment Question Generation
**Status**: ⚠️ Needs Verification  
**Location**: Check `assessment_service.py` or related files  
**Recommended**: Use Gemini 2.0 Flash for dynamic question generation

---

## 4. Email/Notification Services (Future)

### 4.1 Resend (Email Delivery)
- **Purpose**: Transactional emails (password reset, notifications, interview invites)
- **Pricing**: 
  - Free: 100 emails/day, 3,000/month
  - Pro: $20/month for 50,000 emails
- **API Key Required**: `RESEND_API_KEY`
- **Setup**: https://resend.com
- **No GitHub Dependency**: ✅ Fully independent

### 4.2 Twilio SendGrid (Alternative)
- **Purpose**: Enterprise email delivery
- **Pricing**: 
  - Free: 100 emails/day
  - Essentials: $19.95/month for 50,000 emails
- **Setup**: https://sendgrid.com

---

## 5. Payment Processing (Future - For Premium Features)

### 5.1 Stripe
- **Purpose**: Subscription billing for recruiters
- **Pricing**: 2.9% + $0.30 per transaction
- **API Keys**: 
  - `STRIPE_SECRET_KEY`
  - `STRIPE_PUBLISHABLE_KEY`
  - `STRIPE_WEBHOOK_SECRET`
- **Setup**: https://stripe.com
- **No GitHub Dependency**: ✅ Fully independent

---

## 6. Minimum Viable Production (MVP) Setup

### Required API Keys:
```env
# Database & Auth (REQUIRED)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI/LLM (Pick at least ONE)
GOOGLE_API_KEY=your_gemini_api_key  # Recommended (Free tier available)
# OR
GROQ_API_KEY=your_groq_api_key  # Alternative (Free tier available)

# Optional (Fallbacks)
OPENROUTER_API_KEY=your_openrouter_key  # Optional multi-model gateway
```

### Total Monthly Cost (Minimal):
- Supabase Free Tier: **$0**
- Gemini 2.0 Flash Free Tier: **$0**
- **Total**: **$0/month** (up to moderate traffic)

### Recommended Production Setup (Scale to 10,000 users):
- Supabase Pro: **$25/month**
- Gemini 2.0 Flash (with paid tier): **$0-50/month** (depending on usage)
- Resend Pro (for emails): **$20/month**
- **Total**: **~$45-95/month**

---

## 7. Scalability Notes

### 7.1 Database (Supabase)
- **Free Tier Limits**: 500MB DB, 2GB bandwidth, 50,000 MAU
- **When to Upgrade**: 
  - Database > 400MB → Upgrade to Pro ($25/month for 8GB)
  - Users > 40,000 MAU → Team plan ($599/month)

### 7.2 AI/LLM (Gemini)
- **Free Tier Limits**: 1,500 requests/day (Gemini 2.0 Flash)
- **When to Upgrade**: 
  - Resume parsing > 1,500/day → Enable billing (pay-per-use)
  - Cost estimation: ~$0.01 per resume parsed

### 7.3 Bandwidth & Storage
- **Resume Storage**: ~500KB per PDF
- **10,000 candidates** = ~5GB storage ($5-10/month on Supabase)

---

## 8. Cost Projection (Real Numbers)

### Scenario 1: Startup Phase (0-1,000 users)
- **Supabase**: Free tier
- **Gemini**: Free tier (1,500 resumes/day)
- **Total**: **$0/month**

### Scenario 2: Growth Phase (1,000-10,000 users)
- **Supabase Pro**: $25/month
- **Gemini API**: ~$30/month (3,000 resumes/month)
- **Resend Email**: $20/month
- **Total**: **~$75/month**

### Scenario 3: Scale Phase (10,000-100,000 users)
- **Supabase Team**: $599/month
- **Gemini API**: ~$200/month (20,000 resumes/month)
- **Resend**: $80/month (200,000 emails)
- **CDN (Cloudflare)**: $20/month
- **Total**: **~$900/month**

---

## 9. GitHub Copilot Independence Verification

✅ **Supabase** - Independent open-source database platform  
✅ **Google Gemini** - Google's AI platform, no Microsoft/GitHub affiliation  
✅ **Groq** - Independent AI inference company  
✅ **OpenRouter** - Third-party LLM aggregator  
✅ **Stripe** - Independent payment processor  
✅ **Resend** - Independent email service  

**No GitHub Copilot Pro services are used in this stack.**

---

## 10. Security & Environment Variables

### Production `.env` Template:
```env
# === CORE INFRASTRUCTURE (REQUIRED) ===
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# === AI SERVICES (AT LEAST ONE REQUIRED) ===
GOOGLE_API_KEY=  # Recommended
GROQ_API_KEY=    # Optional fallback
OPENROUTER_API_KEY=  # Optional fallback

# === FUTURE SERVICES (OPTIONAL) ===
RESEND_API_KEY=  # Email notifications
STRIPE_SECRET_KEY=  # Payment processing
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# === APPLICATION SETTINGS ===
ENVIRONMENT=production
BACKEND_URL=https://api.talentflow.com
FRONTEND_URL=https://talentflow.com
```

### Security Checklist:
- [ ] Never commit `.env` files to Git
- [ ] Use environment variables in production (not hardcoded)
- [ ] Rotate API keys every 90 days
- [ ] Enable rate limiting on all endpoints
- [ ] Use HTTPS only in production
- [ ] Enable Supabase Row Level Security (RLS)

---

## 11. Next Steps for Production

1. **Immediate** (Week 1):
   - Sign up for Supabase (free tier)
   - Get Google Gemini API key (free tier)
   - Test resume parsing with 100 sample resumes

2. **Pre-Launch** (Week 2-3):
   - Set up Resend for email notifications
   - Configure domain (e.g., talentflow.com)
   - Deploy backend to VPS or Vercel/Railway

3. **Post-Launch** (Month 1-2):
   - Monitor API usage and costs
   - Upgrade Supabase to Pro when > 500MB DB
   - Enable paid Gemini tier when > 1,500 resumes/day

4. **Scale Phase** (Month 3+):
   - Add Stripe for premium recruiter tiers
   - Implement CDN for resume file delivery
   - Consider Redis for caching

---

## 12. Support & Documentation

- **Supabase Docs**: https://supabase.com/docs
- **Gemini API Docs**: https://ai.google.dev/docs
- **Groq Docs**: https://console.groq.com/docs
- **Resend Docs**: https://resend.com/docs
- **Stripe Docs**: https://stripe.com/docs

---

**For questions or cost optimization, refer to this document first.**
