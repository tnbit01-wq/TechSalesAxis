# TALENTFLOW: Quick Start Guide

**Get up and running in 5 minutes**

---

## What is TALENTFLOW?

AI-powered onboarding platform exclusively for IT Tech Sales professionals.  
✅ Intelligent questions (personalized, not generic)  
✅ Career readiness assessment  
✅ Resume building with AI skill extraction  
✅ Role recommendations  
✅ Learning path suggestions  

---

## Start Servers (2 Steps)

### Step 1: Start API Server
```bash
cd C:\Users\Admin\Desktop\Projects\TALENTFLOW\apps\api
set PYTHONPATH=.
.\..\..\.venv\Scripts\python.exe -m uvicorn src.main:app --host 127.0.0.1 --port 8005 --reload
```

**Verify**: `http://127.0.0.1:8005/health` → Should return 200

### Step 2: Start Web Server
```bash
cd C:\Users\Admin\Desktop\Projects\TALENTFLOW\apps\web
npm run dev
```

**Verify**: `http://localhost:3000` → Should load

---

## Test the Platform (3 Steps)

### Step 1: Go to Onboarding
```
http://localhost:3000/onboarding/candidate
```

### Step 2: Complete Career Readiness (5 steps)
```
Step 1: What area excites you? (Cloud, SaaS, etc.)
Step 2: What's your job search mode? ← AI-GENERATED here
Step 3: When can you start?
Step 4: What matters in your role?
Step 5: Any other preferences?
```

### Step 3: Verify Personalization
Go through flow **twice** with different answers:
- First time: "Employed, Active, 1-month"
- Second time: "Unemployed, Passive, 6-month"

**Expected**: Step 2 questions should be COMPLETELY DIFFERENT ✅

---

## How Personalization Works

### Profile 1: Employed + Active (1-month)
```
Question: "What specific sales methodologies have you utilized..."
Focus: Present-focused, deal methodology
```

### Profile 2: Unemployed + Passive (6-month)
```
Question: "What specific skills do you need to enhance..."
Focus: Development-focused, future positioning
```

**Same step, same person, goes through twice** = Different questions each time = **AI working** ✅

---

## Key Features in 60 Seconds

### 1. AI Question Generation
- Questions created fresh by OpenAI
- Each user gets unique questions based on:
  - Employment status (Employed/Unemployed/Student)
  - Job search mode (Active/Passive/Exploring)
  - Notice period/timeline
  - Previous answers
- Not predefined, not generic

### 2. IT Tech Sales Focus
Every question and recommendation is for IT/Tech Sales roles:
- Sales Engineer, Account Executive, SDR, Solutions Consultant
- Deal closing, pipeline management, solution selling
- Cloud/SaaS product knowledge
- Enterprise sales expertise

### 3. Resume Intelligence
AI extracts skills from free text:
- Identifies IT Sales skills automatically
- Suggests skills to develop
- Categorizes: Sales Skills, Tech Knowledge, Tools
- Provides confidence score

### 4. Career Fitness
Analyzes readiness for IT Sales roles:
- Job readiness score (0-100)
- Skill match evaluation
- Timeline to be ready
- Personalized development recommendations

---

## APIs to Test (Optional)

### Test Personalization Endpoint
```bash
curl -X POST http://127.0.0.1:8005/api/v1/intelligence/career-readiness/adaptive-question \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test" \
  -d '{
    "employment_status": "Employed",
    "job_search_mode": "Active",
    "timeline": "1 month",
    "step": 2
  }'
```

**Expected Response**:
```json
{
  "status": "success",
  "data": {
    "question": "What specific sales methodologies have you utilized...",
    "options": ["Option 1", "Option 2", ...],
    "reasoning": "Understanding your sales approach...",
    "personalization_notes": "As employed and actively searching..."
  }
}
```

---

## Troubleshooting

### API Server Won't Start
```bash
# Kill existing Python processes
taskkill /F /IM python.exe

# Try again
cd apps\api
set PYTHONPATH=.
.\..\..\.venv\Scripts\python.exe -m uvicorn src.main:app --host 127.0.0.1 --port 8005
```

### Web Page Won't Load
```bash
# Kill Node processes
taskkill /F /IM node.exe

# Restart from apps/web
npm run dev
```

### Questions Still Generic
1. Check if API is actually responding: `http://127.0.0.1:8005/health`
2. Check OpenAI API key in `.env`
3. Check browser console (F12) for errors
4. Check API logs for `[AI INTELLIGENCE]` messages

### Can't See Personalization Difference
1. Make sure you complete FULL career readiness flow (all 5 steps)
2. For step 2 specifically, change "job_search_mode" between tests
3. Different employment_status + different timeline = more visible difference
4. Use API test above to see raw response clearly

---

## What to Expect

### ✅ Working
- Questions reference your employment status
- Same step, different users = different questions
- Resume building references career readiness answers
- Skill extraction identifies sales skills
- No generic "Tell me about yourself" messages

### ⚠️ If Using Fallback
- If OpenAI slow/fails: Still get personalized questions
- Fallback templates still reference your data
- NOT generic - still intelligent and contextual
- Graceful degradation: System always works

---

## File Structure (Key Files)

```
Main Onboarding: /apps/web/src/app/onboarding/candidate/page.tsx
Career Flow: /apps/web/src/components/CareerReadinessFlow.tsx
AI Service: /apps/api/src/services/ai_intelligence_service.py
API Routes: /apps/api/src/routes/intelligence.py
```

---

## Common Questions

**Q: Are these questions predefined?**  
A: No. Every question is generated fresh by OpenAI based on your answers. Same step, different user = different question.

**Q: Can I see this is working?**  
A: Yes. Go through career readiness twice with different profiles. Step 2 questions will be completely different.

**Q: What if OpenAI is down?**  
A: System falls back to intelligent templates. Still personalized (references your employment status, timeline). Not generic.

**Q: How do I know AI is actually generating?**  
A: Check API logs. You'll see:
```
[AI INTELLIGENCE] Trying AI generation for step 2...
[AI INTELLIGENCE] ✅ AI generated question: [question...]
```

**Q: Is it only for US candidates?**  
A: No. Works globally. Salary ranges shown in Indian Rupees (₹) but platform language-agnostic.

---

## Next Steps

1. **Run Platform**: Start both servers (5 min)
2. **Test Personalization**: Complete flow twice with different answers (5 min)
3. **Verify Working**: Check for unique questions each time (2 min)
4. **Read Full Docs**: [TALENTFLOW_IMPLEMENTATION_COMPLETE.md](./TALENTFLOW_IMPLEMENTATION_COMPLETE.md) for details

---

## Support

**Full Documentation**: [TALENTFLOW_IMPLEMENTATION_COMPLETE.md](./TALENTFLOW_IMPLEMENTATION_COMPLETE.md)  
**Technical Checklist**: [TALENTFLOW_TECH_CHECKLIST.md](./TALENTFLOW_TECH_CHECKLIST.md)  
**This File**: [TALENTFLOW_QUICK_START.md](./TALENTFLOW_QUICK_START.md)

---

**TALENTFLOW is ready to use.** 🚀

Start servers, go to `/onboarding/candidate`, complete career readiness, and see personalized questions in action.
