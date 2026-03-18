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
    professional_persona = Column(Text)
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
    raw_education = Column(Text)
    raw_experience = Column(Text)
    raw_projects = Column(Text)
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
    is_active = Column(Boolean, default=False)
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
