# Implementation Checklist: Tech/Sales Experience Filtering

## Phase 2 Methods - Quick Reference

### ✓ To Implement in `comprehensive_extractor.py`

**Method 1: `classify_experience_type()` - CORE**
- File: `apps/api/src/services/comprehensive_extractor.py`
- Purpose: Classify each job position as tech/sales/other
- Inputs: position (str), company (str), description (str)
- Outputs: {'category': 'sales', 'scores': {...}, 'confidence': 85.0}
- Keyword lists: TECH_SALES_INDICATORS, SALES_INDICATORS, TECH_INDICATORS, NON_RELEVANT_INDICATORS
- Status: [ ] NOT STARTED

**Method 2: `calculate_years_between_dates()` - UTILITY**
- File: `apps/api/src/services/comprehensive_extractor.py`
- Purpose: Parse dates and calculate duration
- Inputs: start_date_str (str), end_date_str (str)
- Outputs: float (years with decimals)
- Handles: "Jan 2020", "Present", "Current"
- Status: [ ] NOT STARTED

**Method 3: `calculate_filtered_experience_years()` - CORE**
- File: `apps/api/src/services/comprehensive_extractor.py`
- Purpose: Calculate tech/sales years only (exclude non-relevant)
- Inputs: experience_list (List[Dict])
- Outputs: {
    'tech_sales_years': 7.0,
    'tech_only_years': 2.0,
    'sales_only_years': 5.0,
    'other_years': 10.0,
    'total_relevant_years': 7.0,
    'total_years': 17.0,
    'breakdown': [...]
  }
- Status: [ ] NOT STARTED

### ✓ To Implement in new file or `analytics_service.py`

**Class: `RoleAnalyzer` - ANALYSIS**
- File: `apps/api/src/services/analytics_service.py` (NEW CLASS)
- Methods:
  - `normalize_role_title()` - Remove "Senior", "Jr", Roman numerals, numbers
  - `calculate_role_frequency()` - Count role occurrences
  - `identify_role_pattern()` - Detect specialist/progressive/generalist

**Method 4: `calculate_role_frequency()` - CORE**
- Purpose: Track role patterns across career
- Inputs: experience_list (List[Dict])
- Outputs: {
    'role_frequency': {'Sales Manager': 2, 'Business Dev': 1},
    'primary_role': 'Sales Manager',
    'primary_role_count': 2,
    'role_diversity': 0.5,
    'unique_roles_count': 2,
    'total_roles': 3
  }
- Status: [ ] NOT STARTED

**Method 5: `identify_role_pattern()` - ANALYSIS**
- Purpose: Identify career progression pattern
- Outputs: 'specialist' | 'progressive' | 'generalist'
- Logic:
  - specialist: 80%+ same role
  - progressive: Shows progression (exec → manager → director)
  - generalist: 60%+ role diversity
- Status: [ ] NOT STARTED

### ✓ Database Schema Updates

**File:** `apps/api/src/core/models.py` - CandidateProfile class

**Fields to Add:**
```python
tech_sales_experience_years = Column(Float)           # [ ] NOT ADDED
total_relevant_experience_years = Column(Float)       # [ ] NOT ADDED
non_relevant_experience_years = Column(Float)         # [ ] NOT ADDED
experience_breakdown = Column(JSONB, default={})      # [ ] NOT ADDED
role_frequency = Column(JSONB, default={})            # [ ] NOT ADDED
primary_role = Column(String)                         # [ ] NOT ADDED
career_pattern = Column(String)                       # [ ] NOT ADDED
```

**Migration Required:**
- [ ] Create Alembic migration for new columns
- [ ] Run migration on dev database
- [ ] Test with test users

### ✓ Integration Points

**Update `extract_all()` method in `comprehensive_extractor.py`**
- [ ] Import RoleAnalyzer class
- [ ] Call classify_experience_type() for each position
- [ ] Call calculate_filtered_experience_years() with experience list
- [ ] Call RoleAnalyzer methods for role analysis
- [ ] Return new fields in extract_all() response

**Update ResumeService or similar to store new fields**
- [ ] Map extracted fields to CandidateProfile model
- [ ] Save tech_sales_experience_years
- [ ] Save role_frequency and primary_role
- [ ] Save career_pattern

---

## Testing Checklist

### Unit Tests to Create
- [ ] Test classify_experience_type() with sample positions
  - [ ] Test with sales position → expect 'sales'
  - [ ] Test with trainer position → expect 'other'
  - [ ] Test with engineer position → expect 'tech'
  
- [ ] Test calculate_years_between_dates()
  - [ ] Test "Jan 2020" to "Dec 2023" → expect 4.0
  - [ ] Test "Jun 2024" to "Present" → expect current calculation
  - [ ] Test invalid dates → expect 0
  
- [ ] Test calculate_filtered_experience_years()
  - [ ] Test Sonam's full experience list
  - [ ] Verify: tech_sales_years = ~7.0, other_years = ~10.0
  - [ ] Verify breakdown structure
  
- [ ] Test RoleAnalyzer.calculate_role_frequency()
  - [ ] Test Sonam's 4 positions
  - [ ] Verify role_diversity, primary_role extracted
  
- [ ] Test identify_role_pattern()
  - [ ] Test specialist pattern (same role 80%+)
  - [ ] Test generalist pattern (diverse roles)
  - [ ] Test progressive pattern (exec → manager → director)

### Integration Tests
- [ ] Extract Sonam's resume with all new methods
- [ ] Verify: total_relevant_years = 6.75 (not 16.0)
- [ ] Verify: primary_role = "Sales Manager"
- [ ] Verify: career_pattern = "generalist"
- [ ] Verify: role_frequency populated correctly

### Re-extraction Test
- [ ] Run re-extraction on Prashant's resume
- [ ] Run re-extraction on Sonam's resume
- [ ] Compare results before/after
- [ ] Update database with new values

---

## Success Criteria

| Metric | Target | Success |
|--------|--------|---------|
| Sonam's tech/sales years | 6.75 (not 16) | [ ] YES / [ ] NO |
| Sonam's primary role | "Sales Manager" | [ ] YES / [ ] NO |
| Sonam's career pattern | "generalist" | [ ] YES / [ ] NO |
| Role frequency accuracy | 100% correct | [ ] YES / [ ] NO |
| Classification confidence | >80% avg | [ ] YES / [ ] NO |
| Database persistence | Fields saved | [ ] YES / [ ] NO |
| Assessment integration ready | New fields available | [ ] YES / [ ] NO |

---

## Code Structure Reference

```
apps/
  api/
    src/
      services/
        comprehensive_extractor.py
          - classify_experience_type()          ← ADD
          - calculate_years_between_dates()     ← ADD
          - calculate_filtered_experience_years() ← ADD
          - extract_all()                       ← MODIFY
        
        analytics_service.py (or new file)
          - RoleAnalyzer class                  ← ADD
            - normalize_role_title()
            - calculate_role_frequency()
            - identify_role_pattern()
      
      core/
        models.py
          - CandidateProfile class
            - tech_sales_experience_years       ← ADD FIELD
            - total_relevant_experience_years   ← ADD FIELD
            - non_relevant_experience_years     ← ADD FIELD
            - experience_breakdown              ← ADD FIELD
            - role_frequency                    ← ADD FIELD
            - primary_role                      ← ADD FIELD
            - career_pattern                    ← ADD FIELD
```

---

## Next Actions

1. **Start with core methods:**
   - [ ] Implement classify_experience_type() first
   - [ ] Test with Sonam's positions
   - Validate classification accuracy

2. **Add calculation methods:**
   - [ ] Implement calculate_years_between_dates()
   - [ ] Implement calculate_filtered_experience_years()
   - Test with full experience list

3. **Add role analysis:**
   - [ ] Implement RoleAnalyzer class
   - [ ] Implement role frequency calculation
   - [ ] Implement pattern identification

4. **Database integration:**
   - [ ] Update CandidateProfile schema
   - [ ] Create migration
   - [ ] Update extract_all() integration

5. **Validation:**
   - [ ] Test all methods with Sonam and Prashant
   - [ ] Verify re-extraction results
   - [ ] Check database persistence

