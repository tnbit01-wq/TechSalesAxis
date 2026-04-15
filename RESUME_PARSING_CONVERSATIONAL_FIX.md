# Resume Parsing Integration in Conversational Onboarding - FIXED ✅

## Problem
Resume parsing was working in Q&A/Assessment mode but **NOT being used** in conversational onboarding mode.

**What was happening:**
- Resume uploaded → S3
- Background parsing triggered → ResumeService.parse_resume_sync() runs
- Resume data stored in ResumeData table ✅
- BUT: Conversational flow never loaded or used this resume data ❌

**Result:** Resume data extracted but ignored, conversational AI had to re-ask questions already answered in the resume.

---

## Solution Implemented

### Files Modified: 3

#### 1. **Backend Service** - `apps/api/src/services/ai_intelligence_service.py`

**Changes to `process_conversational_onboarding()` method:**

```python
async def process_conversational_onboarding(
    self,
    user_message: str,
    conversation_history: List[Dict[str, str]] = None,
    asked_questions: List[str] = None,
    user_id: str = None,           # 🆕 NEW
    db = None                        # 🆕 NEW
) -> Dict[str, Any]:
```

**Added resume loading logic:**

```python
# 🆕 Load user's parsed resume data if available
resume_context = ""
if user_id and db:
    try:
        from src.core.models import ResumeData
        resume = db.query(ResumeData).filter(ResumeData.user_id == user_id).first()
        if resume:
            resume_parts = []
            if resume.raw_text:
                resume_parts.append(f"Resume Text (excerpt): {resume.raw_text[:1500]}")
            if resume.skills:
                resume_parts.append(f"Skills: {', '.join(resume.skills[:10])}")
            if resume.raw_experience:
                resume_parts.append(f"Work Experience: {json.dumps(resume.raw_experience, indent=2)[:500]}")
            if resume.raw_education:
                resume_parts.append(f"Education: {json.dumps(resume.raw_education, indent=2)[:300]}")
            
            if resume_parts:
                resume_context = "\n\nUser's Resume Data (use this to validate/fill extracted info):\n" + "\n".join(resume_parts)
    except Exception as e:
        logger.warning(f"[AI] Could not load resume for {user_id}: {str(e)}")
```

**Updated AI prompt to include resume context:**

```python
prompt = f"""
...
User's Message: "{user_message}"

Previous Conversation Context:
{history_text if history_text else "(No previous context)"}{resume_context}

ALREADY ASKED QUESTIONS (Don't repeat these):
{', '.join(asked_questions) if asked_questions else 'None (This is first message)'}
...
"""
```

**Added resume data fill logic after extraction:**

```python
# 🆕 USE RESUME DATA TO FILL MISSING FIELDS
if user_id and db:
    try:
        from src.core.models import ResumeData
        resume = db.query(ResumeData).filter(ResumeData.user_id == user_id).first()
        if resume:
            extracted_info = extraction.get("extracted_info", {})
            
            # Fill missing fields from resume
            if not extracted_info.get("current_role") and resume.raw_experience:
                if isinstance(resume.raw_experience, list) and len(resume.raw_experience) > 0:
                    most_recent = resume.raw_experience[0]
                    if isinstance(most_recent, dict):
                        extracted_info["current_role"] = most_recent.get("position") or most_recent.get("role") or most_recent.get("title")
            
            # Fill years of experience if not extracted
            if not extracted_info.get("years_experience") and resume.timeline:
                if isinstance(resume.timeline, dict) and "total_years" in resume.timeline:
                    extracted_info["years_experience"] = resume.timeline.get("total_years")
            
            # Add skills from resume if not extracted
            if resume.skills and not extracted_info.get("skills"):
                extracted_info["skills"] = resume.skills[:10]  # Top 10 skills
            
            extraction["extracted_info"] = extracted_info
            logger.info(f"[AI] Filled {sum(1 for k, v in extracted_info.items() if v)} fields from resume data")
    except Exception as e:
        logger.warning(f"[AI] Could not fill fields from resume: {str(e)}")
```

#### 2. **Route Handler** - `apps/api/src/routes/intelligence.py`

**Updated the call to pass user_id and db:**

```python
# Before:
result = await ai_service.process_conversational_onboarding(
    user_message=request.user_message,
    conversation_history=conversation_history,
    asked_questions=request.asked_questions or []
)

# After:
result = await ai_service.process_conversational_onboarding(
    user_message=request.user_message,
    conversation_history=conversation_history,
    asked_questions=request.asked_questions or [],
    user_id=user_id,  # 🆕 Pass user_id to load resume
    db=db  # 🆕 Pass db session to query resume data
)
```

---

## How It Works Now

### Flow Diagram

```
User Uploads Resume
    ↓
/storage/upload/resume
    ↓
S3 Storage
    ↓
/candidate/resume endpoint
    ↓
ResumeService.parse_resume_sync() runs in background
    ↓
Parsed data stored in ResumeData table:
├─ raw_text (full resume)
├─ skills (array)
├─ raw_experience (JSON)
├─ timeline (years, gaps)
└─ raw_education (JSON)
    ↓
🆕 Conversational Onboarding Asks Question
    ↓
/intelligence/onboarding/conversational endpoint
    ↓
Service loads ResumeData from database
    ↓
AI prompt includes: Resume text + skills + experience + education
    ↓
AI extracts info from:
├─ User's current message
├─ Previous conversation
└─ 🆕 Resume data (validates/fills gaps)
    ↓
Returns enriched extracted_info to frontend
```

### Example Behavior Change

**BEFORE (Without Resume Integration):**

```
User uploads resume with 8 years sales experience
User says: "Hi, I'm looking for new opportunities"
Bot: "What's your current employment status?"
User: "I'm employed"
Bot: "Great, how many years of experience do you have?"
User: "8 years in sales"  ← Bot asks what was already in resume!
Bot: "Perfect! What's your notice period?"
```

**AFTER (With Resume Integration):**

```
User uploads resume with 8 years sales experience
User says: "Hi, I'm looking for new opportunities"
Bot: "You've got 8 years of solid sales experience and your skills include [from resume]... What's your current employment status?"
User: "I'm employed"
Bot: "Perfect! So you're currently employed. What's your notice period?"
← Bot knows experience level from resume, not re-asking!
```

---

## Data Flow

### 1. Resume Upload & Parsing
```
Frontend → /storage/upload/resume → S3
         → /candidate/resume → ResumeService.parse_resume_sync()
                            → Stores in ResumeData table
```

### 2. Conversational Onboarding (Now Improved)
```
Frontend → /intelligence/onboarding/conversational
        ↓
        Route (intelligence.py):
        ├─ Get user_id from token
        ├─ Pass user_id to service
        └─ Pass db session
        ↓
        Service (ai_intelligence_service.py):
        ├─ Load ResumeData for user_id
        ├─ Extract resume: raw_text, skills, experience, education
        ├─ Build resume_context string
        ├─ Include in AI prompt
        ├─ Call AI to extract from message + resume
        ├─ Fill missing fields from resume data
        └─ Return enriched extracted_info
        ↓
        Frontend uses extracted_info for conversation flow
```

---

## Fields That Get Auto-Filled from Resume

| Field | Source | Condition |
|-------|--------|-----------|
| `current_role` | `resume.raw_experience[0].position` | If not in conversation message |
| `years_experience` | `resume.timeline.total_years` | If not in conversation message |
| `skills` | `resume.skills[:10]` | If not explicitly mentioned |
| `education` | `resume.raw_education` | Available for AI context |
| `work_history` | `resume.raw_experience` | Available for AI context |

---

## Key Improvements

✅ **Resume data now integrated into AI extraction**
- AI knows candidate's background from resume
- Can validate/confirm information in conversation
- Doesn't re-ask questions already answered in resume

✅ **Smart field filling**
- Years of experience from resume if not mentioned
- Current role from most recent position in resume
- Skills array from parsed resume

✅ **Better conversation context**
- AI can acknowledge experience level: "With your 8 years of sales experience..."
- Can reference resume: "I see you worked at..."
- More natural, personalized responses

✅ **No duplicate questions**
- Resume data pre-fills what's available
- Conversational AI focuses on gaps (notice period, relocation, etc.)

---

## Testing

### 1. Unit Test
```python
# Verify resume data is loaded
async def test_resume_loading():
    from src.core.models import ResumeData
    
    # Create test resume data
    resume = ResumeData(
        user_id="test-user",
        raw_text="8 years sales...",
        skills=["sales", "negotiation"],
        raw_experience=[{"position": "Sales Manager"}],
        timeline={"total_years": 8}
    )
    db.add(resume)
    db.commit()
    
    # Call service with user_id and db
    result = await ai_service.process_conversational_onboarding(
        user_message="Hi, looking for opportunities",
        user_id="test-user",
        db=db
    )
    
    # Should have filled years_experience from resume
    assert result["extracted_info"]["years_experience"] >= 8
```

### 2. Integration Test
1. Upload resume with 8 years sales experience
2. Start conversational onboarding
3. User says "Looking for new role"
4. Bot should acknowledge experience level from resume
5. Bot should focus on missing info (timeline, relocation, etc.)

### 3. Manual Test
- Open http://localhost:3000/onboarding/candidate
- Select "AI Chat Mode" (conversational)
- Upload a resume file
- Type first message: "Hi, I'm looking..."
- Check console: Look for `[AI] Filled N fields from resume data`
- Verify bot acknowledges resume data

---

## Deployment Notes

### Dependencies
- ✅ `json` - Already imported
- ✅ `ResumeData` - Model already exists
- ✅ Database session - Already available in route
- ✅ httpx - Already imported

### No Breaking Changes
- All parameters are **optional** (user_id=None, db=None)
- Falls back gracefully if resume doesn't exist
- Works without any frontend changes
- Routes still accept old calls without new parameters

### Safe Rollout
- Resume loading wrapped in try/except
- Logs warning if resume unavailable
- Continues processing even if resume load fails
- No impact if ResumeData table is empty

---

## Configuration

No new configuration needed. The system uses existing:
- OpenRouter/OpenAI API keys (already configured)
- S3 credentials (already working)
- Database connection (already working)

---

## Summary

**Problem:** Resume parsing works but isn't used in conversational mode
**Root Cause:** Service never loads or includes resume data in AI prompt
**Solution:** Load ResumeData for user, include in AI extraction, fill missing fields
**Result:** Conversational AI now uses parsed resume + conversation for complete picture

✅ **Ready to deploy**
