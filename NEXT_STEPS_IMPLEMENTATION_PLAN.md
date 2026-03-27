# Next Steps & Implementation Plan - Resume Parsing Improvements

**Date:** March 26, 2026  
**Priority:** 🔴 HIGH  
**Status:** Analysis Complete → Implementation Phase

---

## Phase 1: Critical Parser Fixes (IMMEDIATE)

### 1.1 Update Experience Extraction Format Support

**File:** `apps/api/src/services/comprehensive_extractor.py`  
**Method:** `extract_experience()`  
**Status:** ❌ BLOCKING (Breaks for dash-separated format)

**Changes Required:**
- [ ] Add support for dash-separated format: `Position – Company (Location)`
- [ ] Keep backward compatibility with pipe format
- [ ] Extract position when dates are on separate line
- [ ] Parse dates properly (YYYY – YYYY or Month Year format)

**Code Example:**
```python
def extract_experience(text: str) -> Tuple[List[Dict], Optional[str], Optional[str]]:
    """Extract experience handling multiple formats"""
    
    # Format 1: Pipe-separated (Prashant's format)
    # | Position | Company | Location |
    
    # Format 2: Dash-separated (Sonam's format)  
    # Position – Company (Location)
    # 2024 – Present
    
    # Both should return same structure
```

---

### 1.2 Implement Certifications Extraction

**File:** `apps/api/src/services/comprehensive_extractor.py`  
**Method:** `extract_certifications()` (improve or create)  
**Status:** ❌ NOT WORKING (Returns 0 for Sonam)

**Changes Required:**
- [ ] Match "CERTIFICATIONS & TECHNICAL SKILLS" header
- [ ] Extract comma-separated certifications after bullet
- [ ] Handle special characters (dashes, etc.)
- [ ] Support multiple certification formats

**Code Example:**
```python
def extract_certifications(text: str) -> List[Dict]:
    """Extract certifications with multi-format support"""
    
    # Handle "CERTIFICATIONS & TECHNICAL SKILLS" header
    # Extract after: • Certifications: [cert1], [cert2]
    # Result: List of certification names with years if present
```

---

### 1.3 Add Test Cases for Format Compatibility

**File:** Create `tests/test_resume_formats.py`  
**Status:** ❌ MISSING

**Tests Needed:**
- [ ] Test pipe-separated format (Prashant's resume)
- [ ] Test dash-separated format (Sonam's resume)
- [ ] Test certifications from both formats
- [ ] Test years of experience extraction (both formats)

---

## Phase 2: Tech/Sales Experience Filtering (NEW REQUIREMENT)

### 2.1 Add Experience Category Classification

**File:** `apps/api/src/services/comprehensive_extractor.py`  
**New Method:** `classify_experience_type()`  
**Status:** ⏳ TO BE CREATED

**Purpose:** Filter out non-relevant experience, focus on tech/sales

**Implementation:**
```python
def classify_experience_type(position: str, company: str, description: str) -> str:
    """
    Classify experience type as:
    - 'tech_sales': Tech sales, SaaS sales, software sales
    - 'tech': Developer, engineer, technical roles
    - 'sales': General sales, business development
    - 'non_relevant': Teaching, other professions
    """
    
    # Tech Sales Keywords
    tech_sales_keywords = [
        'tech sales', 'saas', 'software sales', 'sales engineer',
        'sales development', 'business development', 'account executive',
        'account manager (tech)', 'solutions engineer', 'sales consultant'
    ]
    
    # Pure Tech Keywords  
    tech_keywords = [
        'engineer', 'developer', 'programmer', 'analyst',
        'architect', 'technical', 'data scientist', 'devops'
    ]
    
    # General Sales Keywords
    sales_keywords = [
        'sales', 'business development', 'account manager',
        'sales executive', 'sales manager', 'consultant'
    ]
    
    # Non-Relevant
    non_relevant = [
        'trainer', 'teacher', 'professor', 'instructor',
        'consultant (non-tech)', 'Hr', 'finance', 'accounting'
    ]
    
    combined_text = f"{position.lower()} {company.lower()} {description.lower()}"
    
    if any(kw in combined_text for kw in tech_sales_keywords):
        return 'tech_sales'
    elif any(kw in combined_text for kw in tech_keywords):
        return 'tech'
    elif any(kw in combined_text for kw in sales_keywords):
        return 'sales'
    else:
        return 'non_relevant'
```

---

### 2.2 Calculate Tech/Sales Experience Years (Filtered)

**File:** `apps/api/src/services/comprehensive_extractor.py`  
**New Method:** `calculate_tech_sales_experience_years()`  
**Status:** ⏳ TO BE CREATED

**Purpose:** Only count tech/sales-related experience, not non-relevant years

**Logic:**
```python
def calculate_tech_sales_experience_years(experience_list: List[Dict]) -> int:
    """
    Calculate years of ONLY tech/sales experience
    Exclude non-relevant experience like teaching
    """
    
    tech_sales_years = 0
    
    for exp in experience_list:
        exp_type = classify_experience_type(
            exp.get('position', ''),
            exp.get('company', ''),
            exp.get('description', '')
        )
        
        # Only count tech/sales experience
        if exp_type in ['tech_sales', 'tech', 'sales']:
            # Calculate years from dates
            start_date = exp.get('start_date')
            end_date = exp.get('end_date')
            
            # Parse and calculate years
            years = calculate_duration_years(start_date, end_date)
            tech_sales_years += years
    
    return tech_sales_years
```

**Example - Sonam Shukla:**
```
Total Years: 16
Breakdown:
  - 2024-Present: Business Development & Client Relations (TECH_SALES) ✓
  - 2021-2023: Business Sales Manager (SALES) ✓
  - 2019-2021: Associate Sales Executive (SALES) ✓
  - 2009-2019: English Communication Trainer (NON_RELEVANT) ✗

Tech/Sales Years: 3 + 2 + 2 = 7 years
Non-Relevant: 10 years

Important: Profile score should use "7 years" for matching, not total "16 years"
```

---

## Phase 3: Role Frequency Analysis (NEW FEATURE)

### 3.1 Add Role Frequency Calculation

**File:** `apps/api/src/services/analytics_service.py` (or new file)  
**New Method:** `calculate_role_frequency()`  
**Status:** ⏳ TO BE CREATED

**Purpose:** Identify most common roles in career history

**Implementation:**
```python
def calculate_role_frequency(experience_list: List[Dict]) -> Dict[str, int]:
    """
    Count frequency of each role type
    Return dict with role counts
    """
    
    role_counts = {}
    
    for exp in experience_list:
        position = exp.get('position', '').lower()
        
        # Normalize position (reduce variations)
        # "Sales Manager" and "Sales Manager I" → "Sales Manager"
        normalized_role = normalize_role_title(position)
        
        role_counts[normalized_role] = role_counts.get(normalized_role, 0) + 1
    
    # Sort by frequency
    sorted_roles = sorted(role_counts.items(), key=lambda x: x[1], reverse=True)
    
    return dict(sorted_roles)


def normalize_role_title(role: str) -> str:
    """Normalize role titles to reduce variations"""
    
    # Remove level indicators
    role = re.sub(r'\s+(I{1,3}|IV|V|Sr\.?|Jr\.?|Senior|Junior)\s*$', '', role)
    
    # Remove numbers
    role = re.sub(r'\s+\d+$', '', role)
    
    return role.title().strip()
```

**Example - Sonam Shukla:**
```
Experience Breakdown:
[
  {
    "position": "Business Development & Client Relations",
    "experience_type": "TECH_SALES",
    "duration": "1 year"
  },
  {
    "position": "Business Sales Manager",
    "experience_type": "SALES",
    "duration": "2 years"
  },
  {
    "position": "Associate Sales Executive",
    "experience_type": "SALES",
    "duration": "2 years"
  },
  {
    "position": "English Communication Trainer",
    "experience_type": "NON_RELEVANT",
    "duration": "10 years"
  }
]

Role Frequency:
{
  "Sales Manager": 1,
  "Sales Executive": 1,
  "Business Development": 1,
  "Trainer": 1
}

Primary Role Pattern: Sales/Business Development (3/4 positions = 75%)
```

---

### 3.2 Add Role Frequency to Profile

**File:** `apps/api/src/core/models.py`  
**Model:** `CandidateProfile`  
**Status:** ⏳ TO BE UPDATED

**New Fields to Add:**
```python
class CandidateProfile(Base):
    # ... existing fields ...
    
    # NEW: Role & Experience Classification
    tech_sales_experience_years = Column(Integer)  # Filtered years
    experience_category = Column(String)  # 'tech_sales', 'tech', 'sales', etc.
    primary_roles = Column(JSONB)  # Most common roles
    role_frequency = Column(JSONB)  # {"Sales Manager": 1, "Executive": 2}
    experience_breakdown = Column(JSONB)  # Detailed breakdown by type
    assessment_relevant_experience = Column(Integer)  # Years relevant to assessment
```

---

## Phase 4: Assessment-Based Resume Questions (EXISTING)

### 4.1 Map Resume Data to Assessment Questions

**File:** `docs/assessment-engine.md` (already exists)  
**Current Status:** ⚠️ NEEDS UPDATE TO REFERENCE RESUME DATA

**Context:** Assessment questions should now be:
- **Resume-based:** Pull from extracted data
- **Role-specific:** Ask about their specific positions
- **Experience-validated:** Verify extracted experience years

**Example Resume-Based Question:**
```
Question Type: EXPERIENCE_VERIFICATION

"According to your resume, you have worked as a 
'Business Sales Manager' at AM Webtech for 2 years. 
Can you describe a specific sales challenge you overcame 
using the CRM tools (Zoho, Salesforce, HubSpot) 
mentioned in your resume?"

This validates:
✓ Resume accuracy (did they really do this role?)
✓ Skill relevance (can they use the tools mentioned?)
✓ Experience depth (not just job title, but real knowledge)
```

---

### 4.2 Assessment Question Generation Strategy

**File:** New method in `apps/api/src/services/assessment_service.py`  
**Status:** ⏳ TO BE CREATED

**Logic:**
```python
def generate_resume_based_questions(candidate_profile: CandidateProfile) -> List[Dict]:
    """
    Generate assessment questions based on resume extraction
    """
    
    questions = []
    
    # Question Type 1: Experience Verification
    for exp in candidate_profile.experience_history:
        q = {
            "type": "EXPERIENCE_VERIFICATION",
            "context": exp,
            "question": f"Tell us about your experience as {exp['position']} at {exp['company']}",
            "expected_depth": "Describe specific achievements and challenges"
        }
        questions.append(q)
    
    # Question Type 2: Skill Validation
    for skill in candidate_profile.skills[:5]:
        q = {
            "type": "SKILL_VALIDATION",
            "skill": skill,
            "question": f"How have you used {skill} in your professional roles?",
            "context": "Verify they actually have this skill"
        }
        questions.append(q)
    
    # Question Type 3: Role Pattern Recognition
    primary_role = identify_primary_role(candidate_profile.role_frequency)
    q = {
        "type": "ROLE_PATTERN",
        "role": primary_role,
        "question": f"You've held {primary_role} roles {count} times. What's your approach?",
        "context": "Understand if they're specialist or generalist"
    }
    questions.append(q)
    
    return questions
```

---

## Phase 5: Database Updates & Re-extraction

### 5.1 Database Schema Updates

**Status:** ⏳ TO DO

Steps:
- [ ] Add new columns to `candidate_profiles` table
- [ ] Create migration script
- [ ] Test migration on dev database

---

### 5.2 Re-process Existing Resumes

**Status:** ⏳ TO DO

For each existing user (Prashant, Sonam, etc.):
- [ ] Run improved extraction
- [ ] Calculate tech_sales_experience_years
- [ ] Calculate role_frequency
- [ ] Update profile with new fields

**Script:**
```python
# apps/api/reextract_all_resumes.py

def reextract_all_resumes():
    """Re-extract all resumes with improved service"""
    
    db = Session()
    users = db.query(User).filter(User.role == 'candidate').all()
    
    for user in users:
        print(f"Re-extracting resume for {user.email}...")
        
        resume = db.query(ResumeData).filter(ResumeData.user_id == user.id).first()
        if not resume or not resume.raw_text:
            continue
        
        # Extract with improved methods
        extracted_data = ComprehensiveResumeExtractor.extract_all(resume.raw_text)
        
        # NEW: Calculate tech/sales experience
        tech_sales_years = calculate_tech_sales_experience_years(
            extracted_data.get('experience_history', [])
        )
        
        # NEW: Calculate role frequency
        role_freq = calculate_role_frequency(
            extracted_data.get('experience_history', [])
        )
        
        # Update profile
        profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user.id).first()
        if profile:
            profile.tech_sales_experience_years = tech_sales_years
            profile.role_frequency = role_freq
            profile.current_role = extracted_data.get('current_role')
            # ... more updates ...
        
        db.commit()
    
    db.close()
```

---

## Implementation Order (Priority)

### 🔴 CRITICAL (Do First - This Week)
1. [x] Identify format issues (DONE - Sonam's analysis)
2. [ ] Update `extract_experience()` to support dash-separated format
3. [ ] Implement proper `extract_certifications()`
4. [ ] Add format-agnostic tests
5. [ ] Re-extract Sonam's resume (verify fixes work)

### 🟠 HIGH (Next - Week 2)
6. [ ] Create `classify_experience_type()` method
7. [ ] Create `calculate_tech_sales_experience_years()` method
8. [ ] Create `calculate_role_frequency()` method
9. [ ] Update CandidateProfile model
10. [ ] Create database migration

### 🟡 MEDIUM (Week 3)
11. [ ] Generate resume-based assessment questions
12. [ ] Update assessment engine
13. [ ] Re-extract all existing resumes
14. [ ] Validate improvements

---

## Success Criteria

### Before Fixes
```
Prashant: 83.3% accuracy
Sonam: 66.7% accuracy ❌
Average: 75% ⚠️
```

### Target After Fixes
```
Prashant: 85%+ accuracy (maintain)
Sonam: 85%+ accuracy ✓ (improve from 66.7%)
Average: 85%+ ✓ (GOOD)

Additional Metrics:
- Tech/Sales Experience: Calculated for all
- Role Frequency: Tracked and available
- Assessment Relevance: 95%+ of questions resume-based
```

---

## Files to Create/Modify

### New Files
- [ ] `tests/test_resume_formats.py` - Format compatibility tests
- [ ] `apps/api/reextract_all_resumes.py` - Batch re-extraction script

### Files to Modify
- [ ] `apps/api/src/services/comprehensive_extractor.py` - Add methods
- [ ] `apps/api/src/services/analytics_service.py` or new file - Add role analysis
- [ ] `apps/api/src/core/models.py` - Add new columns
- [ ] `apps/api/src/services/assessment_service.py` - Resume-based questions

### Documentation Updates
- [ ] `docs/assessment-engine.md` - Reference resume data
- [ ] `docs/domain-model.md` - Document new fields
- [ ] `PARSER_FIX_PROPOSAL.md` - Already created (reference)

---

## Testing Checklist

- [ ] Pipe format still works (Prashant's resume)
- [ ] Dash format now works (Sonam's resume)
- [ ] Years extraction accurate for both
- [ ] Tech/sales years calculation correct
- [ ] Role frequency counting accurate
- [ ] Assessment questions generated from resume
- [ ] No data loss on existing records
- [ ] Performance acceptable (batch re-extraction)

---

## Key Insights from Sonam's Resume

1. **Career Diversity:** 16 years total, but only ~7 years relevant to sales/tech
2. **Role Patterns:** Multiple Sales/Business Development roles = focused career
3. **Assessment Implications:** Should ask about sales-specific experience, not training years
4. **Matching:** When matching to sales jobs, use 7 years not 16 years
5. **Skills Focus:** Sales/CRM skills are primary, not training/teaching skills

---

## Next Team Handoff

**For Backend Developer:**
- Implement Phase 1 (format support) 
- Implement Phase 2 (tech/sales filtering)
- Complete Phase 3 (role frequency)

**For QA/Testing:**
- Create test suite (Phase 1)
- Validate with real resumes
- Performance testing on batch extraction

**For Product/Recruitment:**
- Update assessment questions to be resume-based
- Train on new role frequency insights
- Use tech_sales_years for matching

