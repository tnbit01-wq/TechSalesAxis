# TechSalesAxis Recommendations Engine - Complete Documentation

This guide provides technical documentation for the updated, skills-first **TechSalesAxis Recommendations Engine** currently implemented in the platform.

---

## 1. System Overview

The recommendation engine connects candidates and recruiters using a strict **Skills Match** scoring methodology. All old multi-factor models (e.g. legacy weighting schemes that mixed location, salary, and experience directly into match scores) have been replaced by a clean, deterministic skill-overlap calculation.

- **Recruiter Perspective (Finding Candidates):** Matches candidates to open jobs based strictly on the intersection of the candidate's skills and the job's required skills.
- **Candidate Perspective (Finding Jobs):** Matches jobs to candidates based on normalized skill overlap, allowing candidates to discover any job where they share at least one matching skill.

---

## 2. Skills Match Scoring Algorithm

Both candidate-side and recruiter-side recommendations utilize a unified matching algorithm.

### A. Skill Token Normalization
To prevent inconsistencies from casing, punctuation, and aliases, all skills are normalized before matching:
1. **Punctuation Clean-up:** Strips spaces and special symbols (e.g., `Node.js` -> `nodejs`, `React.js` -> `reactjs`, `C#` -> `csharp`, `.NET` -> `dotnet`).
2. **Alias Mapping:** Maps common technology abbreviations to canonical names (e.g., `js` -> `javascript`, `ts` -> `typescript`, `py` -> `python`, `postgres` -> `postgresql`).
3. **Casing:** Converts all tokens to lowercase.

### B. Match Score Formula
The match score is calculated as the ratio of overlapping skills to the total required skills:
$$\text{Score} = \text{round}\left( \frac{\text{length}(\text{Candidate Skills Normalized} \cap \text{Required Skills Normalized})}{\text{length}(\text{Required Skills Normalized})} \times 100 \right)$$

- **Threshold Floor:** Set to `>= 1%` floor. Any candidate or job with at least one matching skill is included in the recommendations pool (preventing matches from being silently hidden). Profiles with `0%` skill overlap are excluded entirely.

---

## 3. Recruiter-Side Candidate Recommendations

Located at: `/dashboard/recruiter/intelligence/recommendations`

### A. Core Properties
- Matches are anchored to a selected posted job.
- Score displays the direct skills overlap percentage.
- Does **not** penalize candidates in the score for experience level, location, or salary boundaries.

### B. Post-Matching Sidebar Filters (Fully Functional)
Once the skills-matched candidate pool is compiled based on the selected job, recruiters can refine and narrow down candidates using the sticky filter sidebar. All filters are fully functional and integrated with the backend:

1. **Posted Role Selector:** 
   - A dropdown menu at the top of the sidebar listing all recruiter jobs along with their corresponding matching candidate counts.
   - Selecting a different job dynamically switches the baseline candidate matching pool and updates the match counts.
2. **Search Bar:**
   - A text search input allowing recruiters to quickly filter the matched candidate cards by **Name**, **Current Role**, or **Skills**.
3. **Candidate Source Checkboxes:**
   - Checkboxes that filter candidates by their platform status:
     - **Active - Verified:** Candidates who have successfully completed the platform onboarding assessment.
     - **Active - Unverified:** Active platform candidates who have not yet completed the assessment.
     - **Passive Talent Pool:** Pre-sourced passive leads (shadow profiles).
4. **Minimum Culture Fit:** 
   - A dropdown selector to filter out candidates who do not meet a minimum culture fit threshold (Elite $\ge 85\%$, Strong $\ge 70\%$, Potential $\ge 50\%$).
5. **Experience Band:** 
   - Seniority band selector mapping to years of experience ranges: Fresher (0-1 yrs), Mid (1-5 yrs), Senior (5-10 yrs), or Leadership (10+ yrs).
6. **Location Input:** 
   - A location search field matching candidate locations with built-in equivalent handling (e.g. typing `Bangalore` matches candidates with `Bengaluru` or `Bangalore, KA` in their profile).
7. **Budget (Max Salary):** 
   - A numeric input that filters out candidates whose expected salary exceeds the recruiter's specified salary budget.
8. **Availability and Readiness (Advanced Accordion):** 
   - An expandable drawer containing options to filter by relocation willingness, notice periods, and career readiness flags.

**To apply changes:** Click the **Apply Filters** button at the bottom of the sidebar. This queries the backend matching engine and refreshes the candidate recommendation list.

### C. Prioritized Sorting
Recommended candidates are returned in the following strict precedence:
1. **Active - Verified** candidates (sorted by Match Score descending).
2. **Active - Unverified** candidates (sorted by Match Score descending).
3. **Passive Talent Pool** candidates (sorted by Match Score descending).

---

## 4. Candidate-Side Job Recommendations

Located at: `/dashboard/candidate/recommendations`

### A. Core Properties
- Matches active jobs to candidate profile skills.
- Lowers the match floor to `>= 1%` so candidates can view all jobs with any relevant skill overlap.
- Experience, location, and salary filters are applied in the candidate's sidebar to refine outcomes manually.

### B. Prioritized Sorting
- Sorted by **Skills Match score** in descending order.

---

## 5. Conversational AI Assistant Chat Integration

The recommendation engines are fully integrated into the co-pilot chat handler (`apps/api/src/api/assistant_chat.py`):

1. **Recruiter chat (`intent = "candidate_search"`):**
   - Automatically executes `recruiter_service.get_recommended_candidates` in `"skill_match"` mode.
   - Extracts filters (skills, locations, budgets) from the natural language query.
   - AI assistant replies conversationally, describing the top candidates and explaining their skill match ratios, followed by interactive CandidateCards.
2. **Candidate chat (`intent = "job_search"`):**
   - Executes `CandidateService.get_recommended_jobs` in `"skills_focus"` mode.
   - Presents matching jobs in natural prose (e.g., title, company, match score), followed by clickable JobCards.

---

## 6. API References

### A. Recruiter Endpoints
- **Get Job List with Match Counts:**
  `GET /recruiter/jobs`
  Returns active jobs, including `matching_candidates_count` (the count of candidates matching $\ge 1\%$ skills overlap for that job).
- **Get Candidate Matches for a Job:**
  `GET /recruiter/jobs/{job_id}/recommended-candidates?candidate_types=active_verified,passive&min_culture_score=70`
  Returns sorted candidates matching the filter criteria.
- **Get Match Scores for a Candidate Profile:**
  `GET /recruiter/candidate/{candidate_id}/match-scores`
  Returns skill match scores, missing skills list, and explanations against all recruiter company jobs.

### B. Candidate Endpoints
- **Get Job Recommendations:**
  `GET /candidate/recommended-jobs?filter_type=skills_focus&location=Bangalore&min_salary=15`
  Returns matching job list and scores.
