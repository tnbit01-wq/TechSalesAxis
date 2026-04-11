from pydantic import BaseModel, Field, field_validator
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from enum import Enum

# ==========================================
# Career Readiness Enums
# ==========================================

class JobSearchMode(str, Enum):
    """Candidate's job search engagement level"""
    EXPLORING = "exploring"  # Just browsing, no rush
    PASSIVE = "passive"      # Open to great fit, not urgent
    ACTIVE = "active"        # Actively looking, urgent


class EmploymentStatus(str, Enum):
    """Candidate's current employment situation"""
    EMPLOYED = "Employed"
    UNEMPLOYED = "Unemployed"
    STUDENT = "Student"


class ContractPreference(str, Enum):
    """Employment type preference"""
    FULLTIME = "fulltime"
    CONTRACT = "contract"
    BOTH = "both"


# ==========================================
# Request/Response Schemas
# ==========================================

class CareerReadinessStep1Request(BaseModel):
    """Step 1: Employment Status"""
    employment_status: EmploymentStatus = Field(..., description="Current employment situation")
    current_company_name: Optional[str] = Field(None, description="Company name if employed")
    
    class Config:
        use_enum_values = True


class CareerReadinessStep2Request(BaseModel):
    """Step 2: Job Search Mode"""
    job_search_mode: JobSearchMode = Field(..., description="Engagement level: exploring, passive, or active")
    exploration_trigger: Optional[str] = Field(None, description="Why looking: salary, growth, escape, upskill")
    
    class Config:
        use_enum_values = True


class CareerReadinessStep3Request(BaseModel):
    """Step 3: Timeline & Notice Period"""
    notice_period_days: int = Field(..., description="Days needed before joining (0=immediate, 7, 14, 30, 60, 90, 180)")
    willing_to_relocate: bool = Field(False, description="Open to relocation")
    
    @field_validator('notice_period_days')
    def validate_notice_period(cls, v):
        valid_values = [0, 7, 14, 30, 60, 90, 180]
        if v not in valid_values:
            raise ValueError(f"notice_period_days must be one of: {valid_values}")
        return v
    
    class Config:
        use_enum_values = True


class CareerReadinessStep4Request(BaseModel):
    """Step 4: Market Engagement & Preferences"""
    contract_preference: ContractPreference = Field(ContractPreference.FULLTIME)
    visa_sponsorship_needed: bool = Field(False)
    salary_flexibility: float = Field(0.5, ge=0.0, le=1.0, description="0=rigid (exact salary), 1.0=very flexible")
    target_market_segment: Optional[str] = Field(None, description="SMB, mid_market, enterprise, any")
    
    class Config:
        use_enum_values = True


class CareerReadinessSaveRequest(BaseModel):
    """Complete Career Readiness profile"""
    employment_status: EmploymentStatus
    job_search_mode: JobSearchMode
    notice_period_days: int
    willing_to_relocate: bool
    contract_preference: ContractPreference = ContractPreference.FULLTIME
    visa_sponsorship_needed: bool = False
    salary_flexibility: float = 0.5
    exploration_trigger: Optional[str] = None
    target_market_segment: Optional[str] = None
    current_company_name: Optional[str] = None
    
    @field_validator('notice_period_days')
    def validate_notice_period(cls, v):
        valid_values = [0, 7, 14, 30, 60, 90, 180]
        if v not in valid_values:
            raise ValueError(f"notice_period_days must be one of: {valid_values}")
        return v
    
    @field_validator('salary_flexibility')
    def validate_salary_flexibility(cls, v):
        if not 0.0 <= v <= 1.0:
            raise ValueError("salary_flexibility must be between 0.0 and 1.0")
        return v

    class Config:
        use_enum_values = True


class CareerReadinessResponse(BaseModel):
    """Candidate's Career Readiness Profile"""
    employment_status: str
    job_search_mode: str
    notice_period_days: Optional[int]
    availability_date: Optional[datetime]
    willing_to_relocate: bool
    contract_preference: str
    visa_sponsorship_needed: bool
    salary_flexibility: float
    exploration_trigger: Optional[str]
    target_market_segment: Optional[str]
    current_company_name: Optional[str]
    career_readiness_timestamp: datetime
    days_until_revertification: int  # Calculated field
    
    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class CareerReadinessMetadataResponse(BaseModel):
    """Extended metadata about career readiness"""
    mode: str  # exploring, passive, active
    availability_in_days: int
    availability_date: str  # ISO format
    immediate_joiner: bool  # True if notice_period_days == 0
    revertification_needed: bool  # True if >15 days since last update
    days_since_update: int
    recruiter_visibility: str  # 'hidden', 'limited', 'full'
    notification_frequency: str  # 'weekly', '2-3x_weekly', 'daily'
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class CareerReadinessFilterRequest(BaseModel):
    """Recruiter filter options for finding candidates"""
    job_search_modes: Optional[List[str]] = None  # ['exploring', 'passive', 'active']
    max_notice_period_days: Optional[int] = None  # Show candidates available within X days
    immediate_joiners_only: bool = False  # notice_period_days == 0
    willing_to_relocate: Optional[bool] = None
    visa_sponsorship_required: Optional[bool] = None
    salary_range_min: Optional[int] = None
    salary_range_max: Optional[int] = None
    
    class Config:
        use_enum_values = True


class CareerReadinessUpdateRequest(BaseModel):
    """Candidate can update their career readiness at any time from dashboard"""
    job_search_mode: Optional[JobSearchMode] = None
    notice_period_days: Optional[int] = None
    willing_to_relocate: Optional[bool] = None
    employment_status: Optional[EmploymentStatus] = None
    reason: Optional[str] = Field(None, description="Why updating: 'accepted_offer', 'found_role', 'status_changed', etc")
    
    @field_validator('notice_period_days')
    def validate_notice_period(cls, v):
        if v is not None:
            valid_values = [0, 7, 14, 30, 60, 90, 180]
            if v not in valid_values:
                raise ValueError(f"notice_period_days must be one of: {valid_values}")
        return v
    
    class Config:
        use_enum_values = True


# ==========================================
# Helper Functions for Response Building
# ==========================================

def build_career_readiness_metadata(candidate_profile) -> CareerReadinessMetadataResponse:
    """Calculate derived fields for career readiness response"""
    import datetime as dt
    
    now = dt.datetime.now(dt.timezone.utc)
    career_readiness_ts = candidate_profile.career_readiness_timestamp or now
    
    # Calculate days since update
    days_since_update = (now - (career_readiness_ts if career_readiness_ts.tzinfo else dt.datetime.combine(career_readiness_ts.date(), dt.time.min, dt.timezone.utc))).days
    revertification_needed = days_since_update > 15
    
    # Determine availability
    availability_date = candidate_profile.availability_date
    if availability_date:
        if availability_date.tzinfo is None:
            availability_date = dt.datetime.combine(availability_date.date(), dt.time.min, dt.timezone.utc)
        availability_in_days = max(0, (availability_date - now).days)
    else:
        availability_in_days = 999
    
    immediate_joiner = candidate_profile.notice_period_days == 0
    
    # Determine visibility based on mode
    mode = candidate_profile.job_search_mode
    if mode == 'exploring':
        recruiter_visibility = 'hidden'
        notification_frequency = 'weekly'
    elif mode == 'passive':
        recruiter_visibility = 'limited' if immediate_joiner else 'full'
        notification_frequency = '2-3x_weekly'
    else:  # active
        recruiter_visibility = 'full'
        notification_frequency = 'daily'
    
    return CareerReadinessMetadataResponse(
        mode=mode,
        availability_in_days=availability_in_days,
        availability_date=availability_date.isoformat() if availability_date else 'unknown',
        immediate_joiner=immediate_joiner,
        revertification_needed=revertification_needed,
        days_since_update=days_since_update,
        recruiter_visibility=recruiter_visibility,
        notification_frequency=notification_frequency
    )
