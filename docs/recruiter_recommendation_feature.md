# TalentFlow: SmartMatch Recommendation Feature (Recruiter Intelligence)

The **Recruiter Intelligence Recommendations** page (branded as **SmartMatch**) is a high-precision algorithmic engine designed to connect recruiters with the most relevant sales and IT talent in the database.

## 1. Architectural Overview
The feature operates on a hybrid model:
- **Hard Filtering (SQL layer)**: For binary constraints like Location and Experience Bands.
- **Soft Scoring (Python layer)**: For qualitative matching like Skill Overlap and Salary Alignment.

## 2. Filtering Mechanism (The "Hard" Constraints)
Filters on the page trigger server-side queries for performance and accuracy.

| Filter | Logic | Implementation |
| :--- | :--- | :--- |
| **Location** | CASE-INSENSITIVE Match | `ILIKE %location%` in Postgres. Matches partial strings (e.g., "Mumb" matches "Mumbai"). |
| **Experience** | Range-Based Strict Mapping| Maps UI labels to `years_of_experience`: <br> - **0-1 Fresher**: <= 1 yr <br> - **1-5 Mid**: 1-5 yrs <br> - **5-10 Senior**: 5-10 yrs <br> - **10+ Leadership**: > 10 yrs |
| **Budget** | Max Cap | Excludes candidates whose `expected_salary` strictly exceeds the budget (with a hidden negotiation buffer). |
| **Skills/Search** | Keyword Array Scan | Checks the `CandidateProfile.skills` array for presence of provided keywords. |

## 3. The SmartMatch Scoring Algorithm (The "Neural" Rank)
Candidates are ranked using a weighted percentage (Score out of 100). The current weights are:

### **A. Skill Overlap (60%)**
The most critical factor. The engine calculates the intersection of the recruiter's requested skills vs. the candidate's verified skills.
- **Calculation**: `len(overlap) / len(target_skills)`
- **Output**: Generates specific reasoning like *"Matched 5 core skills"*.

### **B. Experience Alignment (20%)**
Aligns the candidate's career stage with the recruiter's selected target level.
- **Full Credit (20 pts)**: Exact match of the experience band.
- **Partial Credit (5 pts)**: Adjacent bands (e.g., Senior candidate for a Mid-level request).

### **C. Salary Synergy (10%)**
- **Full Credit (10 pts)**: Candidate is at or below the recruiter's budget.
- **Partial Credit (5 pts)**: Candidate is within a 15% negotiation buffer above the budget.

### **D. System Trust Bonus (10%)**
Bonus points for candidates who have high "Profile Strength" or have completed verified assessments.

## 4. Categorization Tiers
Candidates are grouped into three distinct visibility tiers on the UI:
1. **Elite (85%+ Match)**: Featured at the top with a pulsing gold/orange badge. Represents "Low-risk, High-Return" hires.
2. **Strong (60% - 85% Match)**: Solid candidates who meet the majority of core criteria.
3. **Potential (< 60% Match)**: Candidates who pass filters but may require upskilling or have higher salary expectations.

## 5. UI/UX Optimization Highlights
- **No-Intrusion Syncing**: Removed legacy auto-refresh logic. The page only recalculates on deliberate search actions.
- **Live Currency Detection**: The budget input automatically switches currency symbols based on the Location filter (₹ for India, £ for UK, etc.).
- **Smart Reasoning**: Every candidate card includes a "Logic Trace" (e.g., *"Within salary expectations | Experience band matches role"*) so recruiters understand exactly why a candidate was recommended.

---
*Document Version: 1.2*
*Last Updated: March 17, 2026*
