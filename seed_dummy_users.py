import uuid
import sys
import os
from datetime import datetime

# Add the apps/api directory to the path so we can import src
sys.path.append(os.path.join(os.getcwd(), "apps", "api"))

try:
    from src.core.database import SessionLocal
    from src.core.models import User, CandidateProfile, RecruiterProfile, Company
    from src.core.auth_utils import get_password_hash
except ImportError as e:
    print(f"Error importing modules: {e}")
    sys.exit(1)

def seed_dummy_users():
    session = SessionLocal()
    try:
        # 1. Create a dummy company for the recruiter
        company_id = uuid.uuid4()
        company = session.query(Company).filter(Company.name == "TalentFlow Demo Corp").first()
        if not company:
            company = Company(
                id=company_id,
                name="TalentFlow Demo Corp",
                website="https://talentflow.demo",
                industry_category="Technology",
                verification_status="Verified",
                created_at=datetime.utcnow()
            )
            session.add(company)
            print(f"Created dummy company: {company.name}")
        else:
            company_id = company.id
            print(f"Using existing company: {company.name}")

        # 2. Create Dummy Recruiter (Professional Email)
        recruiter_email = "recruiter@talentflow.pro"
        recruiter_pwd = "Password123!"
        
        recruiter = session.query(User).filter(User.email == recruiter_email).first()
        if not recruiter:
            recruiter_id = uuid.uuid4()
            recruiter = User(
                id=recruiter_id,
                email=recruiter_email,
                role="recruiter",
                hashed_password=get_password_hash(recruiter_pwd),
                is_verified=True,
                created_at=datetime.utcnow()
            )
            session.add(recruiter)
            
            recruiter_profile = RecruiterProfile(
                user_id=recruiter_id,
                company_id=company_id,
                full_name="Demo Recruiter",
                job_title="Senior Talent Acquisition",
                onboarding_step="completed",
                is_admin=True,
                account_status="Active",
                created_at=datetime.utcnow()
            )
            session.add(recruiter_profile)
            print(f"Created recruiter: {recruiter_email}")
        else:
            print(f"Recruiter {recruiter_email} already exists.")

        # 3. Create Dummy Candidate (Normal Email)
        candidate_email = "candidate@gmail.com"
        candidate_pwd = "Password123!"
        
        candidate = session.query(User).filter(User.email == candidate_email).first()
        if not candidate:
            candidate_id = uuid.uuid4()
            candidate = User(
                id=candidate_id,
                email=candidate_email,
                role="candidate",
                hashed_password=get_password_hash(candidate_pwd),
                is_verified=True,
                created_at=datetime.utcnow()
            )
            session.add(candidate)
            
            candidate_profile = CandidateProfile(
                user_id=candidate_id,
                full_name="Demo Candidate",
                assessment_status="not_started",
                account_status="Active",
                completion_score=0,
                terms_accepted=True
            )
            session.add(candidate_profile)
            print(f"Created candidate: {candidate_email}")
        else:
            print(f"Candidate {candidate_email} already exists.")

        session.commit()
        print("\nSeeding complete!")
        print(f"Recruiter: {recruiter_email} / {recruiter_pwd}")
        print(f"Candidate: {candidate_email} / {candidate_pwd}")

    except Exception as e:
        session.rollback()
        print(f"Error seeding users: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    seed_dummy_users()
