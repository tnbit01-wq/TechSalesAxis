# CODE CHANGES - EXACT IMPLEMENTATIONS

## Summary of Changes

This document shows the exact code changes made to fix:
1. Conversation data sync to profiles
2. Question deduplication with variation matching
3. Enum value mapping for employment_status

---

## FILE 1: apps/api/src/routes/intelligence.py

### Change 1A: Added async sync function

**Location**: After `normalize_extracted_data()` function (around line 104)

```python
async def sync_conversation_to_profile(session: ConversationalOnboardingSession, db) -> bool:
    """
    Sync extracted conversation data to candidate profile
    Called when conversation is successfully completed
    
    Transfers:
    - years_experience
    - notice_period_days
    - willing_to_relocate
    - job_search_mode
    - employment_status
    - current_role
    """
    try:
        profile = db.query(CandidateProfile).filter(
            CandidateProfile.user_id == session.candidate_id
        ).first()
        
        if not profile:
            logger.warning(f"[SYNC] Profile not found for candidate {session.candidate_id}")
            return False
        
        updates_made = False
        
        # 1. Years of Experience
        if session.extracted_years_experience is not None:
            if profile.years_of_experience != session.extracted_years_experience:
                logger.info(f"[SYNC] Updating years_of_experience: {profile.years_of_experience} → {session.extracted_years_experience}")
                profile.years_of_experience = session.extracted_years_experience
                updates_made = True
        
        # 2. Notice Period (Days)
        if session.extracted_notice_period_days is not None:
            if profile.notice_period_days != session.extracted_notice_period_days:
                logger.info(f"[SYNC] Updating notice_period_days: {profile.notice_period_days} → {session.extracted_notice_period_days}")
                profile.notice_period_days = session.extracted_notice_period_days
                updates_made = True
        
        # 3. Willing to Relocate
        if session.extracted_willing_to_relocate is not None:
            if profile.willing_to_relocate != session.extracted_willing_to_relocate:
                logger.info(f"[SYNC] Updating willing_to_relocate: {profile.willing_to_relocate} → {session.extracted_willing_to_relocate}")
                profile.willing_to_relocate = session.extracted_willing_to_relocate
                updates_made = True
        
        # 4. Job Search Mode
        if session.extracted_job_search_mode is not None:
            mode_map = {
                "exploring": "exploring",
                "passive": "passive",
                "active": "active",
                "not_mentioned": None
            }
            mapped_mode = mode_map.get(session.extracted_job_search_mode, session.extracted_job_search_mode)
            if mapped_mode and profile.job_search_mode != mapped_mode:
                logger.info(f"[SYNC] Updating job_search_mode: {profile.job_search_mode} → {mapped_mode}")
                profile.job_search_mode = mapped_mode
                updates_made = True
        
        # 5. Employment Status - Map to enum values
        if session.extracted_employment_status is not None:
            # Database enum values are: 'Employed', 'Unemployed', 'Student'
            status_map = {
                "employed": "Employed",
                "unemployed": "Unemployed",
                "student": "Student",
                "between_roles": "Unemployed",
            }
            extracted_lower = session.extracted_employment_status.lower()
            mapped_status = status_map.get(extracted_lower, session.extracted_employment_status)
            if profile.current_employment_status != mapped_status:
                logger.info(f"[SYNC] Updating current_employment_status: {profile.current_employment_status} → {mapped_status}")
                profile.current_employment_status = mapped_status
                updates_made = True
        
        # 6. Current Role
        if session.extracted_current_role is not None:
            if profile.current_role != session.extracted_current_role:
                logger.info(f"[SYNC] Updating current_role: {profile.current_role} → {session.extracted_current_role}")
                profile.current_role = session.extracted_current_role
                updates_made = True
        
        if updates_made:
            profile.updated_at = datetime.utcnow()
            db.commit()
            logger.info(f"[SYNC] ✅ Successfully synced conversation data to profile for {session.candidate_id}")
            return True
        else:
            logger.info(f"[SYNC] No updates needed for {session.candidate_id}")
            return False
        
    except Exception as e:
        logger.error(f"[SYNC] ❌ Error syncing conversation to profile: {str(e)}")
        db.rollback()
        return False
```

---

### Change 1B: Enhanced question deduplication

**Location**: In `process_conversational_onboarding()` endpoint (around line 316)

**BEFORE**:
```python
# Update asked questions (merge with existing to avoid duplicates)
updated_asked = list(set(request.asked_questions or []))  # Deduplicate
# Explicit reassignment for array changes
session.asked_questions = updated_asked
```

**AFTER**:
```python
# Update asked questions with deduplication
# Merge any new questions asked with existing ones
# Use set to avoid exact duplicates, but also handle variations
current_asked = set(session.asked_questions or [])
new_asked = set(request.asked_questions or [])
merged_asked = list(current_asked.union(new_asked))

# Smart deduplication - recognize question variations
question_variations = {
    "employment_status": ["employment_status", "current_status", "work_status"],
    "job_search_mode": ["job_search_mode", "urgency", "search_urgency", "active_passive"],
    "notice_period": ["notice_period", "notice_period_days", "timeline", "availability"],
    "current_role": ["current_role", "position", "current_position", "role"],
    "years_experience": ["years_experience", "experience_years", "years_of_experience"],
    "willing_to_relocate": ["willing_to_relocate", "relocation", "relocate"],
    "visa_sponsorship": ["visa_sponsorship_needed", "visa", "sponsorship"]
}

# Deduplicate using variations
deduped = set()
for q in merged_asked:
    q_lower = q.lower()
    # Find canonical form
    canonical = None
    for canonical_q, variations in question_variations.items():
        if any(q_lower == v.lower() or q_lower in v.lower() for v in variations):
            canonical = canonical_q
            break
    if canonical:
        deduped.add(canonical)
    else:
        deduped.add(q)

updated_asked = list(deduped)
# Explicit reassignment for array changes
session.asked_questions = updated_asked
```

---

### Change 1C: Call sync function when conversation completes

**Location**: In `process_conversational_onboarding()` endpoint (around line 365)

**BEFORE**:
```python
# Mark as completed if all critical fields are found
if session.completeness_score > 0.8:
    session.successfully_completed = True

# Save to database
db.commit()
logger.info(f"[DB] ✅ Saved ConversationalOnboardingSession for {user_id} - total_messages: {session.total_messages}, asked: {session.asked_questions}")
```

**AFTER**:
```python
# Mark as completed if all critical fields are found
if session.completeness_score > 0.8:
    session.successfully_completed = True
    session.completed_at = datetime.utcnow()
    session.conversation_status = 'completed'

# Save to database
db.commit()
logger.info(f"[DB] ✅ Saved ConversationalOnboardingSession for {user_id} - total_messages: {session.total_messages}, asked: {session.asked_questions}")

# 🆕 SYNC EXTRACTED DATA TO PROFILE when conversation is completed
if session.successfully_completed:
    logger.info(f"[COMPLETION] Conversation completed, syncing to profile...")
    sync_result = await sync_conversation_to_profile(session, db)
    if sync_result:
        logger.info(f"[COMPLETION] ✅ Profile successfully synced with conversation data")
    else:
        logger.warning(f"[COMPLETION] ⚠️ Profile sync had no updates or encountered issues")
```

---

## FILE 2: retrospective_sync.py (New Utility File)

**Purpose**: One-time utility to sync all existing completed conversations to profiles

**Location**: `prospective_sync.py` (in root directory)

```python
#!/usr/bin/env python3
"""
Retrospective sync - sync all completed conversations that haven't been synced to profiles yet
"""
import os
import sys
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent / "apps" / "api"))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.core.models import ConversationalOnboardingSession, CandidateProfile, User

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
db = Session()

# ... full implementation in retrospective_sync.py file
```

---

## Summary Table

| Component | Change | Type | Impact |
|-----------|--------|------|--------|
| Sync Function | `sync_conversation_to_profile()` | New | Transfers 6 profile fields from conversation |
| Deduplication | Question variations matching | Enhanced | Prevents 2+ asking of same question |
| Enum Mapping | Status value mapping | New | Handles DB enum validation |
| Completion Trigger | Auto-sync on 80%+ complete | New | Automatic profile update |
| Conversation Status | Mark as "completed" | Enhanced | Track conversation lifecycle |
| Timestamp Tracking | completed_at field | New | Know when conversation finished |

---

## Testing

### Test 1: Retrospective Sync
```
✅ Found 1 conversation
✅ Synced 6 fields
✅ No errors
✅ All values updated correctly
```

### Test 2: Verification
```
✅ Years of Experience: 6 synced
✅ Notice Period: 30 synced
✅ Willing to Relocate: True synced
✅ Job Search Mode: passive synced
✅ Conversation Status: completed
✅ Timestamp: recorded
```

---

## Deployment Instructions

1. Update `apps/api/src/routes/intelligence.py` with the three changes above
2. Run `retrospective_sync.py` once to fix existing conversations
3. Restart API server
4. New conversations will automatically sync on completion

All changes are backward compatible - no database schema changes needed.
