"""Analytics and tracking service for TALENTFLOW."""
from sqlalchemy.orm import Session
from sqlalchemy import func
from uuid import UUID
from datetime import datetime
from typing import Dict, List, Optional
from src.core.models import (
    JobView, ProfileAnalytics, CandidateJobSync, 
    Job, User, CandidateProfile, SavedJob, JobApplication
)
import json


class AnalyticsService:
    """Service for handling analytics, tracking, and synchronization."""
    
    @staticmethod
    def log_job_view(
        db: Session, 
        job_id: UUID, 
        candidate_id: Optional[UUID] = None,
        viewer_ip: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> JobView:
        """Log a job view event."""
        job_view = JobView(
            job_id=job_id,
            candidate_id=candidate_id,
            viewer_ip=viewer_ip,
            user_agent=user_agent
        )
        try:
            db.add(job_view)
            db.commit()
            db.refresh(job_view)
            return job_view
        except Exception as e:
            db.rollback()
            raise Exception(f"Failed to log job view: {str(e)}")
    
    @staticmethod
    def get_job_view_stats(db: Session, job_id: UUID) -> Dict:
        """Get job view statistics."""
        total_views = db.query(func.count(JobView.id)).filter(
            JobView.job_id == job_id
        ).scalar()
        
        unique_candidates = db.query(func.count(func.distinct(JobView.candidate_id))).filter(
            JobView.job_id == job_id
        ).scalar()
        
        # Get view trends (last 7 days breakdown)
        views_by_day = db.query(
            func.date(JobView.created_at).label('date'),
            func.count(JobView.id).label('count')
        ).filter(
            JobView.job_id == job_id
        ).group_by(
            func.date(JobView.created_at)
        ).order_by(
            func.date(JobView.created_at).desc()
        ).limit(7).all()
        
        return {
            "total_views": total_views or 0,
            "unique_candidates": unique_candidates or 0,
            "views_by_day": [
                {"date": str(row[0]), "count": row[1]} 
                for row in views_by_day
            ]
        }
    
    @staticmethod
    def log_profile_analytics(
        db: Session,
        candidate_id: UUID,
        recruiter_id: UUID,
        event_type: str,
        job_id: Optional[UUID] = None,
        metadata: Optional[Dict] = None
    ) -> ProfileAnalytics:
        """
        Log a profile analytics event (view, application, etc.).
        For profile_view events: One entry per recruiter-candidate pair (all time).
        If recruiter views multiple times, updates the timestamp but doesn't create new entries.
        
        This allows:
        - Recruiter A views Candidate B → 1 entry
        - Recruiter A views Candidate C → 1 separate entry (different candidate)
        - Recruiter A views Candidate B again → Same entry (updated timestamp)
        """
        from datetime import datetime
        
        print(f"\n[SERVICE] ===== log_profile_analytics =====")
        print(f"[SERVICE] event_type: {event_type}")
        print(f"[SERVICE] recruiter_id: {recruiter_id} (type: {type(recruiter_id)})")
        print(f"[SERVICE] candidate_id: {candidate_id} (type: {type(candidate_id)})")
        
        try:
            # For profile_view events, check if this recruiter ever viewed THIS SPECIFIC candidate
            if event_type == "profile_view":
                print(f"[SERVICE] Checking for existing view...")
                
                # Query with explicit UUID handling
                existing_view = db.query(ProfileAnalytics).filter(
                    ProfileAnalytics.candidate_id == candidate_id,
                    ProfileAnalytics.recruiter_id == recruiter_id,
                    ProfileAnalytics.event_type == "profile_view"
                ).first()
                
                print(f"[SERVICE] Existing view found: {existing_view is not None}")
                
                if existing_view:
                    # Update the timestamp of existing view (track most recent view time)
                    print(f"[SERVICE] ✓ View already exists - ID: {existing_view.id}")
                    print(f"[SERVICE]   Previous timestamp: {existing_view.created_at}")
                    old_timestamp = existing_view.created_at
                    
                    existing_view.created_at = datetime.utcnow()
                    if metadata:
                        existing_view.event_metadata = metadata
                    db.commit()
                    db.refresh(existing_view)
                    
                    print(f"[SERVICE]   Updated timestamp: {existing_view.created_at}")
                    print(f"[SERVICE]   Reusing existing entry (no new record created)")
                    return existing_view
            
            # Create new profile event if this recruiter hasn't viewed this candidate before
            print(f"[SERVICE] Creating NEW entry...")
            profile_event = ProfileAnalytics(
                candidate_id=candidate_id,
                recruiter_id=recruiter_id,
                event_type=event_type,
                job_id=job_id,
                event_metadata=metadata or {}
            )
            print(f"[SERVICE] ProfileAnalytics object created")
            print(f"[SERVICE]   Recruiter: {recruiter_id}")
            print(f"[SERVICE]   Candidate: {candidate_id}")
            
            print(f"[SERVICE] Adding to database session...")
            db.add(profile_event)
            print(f"[SERVICE] Committing transaction...")
            db.commit()
            print(f"[SERVICE] Refreshing object from DB...")
            db.refresh(profile_event)
            
            print(f"[SERVICE] ✓ NEW entry created - ID: {profile_event.id}")
            print(f"[SERVICE]   Timestamp: {profile_event.created_at}")
            print(f"[SERVICE] ===== log_profile_analytics END =====\n")
            return profile_event
            
        except Exception as e:
            print(f"[SERVICE] ✗ EXCEPTION during save")
            print(f"[SERVICE] Error: {str(e)}")
            print(f"[SERVICE] Error type: {type(e).__name__}")
            db.rollback()
            import traceback
            traceback.print_exc()
            print(f"[SERVICE] ===== log_profile_analytics END (ERROR) =====\n")
            raise Exception(f"Failed to log profile analytics: {str(e)}")
    
    @staticmethod
    def get_candidate_profile_analytics(
        db: Session, 
        candidate_id: UUID,
        days: int = 30
    ) -> Dict:
        """Get analytics for a candidate's profile."""
        from datetime import timedelta
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # Get all profile view events
        profile_views = db.query(ProfileAnalytics).filter(
            ProfileAnalytics.candidate_id == candidate_id,
            ProfileAnalytics.event_type == 'profile_view',
            ProfileAnalytics.created_at >= cutoff_date
        ).all()
        
        # Get all applications from this candidate in the period
        applications = db.query(JobApplication).filter(
            JobApplication.candidate_id == candidate_id,
            JobApplication.created_at >= cutoff_date
        ).all()
        
        # Get unique recruiters who viewed profile
        unique_recruiters = db.query(func.count(func.distinct(ProfileAnalytics.recruiter_id))).filter(
            ProfileAnalytics.candidate_id == candidate_id,
            ProfileAnalytics.event_type == 'profile_view',
            ProfileAnalytics.created_at >= cutoff_date
        ).scalar()
        
        return {
            "profile_views": len(profile_views),
            "unique_recruiters": unique_recruiters or 0,
            "applications_sent": len(applications),
            "conversion_rate": (
                (len(applications) / len(profile_views) * 100) 
                if len(profile_views) > 0 else 0
            )
        }
    
    @staticmethod
    def sync_candidate_job_matches(
        db: Session,
        candidate_id: UUID,
        job_id: UUID,
        match_score: float,
        match_explanation: str = "",
        missing_skills: List[str] = None
    ) -> CandidateJobSync:
        """Create or update candidate-job match sync record."""
        
        # Check if sync record already exists
        existing_sync = db.query(CandidateJobSync).filter(
            CandidateJobSync.candidate_id == candidate_id,
            CandidateJobSync.job_id == job_id
        ).first()
        
        if existing_sync:
            # Update existing record
            existing_sync.overall_match_score = match_score
            existing_sync.match_explanation = match_explanation
            existing_sync.missing_critical_skills = missing_skills or []
            db.commit()
            db.refresh(existing_sync)
            return existing_sync
        else:
            # Create new record
            sync = CandidateJobSync(
                candidate_id=candidate_id,
                job_id=job_id,
                overall_match_score=match_score,
                match_explanation=match_explanation,
                missing_critical_skills=missing_skills or []
            )
            try:
                db.add(sync)
                db.commit()
                db.refresh(sync)
                return sync
            except Exception as e:
                db.rollback()
                raise Exception(f"Failed to sync candidate-job match: {str(e)}")
    
    @staticmethod
    def get_matched_jobs_for_candidate(
        db: Session,
        candidate_id: UUID,
        min_match_score: float = 0.0
    ) -> List[Dict]:
        """Get all jobs matched to a candidate with match details."""
        syncs = db.query(CandidateJobSync).filter(
            CandidateJobSync.candidate_id == candidate_id,
            CandidateJobSync.overall_match_score >= min_match_score
        ).order_by(
            CandidateJobSync.overall_match_score.desc()
        ).all()
        
        results = []
        for sync in syncs:
            job = db.query(Job).filter(Job.id == sync.job_id).first()
            if job:
                # Check if candidate has already applied
                application = db.query(JobApplication).filter(
                    JobApplication.candidate_id == candidate_id,
                    JobApplication.job_id == sync.job_id
                ).first()
                
                results.append({
                    "job_id": str(sync.job_id),
                    "job_title": job.title,
                    "company_name": job.company_name,
                    "job_location": job.location,
                    "match_score": float(sync.overall_match_score),
                    "match_explanation": sync.match_explanation,
                    "missing_critical_skills": sync.missing_critical_skills or [],
                    "already_applied": application is not None,
                    "match_date": sync.created_at.isoformat() if sync.created_at else None
                })
        
        return results
    
    @staticmethod
    def get_recruiter_profile_analytics(
        db: Session,
        recruiter_id: UUID,
        days: int = 30
    ) -> Dict:
        """Get analytics for a recruiter's activities."""
        from datetime import timedelta
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # Profile views performed by this recruiter
        profile_views = db.query(ProfileAnalytics).filter(
            ProfileAnalytics.recruiter_id == recruiter_id,
            ProfileAnalytics.event_type == 'profile_view',
            ProfileAnalytics.created_at >= cutoff_date
        ).all()
        
        # Unique candidates viewed
        unique_candidates_viewed = db.query(func.count(func.distinct(ProfileAnalytics.candidate_id))).filter(
            ProfileAnalytics.recruiter_id == recruiter_id,
            ProfileAnalytics.event_type == 'profile_view',
            ProfileAnalytics.created_at >= cutoff_date
        ).scalar()
        
        # Get their job postings' view stats
        from src.core.models import Job
        recruiter_jobs = db.query(Job).filter(
            Job.recruiter_id == recruiter_id
        ).all()
        
        total_job_views = 0
        for job in recruiter_jobs:
            views = db.query(func.count(JobView.id)).filter(
                JobView.job_id == job.id
            ).scalar()
            total_job_views += views or 0
        
        return {
            "profile_views_made": len(profile_views),
            "unique_candidates_viewed": unique_candidates_viewed or 0,
            "total_job_views": total_job_views,
            "job_postings_count": len(recruiter_jobs)
        }
    
    @staticmethod
    def batch_sync_job_matches(
        db: Session,
        job_id: UUID,
        matches_data: List[Dict]
    ) -> List[CandidateJobSync]:
        """Batch sync multiple candidate-job matches."""
        results = []
        
        try:
            for match_data in matches_data:
                sync = AnalyticsService.sync_candidate_job_matches(
                    db=db,
                    candidate_id=UUID(match_data["candidate_id"]),
                    job_id=job_id,
                    match_score=match_data.get("match_score", 0.0),
                    match_explanation=match_data.get("match_explanation", ""),
                    missing_skills=match_data.get("missing_skills", [])
                )
                results.append(sync)
            
            return results
        except Exception as e:
            db.rollback()
            raise Exception(f"Batch sync failed: {str(e)}")
