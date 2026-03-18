from pydantic import BaseModel, HttpUrl, EmailStr, Field
from typing import List, Optional, Dict, Any, Union
from datetime import datetime

class CandidateProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    profile_photo_url: Optional[str] = None
    bio: Optional[str] = None
    experience: Optional[str] = None
    current_role: Optional[str] = Field(None, alias="current_role")
    years_of_experience: Optional[int] = None
    primary_industry_focus: Optional[str] = None
    current_employment_status: Optional[str] = None
    key_responsibilities: Optional[str] = None
    major_achievements: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    location: Optional[str] = None
    expected_salary: Optional[int] = None
    location_tier: Optional[str] = None
    learning_links: Optional[List[Dict[str, str]]] = None
    career_interests: Optional[Union[str, List[str]]] = None
    learning_interests: Optional[Union[str, List[str]]] = None
    job_type: Optional[str] = None
    gender: Optional[str] = None
    birthdate: Optional[str] = None
    referral: Optional[str] = None
    identity_verified: Optional[bool] = None
    identity_proof_path: Optional[str] = None
    education_history: Optional[List[Dict[str, Any]]] = None
    experience_history: Optional[List[Dict[str, Any]]] = None
    career_gap_report: Optional[Dict[str, Any]] = None

    class Config:
        populate_by_name = True

class CandidateStats(BaseModel):
    applications_count: int
    daily_applications_count: int
    shortlisted_count: int
    invites_received: int
    posts_count: int
    saved_jobs_count: int
    profile_score: Optional[int]
    profile_strength: str
    completion_score: int
    assessment_status: str
    identity_verified: bool
    identity_proof_path: Optional[str] = None
    terms_accepted: bool
    account_status: str
    onboarding_step: str = "INITIAL"

class CandidateJobResponse(BaseModel):
    id: str
    title: str
    description: str
    experience_band: str
    location: Optional[str] = None
    salary_range: Optional[str] = None
    job_type: str
    company_name: str
    company_website: Optional[str] = None
    created_at: datetime
    has_applied: bool = False

class JobApplicationResponse(BaseModel):
    id: str
    job_id: str
    status: str
    applied_at: datetime
    job_title: str
    company_name: str
    feedback: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    active_interview: Optional[Dict[str, Any]] = None

class JobApplicationDetailResponse(BaseModel):
    id: str
    job_id: str
    status: str
    applied_at: datetime
    job: Dict[str, Any]
    company: Dict[str, Any]
    interviews: List[Dict[str, Any]] = []
    metadata: Optional[Dict[str, Any]] = None
    feedback: Optional[str] = None
