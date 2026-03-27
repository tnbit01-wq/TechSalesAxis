# TALENTFLOW Analytics API - Quick Reference

## Base URL
```
http://localhost:8000/analytics
```

## Authentication
All endpoints require:
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
```

---

## JOB VIEWS TRACKING

### Log a Job View
```
POST /jobs/{job_id}/view

Description: Track when a candidate views a job posting
Permission: Any authenticated user

Response (200):
{
    "status": "success",
    "message": "Job view logged",
    "view_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Get Job View Statistics
```
GET /jobs/{job_id}/stats

Description: Get statistics for a specific job (views, unique candidates, timeline)
Permission: Recruiter who posted the job

Query Parameters: None

Response (200):
{
    "job_id": "550e8400-e29b-41d4-a716-446655440000",
    "stats": {
        "total_views": 45,
        "unique_candidates": 28,
        "views_by_day": [
            {"date": "2026-03-25", "count": 12},
            {"date": "2026-03-24", "count": 8},
            {"date": "2026-03-23", "count": 5}
        ]
    }
}
```

---

## PROFILE ANALYTICS

### Log Profile Event
```
POST /profile/event

Description: Track recruiter activities (viewing candidate profiles)
Permission: Recruiters

Request Body:
{
    "candidate_id": "550e8400-e29b-41d4-a716-446655440000",
    "event_type": "profile_view",
    "job_id": "550e8400-e29b-41d4-a716-446655440001" (optional),
    "metadata": {
        "source": "search",
        "timestamp": "2026-03-25T10:30:00Z"
    }
}

Event Types:
- profile_view
- application_sent
- profile_saved
- profile_shortlisted
- profile_rejected

Response (200):
{
    "status": "success",
    "message": "profile_view event logged",
    "event_id": "550e8400-e29b-41d4-a716-446655440002"
}
```

### Get Candidate Profile Analytics
```
GET /profile/{candidate_id}/analytics

Description: Get analytics for a candidate's profile (views, recruiter interest)
Permission: The candidate themselves

Query Parameters:
- days: number (default 30) - Period to analyze

Response (200):
{
    "candidate_id": "550e8400-e29b-41d4-a716-446655440000",
    "period_days": 30,
    "analytics": {
        "profile_views": 15,
        "unique_recruiters": 8,
        "applications_sent": 3,
        "conversion_rate": 20.0
    }
}
```

### Get Recruiter Activity Analytics
```
GET /recruiter/activities

Description: Get recruiter's activity statistics
Permission: The recruiter themselves

Query Parameters:
- days: number (default 30) - Period to analyze

Response (200):
{
    "recruiter_id": "550e8400-e29b-41d4-a716-446655440000",
    "period_days": 30,
    "analytics": {
        "profile_views_made": 45,
        "unique_candidates_viewed": 38,
        "total_job_views": 320,
        "job_postings_count": 3
    }
}
```

---

## CANDIDATE-JOB SYNC & MATCHES

### Sync a Candidate-Job Match
```
POST /sync/candidate-job-match

Description: Create or update a candidate-job match record
Permission: Admin or the candidate themselves

Request Body:
{
    "candidate_id": "550e8400-e29b-41d4-a716-446655440000",
    "job_id": "550e8400-e29b-41d4-a716-446655440001",
    "match_score": 85.5,
    "match_explanation": "Strong skill match. Python and React expertise aligns with role requirements.",
    "missing_skills": ["AWS", "Docker"]
}

Response (200):
{
    "status": "success",
    "message": "Match sync updated",
    "sync_id": "550e8400-e29b-41d4-a716-446655440002",
    "match_score": 85.5
}
```

### Get Candidate's Matched Jobs
```
GET /candidate/{candidate_id}/matched-jobs

Description: Get all jobs matched to a candidate with match details
Permission: The candidate themselves or admin

Query Parameters:
- min_match_score: float (default 0.0) - Filter by minimum match score (0-100)

Response (200):
{
    "candidate_id": "550e8400-e29b-41d4-a716-446655440000",
    "total_matches": 7,
    "matches": [
        {
            "job_id": "550e8400-e29b-41d4-a716-446655440001",
            "job_title": "Senior Backend Engineer",
            "company_name": "TechCorp",
            "job_location": "Bangalore, India",
            "match_score": 92.0,
            "match_explanation": "Excellent alignment with Python, Django, and PostgreSQL requirements",
            "missing_critical_skills": ["AWS"],
            "already_applied": false,
            "match_date": "2026-03-25T10:30:00"
        },
        {
            "job_id": "550e8400-e29b-41d4-a716-446655440002",
            "job_title": "Full Stack Developer",
            "company_name": "StartupXYZ",
            "job_location": "Remote",
            "match_score": 78.5,
            "match_explanation": "Good fit. Vue.js and Node.js experience matches requirements.",
            "missing_critical_skills": ["TypeScript", "Testing"],
            "already_applied": true,
            "match_date": "2026-03-24T15:20:00"
        }
    ]
}
```

### Batch Sync Job Matches
```
POST /batch/sync-job-matches

Description: Batch create/update matches for multiple candidates for a single job
Permission: Recruiters only

Request Body:
{
    "job_id": "550e8400-e29b-41d4-a716-446655440001",
    "matches": [
        {
            "candidate_id": "550e8400-e29b-41d4-a716-446655440000",
            "match_score": 85.0,
            "match_explanation": "Strong candidate",
            "missing_skills": ["AWS"]
        },
        {
            "candidate_id": "550e8400-e29b-41d4-a716-446655440003",
            "match_score": 72.0,
            "match_explanation": "Moderate fit",
            "missing_skills": ["AWS", "Docker"]
        }
    ]
}

Response (200):
{
    "status": "success",
    "job_id": "550e8400-e29b-41d4-a716-446655440001",
    "syncs_created": 2,
    "message": "Synced 2 candidate-job matches"
}
```

---

## Common Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Invalid request body |
| 401 | Missing or invalid authentication token |
| 403 | Insufficient permissions (unauthorized) |
| 404 | Resource not found |
| 500 | Server error |

---

## Error Response Format

```json
{
    "detail": "Error message describing what went wrong"
}
```

---

## Rate Limiting

No rate limiting currently implemented. Recommended limits:
- Job view logging: 1000 req/min per IP
- Analytics queries: 100 req/min per user
- Batch operations: 10 req/min per user

---

## Example: Complete Candidate Dashboard Flow

### 1. Get Profile Analytics
```bash
curl -X GET "http://localhost:8000/analytics/profile/550e8400-e29b-41d4-a716-446655440000/analytics?days=30" \
  -H "Authorization: Bearer TOKEN"
```

### 2. Get Matched Jobs
```bash
curl -X GET "http://localhost:8000/analytics/candidate/550e8400-e29b-41d4-a716-446655440000/matched-jobs?min_match_score=70" \
  -H "Authorization: Bearer TOKEN"
```

### 3. View Job (trigger tracking)
```bash
curl -X POST "http://localhost:8000/analytics/jobs/550e8400-e29b-41d4-a716-446655440001/view" \
  -H "Authorization: Bearer TOKEN"
```

---

## Example: Complete Recruiter Dashboard Flow

### 1. Get Activity Analytics
```bash
curl -X GET "http://localhost:8000/analytics/recruiter/activities?days=30" \
  -H "Authorization: Bearer TOKEN"
```

### 2. Get Job Statistics
```bash
curl -X GET "http://localhost:8000/analytics/jobs/550e8400-e29b-41d4-a716-446655440001/stats" \
  -H "Authorization: Bearer TOKEN"
```

### 3. Batch Sync Matches for Job
```bash
curl -X POST "http://localhost:8000/analytics/batch/sync-job-matches" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "550e8400-e29b-41d4-a716-446655440001",
    "matches": [...]
  }'
```

---

## Database Tables Reference

### job_views
- Logs when candidates view job postings
- Used for: Job posting analytics, recruiter insights

### profile_analytics
- Logs recruiter activities (profile views, applications)
- Used for: Candidate profile popularity, recruiter interest

### candidate_job_sync
- Caches candidate-job match scores
- Used for: Recommendations, match details

### post_likes
- Logs likes on community posts
- Used for: Post engagement metrics

### post_comments
- Logs comments on community posts
- Used for: Community engagement

---

**Last Updated:** March 25, 2026
**API Version:** 1.0.0
