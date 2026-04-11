#!/usr/bin/env python3
"""
Analyze test_01 batch upload - Resume parsing status
Focus: Years of experience calculation
"""

import os
import sys
from urllib.parse import urlparse

# Database connection
DB_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:tX6v2KraCehQkZR@techsalesaxis-db.c34g4umwou6k.ap-south-1.rds.amazonaws.com:5432/postgres"
)

print("=" * 80)
print("BULK UPLOAD PARSING ANALYSIS - test_01 BATCH")
print("=" * 80)
print()

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    
    # Parse connection string
    parsed = urlparse(DB_URL)
    
    conn = psycopg2.connect(
        host=parsed.hostname,
        user=parsed.username,
        password=parsed.password,
        database=parsed.path.lstrip('/'),
        port=parsed.port or 5432
    )
    
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # 1. Get batch info
    print("1. CHECKING BATCH 'test_01'")
    print("-" * 80)
    cursor.execute("""
        SELECT batch_id, batch_name, total_files, status, created_at, updated_at
        FROM bulk_upload_batches
        WHERE batch_name = %s
        ORDER BY created_at DESC
        LIMIT 1
    """, ("test_01",))
    
    batch = cursor.fetchone()
    if batch:
        print(f"   Batch ID: {batch['batch_id']}")
        print(f"   Batch Name: {batch['batch_name']}")
        print(f"   Total Files: {batch['total_files']}")
        print(f"   Status: {batch['status']}")
        print(f"   Created: {batch['created_at']}")
        print(f"   Updated: {batch['updated_at']}")
    else:
        print("   ERROR: Batch 'test_01' not found in database")
        sys.exit(1)
    
    print()
    
    # 2. Check job records for this batch
    print("2. PARSING JOBS FOR BATCH")
    print("-" * 80)
    cursor.execute("""
        SELECT job_id, file_name, status, result, created_at, updated_at
        FROM bulk_upload_jobs
        WHERE batch_id = %s
        ORDER BY created_at
    """, (batch['batch_id'],))
    
    jobs = cursor.fetchall()
    print(f"   Total Jobs: {len(jobs)}")
    
    success_count = 0
    failed_count = 0
    parsing_count = 0
    
    for job in jobs:
        if job['status'] == 'completed':
            success_count += 1
        elif job['status'] == 'failed':
            failed_count += 1
        elif job['status'] == 'processing':
            parsing_count += 1
    
    print(f"   Completed: {success_count}")
    print(f"   Failed: {failed_count}")
    print(f"   Processing: {parsing_count}")
    print()
    
    # 3. Check linked candidates and their parsed data
    print("3. CANDIDATE PROFILES - YEARS OF EXPERIENCE ANALYSIS")
    print("-" * 80)
    
    cursor.execute("""
        SELECT 
            c.candidate_id,
            c.full_name,
            c.years_of_experience,
            c.experience_band,
            c.current_role,
            c.skills,
            j.file_name,
            j.status as job_status
        FROM candidate_profiles c
        JOIN bulk_upload_jobs j ON c.candidate_id = j.candidate_id
        WHERE j.batch_id = %s
        ORDER BY c.candidate_id
    """, (batch['batch_id'],))
    
    candidates = cursor.fetchall()
    print(f"   Total Candidates: {len(candidates)}")
    print()
    
    if len(candidates) > 0:
        print("   Sample Analysis (First 10):")
        print()
        print(f"   {'Name':<20} {'Years Exp':<12} {'Role':<25} {'Band':<15}")
        print(f"   {'-'*20} {'-'*12} {'-'*25} {'-'*15}")
        
        years_list = []
        for i, cand in enumerate(candidates[:10]):
            name = (cand['full_name'] or 'N/A')[:20]
            years = cand['years_of_experience'] if cand['years_of_experience'] is not None else 'NULL'
            role = (cand['current_role'] or 'N/A')[:25]
            band = (cand['experience_band'] or 'N/A')[:15]
            
            print(f"   {name:<20} {str(years):<12} {role:<25} {band:<15}")
            
            if isinstance(years, int):
                years_list.append(years)
        
        print()
        print("   Statistics:")
        if years_list:
            print(f"   - Average years_of_experience: {sum(years_list)/len(years_list):.1f}")
            print(f"   - Min: {min(years_list)}")
            print(f"   - Max: {max(years_list)}")
            print(f"   - With NULL values: {len([c for c in candidates if c['years_of_experience'] is None])}")
    
    print()
    
    # 4. Check for parsing errors
    print("4. PARSING ERRORS/ISSUES")
    print("-" * 80)
    
    cursor.execute("""
        SELECT job_id, file_name, status, result
        FROM bulk_upload_jobs
        WHERE batch_id = %s AND status = 'failed'
        LIMIT 5
    """, (batch['batch_id'],))
    
    failed_jobs = cursor.fetchall()
    
    if len(failed_jobs) > 0:
        print(f"   Found {len(failed_jobs)} failed jobs:")
        for job in failed_jobs:
            print(f"   - {job['file_name']}: {job['result'][:100]}")
    else:
        print("   No failed jobs found")
    
    print()
    
    # 5. Check raw resume data for sample candidate
    print("5. SAMPLE PARSED RESUME DATA")
    print("-" * 80)
    
    if len(candidates) > 0:
        first_candidate = candidates[0]
        cursor.execute("""
            SELECT user_id, raw_text, skills, education, timeline
            FROM resume_data
            WHERE user_id = %s
            LIMIT 1
        """, (first_candidate['candidate_id'],))
        
        resume_data = cursor.fetchone()
        if resume_data:
            print(f"   Candidate: {first_candidate['full_name']}")
            print(f"   Skills: {str(resume_data['skills'])[:80]}")
            print(f"   Education: {str(resume_data['education'])[:80]}")
            print(f"   Timeline present: {'Yes' if resume_data['timeline'] else 'No'}")
            print(f"   Raw text length: {len(resume_data['raw_text']) if resume_data['raw_text'] else 0} chars")
        else:
            print(f"   No resume_data found for candidate {first_candidate['candidate_id']}")
    
    print()
    
    # 6. Summary based on bulk_upload_tasks.py logic
    print("6. YEARS OF EXPERIENCE CALCULATION STATUS")
    print("-" * 80)
    
    # Check if IT/Tech filtering is being applied
    it_tech_keywords = [
        'developer', 'engineer', 'programmer', 'software', 'data scientist',
        'devops', 'architect', 'python', 'java', 'javascript', 'aws', 'azure'
    ]
    
    it_tech_count = 0
    non_it_count = 0
    
    for cand in candidates:
        if cand['current_role']:
            role_lower = cand['current_role'].lower()
            if any(keyword in role_lower for keyword in it_tech_keywords):
                it_tech_count += 1
            else:
                non_it_count += 1
    
    print(f"   IT/Tech roles detected: {it_tech_count}")
    print(f"   Non-IT roles detected: {non_it_count}")
    
    # Check if years_of_experience is populated
    null_count = len([c for c in candidates if c['years_of_experience'] is None])
    populated_count = len(candidates) - null_count
    
    print(f"   Years_of_experience populated: {populated_count}/{len(candidates)}")
    print(f"   Years_of_experience NULL: {null_count}/{len(candidates)}")
    
    print()
    print("=" * 80)
    
    cursor.close()
    conn.close()
    
except ImportError:
    print("ERROR: psycopg2 not installed")
    print("Install with: pip install psycopg2-binary")
    sys.exit(1)
except Exception as e:
    print(f"ERROR: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
