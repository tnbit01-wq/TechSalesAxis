from core.database import SessionLocal
from core.models import User, CandidateProfile, RecruiterProfile, Company
import uuid

def ensure_profiles():
    db = SessionLocal()
    try:
        c_id = '9d8bf4c3-69cf-4a24-8155-cee8f2652f49'
        r_id = 'dc465bc1-6b0a-ae48-8cde-e54f77c4f1e1'
        
        # Candidate
        cp = db.query(CandidateProfile).filter(CandidateProfile.user_id == c_id).first()
        if not cp:
            db.add(CandidateProfile(user_id=c_id, assessment_status='not_started'))
            print("CANDIDATE PROFILE CREATED")
        else:
            print("CANDIDATE PROFILE EXISTS")
            
        # Recruiter
        rp = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == r_id).first()
        if not rp:
            comp = db.query(Company).filter(Company.name == 'TalentFlow Test').first()
            if not comp:
                comp = Company(id=uuid.uuid4(), name='TalentFlow Test', industry_category='Tech')
                db.add(comp)
                db.flush()
            db.add(RecruiterProfile(user_id=r_id, company_id=comp.id, full_name='Recruiter Admin'))
            print("RECRUITER PROFILE CREATED")
        else:
            print("RECRUITER PROFILE EXISTS")
            
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"ERROR: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    ensure_profiles()
