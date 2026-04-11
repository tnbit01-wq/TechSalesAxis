#!/usr/bin/env python3
"""
Simple direct database query for test_01 batch analysis
Focus: Years of experience calculation and data mismatch detection
"""

import os
import sys
from urllib.parse import urlparse
import json

DB_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:tX6v2KraCehQkZR@techsalesaxis-db.c34g4umwou6k.ap-south-1.rds.amazonaws.com:5432/postgres"
)

print("\n" + "="*90)
print("TEST_01 BATCH RESUME PARSING ANALYSIS")
print("Focus: Years of Experience Calculation")
print("="*90)

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    
    parsed = urlparse(DB_URL)
    conn = psycopg2.connect(
        host=parsed.hostname,
        user=parsed.username,
        password=parsed.password,
        database=parsed.path.lstrip('/'),
        port=parsed.port or 5432
    )
    
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # 1. Get batch summary
    print("\n1. BATCH SUMMARY")
    print("-" * 90)
    cursor.execute("""
        SELECT 
            id,
            batch_name,
            upload_status,
            total_files_uploaded,
            successfully_parsed,
            parsing_failed,
            extraction_confidence_avg,
            created_at
        FROM bulk_uploads
        WHERE batch_name = 'test_01'
        LIMIT 1
    """)
    
    batch = cursor.fetchone()
    if batch:
        print(f"Batch ID: {batch['id']}")
        print(f"Batch Name: {batch['batch_name']}")
        print(f"Upload Status: {batch['upload_status']}")
        print(f"Total Files: {batch['total_files_uploaded']}")
        print(f"Successfully Parsed: {batch['successfully_parsed']}")
        print(f"Parsing Failed: {batch['parsing_failed']}")
        print(f"Avg Confidence: {batch['extraction_confidence_avg']}")
        print(f"Created: {batch['created_at']}")
    else:
        print("ERROR: Batch test_01 not found")
        sys.exit(1)
    
    # 2. Years of experience statistics
    print("\n2. YEARS OF EXPERIENCE ANALYSIS")
    print("-" * 90)
    
    cursor.execute("""
        SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN years_of_experience IS NOT NULL THEN 1 END) as populated,
            COUNT(CASE WHEN years_of_experience IS NULL THEN 1 END) as null_values,
            MIN(years_of_experience) as min_years,
            MAX(years_of_experience) as max_years,
            AVG(years_of_experience) as avg_years,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY years_of_experience) as median_years
        FROM candidate_profiles cp
        JOIN users u ON cp.user_id = u.id
        JOIN bulk_upload_files buf ON u.id = buf.matched_candidate_id
        JOIN bulk_uploads bu ON buf.bulk_upload_id = bu.id
        WHERE bu.batch_name = 'test_01'
    """)
    
    stats = cursor.fetchone()
    if stats and stats['total'] > 0:
        print(f"Total Candidates: {stats['total']}")
        print(f"Years_of_experience Populated: {stats['populated']} ({100*stats['populated']/stats['total']:.1f}%)")
        print(f"Years_of_experience NULL: {stats['null_values']} ({100*stats['null_values']/stats['total']:.1f}%)")
        print(f"Min Years: {stats['min_years']}")
        print(f"Max Years: {stats['max_years']}")
        print(f"Avg Years: {stats['avg_years']:.1f if stats['avg_years'] else 'N/A'}")
        print(f"Median Years: {stats['median_years']}")
    
    # 3. Experience band distribution
    print("\n3. EXPERIENCE BAND DISTRIBUTION")
    print("-" * 90)
    
    cursor.execute("""
        SELECT 
            COALESCE(experience_band, 'N/A') as band,
            COUNT(*) as count,
            AVG(years_of_experience) as avg_years
        FROM candidate_profiles cp
        JOIN users u ON cp.user_id = u.id
        JOIN bulk_upload_files buf ON u.id = buf.matched_candidate_id
        JOIN bulk_uploads bu ON buf.bulk_upload_id = bu.id
        WHERE bu.batch_name = 'test_01'
        GROUP BY experience_band
        ORDER BY count DESC
    """)
    
    bands = cursor.fetchall()
    for band in bands:
        print(f"  {band['band']:<15} - Count: {band['count']:3d}, Avg Years: {band['avg_years']:.1f if band['avg_years'] else 'N/A'}")
    
    # 4. Check for mismatches between extracted and stored years
    print("\n4. DATA MISMATCH DETECTION")
    print("-" * 90)
    
    cursor.execute("""
        SELECT 
            buf.original_filename,
            (buf.parsed_data->>'years_of_experience')::integer as extracted_years,
            cp.years_of_experience as profile_years,
            cp.current_role,
            cp.experience_band,
            u.email
        FROM bulk_upload_files buf
        JOIN bulk_uploads bu ON buf.bulk_upload_id = bu.id
        JOIN users u ON buf.matched_candidate_id = u.id
        JOIN candidate_profiles cp ON u.id = cp.user_id
        WHERE bu.batch_name = 'test_01'
            AND buf.parsed_data IS NOT NULL
            AND (buf.parsed_data->>'years_of_experience')::integer IS NOT NULL
        ORDER BY buf.created_at
    """)
    
    files_data = cursor.fetchall()
    
    mismatch_count = 0
    print(f"\nTotal files with parsed data: {len(files_data)}")
    print(f"\nFiles with MISMATCHES (extracted != stored):\n")
    
    for row in files_data:
        if row['extracted_years'] != row['profile_years']:
            mismatch_count += 1
            print(f"  File: {row['original_filename'][:40]:<40}")
            print(f"    Extracted: {row['extracted_years']} years  â†’  Stored: {row['profile_years']} years")
            print(f"    Role: {row['current_role']}")
            print(f"    Band: {row['experience_band']}")
            print()
    
    print(f"\nMismatch Summary: {mismatch_count}/{len(files_data)} files have data differences")
    print(f"Match Rate: {100*(len(files_data)-mismatch_count)/len(files_data):.1f}%")
    
    # 5. Check role analysis for IT/Tech detection
    print("\n5. ROLE ANALYSIS & IT/TECH DETECTION")
    print("-" * 90)
    
    cursor.execute("""
        SELECT 
            COALESCE(current_role, 'No Role') as role,
            COUNT(*) as count,
            AVG(years_of_experience) as avg_years
        FROM candidate_profiles cp
        JOIN users u ON cp.user_id = u.id
        JOIN bulk_upload_files buf ON u.id = buf.matched_candidate_id
        JOIN bulk_uploads bu ON buf.bulk_upload_id = bu.id
        WHERE bu.batch_name = 'test_01'
        GROUP BY current_role
        ORDER BY count DESC
        LIMIT 20
    """)
    
    roles = cursor.fetchall()
    print(f"Top roles in batch:\n")
    for role in roles:
        print(f"  {role['role'][:50]:<50} - Count: {role['count']:2d}, Avg Years: {role['avg_years']:.1f if role['avg_years'] else 'N/A'}")
    
    # 6. Parsing failures
    print("\n6. PARSING STATUS")
    print("-" * 90)
    
    cursor.execute("""
        SELECT 
            parsing_status,
            COUNT(*) as count,
            extraction_confidence_score
        FROM bulk_upload_files buf
        JOIN bulk_uploads bu ON buf.bulk_upload_id = bu.id
        WHERE bu.batch_name = 'test_01'
        GROUP BY parsing_status, extraction_confidence_score
        ORDER BY count DESC
    """)
    
    statuses = cursor.fetchall()
    for status in statuses:
        print(f"  {status['parsing_status']:<15} - Count: {status['count']:2d}, Confidence: {status['extraction_confidence_score']}")
    
    cursor.close()
    conn.close()
    
    print("\n" + "="*90)
    print("ANALYSIS COMPLETE")
    print("="*90 + "\n")
    
except ImportError as e:
    print(f"ERROR: psycopg2 not installed - {e}")
    print("Install with: pip install psycopg2-binary")
    sys.exit(1)
except Exception as e:
    print(f"ERROR: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
