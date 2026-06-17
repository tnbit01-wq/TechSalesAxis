from pydantic import BaseModel, HttpUrl, EmailStr, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class RecruiterProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    job_title: Optional[str] = None
    linkedin_url: Optional[str] = None
    bio: Optional[str] = None
    professional_persona: Optional[Dict[str, Any]] = None
    onboarding_step: Optional[str] = None
    team_role: Optional[str] = None

class CompanyProfileUpdate(BaseModel):
    name: Optional[str] = None
    website: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    industry_category: Optional[str] = None
    size_band: Optional[str] = None
    sales_model: Optional[str] = None
    target_market: Optional[str] = None
    hiring_focus_areas: Optional[List[str]] = None
    avg_deal_size_range: Optional[str] = None
    logo_url: Optional[str] = None
    brand_colors: Optional[Dict[str, str]] = None
    life_at_photo_urls: Optional[List[str]] = None

class TeamInviteRequest(BaseModel):
    email: EmailStr

class TeamMemberUpdate(BaseModel):
    is_admin: bool

class RecruiterAccountSettingsUpdate(BaseModel):
    email_notifications: Optional[bool] = None
    web_notifications: Optional[bool] = None
    mobile_notifications: Optional[bool] = None
    profile_visibility: Optional[str] = None
    language: Optional[str] = None
    timezone: Optional[str] = None
    ghost_mode: Optional[bool] = None

class RecruiterStats(BaseModel):
    active_jobs_count: int
    total_hires_count: int
    invites_sent_count: int
    pending_applications_count: int
    response_rate: float
    avg_hiring_cycle: Optional[float]
    candidate_feedback_score: float
    company_quality_score: int
    visibility_tier: str
    assessment_status: str
    verification_status: str
    account_status: str
    completion_score: int

class JobCreate(BaseModel):
    title: str
    description: str
    requirements: List[str] = []
    skills_required: List[str] = []
    experience_band: str  # Fixed from experience_level
    job_type: str = "onsite"
    location: Optional[str] = None
    salary_range: Optional[str] = None
    number_of_positions: int = 1
    metadata: Dict[str, Any] = {}
    is_ai_generated: bool = False

class JobUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[List[str]] = None
    skills_required: Optional[List[str]] = None
    experience_band: Optional[str] = None # Fixed from experience_level
    job_type: Optional[str] = None
    location: Optional[str] = None
    salary_range: Optional[str] = None
    number_of_positions: Optional[int] = None
    status: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class JobResponse(BaseModel):
    id: str
    company_id: str
    recruiter_id: Optional[str]
    title: str
    description: str
    requirements: Optional[List[str]] = []
    skills_required: Optional[List[str]] = []
    experience_band: str 
    job_type: str
    location: Optional[str] = None
    salary_range: Optional[str] = None
    number_of_positions: int = 1
    status: str
    is_ai_generated: bool
    closed_at: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = {}
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class JobAIPrompt(BaseModel):
    prompt: str
    experience_band: str
    location: Optional[str] = None

class ApplicationStatusUpdate(BaseModel):
    application_id: str
    status: str
    feedback: Optional[str] = None

class JobInviteRequest(BaseModel):
    job_id: str
    message: Optional[str] = None
    custom_role_title: Optional[str] = None

class BulkApplicationStatusUpdate(BaseModel):
    application_ids: List[str]
    status: str
    feedback: Optional[str] = None
