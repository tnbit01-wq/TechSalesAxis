from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, String, Integer, Boolean, Text, DateTime, ForeignKey, Numeric, ARRAY, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(Text, unique=True, nullable=False)
    role = Column(String(9), nullable=False)
    hashed_password = Column(Text) # Added for AWS Auth
    is_verified = Column(Boolean, default=False) # Added for OTP verification
    otp_code = Column(String(6)) # Temporary OTP storage
    otp_expires_at = Column(DateTime)
    reset_token = Column(String(255)) # Added for Password Reset
    reset_token_expires_at = Column(DateTime)
    created_at = Column(DateTime, default=func.now())

class CandidateProfile(Base):
    __tablename__ = 'candidate_profiles'
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), primary_key=True)
    full_name = Column(Text)
    phone_number = Column(Text)
    bio = Column(Text)
    current_role = Column(Text)
    years_of_experience = Column(Integer)
    primary_industry_focus = Column(Text)
    linkedin_url = Column(Text)
    portfolio_url = Column(Text)
    gender = Column(Text)
    birthdate = Column(DateTime)
    location = Column(Text)
    location_tier = Column(Text)
    target_role = Column(Text)
    experience = Column(Text)
    long_term_goal = Column(Text)
    major_achievements = Column(Text)
    key_responsibilities = Column(Text)
    onboarding_step = Column(Text)
    graduation_status = Column(String)
    graduation_year = Column(Integer)
    gpa_score = Column(Numeric)
    qualification_held = Column(String)
    expected_salary = Column(Numeric)
    job_type = Column(String)
    current_employment_status = Column(String)
    ai_extraction_confidence = Column(Numeric)
    last_resume_parse_at = Column(DateTime)
    identity_proof_path = Column(Text)
    referral = Column(Text)
    career_gap_report = Column(JSONB)
    identity_verified = Column(Boolean, default=False)
    resume_uploaded = Column(Boolean, default=False)
    profile_photo_url = Column(Text)
    resume_path = Column(Text)
    final_profile_score = Column(Integer)
    profile_strength = Column(Text, default='Low')
    completion_score = Column(Integer, default=0)
    assessment_status = Column(Text, default='not_started')
    terms_accepted = Column(Boolean, default=False)
    account_status = Column(String, default='Active')
    skills = Column(ARRAY(Text))
    career_interests = Column(ARRAY(Text))
    certifications = Column(ARRAY(Text))
    learning_interests = Column(ARRAY(Text))
    education_history = Column(JSONB)
    experience_history = Column(JSONB)
    projects = Column(JSONB)
    learning_links = Column(JSONB)
    social_links = Column(JSONB)
    bulk_file_id = Column(UUID(as_uuid=True), ForeignKey('bulk_upload_files.id'), nullable=True)
    is_shadow_profile = Column(Boolean, default=False)
    # Career Readiness Feature
    job_search_mode = Column(String, default='exploring')  # 'exploring', 'passive', 'active'
    notice_period_days = Column(Integer, default=None)  # 0, 7, 14, 30, 60, 90, 180
    notice_period_required_days = Column(Integer, default=None)  # Alias for notice_period_days
    availability_date = Column(DateTime, default=None)  # Calculated: now + notice_period
    career_readiness_timestamp = Column(DateTime, default=func.now())  # When last updated
    career_readiness_metadata = Column(JSONB, default={})  # {exploration_trigger, visa_needed, salary_flexibility, etc}
    career_readiness_score = Column(Numeric, default=0)  # 0-100 readiness score
    role_urgency_level = Column(String, default='passive')  # 'passive', 'active', 'urgent_30days', 'urgent_immediate'
    employment_readiness_status = Column(String, default='not_specified')  # Overall readiness status
    willing_to_relocate = Column(Boolean, default=False)
    job_opportunity_type = Column(ARRAY(String), default=[])  # ['Full-time', 'Contract', 'Part-time', etc]
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    created_at = Column(DateTime, default=func.now())

class JobApplication(Base):
    __tablename__ = 'job_applications'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey('jobs.id'))
    candidate_id = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    status = Column(String(19), default='pending')
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    feedback = Column(Text)
    invitation_message = Column(Text)
    job = relationship('Job', back_populates='applications')

class Post(Base):
    __tablename__ = 'posts'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    content = Column(Text)
    media_urls = Column(ARRAY(Text), default=[])
    type = Column(Text)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

class SavedJob(Base):
    __tablename__ = 'saved_jobs'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    job_id = Column(UUID(as_uuid=True), ForeignKey('jobs.id'))
    created_at = Column(DateTime)

class Job(Base):
    __tablename__ = 'jobs'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.id'))
    recruiter_id = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    title = Column(Text)
    description = Column(Text)
    experience_band = Column(Text)
    location = Column(Text)
    job_type = Column(Text)
    salary_range = Column(Text)
    status = Column(Text, default='active')
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    closed_at = Column(DateTime)
    is_ai_generated = Column(Boolean, default=False)
    number_of_positions = Column(Integer, default=1)
    requirements = Column(ARRAY(Text), default=[])
    skills_required = Column(ARRAY(Text), default=[])
    metadata_ = Column(JSONB, name='metadata', default={})
    applications = relationship('JobApplication', back_populates='job')

class Company(Base):
    __tablename__ = 'companies'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(Text)
    website = Column(Text)
    logo_url = Column(Text)
    description = Column(Text)
    location = Column(Text)
    industry_category = Column(Text)
    size_band = Column(Text)
    registration_number = Column(Text)
    verification_status = Column(Text)
    profile_score = Column(Integer, default=0)
    sales_model = Column(Text)
    target_market = Column(Text)
    visibility_tier = Column(Text)
    domain = Column(Text)
    hiring_focus_areas = Column(ARRAY(Text))
    avg_deal_size_range = Column(Text)
    candidate_feedback_score = Column(Numeric)
    successful_hires_count = Column(Integer, default=0)
    brand_colors = Column(JSONB)
    life_at_photo_urls = Column(ARRAY(Text))
    created_at = Column(DateTime)
    updated_at = Column(DateTime)

class RecruiterProfile(Base):
    __tablename__ = 'recruiter_profiles'
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), primary_key=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.id'))
    full_name = Column(Text)
    job_title = Column(Text)
    bio = Column(Text)
    phone_number = Column(Text)
    linkedin_url = Column(Text)
    onboarding_step = Column(Text)
    completion_score = Column(Integer, default=0)
    identity_verified = Column(Boolean, default=False)
    is_admin = Column(Boolean, default=False)
    account_status = Column(String, default='Active')
    warning_count = Column(Integer, default=0)
    terms_accepted = Column(Boolean, default=False)
    team_role = Column(Text)
    professional_persona = Column(JSONB)
    assessment_status = Column(Text, default='not_started')
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    user = relationship('User', foreign_keys=[user_id], primaryjoin='RecruiterProfile.user_id == User.id', uselist=False)
    company = relationship('Company', foreign_keys=[company_id], primaryjoin='RecruiterProfile.company_id == Company.id', uselist=False)

class ResumeData(Base):
    __tablename__ = 'resume_data'
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), primary_key=True)
    raw_text = Column(Text)
    timeline = Column(JSONB)
    career_gaps = Column(JSONB)
    achievements = Column(ARRAY(Text))
    skills = Column(ARRAY(Text))
    education = Column(JSONB)
    raw_education = Column(JSONB)
    raw_experience = Column(JSONB)
    raw_projects = Column(JSONB)
    parsed_at = Column(DateTime, default=func.now())

class ProfileScore(Base):
    __tablename__ = 'profile_scores'
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), primary_key=True)
    resume_score = Column(Integer)
    behavioral_score = Column(Integer)
    psychometric_score = Column(Integer)
    skills_score = Column(Integer)
    reference_score = Column(Integer)
    final_score = Column(Integer)
    calculated_at = Column(DateTime, default=func.now())

class CareerReadinessHistory(Base):
    __tablename__ = 'career_readiness_history'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    old_job_search_mode = Column(Text)
    new_job_search_mode = Column(Text)
    old_notice_period_days = Column(Integer)
    new_notice_period_days = Column(Integer)
    changed_at = Column(DateTime, default=func.now())
    reason = Column(Text, default='self_update')
    ip_address = Column(Text)
    user_agent = Column(Text)

class ProfileMatch(Base):
    __tablename__ = 'profile_matches'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    recruiter_id = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    match_score = Column(Integer, default=0)
    reasoning_text = Column(Text)
    candidate_token = Column(Text)
    recruiter_token = Column(Text)
    match_type = Column(Text, default='culture_fit')
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now())

class JobApplicationHistory(Base):
    __tablename__ = 'job_application_status_history'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id = Column(UUID(as_uuid=True), ForeignKey('job_applications.id'))
    old_status = Column(Text)
    new_status = Column(Text, nullable=False)
    changed_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    reason = Column(Text)
    created_at = Column(DateTime, default=func.now())

class ChatThread(Base):
    __tablename__ = 'chat_threads'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    recruiter_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    is_active = Column(Boolean, default=True)  # Legacy global flag
    recruiter_archived = Column(Boolean, default=False)
    candidate_archived = Column(Boolean, default=False)
    last_message_at = Column(DateTime, default=func.now())
    created_at = Column(DateTime, default=func.now())

class ChatMessage(Base):
    __tablename__ = 'chat_messages'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    thread_id = Column(UUID(as_uuid=True), ForeignKey('chat_threads.id'), nullable=False)
    sender_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    text = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.now())

class CareerGPS(Base):
    __tablename__ = 'career_gps'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    target_role = Column(Text)
    current_status = Column(String)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

class CareerMilestone(Base):
    __tablename__ = 'career_milestones'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    gps_id = Column(UUID(as_uuid=True), ForeignKey('career_gps.id'), nullable=False)
    step_order = Column(Integer, nullable=False)
    title = Column(Text, nullable=False)
    description = Column(Text)
    skills_to_acquire = Column(ARRAY(Text), default=[])
    learning_actions = Column(JSONB, default=[])
    status = Column(String, default='not_started')
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=func.now())

class SkillCatalog(Base):
    __tablename__ = 'skill_catalog'
    name = Column(Text, primary_key=True)
    experience_band = Column(String, primary_key=True)
    last_seen_at = Column(DateTime, default=func.now())

class AssessmentQuestion(Base):
    __tablename__ = 'assessment_questions'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category = Column(Text, nullable=False)
    driver = Column(Text, nullable=False)
    experience_band = Column(Text, nullable=False)
    difficulty = Column(Text, nullable=False)
    question_text = Column(Text, nullable=False)
    evaluation_rubric = Column(Text)
    created_at = Column(DateTime, default=func.now())

class RecruiterAssessmentQuestion(Base):
    __tablename__ = 'recruiter_assessment_questions'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category = Column(Text, nullable=False)
    driver = Column(Text, nullable=False)
    question_text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=func.now())

class AssessmentSession(Base):
    __tablename__ = 'assessment_sessions'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), unique=True)
    experience_band = Column(Text, nullable=False)
    status = Column(Text, default='started')
    total_budget = Column(Integer)
    current_step = Column(Integer, default=1)
    warning_count = Column(Integer, default=0)
    overall_score = Column(Numeric, default=0.0)
    component_scores = Column(JSONB, default={})
    driver_confidence = Column(JSONB, default={})
    queue_priority = Column(String, default='standard')  # 'standard' or 'fast_track'
    queue_priority_reason = Column(Text)  # Reason for queue priority
    expected_completion_sla = Column(DateTime)  # Expected completion deadline
    started_at = Column(DateTime, default=func.now())
    completed_at = Column(DateTime)

class AssessmentResponse(Base):
    __tablename__ = 'assessment_responses'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    question_id = Column(UUID(as_uuid=True), ForeignKey('assessment_questions.id'))
    question_text = Column(Text)
    category = Column(Text, nullable=False)
    driver = Column(Text)
    difficulty = Column(Text)
    raw_answer = Column(Text)
    score = Column(Integer)
    evaluation_metadata = Column(JSONB, default={})
    is_skipped = Column(Boolean, default=False)
    tab_switches = Column(Integer, default=0)
    time_taken_seconds = Column(Integer)
    created_at = Column(DateTime, default=func.now())

class AssessmentRetakeEligibility(Base):
    """Track when candidates are eligible to retake assessments (30-day cooldown)"""
    __tablename__ = 'assessment_retake_eligibility'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), unique=True)
    last_completed_at = Column(DateTime, default=func.now())
    eligible_after = Column(DateTime, nullable=False)  # 30 days from completion
    retake_count = Column(Integer, default=0)  # How many times they've retaken
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

class AssessmentFeedback(Base):
    """Store generated feedback for assessments"""
    __tablename__ = 'assessment_feedback'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    session_id = Column(UUID(as_uuid=True), ForeignKey('assessment_sessions.id'))
    feedback_report = Column(JSONB, default={})  # Complete feedback JSON
    strengths = Column(ARRAY(Text))
    improvement_areas = Column(ARRAY(Text))
    recommendations = Column(ARRAY(Text))
    tier = Column(String)  # Top, Strong, Developing, Growing
    final_score = Column(Integer)
    generated_at = Column(DateTime, default=func.now())
    viewed_at = Column(DateTime)  # When candidate viewed this feedback
    created_at = Column(DateTime, default=func.now())

class RecruiterAssessmentResponse(Base):
    __tablename__ = 'recruiter_assessment_responses'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    category = Column(Text, nullable=False)
    question_text = Column(Text)
    answer_text = Column(Text)
    average_score = Column(Integer)
    relevance_score = Column(Integer)
    specificity_score = Column(Integer)
    clarity_score = Column(Integer)
    ownership_score = Column(Integer)
    evaluation_metadata = Column(JSONB, default={})
    created_at = Column(DateTime, default=func.now())

class RecruiterSetting(Base):
    __tablename__ = 'recruiter_settings'
    user_id = Column(UUID(as_uuid=True), ForeignKey('recruiter_profiles.user_id'), primary_key=True)
    email_notifications = Column(Boolean, default=True)
    web_notifications = Column(Boolean, default=True)
    mobile_notifications = Column(Boolean, default=False)
    profile_visibility = Column(Text, default='public')
    language = Column(Text, default='en')
    timezone = Column(Text, default='UTC')
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

class BlockedUser(Base):
    __tablename__ = 'blocked_users'
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), primary_key=True)
    reason = Column(Text, nullable=False)
    blocked_at = Column(DateTime, default=func.now())

class Notification(Base):
    __tablename__ = 'notifications'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    title = Column(Text, nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(Text, name='type')  # DB column is 'type'
    is_read = Column(Boolean, default=False)
    metadata_ = Column(JSONB, name='metadata', default={})
    created_at = Column(DateTime, default=func.now())

class ChatReport(Base):
    __tablename__ = 'chat_reports'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reporter_id = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    reported_id = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    reason = Column(Text)
    created_at = Column(DateTime, default=func.now())

class PostInteraction(Base):
    __tablename__ = 'post_interactions'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id = Column(UUID(as_uuid=True), ForeignKey('posts.id'))
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    interaction_type = Column(String(10)) # 'like', 'comment'
    content = Column(Text)
    created_at = Column(DateTime, default=func.now())

class PostLike(Base):
    __tablename__ = 'post_likes'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id = Column(UUID(as_uuid=True), ForeignKey('posts.id'))
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    created_at = Column(DateTime, default=func.now())

class PostComment(Base):
    __tablename__ = 'post_comments'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id = Column(UUID(as_uuid=True), ForeignKey('posts.id'))
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=func.now())

class UserPinnedPost(Base):
    __tablename__ = 'user_pinned_posts'
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), primary_key=True)
    post_id = Column(UUID(as_uuid=True), ForeignKey('posts.id'), primary_key=True)
    pinned_at = Column(DateTime, default=func.now())

class Follow(Base):
    __tablename__ = 'follows'
    follower_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), primary_key=True)
    following_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), primary_key=True)
    created_at = Column(DateTime, default=func.now())

class Interview(Base):
    __tablename__ = 'interviews'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey('jobs.id'))
    candidate_id = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    recruiter_id = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    application_id = Column(UUID(as_uuid=True), ForeignKey('job_applications.id'))
    round_name = Column(Text)
    round_number = Column(Integer)
    format = Column(Text)
    location = Column(Text)
    meeting_link = Column(Text)
    interviewer_names = Column(ARRAY(Text))
    status = Column(Text)
    candidate_joined_at = Column(DateTime, nullable=True)
    recruiter_joined_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    slots = relationship('InterviewSlot', back_populates='interview', cascade='all, delete-orphan')

class InterviewSlot(Base):
    __tablename__ = 'interview_slots'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    interview_id = Column(UUID(as_uuid=True), ForeignKey('interviews.id'), nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    is_selected = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.now())
    status = Column(Text, default='pending')
    interview = relationship('Interview', back_populates='slots')

# Analytics and Tracking Models

class JobView(Base):
    __tablename__ = 'job_views'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey('jobs.id'), nullable=False)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    viewer_ip = Column(Text)
    user_agent = Column(Text)
    created_at = Column(DateTime, default=func.now())

class ProfileAnalytics(Base):
    __tablename__ = 'profile_analytics'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    recruiter_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    event_type = Column(Text)  # 'profile_view', 'application_sent', etc.
    job_id = Column(UUID(as_uuid=True), ForeignKey('jobs.id'))
    event_metadata = Column(JSONB, name='metadata', default={})
    created_at = Column(DateTime, default=func.now())

class CandidateJobSync(Base):
    __tablename__ = 'candidate_job_sync'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    job_id = Column(UUID(as_uuid=True), ForeignKey('jobs.id'), nullable=False)
    overall_match_score = Column(Numeric, default=0.0)
    match_explanation = Column(Text)
    missing_critical_skills = Column(ARRAY(Text), default=[])
    created_at = Column(DateTime, default=func.now())

class CandidateCompanySync(Base):
    __tablename__ = 'candidate_company_sync'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.id'), nullable=False)
    overall_match_score = Column(Numeric, default=0.0)
    match_explanation = Column(Text)
    strength_areas = Column(ARRAY(Text), default=[])
    improvement_areas = Column(ARRAY(Text), default=[])
    created_at = Column(DateTime, default=func.now())

# ============================================================================
# BULK UPLOAD FEATURE - Database Models
# ============================================================================

class BulkUpload(Base):
    __tablename__ = 'bulk_uploads'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    admin_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    
    # Batch metadata
    batch_name = Column(Text, nullable=False)
    batch_description = Column(Text)
    source_system = Column(Text)  # 'internal_hr', 'recruitment_agency', 'headhunter'
    
    # Processing status
    upload_status = Column(Text, nullable=False, default='uploaded')  # uploaded, processing, completed, failed, partially_failed
    processing_started_at = Column(DateTime)
    processing_completed_at = Column(DateTime)
    
    # File & parsing metrics
    total_files_uploaded = Column(Integer, nullable=False, default=0)
    successfully_parsed = Column(Integer, nullable=False, default=0)
    parsing_failed = Column(Integer, nullable=False, default=0)
    extraction_confidence_avg = Column(Numeric(5, 4))
    
    # Duplicate detection metrics
    total_candidates_found = Column(Integer, nullable=False, default=0)
    duplicate_candidates_detected = Column(Integer, nullable=False, default=0)
    new_candidates_identified = Column(Integer, nullable=False, default=0)
    duplicates_admin_reviewed = Column(Integer, nullable=False, default=0)
    duplicates_auto_merged = Column(Integer, nullable=False, default=0)
    
    # Account creation metrics
    shadow_profiles_created = Column(Integer, nullable=False, default=0)
    verified_accounts_from_bulk = Column(Integer, nullable=False, default=0)
    invitations_sent = Column(Integer, nullable=False, default=0)
    invitations_opened = Column(Integer, nullable=False, default=0)
    account_verifications_completed = Column(Integer, nullable=False, default=0)
    
    # Compliance & security
    virus_scan_enabled = Column(Boolean, nullable=False, default=True)
    virus_scan_status = Column(Text)  # pending, scanning, clean, infected_found
    virus_scan_completed_at = Column(DateTime)
    
    # Data retention
    data_retention_days = Column(Integer, nullable=False, default=90)
    scheduled_deletion_date = Column(DateTime)
    
    # Audit trail
    processing_notes = Column(JSONB, default='[]')
    error_summary = Column(JSONB, default='[]')
    admin_decisions = Column(JSONB, default='{}')
    
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

class BulkUploadFile(Base):
    __tablename__ = 'bulk_upload_files'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bulk_upload_id = Column(UUID(as_uuid=True), ForeignKey('bulk_uploads.id'), nullable=False)
    
    # File metadata
    original_filename = Column(Text, nullable=False)
    file_ext = Column(Text, nullable=False)  # pdf, doc, docx
    file_size_bytes = Column(Integer, nullable=False)
    file_hash = Column(Text, unique=True, nullable=False)  # SHA-256 hash
    file_storage_path = Column(Text)  # s3://bucket/path or /uploads/path
    
    # Virus scan status
    virus_scan_status = Column(Text, default='pending')  # pending, scanning, clean, infected
    virus_scan_result = Column(JSONB)
    virus_scan_timestamp = Column(DateTime)
    
    # Parsing status
    parsing_status = Column(Text, default='pending')  # pending, processing, completed, failed
    parsing_error = Column(Text)
    parsing_error_details = Column(JSONB)
    parsing_confidence = Column(Numeric(5, 4))
    parsed_at = Column(DateTime)
    
    # Extracted candidate info
    extracted_name = Column(Text)
    extracted_email = Column(Text)
    extracted_phone = Column(Text)
    extracted_location = Column(Text)
    extracted_current_role = Column(Text)
    extracted_years_experience = Column(Integer)
    
    # Candidate matching result
    matched_candidate_id = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    match_confidence = Column(Numeric(5, 4))
    match_type = Column(Text)  # exact, strong, moderate, soft, no_match
    
    # Raw data
    raw_text = Column(Text)
    parsed_data = Column(JSONB)
    
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

class BulkUploadCandidateMatch(Base):
    __tablename__ = 'bulk_upload_candidate_matches'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bulk_upload_file_id = Column(UUID(as_uuid=True), ForeignKey('bulk_upload_files.id'), nullable=False)
    
    # Matched candidate info
    matched_candidate_user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    candidate_full_name = Column(Text)
    candidate_email = Column(Text)
    candidate_phone = Column(Text)
    
    # Matching details
    match_type = Column(Text, nullable=False)  # exact_match, strong_match, moderate_match, soft_match, no_match
    match_confidence = Column(Numeric(5, 4), nullable=False)
    match_reason = Column(Text)
    match_details = Column(JSONB, nullable=False)
    
    # Admin decision
    admin_decision = Column(Text)  # pending, approved_merge, rejected_duplicate, skip, create_new
    admin_decision_made_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    admin_decision_reason = Column(Text)
    admin_decision_at = Column(DateTime)
    
    # Merge action result
    merge_status = Column(Text)  # pending, completed, failed
    merge_completed_at = Column(DateTime)
    merge_action_details = Column(JSONB)
    
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

class BulkUploadProcessingQueue(Base):
    __tablename__ = 'bulk_upload_processing_queue'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Job info
    bulk_upload_id = Column(UUID(as_uuid=True), ForeignKey('bulk_uploads.id'), nullable=False)
    bulk_upload_file_id = Column(UUID(as_uuid=True), ForeignKey('bulk_upload_files.id'))
    
    job_type = Column(Text, nullable=False)  # virus_scan, parse_resume, detect_duplicate, create_account, send_invite
    job_status = Column(Text, nullable=False, default='queued')  # queued, processing, completed, failed, retry
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    
    # Execution details
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    execution_time_seconds = Column(Integer)
    
    # Error tracking
    error_message = Column(Text)
    error_details = Column(JSONB)
    
    # Result stored
    job_result = Column(JSONB)
    
    # Priority & scheduling
    priority = Column(Integer, default=50)  # 0-100, higher = more urgent
    scheduled_for = Column(DateTime, default=func.now())
    
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

class BulkUploadAuditLog(Base):
    __tablename__ = 'bulk_upload_audit_log'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bulk_upload_id = Column(UUID(as_uuid=True), ForeignKey('bulk_uploads.id'), nullable=False)
    
    # Action info
    action_type = Column(Text, nullable=False)  # upload_started, file_scanned, duplicate_reviewed, account_created, candidate_verified, merge_completed
    actor_type = Column(Text, nullable=False)  # admin, system, candidate
    actor_id = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    
    # Changed data
    affected_resource_type = Column(Text)  # bulk_upload, bulk_upload_file, candidate_profile
    affected_resource_id = Column(UUID(as_uuid=True))
    
    changes_before = Column(JSONB)
    changes_after = Column(JSONB)
    
    # Context
    ip_address = Column(Text)
    user_agent = Column(Text)
    action_details = Column(Text)
    
    created_at = Column(DateTime, default=func.now())

# ============================================================================
# CONVERSATIONAL ONBOARDING - Natural Language Chat-Based Flow
# ============================================================================

class ConversationalOnboardingSession(Base):
    """
    Track conversational onboarding sessions for intelligent, chat-based flow
    LEAN SCHEMA - only columns that are actually used
    """
    __tablename__ = 'conversational_onboarding_sessions'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    
    # Conversation data (required)
    conversation_messages = Column(JSONB, nullable=False, default={})  # [{user: '...', assistant: '...', timestamp: ...}]
    total_messages = Column(Integer, default=0)
    conversation_status = Column(String, default='in_progress')  # in_progress, completed
    
    # Extracted career readiness info (populated as conversation progresses)
    extracted_employment_status = Column(Text)
    extracted_job_search_mode = Column(Text)
    extracted_notice_period_days = Column(Integer)
    extracted_current_role = Column(Text)
    extracted_years_experience = Column(Integer)
    extracted_willing_to_relocate = Column(Boolean)
    extracted_visa_sponsorship_needed = Column(Boolean)
    extracted_metadata = Column(JSONB, default={})  # Any additional extracted data
    
    # Information completeness and quality
    completeness_score = Column(Numeric(5, 2), default=0.0)  # 0-100
    missing_critical_fields = Column(ARRAY(Text), default=[])
    average_ai_confidence = Column(Numeric(5, 2), default=0.0)  # 0-100
    
    # Outcomes
    successfully_completed = Column(Boolean, default=False)
    
    # Timing
    started_at = Column(DateTime, default=func.now())
    completed_at = Column(DateTime)
    
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
