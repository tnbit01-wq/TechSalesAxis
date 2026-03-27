from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

class InterviewStatus(str, Enum):
    PENDING = "pending_confirmation"
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class InterviewFormat(str, Enum):
    VIRTUAL = "virtual"
    ONSITE = "onsite"

class InterviewSlotBase(BaseModel):
    start_time: datetime
    end_time: datetime

class InterviewSlotResponse(InterviewSlotBase):
    id: str
    interview_id: str
    is_selected: bool
    created_at: datetime

class InterviewProposeRequest(BaseModel):
    application_id: str
    round_name: str
    round_number: int = 1
    format: InterviewFormat = InterviewFormat.VIRTUAL
    location: Optional[str] = None
    interviewer_names: List[str] = []
    slots: List[InterviewSlotBase] = Field(..., min_length=1, max_length=5)

class InterviewConfirmRequest(BaseModel):
    slot_id: str

class InterviewCancelRequest(BaseModel):
    reason: str

class InterviewFeedbackRequest(BaseModel):
    feedback: str
    next_status: str # 'offered', 'rejected', or 'shortlisted' (for next round)

class InterviewResponse(BaseModel):
    id: str
    job_id: str
    candidate_id: str
    recruiter_id: str
    application_id: str
    status: InterviewStatus
    round_name: str
    round_number: int
    format: InterviewFormat
    meeting_link: Optional[str] = None
    location: Optional[str] = None
    interviewer_names: List[str] = []
    feedback: Optional[str] = None
    cancellation_reason: Optional[str] = None
    candidate_joined_at: Optional[datetime] = None
    recruiter_joined_at: Optional[datetime] = None
    slots: List[InterviewSlotResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
