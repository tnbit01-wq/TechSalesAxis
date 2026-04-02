"""Recommendation engine for job-candidate matching."""
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from uuid import UUID
from typing import Dict, List, Optional, Tuple
from src.core.models import (
    CandidateJobSync, Job, CandidateProfile, JobApplication, 
    Company, User
)
from datetime import datetime
import math


class RecommendationService:
    """Service for calculating job recommendations for candidates."""
    
    @staticmethod
    def get_job_recommendations(
        db: Session,
        candidate_id: UUID,
        limit: int = 10,
        offset: int = 0,
        min_score: float = 50.0
    ) -> Dict:
        """
        Get job recommendations for a candidate.
        
        Process:
        1. Get candidate profile
        2. Get active jobs not already applied to
        3. Calculate match scores
        4. Store in candidate_job_sync
        5. Return paginated results
        """
        print(f"[RECOMMENDATION] Getting recommendations for candidate: {candidate_id}")
        
        # Get candidate profile
        candidate = db.query(CandidateProfile).filter(
            CandidateProfile.user_id == candidate_id
        ).first()
        
        if not candidate:
            print(f"[RECOMMENDATION] Candidate not found")
            return {"total": 0, "recommendations": []}
        
        print(f"[RECOMMENDATION] Candidate found: {candidate.full_name}")
        print(f"[RECOMMENDATION] Candidate skills: {candidate.skills}")
        print(f"[RECOMMENDATION] Candidate experience: {candidate.experience}")
        print(f"[RECOMMENDATION] Candidate location: {candidate.location}")
        
        # Get jobs already applied to
        applied_jobs = db.query(JobApplication.job_id).filter(
            JobApplication.candidate_id == candidate_id
        ).all()
        applied_job_ids = [j[0] for j in applied_jobs]
        print(f"[RECOMMENDATION] Applied jobs: {len(applied_job_ids)}")
        
        # Get active jobs not applied to
        available_jobs = db.query(Job).filter(
            and_(
                Job.status == 'active',
                ~Job.id.in_(applied_job_ids) if applied_job_ids else True
            )
        ).all()
        
        print(f"[RECOMMENDATION] Available jobs: {len(available_jobs)}")
        
        # Calculate matches for all jobs
        matches = []
        for job in available_jobs:
            match_result = RecommendationService.calculate_match_score(
                candidate, job
            )
            
            if match_result["overall_match_score"] >= min_score:
                matches.append({
                    "job": job,
                    "match_result": match_result
                })
        
        print(f"[RECOMMENDATION] Matches found (>= {min_score}%): {len(matches)}")
        
        # Sort by match score descending
        matches.sort(
            key=lambda x: x["match_result"]["overall_match_score"],
            reverse=True
        )
        
        # Store top matches in candidate_job_sync
        for match in matches[:10]:  # Store top 10
            try:
                # Check if already exists
                existing = db.query(CandidateJobSync).filter(
                    and_(
                        CandidateJobSync.candidate_id == candidate_id,
                        CandidateJobSync.job_id == match["job"].id
                    )
                ).first()
                
                if not existing:
                    sync_record = CandidateJobSync(
                        candidate_id=candidate_id,
                        job_id=match["job"].id,
                        overall_match_score=match["match_result"]["overall_match_score"],
                        match_explanation=match["match_result"]["explanation"],
                        missing_critical_skills=match["match_result"]["missing_critical_skills"]
                    )
                    db.add(sync_record)
                    print(f"[RECOMMENDATION] Added recommendation: {match['job'].title}")
                else:
                    existing.overall_match_score = match["match_result"]["overall_match_score"]
                    existing.match_explanation = match["match_result"]["explanation"]
                    existing.missing_critical_skills = match["match_result"]["missing_critical_skills"]
                    print(f"[RECOMMENDATION] Updated recommendation: {match['job'].title}")
            except Exception as e:
                print(f"[RECOMMENDATION] Error storing match: {str(e)}")
                db.rollback()
                continue
        
        try:
            db.commit()
            print(f"[RECOMMENDATION] Stored {len(matches[:10])} recommendations")
        except Exception as e:
            print(f"[RECOMMENDATION] Error committing recommendations: {str(e)}")
            db.rollback()
        
        # Get paginated results
        total = len(matches)
        paginated = matches[offset:offset + limit]
        
        print(f"[RECOMMENDATION] Returning {len(paginated)} paginated results")
        
        return {
            "total": total,
            "recommendations": paginated
        }
    
    @staticmethod
    def calculate_match_score(candidate: CandidateProfile, job: Job) -> Dict:
        """
        Calculate comprehensive match score between candidate and job.
        
        Score breakdown:
        - Skills match: 40%
        - Experience band: 25%
        - Location: 20%
        - Salary alignment: 10%
        - Role relevance: 5%
        """
        print(f"\n[MATCH] Calculating score for job: {job.title}")
        
        scores = {}
        missing_skills = []
        
        # 1. Skills Match (40 points max)
        skills_score = RecommendationService.calculate_skills_match(
            candidate.skills or [],
            job.skills_required or []
        )
        scores["skills"] = skills_score * 0.40
        missing_skills = RecommendationService.get_missing_skills(
            candidate.skills or [],
            job.skills_required or []
        )
        print(f"[MATCH] Skills match: {skills_score * 100:.1f}% → {scores['skills']:.1f} points")
        
        # 2. Experience Band Match (25 points max)
        experience_score = RecommendationService.calculate_experience_match(
            candidate.experience,
            job.experience_band
        )
        scores["experience"] = experience_score * 0.25
        print(f"[MATCH] Experience match: {experience_score * 100:.1f}% → {scores['experience']:.1f} points")
        
        # 3. Location Match (20 points max)
        location_score = RecommendationService.calculate_location_match(
            candidate.location or "",
            job.location or "",
            job.job_type
        )
        scores["location"] = location_score * 0.20
        print(f"[MATCH] Location match: {location_score * 100:.1f}% → {scores['location']:.1f} points")
        
        # 4. Salary Alignment (10 points max)
        salary_score = RecommendationService.calculate_salary_match(
            candidate.experience,
            job.salary_range or ""
        )
        scores["salary"] = salary_score * 0.10
        print(f"[MATCH] Salary match: {salary_score * 100:.1f}% → {scores['salary']:.1f} points")
        
        # 5. Role Relevance (5 points max)
        role_score = RecommendationService.calculate_role_relevance(
            candidate.career_interests or [],
            job.title
        )
        scores["role"] = role_score * 0.05
        print(f"[MATCH] Role relevance: {role_score * 100:.1f}% → {scores['role']:.1f} points")
        
        # Calculate overall score
        overall_score = sum(scores.values())
        print(f"[MATCH] Overall score: {overall_score:.1f}/100")
        
        # Generate explanation
        explanation = RecommendationService.generate_explanation(
            scores, missing_skills, candidate.experience, job.experience_band
        )
        
        return {
            "overall_match_score": overall_score,
            "scores": scores,
            "explanation": explanation,
            "missing_critical_skills": missing_skills[:3]  # Top 3 missing
        }
    
    @staticmethod
    def calculate_skills_match(
        candidate_skills: List[str],
        required_skills: List[str]
    ) -> float:
        """
        Calculate skills overlap percentage.
        Returns 0-1 score.
        """
        if not required_skills:
            return 1.0
        
        # Normalize and lowercase for comparison
        candidate_skills_normalized = [s.lower().strip() for s in candidate_skills]
        required_skills_normalized = [s.lower().strip() for s in required_skills]
        
        # Find matches
        matches = set(candidate_skills_normalized) & set(required_skills_normalized)
        
        score = len(matches) / len(required_skills_normalized)
        print(f"[SKILLS] {len(matches)}/{len(required_skills_normalized)} skills match")
        return score
    
    @staticmethod
    def calculate_experience_match(candidate_band: str, job_band: str) -> float:
        """
        Calculate experience band compatibility.
        Returns 0-1 score.
        """
        experience_levels = ["fresher", "mid", "senior", "leadership"]
        
        if candidate_band not in experience_levels or job_band not in experience_levels:
            return 0.5
        
        candidate_idx = experience_levels.index(candidate_band)
        job_idx = experience_levels.index(job_band)
        
        # Exact match: 1.0
        # One level difference: 0.6
        # Two+ levels: 0.0
        diff = abs(candidate_idx - job_idx)
        
        if diff == 0:
            return 1.0
        elif diff == 1:
            return 0.6
        else:
            return 0.0
    
    @staticmethod
    def calculate_location_match(
        candidate_location: str,
        job_location: str,
        job_type: str
    ) -> float:
        """
        Calculate location compatibility.
        Returns 0-1 score.
        """
        # Remote jobs are always a full match
        if job_type == "remote":
            return 1.0
        
        # Normalize locations
        candidate_loc = candidate_location.lower().strip()
        job_loc = job_location.lower().strip()
        
        # Exact match
        if candidate_loc == job_loc:
            return 1.0
        
        # Hybrid jobs get partial match if different location
        if job_type == "hybrid":
            return 0.7
        
        # Onsite different location
        return 0.0
    
    @staticmethod
    def calculate_salary_match(experience_band: str, salary_range: str) -> float:
        """
        Calculate salary alignment with experience level.
        Returns 0-1 score.
        """
        # Define typical salary ranges (in LPA for India market)
        salary_ranges = {
            "fresher": (0, 8),
            "mid": (8, 25),
            "senior": (25, 50),
            "leadership": (50, 200)
        }
        
        if experience_band not in salary_ranges:
            return 0.5
        
        # Try to extract min-max from salary range string (e.g., "15-25 LPA")
        try:
            parts = salary_range.replace("LPA", "").replace("lpa", "").strip().split("-")
            if len(parts) == 2:
                job_min = float(parts[0].strip())
                job_max = float(parts[1].strip())
            else:
                return 0.5
        except:
            return 0.5
        
        exp_min, exp_max = salary_ranges[experience_band]
        
        # Check if job salary aligns with experience level
        # Allow 50% buffer on both sides
        exp_min_with_buffer = exp_min * 0.5
        exp_max_with_buffer = exp_max * 1.5
        
        # If job range overlaps with experience range
        if job_max >= exp_min_with_buffer and job_min <= exp_max_with_buffer:
            return 1.0
        
        return 0.3
    
    @staticmethod
    def calculate_role_relevance(
        career_interests: List[str],
        job_title: str
    ) -> float:
        """
        Calculate if job title matches career interests.
        Returns 0-1 score.
        """
        if not career_interests:
            return 0.5  # No preference stated
        
        job_title_lower = job_title.lower()
        
        for interest in career_interests:
            if interest.lower() in job_title_lower:
                return 1.0
        
        return 0.3  # Not directly related
    
    @staticmethod
    def get_missing_skills(
        candidate_skills: List[str],
        required_skills: List[str]
    ) -> List[str]:
        """Get list of required skills candidate doesn't have."""
        candidate_normalized = [s.lower().strip() for s in candidate_skills]
        required_normalized = [s.lower().strip() for s in required_skills]
        
        missing = [
            s for s in required_normalized
            if s not in candidate_normalized
        ]
        
        return missing
    
    @staticmethod
    def generate_explanation(
        scores: Dict,
        missing_skills: List[str],
        candidate_band: str,
        job_band: str
    ) -> str:
        """Generate human-readable match explanation."""
        overall = sum(scores.values())
        
        # Determine match quality
        if overall >= 85:
            quality = "Strong match"
        elif overall >= 70:
            quality = "Good match"
        elif overall >= 50:
            quality = "Moderate match"
        else:
            quality = "Weak match"
        
        # Build explanation
        skills_pct = (scores.get("skills", 0) / 0.40 * 100) if scores.get("skills", 0) else 0
        exp_match = "your level matches" if scores.get("experience", 0) >= 0.15 else "experience level differs"
        
        explanation = f"{quality}: {skills_pct:.0f}% skills overlap, {exp_match}"
        
        if missing_skills:
            top_missing = ", ".join(missing_skills[:2])
            explanation += f". Missing: {top_missing}"
        
        return explanation
    
    @staticmethod
    def get_strength_areas(scores: Dict) -> List[str]:
        """Get areas where candidate has strong match (>50%)."""
        strengths = []
        
        strength_map = {
            "skills": "Strong skill match",
            "experience": "Experience level matches",
            "location": "Location works well",
            "salary": "Salary is competitive",
            "role": "Aligns with interests"
        }
        
        for key, label in strength_map.items():
            if scores.get(key, 0) / (0.40 if key == "skills" else 0.25 if key == "experience" else 0.20 if key == "location" else 0.10 if key == "salary" else 0.05) > 0.5:
                strengths.append(label)
        
        return strengths
