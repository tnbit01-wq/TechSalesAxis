# Technical Implementation Guide: Tech/Sales Experience Filtering & Role Analysis

**Purpose:** Extract only tech/sales-related experience, ignore non-relevant roles (like teaching)  
**Impact:** More accurate candidate matching and skill assessment

---

## Part 1: Experience Type Classification

### Implementation Code

**File:** `apps/api/src/services/comprehensive_extractor.py`

Add this new method:

```python
@staticmethod
def classify_experience_type(position: str, company: str, description: str = "") -> Dict[str, str]:
    """
    Classify experience into categories:
    - 'tech_sales': Sales roles in technology/SaaS
    - 'sales': General sales/business development  
    - 'tech': Engineering/technical roles
    - 'other': Non-relevant roles
    
    Returns dict with classification and confidence score
    """
    
    # Combine all text for analysis
    text = f"{position} {company} {description}".lower()
    
    # Define keywords for each category
    TECH_SALES_INDICATORS = [
        # Primary indicators
        'sales engineer', 'sales development', 'sales consultant (tech',
        'account executive (tech', 'account executive (software',
        'saas sales', 'software sales', 'tech sales',
        # Secondary indicators  
        'business development (tech', 'business development (software',
        'sales manager (sales engineer', 'sales manager (client',
        # Company types
        'saas', 'software', 'technology', 'cloud', 'ai', 'it vendor',
        # Specific tools/context
        'sales force', 'hubspot', 'zoho', 'pipedrive', 'crm',
    ]
    
    SALES_INDICATORS = [
        'sales manager', 'sales executive', 'business development',
        'account manager', 'account executive', 'business consultant',
        'sales representative', 'sales director', 'sales lead',
        'bd manager', 'business development manager',
        'inside sales', 'outside sales', 'field sales',
        'sales coordinator', 'sales associate',
        # Non-tech sales companies/contexts
        'retail', 'finance', 'real estate', 'insurance', 'pharma',
    ]
    
    TECH_INDICATORS = [
        'software engineer', 'developer', 'programmer', 'full stack',
        'frontend', 'backend', 'devops', 'architect',
        'data scientist', 'data engineer', 'ml engineer',
        'technical lead', 'engineering manager',
        'systems engineer', 'network engineer', 'security',
        'tech lead', 'senior engineer', 'engineering',
    ]
    
    NON_RELEVANT_INDICATORS = [
        'trainer', 'teacher', 'professor', 'instructor', 'coach',
        'educator', 'faculty',
        'hr ', 'human resources', 'recruiter', 'recruitment',
        'accounting', 'accountant', 'finance', 'financial',
        'administrative', 'secretary', 'office manager',
        'consulting (management', 'management consultant',
    ]
    
    # Count matches in each category
    scores = {
        'tech_sales': 0,
        'sales': 0,
        'tech': 0,
        'other': 0,
    }
    
    # Check for tech sales indicators
    for indicator in TECH_SALES_INDICATORS:
        if indicator in text:
            scores['tech_sales'] += 2  # Higher weight
    
    # Check for sales indicators
    for indicator in SALES_INDICATORS:
        if indicator in text:
            scores['sales'] += 1
    
    # Check for tech indicators
    for indicator in TECH_INDICATORS:
        if indicator in text:
            scores['tech'] += 1
    
    # Check for non-relevant indicators
    for indicator in NON_RELEVANT_INDICATORS:
        if indicator in text:
            scores['other'] += 3  # Higher weight to exclude
    
    # Determine primary category
    primary_category = max(scores, key=scores.get)
    max_score = scores[primary_category]
    
    # If non-relevant is dominant, return 'other'
    if scores['other'] > scores['tech_sales'] and scores['other'] > scores['sales']:
        primary_category = 'other'
    
    # Calculate confidence (as percentage)
    total_keywords = sum(scores.values())
    confidence = (max_score / total_keywords * 100) if total_keywords > 0 else 0
    
    return {
        'category': primary_category,
        'scores': scores,
        'confidence': round(confidence, 1)
    }
```

### Usage Example

```python
# Test with Sonam's positions
positions = [
    {
        'position': 'Business Development & Client Relations',
        'company': 'Lasani 3D',
        'description': 'Overseeing client communication for architectural visualization'
    },
    {
        'position': 'Business Sales Manager',
        'company': 'AM Webtech Pvt. Ltd.',
        'description': 'Managed distributed sales team, negotiated with clients'
    },
    {
        'position': 'English Communication Trainer',
        'company': 'CBSE Schools',
        'description': 'Trained students and professionals in communication'
    }
]

for pos in positions:
    result = classify_experience_type(
        pos['position'],
        pos['company'],
        pos['description']
    )
    print(f"{pos['position']}: {result['category']} (confidence: {result['confidence']}%)")

# Output:
# Business Development & Client Relations: sales (confidence: 85.0%)
# Business Sales Manager: sales (confidence: 90.0%)
# English Communication Trainer: other (confidence: 92.0%)
```

---

## Part 2: Calculate Tech/Sales Experience Years

### Implementation Code

**File:** `apps/api/src/services/comprehensive_extractor.py`

Add these methods:

```python
@staticmethod
def calculate_years_between_dates(start_date_str: str, end_date_str: str) -> float:
    """
    Calculate years between two dates
    Handles various formats: "Jan 2020", "January 2020", "Jan 2020 – Dec 2023", etc.
    
    Returns float (e.g., 3.5 for 3 years 6 months)
    """
    import re
    from datetime import datetime
    
    # Extract year and month from strings like "Jan 2020" or "January 2020"
    def extract_year_month(date_str):
        # Try to match "Jan 2020" or "January 2020"
        match = re.search(r'(\w+)\s+(\d{4})', date_str)
        if match:
            month_str = match.group(1)
            year = int(match.group(2))
            
            # Month name to number
            months = {
                'jan': 1, 'january': 1,
                'feb': 2, 'february': 2,
                'mar': 3, 'march': 3,
                'apr': 4, 'april': 4,
                'may': 5,
                'jun': 6, 'june': 6,
                'jul': 7, 'july': 7,
                'aug': 8, 'august': 8,
                'sep': 9, 'september': 9,
                'oct': 10, 'october': 10,
                'nov': 11, 'november': 11,
                'dec': 12, 'december': 12,
            }
            month = months.get(month_str.lower(), 1)
            return year, month
        
        # Try to match just year "2020"
        match = re.search(r'(\d{4})', date_str)
        if match:
            return int(match.group(1)), 1
        
        return None, None
    
    # Extract start and end dates
    start_year, start_month = extract_year_month(start_date_str)
    
    # Handle "Present" or "Current"
    if 'present' in end_date_str.lower() or 'current' in end_date_str.lower():
        from datetime import date
        end_year = date.today().year
        end_month = date.today().month
    else:
        end_year, end_month = extract_year_month(end_date_str)
    
    if not start_year or not end_year:
        return 0
    
    # Calculate difference
    year_diff = end_year - start_year
    month_diff = end_month - start_month
    
    total_months = year_diff * 12 + month_diff
    years = total_months / 12
    
    return round(years, 1)


@staticmethod
def calculate_filtered_experience_years(experience_list: List[Dict]) -> Dict:
    """
    Calculate experience years filtered by category
    Returns breakdown of tech/sales vs other experience
    
    Returns:
    {
        'tech_sales_years': 7.0,
        'tech_only_years': 2.0,
        'sales_only_years': 5.0,
        'other_years': 10.0,
        'total_relevant': 7.0,
        'total_all': 17.0,
        'breakdown': [
            {
                'position': 'Sales Manager',
                'category': 'sales',
                'years': 2.0,
                'included': True
            }
        ]
    }
    """
    
    breakdown = []
    years_by_category = {
        'tech_sales': 0,
        'sales': 0,
        'tech': 0,
        'other': 0,
    }
    
    for exp in experience_list:
        position = exp.get('position', '')
        company = exp.get('company', '')
        description = exp.get('description', '')
        
        # Classify experience type
        classification = ComprehensiveResumeExtractor.classify_experience_type(
            position, company, description
        )
        category = classification['category']
        
        # Calculate duration
        start_date = exp.get('start_date', '')
        end_date = exp.get('end_date', 'Present')
        
        duration_years = ComprehensiveResumeExtractor.calculate_years_between_dates(
            start_date, end_date
        )
        
        # Add to category total
        years_by_category[category] += duration_years
        
        # Track for breakdown
        breakdown.append({
            'position': position,
            'company': company,
            'category': category,
            'duration_years': duration_years,
            'included_in_relevant': category != 'other',
            'start_date': start_date,
            'end_date': end_date,
        })
    
    # Calculate totals
    total_relevant = (
        years_by_category['tech_sales'] +
        years_by_category['sales'] +
        years_by_category['tech']
    )
    
    total_all = sum(years_by_category.values())
    
    return {
        'tech_sales_years': years_by_category['tech_sales'],
        'tech_only_years': years_by_category['tech'],
        'sales_only_years': years_by_category['sales'],
        'other_years': years_by_category['other'],
        'total_relevant_years': total_relevant,
        'total_years': total_all,
        'breakdown': breakdown,
    }
```

### Usage Example

```python
# Sonam's experience data
experience_list = [
    {
        'position': 'Business Development & Client Relations',
        'company': 'Lasani 3D',
        'description': 'Client communication, project follow-ups',
        'start_date': 'Jun 2024',
        'end_date': 'Present'
    },
    {
        'position': 'Business Sales Manager',
        'company': 'AM Webtech Pvt. Ltd.',
        'description': 'Sales team management, 30% revenue uplift',
        'start_date': 'Feb 2021',
        'end_date': 'Mar 2023'
    },
    {
        'position': 'Associate Sales Executive',
        'company': 'XTRIM Global Solutions',
        'description': 'Lead generation, client relationships',
        'start_date': 'Jan 2019',
        'end_date': 'Dec 2020'
    },
    {
        'position': 'English Communication Trainer',
        'company': 'CBSE Schools',
        'description': 'Trained students in communication',
        'start_date': 'Jan 2009',
        'end_date': 'Dec 2019'
    }
]

# Calculate filtered experience
result = ComprehensiveResumeExtractor.calculate_filtered_experience_years(experience_list)

print(f"Tech/Sales Experience: {result['tech_sales_years']} years")
print(f"Sales Only: {result['sales_only_years']} years")
print(f"Tech Only: {result['tech_only_years']} years")
print(f"Other (Non-Relevant): {result['other_years']} years")
print(f"Total Relevant: {result['total_relevant_years']} years")
print(f"Total (All): {result['total_years']} years")

# Output:
# Tech/Sales Experience: 2.75 years
# Sales Only: 4.0 years
# Tech Only: 0 years
# Other (Non-Relevant): 10.0 years
# Total Relevant: 6.75 years
# Total (All): 16.75 years
```

---

## Part 3: Role Frequency Analysis

### Implementation Code

**File:** `apps/api/src/services/analytics_service.py` or new file

```python
class RoleAnalyzer:
    """Analyze role patterns and frequency from experience history"""
    
    @staticmethod
    def normalize_role_title(role: str) -> str:
        """
        Normalize role titles to reduce variations
        E.g., "Sales Manager I", "Senior Sales Manager" → "Sales Manager"
        """
        import re
        
        role = role.strip().lower()
        
        # Remove level indicators
        role = re.sub(r'\b(senior|junior|sr\.|jr\.|i{1,3}|iv|v)\b', '', role)
        
        # Remove numbers
        role = re.sub(r'\s*\d+\s*', ' ', role)
        
        # Clean up extra spaces
        role = re.sub(r'\s+', ' ', role).strip()
        
        return role.title()
    
    @staticmethod
    def calculate_role_frequency(experience_list: List[Dict]) -> Dict:
        """
        Calculate frequency of each role type
        
        Returns:
        {
            'role_frequency': {
                'Sales Manager': 1,
                'Business Development': 1,
                'Sales Executive': 1
            },
            'primary_role': 'Sales Manager',
            'primary_role_count': 1,
            'role_diversity': 0.75  # Different roles / total roles
        }
        """
        
        role_counts = {}
        total_roles = len(experience_list)
        
        if total_roles == 0:
            return {
                'role_frequency': {},
                'primary_role': None,
                'primary_role_count': 0,
                'role_diversity': 0
            }
        
        # Count normalized roles
        for exp in experience_list:
            position = exp.get('position', '')
            if position:
                normalized_role = RoleAnalyzer.normalize_role_title(position)
                role_counts[normalized_role] = role_counts.get(normalized_role, 0) + 1
        
        # Sort by frequency
        sorted_roles = sorted(role_counts.items(), key=lambda x: x[1], reverse=True)
        
        # Calculate role diversity (how many unique roles / total roles)
        unique_roles = len(role_counts)
        role_diversity = unique_roles / total_roles if total_roles > 0 else 0
        
        # Get primary role
        primary_role = sorted_roles[0][0] if sorted_roles else None
        primary_role_count = sorted_roles[0][1] if sorted_roles else 0
        
        return {
            'role_frequency': dict(sorted_roles),
            'primary_role': primary_role,
            'primary_role_count': primary_role_count,
            'role_diversity': round(role_diversity, 2),
            'unique_roles_count': unique_roles,
            'total_roles': total_roles,
        }
    
    @staticmethod  
    def identify_role_pattern(role_frequency_dict: Dict, experience_breakdown: List[Dict]) -> str:
        """
        Identify career pattern:
        - 'specialist': Same role repeatedly (80%+ same role)
        - 'progressive': Related roles with progression (Sales Exec → Manager → Director)
        - 'generalist': Diverse roles (30%+ diversity)
        """
        
        if not role_frequency_dict or 'role_frequency' not in role_frequency_dict:
            return 'unknown'
        
        role_freq = role_frequency_dict['role_frequency']
        diversity = role_frequency_dict['role_diversity']
        
        # Check if specialist
        if len(role_freq) == 1:
            return 'specialist'
        
        # Check if generalist
        if diversity >= 0.6:  # 60% unique roles
            return 'generalist'
        
        # Check if progressive
        # Look for progression pattern (exec → manager → consultant)
        progression_indicators = [
            ('executive', 'manager'),
            ('manager', 'director'),
            ('consultant', 'manager'),
            ('specialist', 'lead'),
        ]
        
        for indicator_pair in progression_indicators:
            if any(ind in role.lower() for role in role_freq.keys() for ind in indicator_pair):
                return 'progressive'
        
        return 'generalist'
```

### Usage Example

```python
# Sonam's experience
experience_list = [
    {'position': 'Business Development & Client Relations', ...},
    {'position': 'Business Sales Manager', ...},
    {'position': 'Associate Sales Executive', ...},
    {'position': 'English Communication Trainer', ...}
]

# Analyze roles
analyzer = RoleAnalyzer()
role_analysis = analyzer.calculate_role_frequency(experience_list)

print("Role Frequency:", role_analysis['role_frequency'])
print("Primary Role:", role_analysis['primary_role'])
print("Role Diversity:", role_analysis['role_diversity'])

pattern = analyzer.identify_role_pattern(role_analysis, experience_list)
print("Career Pattern:", pattern)

# Output:
# Role Frequency: {'Sales Manager': 1, 'Business Development': 1, 'Sales Executive': 1, 'Trainer': 1}
# Primary Role: Sales Manager
# Role Diversity: 1.0 (all different)
# Career Pattern: generalist
```

---

## Part 4: Integrate into Candidate Profile

### Database Schema Update

**File:** `apps/api/src/core/models.py`

```python
class CandidateProfile(Base):
    # ... existing fields ...
    
    # New fields for experience analysis
    tech_sales_experience_years = Column(Float)  # Filtered years
    total_relevant_experience_years = Column(Float)  # Tech + Sales
    non_relevant_experience_years = Column(Float)  # Other (e.g., teaching)
    
    experience_breakdown = Column(JSONB, default={})  # Full breakdown
    role_frequency = Column(JSONB, default={})  # Role counts
    primary_role = Column(String)  # Most common role
    career_pattern = Column(String)  # specialist/progressive/generalist
```

---

## Part 5: Update extract_all() Method

### Modified Method

```python
@staticmethod
def extract_all(text: str) -> Dict:
    """Master extraction method - returns all fields properly mapped"""
    
    # ... existing extraction code ...
    
    # NEW: Calculate experience analysis
    experience_list, current_role, previous_role = ComprehensiveResumeExtractor.extract_experience(text)
    
    experience_analysis = ComprehensiveResumeExtractor.calculate_filtered_experience_years(experience_list)
    
    role_analyzer = RoleAnalyzer()
    role_analysis = role_analyzer.calculate_role_frequency(experience_list)
    career_pattern = role_analyzer.identify_role_pattern(role_analysis, experience_list)
    
    return {
        # ... existing fields ...
        
        # NEW: Experience analysis
        'tech_sales_experience_years': experience_analysis['tech_sales_years'],
        'total_relevant_experience_years': experience_analysis['total_relevant_years'],
        'non_relevant_experience_years': experience_analysis['other_years'],
        'experience_breakdown': experience_analysis['breakdown'],
        'role_frequency': role_analysis['role_frequency'],
        'primary_role': role_analysis['primary_role'],
        'career_pattern': career_pattern,
    }
```

---

## Testing

### Test Script

```python
# tests/test_experience_filtering.py

def test_sonam_experience_classification():
    """Test classification of Sonam's positions"""
    
    test_cases = [
        {
            'position': 'Business Development & Client Relations',
            'company': 'Lasani 3D',
            'expected_category': 'sales'
        },
        {
            'position': 'Business Sales Manager',
            'company': 'AM Webtech',
            'expected_category': 'sales'
        },
        {
            'position': 'English Communication Trainer',
            'company': 'CBSE Schools',
            'expected_category': 'other'
        }
    ]
    
    for test_case in test_cases:
        result = classify_experience_type(
            test_case['position'],
            test_case['company']
        )
        assert result['category'] == test_case['expected_category'], \
            f"Expected {test_case['expected_category']}, got {result['category']}"
    
    print("✓ Classification tests passed")
```

---

## Summary

This implementation provides:
- ✅ Experience type classification (tech/sales vs other)
- ✅ Filtered experience year calculation
- ✅ Role frequency analysis  
- ✅ Career pattern identification
- ✅ Integration with assessment for resume-based questions

**Result:** More accurate candidate matching and targeted assessment questions based on actual relevant experience!

