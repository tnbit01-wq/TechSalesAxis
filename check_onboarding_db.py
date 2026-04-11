import psycopg2
import json
from datetime import datetime

# Database connection
conn = psycopg2.connect(
    host="talentflow-db.cjymcuai297y.ap-southeast-2.rds.amazonaws.com",
    database="talentflow",
    user="postgres",
    password="tX6v2KraCehQkZR"
)
cursor = conn.cursor()

print("=" * 80)
print("RECENT CANDIDATES (LAST 2 CREATED)")
print("=" * 80)

# Get 2 most recent candidates
cursor.execute("""
    SELECT id, email, created_at 
    FROM users 
    WHERE role = 'candidate'
    ORDER BY created_at DESC 
    LIMIT 2
""")

candidates = cursor.fetchall()
candidate_ids = [c[0] for c in candidates]

for idx, (user_id, email, created_at) in enumerate(candidates, 1):
    print(f"\nCANDIDATE #{idx}")
    print(f"  User ID: {user_id}")
    print(f"  Email: {email}")
    print(f"  Created: {created_at}")

print("\n" + "=" * 80)
print("CANDIDATE PROFILE DATA")
print("=" * 80)

for user_id in candidate_ids:
    cursor.execute("""
        SELECT 
            id, candidate_id, onboarding_step, experience_band, skills, bio, 
            education_raw, experience_raw, long_term_goal, trust_score, 
            verified, profile_completion_percentage, created_at
        FROM candidate_profile 
        WHERE candidate_id = %s
    """, (user_id,))
    
    profile = cursor.fetchone()
    if profile:
        (prof_id, cand_id, on_step, exp_band, skills, bio, edu, exp, goal, score, verified, completion, created) = profile
        print(f"\n▶ Profile for {user_id}")
        print(f"  Onboarding Step: {on_step}")
        print(f"  Experience Band: {exp_band}")
        print(f"  Skills: {skills}")
        print(f"  Bio: {bio[:100] if bio else 'NULL'}...")
        print(f"  Education Raw: {edu is not None and len(str(edu)) > 0}")
        print(f"  Experience Raw: {exp is not None and len(str(exp)) > 0}")
        print(f"  Long-term Goal: {goal[:100] if goal else 'NULL'}...")
        print(f"  Trust Score: {score}")
        print(f"  Verified: {verified}")
        print(f"  Completion %: {completion}")
        print(f"  Created: {created}")
    else:
        print(f"\n▶ NO PROFILE found for {user_id}")

print("\n" + "=" * 80)
print("CAREER READINESS DATA")
print("=" * 80)

for user_id in candidate_ids:
    cursor.execute("""
        SELECT 
            id, employment_status, job_search_mode, notice_period_days, 
            willing_to_relocate, salary_flexibility, target_market_segment,
            created_at
        FROM career_readiness 
        WHERE candidate_id = %s
    """, (user_id,))
    
    cr = cursor.fetchone()
    if cr:
        (cr_id, emp_status, job_mode, notice, relocate, salary_flex, target, created) = cr
        print(f"\n▶ Career Readiness for {user_id}")
        print(f"  Employment Status: {emp_status}")
        print(f"  Job Search Mode: {job_mode}")
        print(f"  Notice Period Days: {notice}")
        print(f"  Willing to Relocate: {relocate}")
        print(f"  Salary Flexibility: {salary_flex}")
        print(f"  Target Market Segment: {target}")
        print(f"  Created: {created}")
    else:
        print(f"\n▶ NO CAREER READINESS found for {user_id}")

print("\n" + "=" * 80)
print("CANDIDATE SKILLS")
print("=" * 80)

for user_id in candidate_ids:
    cursor.execute("""
        SELECT skill_name, proficiency_level, extracted_from
        FROM candidate_skills 
        WHERE candidate_id = %s
    """, (user_id,))
    
    skills = cursor.fetchall()
    if skills:
        print(f"\n▶ Skills for {user_id}")
        for skill_name, proficiency, extracted_from in skills:
            print(f"  • {skill_name} ({proficiency}) - from: {extracted_from}")
    else:
        print(f"\n▶ NO SKILLS found for {user_id}")

print("\n" + "=" * 80)
print("INTELLIGENCE ENDPOINTS ACTIVITY")
print("=" * 80)

# Check if conversational_onboarding_sessions exists
cursor.execute("""
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'conversational_onboarding_sessions'
    )
""")

table_exists = cursor.fetchone()[0]
print(f"\nConversational Onboarding Table Exists: {table_exists}")

if table_exists:
    for user_id in candidate_ids:
        cursor.execute("""
            SELECT 
                id, conversation_status, completeness_score, 
                average_ai_confidence, successfully_completed,
                created_at
            FROM conversational_onboarding_sessions 
            WHERE candidate_id = %s
        """, (user_id,))
        
        sessions = cursor.fetchall()
        if sessions:
            print(f"\n▶ Conversational Sessions for {user_id}")
            for (sess_id, status, completeness, confidence, completed, created) in sessions:
                print(f"  Status: {status}")
                print(f"  Completeness Score: {completeness}")
                print(f"  AI Confidence: {confidence}")
                print(f"  Completed: {completed}")
                print(f"  Created: {created}")
        else:
            print(f"\n▶ NO CONVERSATIONAL SESSIONS for {user_id}")

print("\n" + "=" * 80)
print("RESUME DATA")
print("=" * 80)

for user_id in candidate_ids:
    cursor.execute("""
        SELECT 
            id, original_filename, file_size, parsed_successfully, 
            confidence_score, created_at
        FROM candidate_resume 
        WHERE candidate_id = %s
        ORDER BY created_at DESC
        LIMIT 1
    """, (user_id,))
    
    resume = cursor.fetchone()
    if resume:
        (res_id, filename, size, parsed, confidence, created) = resume
        print(f"\n▶ Resume for {user_id}")
        print(f"  Filename: {filename}")
        print(f"  File Size: {size}")
        print(f"  Parsed Successfully: {parsed}")
        print(f"  Confidence Score: {confidence}")
        print(f"  Created: {created}")
    else:
        print(f"\n▶ NO RESUME found for {user_id}")

cursor.close()
conn.close()

print("\n" + "=" * 80)
