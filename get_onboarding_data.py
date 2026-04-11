import psycopg2
import json

conn = psycopg2.connect(
    host="talentflow-db.cjymcuai297y.ap-southeast-2.rds.amazonaws.com",
    database="talentflow",
    user="postgres",
    password="tX6v2KraCehQkZR"
)
cursor = conn.cursor()

print("=" * 100)
print("ONBOARDING DATA FOR 2 MOST RECENT CANDIDATES")
print("=" * 100)

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

print("\n▶ CANDIDATE IDS:")
for i, (user_id, email, created) in enumerate(candidates, 1):
    print(f"  {i}. {user_id} ({email}) - Created: {created}")

print("\n" + "=" * 100)
print("CANDIDATE PROFILES DATA")
print("=" * 100)

for idx, user_id in enumerate(candidate_ids, 1):
    cursor.execute("""
        SELECT 
            onboarding_step, experience, current_role, years_of_experience,
            skills, bio, current_employment_status, terms_accepted,
            resume_uploaded, target_role, long_term_goal, completion_score,
            education_history, experience_history, final_profile_score,
            current_employment_status, ai_extraction_confidence
        FROM candidate_profiles 
        WHERE user_id = %s
    """, (user_id,))
    
    profile = cursor.fetchone()
    print(f"\n▶ CANDIDATE #{idx} PROFILE (user_id: {user_id})")
    print(f"  Email: {candidates[idx-1][1]}")
    
    if profile:
        (onboard_step, exp_enum, cur_role, years_exp, skills, bio, emp_status, 
         terms, resume_uploaded, target_role, long_goal, completion, edu_hist, 
         exp_hist, final_score, emp_status2, ai_confidence) = profile
        
        print(f"\n  ✓ PROFILE EXISTS")
        print(f"    Onboarding Step: {onboard_step}")
        print(f"    Employment Status: {emp_status}")
        print(f"    Current Role: {cur_role}")
        print(f"    Years of Experience: {years_exp}")
        print(f"    Experience Level: {exp_enum}")
        print(f"    Skills: {skills if skills else 'EMPTY'} ({len(skills) if skills else 0} total)")
        print(f"    Bio: {bio[:80] if bio else 'EMPTY'}...")
        print(f"    Resume Uploaded: {resume_uploaded}")
        print(f"    Target Role: {target_role}")
        print(f"    Long-term Goal: {long_goal[:80] if long_goal else 'EMPTY'}...")
        print(f"    Terms Accepted: {terms}")
        print(f"    Completion Score: {completion}%")
        print(f"    Final Profile Score: {final_score}")
        print(f"    AI Extraction Confidence: {ai_confidence}")
        
        # Show education and experience data
        if edu_hist:
            try:
                edu_data = json.loads(edu_hist) if isinstance(edu_hist, str) else edu_hist
                print(f"    Education History: {edu_data}")
            except:
                print(f"    Education History: {edu_hist}")
        
        if exp_hist:
            try:
                exp_data = json.loads(exp_hist) if isinstance(exp_hist, str) else exp_hist
                if isinstance(exp_data, list) and len(exp_data) > 0:
                    print(f"    Experience History ({len(exp_data)} entries):")
                    for entry in exp_data[:3]:  # Show first 3
                        print(f"      • {entry}")
                else:
                    print(f"    Experience History: {exp_data}")
            except:
                print(f"    Experience History: {exp_hist}")
    else:
        print(f"    ✗ NO PROFILE FOUND")

print("\n" + "=" * 100)
print("CAREER GPS DATA")
print("=" * 100)

for idx, user_id in enumerate(candidate_ids, 1):
    cursor.execute("""
        SELECT 
            id, target_role, current_status, created_at, updated_at
        FROM career_gps 
        WHERE candidate_id = %s
    """, (user_id,))
    
    gps = cursor.fetchone()
    print(f"\n▶ CANDIDATE #{idx} CAREER GPS")
    if gps:
        (gps_id, target_role, current_status, created, updated) = gps
        print(f"    ✓ CAREER GPS EXISTS")
        print(f"      Target Role: {target_role}")
        print(f"      Current Status: {current_status}")
        print(f"      Created: {created}")
        print(f"      Updated: {updated}")
    else:
        print(f"    ✗ NO CAREER GPS FOUND")

print("\n" + "=" * 100)
print("RESUME DATA")
print("=" * 100)

for idx, user_id in enumerate(candidate_ids, 1):
    cursor.execute("""
        SELECT 
            parsed_at, career_gaps, raw_text
        FROM resume_data 
        WHERE user_id = %s
        ORDER BY parsed_at DESC
        LIMIT 1
    """, (user_id,))
    
    resume = cursor.fetchone()
    print(f"\n▶ CANDIDATE #{idx} RESUME DATA")
    if resume:
        (parsed_at, career_gaps, raw_text) = resume
        print(f"    ✓ RESUME DATA EXISTS")
        print(f"      Parsed At: {parsed_at}")
        print(f"      Career Gaps: {career_gaps}")
        print(f"      Raw Text Length: {len(raw_text) if raw_text else 0} chars")
    else:
        print(f"    ✗ NO RESUME DATA FOUND")

print("\n" + "=" * 100)
print("JOB APPLICATIONS")
print("=" * 100)

for idx, user_id in enumerate(candidate_ids, 1):
    cursor.execute("""
        SELECT COUNT(*) FROM job_applications WHERE candidate_id = %s
    """, (user_id,))
    
    count = cursor.fetchone()[0]
    print(f"\n▶ CANDIDATE #{idx} JOB APPLICATIONS")
    print(f"    Total Applications: {count}")

cursor.close()
conn.close()

print("\n" + "=" * 100)

