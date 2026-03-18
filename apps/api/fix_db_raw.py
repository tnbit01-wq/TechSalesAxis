from core.database import db_engine
from sqlalchemy import text

def fix():
    with db_engine.connect() as conn:
        # Get valid experience_band values
        res = conn.execute(text("SELECT enum_range(NULL::experience_band)"))
        # valid_bands is a list of strings if using psycopg2 or similar
        row = res.fetchone()[0]
        # In some cases row is a list/tuple, in others it's a string like '{fresher,junior}'
        if isinstance(row, str):
            band = row.strip("{}").split(",")[0]
        else:
            band = row[0]
            
        print(f"USING BAND: {band}")

        # Candidate Profile
        conn.execute(text("DELETE FROM candidate_profiles WHERE user_id = '9d8bf4c3-69cf-4a24-8155-cee8f2652f49'"))
        conn.execute(text(f"""
            INSERT INTO candidate_profiles 
            (user_id, experience, assessment_status, profile_strength, completion_score, terms_accepted, account_status) 
            VALUES ('9d8bf4c3-69cf-4a24-8155-cee8f2652f49', '{band}', 'not_started', 'Low', 0, false, 'Active')
        """))
        
        # Recruiter Profile
        res = conn.execute(text("SELECT id FROM companies WHERE name = 'TalentFlow Test'"))
        row = res.fetchone()
        if row:
            comp_id = row[0]
        else:
            comp_id = 'e3b0c442-98fc-1c14-9afb-f4c8996fb924' # fixed dummy uuid
            conn.execute(text(f"INSERT INTO companies (id, name, industry_category) VALUES ('{comp_id}', 'TalentFlow Test', 'Tech')"))
            
        conn.execute(text(f"DELETE FROM recruiter_profiles WHERE user_id = 'dc465bc1-6b0a-ae48-8cde-e54f77c4f1e1'"))
        conn.execute(text(f"""
            INSERT INTO recruiter_profiles (user_id, company_id, full_name, account_status)
            VALUES ('dc465bc1-6b0a-ae48-8cde-e54f77c4f1e1', '{comp_id}', 'Recruiter Admin', 'Active')
        """))
        
        conn.commit()
        print("FIX DONE")

if __name__ == "__main__":
    fix()
