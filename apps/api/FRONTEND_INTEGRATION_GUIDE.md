"""
Frontend Integration Guide - Analytics & Tracking Implementation
================================================================

This guide shows how to integrate the analytics and tracking endpoints
with the TALENTFLOW frontend.

## 1. JOB VIEW TRACKING

### Location: apps/web/src/app/jobs/{jobId}/page.tsx (or Job Details component)

Add this code to track job views:

```typescript
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function JobDetailsPage({ params }: { params: { jobId: string } }) {
  const router = useRouter();

  useEffect(() => {
    // Log job view when page loads
    const logJobView = async () => {
      try {
        const response = await fetch(`/api/analytics/jobs/${params.jobId}/view`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        });
        
        if (response.ok) {
          console.log('Job view logged successfully');
        }
      } catch (error) {
        console.error('Failed to log job view:', error);
      }
    };

    logJobView();
  }, [params.jobId]);

  // Rest of component...
}
```

### For Recruiters - View Job Analytics:

```typescript
export default function JobAnalytics({ jobId }: { jobId: string }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`/api/analytics/jobs/${jobId}/stats`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        });
        
        const data = await response.json();
        setStats(data.stats);
      } catch (error) {
        console.error('Failed to fetch job stats:', error);
      }
    };

    fetchStats();
  }, [jobId]);

  return (
    <div className="job-analytics">
      <h3>Job Analytics</h3>
      <p>Total Views: {stats?.total_views}</p>
      <p>Unique Candidates: {stats?.unique_candidates}</p>
      <div className="views-timeline">
        {stats?.views_by_day.map((day) => (
          <div key={day.date}>
            <span>{day.date}: {day.count} views</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 2. PROFILE ANALYTICS TRACKING

### Location: When Recruiter Views Candidate Profile

```typescript
// In candidate profile detail component
import { useEffect } from 'react';

export default function CandidateProfilePage({ candidateId }: { candidateId: string }) {
  
  useEffect(() => {
    const logProfileView = async () => {
      try {
        await fetch(`/api/analytics/profile/event`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          },
          body: JSON.stringify({
            candidate_id: candidateId,
            event_type: 'profile_view',
            metadata: {
              source: 'direct_view',
              timestamp: new Date().toISOString()
            }
          })
        });
      } catch (error) {
        console.error('Failed to log profile view:', error);
      }
    };

    logProfileView();
  }, [candidateId]);

  // Rest of component...
}
```

### For Candidates - View Their Profile Analytics:

```typescript
export default function MyProfileAnalytics() {
  const [analytics, setAnalytics] = useState(null);
  const userId = localStorage.getItem('user_id');

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await fetch(
          `/api/analytics/profile/${userId}/analytics?days=30`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            }
          }
        );
        
        const data = await response.json();
        setAnalytics(data.analytics);
      } catch (error) {
        console.error('Failed to fetch profile analytics:', error);
      }
    };

    if (userId) {
      fetchAnalytics();
    }
  }, []);

  return (
    <div className="profile-analytics-widget">
      <h3>Your Profile Activity</h3>
      <div className="stats-grid">
        <div className="stat">
          <h4>{analytics?.profile_views}</h4>
          <p>Profile Views</p>
        </div>
        <div className="stat">
          <h4>{analytics?.unique_recruiters}</h4>
          <p>Recruiters Interested</p>
        </div>
        <div className="stat">
          <h4>{analytics?.applications_sent}</h4>
          <p>You Applied</p>
        </div>
        <div className="stat">
          <h4>{analytics?.conversion_rate?.toFixed(1)}%</h4>
          <p>Conversion Rate</p>
        </div>
      </div>
    </div>
  );
}
```

---

## 3. CANDIDATE-JOB MATCH DISPLAY

### Location: Candidate Dashboard - "Recommended Jobs" Section

```typescript
export default function MatchedJobsWidget() {
  const [matchedJobs, setMatchedJobs] = useState([]);
  const userId = localStorage.getItem('user_id');

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const response = await fetch(
          `/api/analytics/candidate/${userId}/matched-jobs?min_match_score=60`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            }
          }
        );
        
        const data = await response.json();
        setMatchedJobs(data.matches);
      } catch (error) {
        console.error('Failed to fetch matched jobs:', error);
      }
    };

    if (userId) {
      fetchMatches();
    }
  }, []);

  return (
    <div className="matched-jobs-section">
      <h3>Jobs Recommended for You</h3>
      
      {matchedJobs.map((match) => (
        <div key={match.job_id} className="job-match-card">
          <div className="match-header">
            <h4>{match.job_title} at {match.company_name}</h4>
            <div className="match-score">
              <span className="score-badge">{match.match_score.toFixed(0)}% Match</span>
            </div>
          </div>
          
          <p className="location">{match.job_location}</p>
          
          <div className="match-details">
            <p className="match-explanation">{match.match_explanation}</p>
            
            {match.missing_critical_skills?.length > 0 && (
              <div className="missing-skills">
                <h5>Skills to Improve:</h5>
                <div className="skills-list">
                  {match.missing_critical_skills.map((skill) => (
                    <span key={skill} className="skill-tag">{skill}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="match-actions">
            {!match.already_applied ? (
              <button className="btn-apply">Apply Now</button>
            ) : (
              <span className="already-applied">Applied</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## 4. POST INTERACTIONS (Already Implemented)

The backend already supports likes and comments. Here's how to use:

### Like a Post:
```typescript
const likePost = async (postId: string) => {
  await fetch(`/api/posts/${postId}/like`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
    }
  });
};
```

### Comment on a Post:
```typescript
const commentOnPost = async (postId: string, content: string) => {
  await fetch(`/api/posts/${postId}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
    },
    body: JSON.stringify({ content })
  });
};
```

---

## 5. RECRUITER ACTIVITY DASHBOARD

### Location: Recruiter Dashboard Analytics Page

```typescript
export default function RecruiterActivityDashboard() {
  const [activities, setActivities] = useState(null);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const response = await fetch(
          `/api/analytics/recruiter/activities?days=30`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            }
          }
        );
        
        const data = await response.json();
        setActivities(data.analytics);
      } catch (error) {
        console.error('Failed to fetch recruiter activities:', error);
      }
    };

    fetchActivities();
  }, []);

  return (
    <div className="recruiter-activity-dashboard">
      <h2>Your Activity Analytics</h2>
      
      <div className="activity-cards">
        <div className="card">
          <h3>{activities?.profile_views_made}</h3>
          <p>Profiles Viewed</p>
        </div>
        
        <div className="card">
          <h3>{activities?.unique_candidates_viewed}</h3>
          <p>Unique Candidates</p>
        </div>
        
        <div className="card">
          <h3>{activities?.total_job_views}</h3>
          <p>Total Job Views</p>
        </div>
        
        <div className="card">
          <h3>{activities?.job_postings_count}</h3>
          <p>Active Job Postings</p>
        </div>
      </div>
    </div>
  );
}
```

---

## 6. INTEGRATION CHECKLIST

- [ ] Add job view tracking to job details page
- [ ] Add profile analytics display to candidate dashboard
- [ ] Add matched jobs widget to candidate job recommendations
- [ ] Add job analytics dashboard to recruiter dashboard
- [ ] Add like/comment buttons to posts (if not already done)
- [ ] Add recruiter activity dashboard
- [ ] Test tracking with real user interactions
- [ ] Verify data appears in database tables
- [ ] Add UI for team invitations management
- [ ] Add UI for profile_matches filtering

---

## API ENDPOINTS REFERENCE

### Job Views
- `POST /analytics/jobs/{job_id}/view` - Log a job view
- `GET /analytics/jobs/{job_id}/stats` - Get job view statistics

### Profile Analytics
- `POST /analytics/profile/event` - Log a profile event
- `GET /analytics/profile/{candidate_id}/analytics` - Get candidate's profile analytics
- `GET /analytics/recruiter/activities` - Get recruiter's activity analytics

### Candidate-Job Matches
- `POST /analytics/sync/candidate-job-match` - Create/update match sync
- `GET /analytics/candidate/{candidate_id}/matched-jobs` - Get candidate's matched jobs
- `POST /analytics/batch/sync-job-matches` - Batch sync matches

---

## DATA MODELS

### JobView
- `id`: UUID
- `job_id`: UUID (FK to jobs)
- `candidate_id`: UUID (FK to users)
- `viewer_ip`: Text
- `user_agent`: Text
- `created_at`: DateTime

### ProfileAnalytics
- `id`: UUID
- `candidate_id`: UUID (FK to users)
- `recruiter_id`: UUID (FK to users)
- `event_type`: Text (profile_view, application_sent, etc.)
- `job_id`: UUID (FK to jobs)
- `metadata`: JSONB
- `created_at`: DateTime

### CandidateJobSync
- `id`: UUID
- `candidate_id`: UUID (FK to users)
- `job_id`: UUID (FK to jobs)
- `overall_match_score`: Numeric (0.0-100.0)
- `match_explanation`: Text
- `missing_critical_skills`: Array of Text
- `created_at`: DateTime
"""
