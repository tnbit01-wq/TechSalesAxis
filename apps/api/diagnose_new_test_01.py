#!/usr/bin/env python3
"""
Comprehensive diagnostic for the newly re-created test_01 batch.
CORRECTED WITH ACTUAL SCHEMA
"""

import os
import sys
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime

load_dotenv()

DB_HOST = os.getenv('DB_HOST')
DB_USER = os.getenv('DB_USER')
DB_PASSWORD = os.getenv('DB_PASSWORD')
DB_NAME = os.getenv('DB_NAME', 'postgres')
DB_PORT = os.getenv('DB_PORT', '5432')

def connect_db():
    try:
        conn = psycopg2.connect(
            host=DB_HOST, user=DB_USER, password=DB_PASSWORD,
            database=DB_NAME, port=DB_PORT
        )
        return conn
    except Exception as e:
        print(f"Database connection error: {e}")
        sys.exit(1)

def analyze_batch():
    conn = connect_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    print("=" * 90)
    print("NEW TEST_01 BATCH PARSING ACCURACY ANALYSIS (CORRECTED)")
    print(f"Analysis Timestamp: {datetime.now().isoformat()}")
    print("=" * 90)
    
    # Get batch ID
    cur.execute("SELECT id FROM bulk_uploads WHERE batch_name = 'test_01' LIMIT 1")
    batch_result = cur.fetchone()
    if not batch_result:
        print("ERROR: test_01 batch not found!")
        cur.close()
        conn.close()
        return
    
    batch_id = batch_result['id']
    
    # 1. Batch Info
    print("\n1. BATCH INFORMATION")
    print("-" * 90)
    cur.execute("""
        SELECT batch_name, upload_status, total_files_uploaded, 
               successfully_parsed, parsing_failed, created_at, updated_at
        FROM bulk_uploads WHERE id = %s
    """, (batch_id,))
    batch = cur.fetchone()
    if batch:
        print(f"Batch Name: {batch['batch_name']}")
        print(f"Status: {batch['upload_status']}")
        print(f"Total Files: {batch['total_files_uploaded']}")
        print(f"Successfully Parsed: {batch['successfully_parsed']}")
        print(f"Parse Failed: {batch['parsing_failed']}")
        print(f"Created: {batch['created_at']}")
        print(f"Updated: {batch['updated_at']}")
    
    # 2. File Status Distribution
    print("\n2. FILE PARSING STATUS")
    print("-" * 90)
    cur.execute("""
        SELECT 
            parsing_status,
            COUNT(*) as count
        FROM bulk_upload_files 
        WHERE bulk_upload_id = %s
        GROUP BY parsing_status
        ORDER BY count DESC
    """, (batch_id,))
    statuses = cur.fetchall()
    total_files = sum(s['count'] for s in statuses)
    for status in statuses:
        pct = 100 * status['count'] / total_files if total_files > 0 else 0
        print(f"  {status['parsing_status'] or 'null'}: {status['count']} ({pct:.1f}%)")
    
    # 3. Data Extraction Quality
    print("\n3. EXTRACTION DATA QUALITY")
    print("-" * 90)
    cur.execute("""
        SELECT 
            COUNT(*) as total,
            COUNT(extracted_name) as has_name,
            COUNT(extracted_email) as has_email,
            COUNT(extracted_phone) as has_phone,
            COUNT(extracted_location) as has_location,
            COUNT(extracted_current_role) as has_role,
            COUNT(extracted_years_experience) as has_years
        FROM bulk_upload_files 
        WHERE bulk_upload_id = %s AND parsing_status = 'parsed'
    """, (batch_id,))
    quality = cur.fetchone()
    if quality and quality['total'] > 0:
        total = quality['total']
        print(f"Total Successfully Parsed: {total}")
        print(f"  Name Extracted: {quality['has_name']} ({100*quality['has_name']/total:.1f}%)")
        print(f"  Email Extracted: {quality['has_email']} ({100*quality['has_email']/total:.1f}%)")
        print(f"  Phone Extracted: {quality['has_phone']} ({100*quality['has_phone']/total:.1f}%)")
        print(f"  Location Extracted: {quality['has_location']} ({100*quality['has_location']/total:.1f}%)")
        print(f"  Role Extracted: {quality['has_role']} ({100*quality['has_role']/total:.1f}%)")
        print(f"  Years Extracted: {quality['has_years']} ({100*quality['has_years']/total:.1f}%)")
    
    # 4. Extracted Years Distribution
    print("\n4. EXTRACTED YEARS OF EXPERIENCE DISTRIBUTION")
    print("-" * 90)
    cur.execute("""
        SELECT 
            MIN(extracted_years_experience) as min_years,
            MAX(extracted_years_experience) as max_years,
            ROUND(AVG(COALESCE(extracted_years_experience, 0))::numeric, 2) as avg_years,
            COUNT(CASE WHEN extracted_years_experience = 0 THEN 1 END) as zero_count,
            COUNT(CASE WHEN extracted_years_experience IS NULL THEN 1 END) as null_count,
            COUNT(*) as total
        FROM bulk_upload_files 
        WHERE bulk_upload_id = %s AND parsing_status = 'completed'
    """, (batch_id,))
    exp_dist = cur.fetchone()
    if exp_dist:
        total = exp_dist['total']
        print(f"Min Years: {exp_dist['min_years']}")
        print(f"Max Years: {exp_dist['max_years']}")
        print(f"Avg Years: {exp_dist['avg_years']}")
        print(f"Zero Years: {exp_dist['zero_count']} ({100*exp_dist['zero_count']/total if total > 0 else 0:.1f}%)")
        print(f"NULL Years: {exp_dist['null_count']} ({100*exp_dist['null_count']/total if total > 0 else 0:.1f}%)")
    
    # 5. Stored Years Distribution (in candidate profiles)
    print("\n5. STORED YEARS OF EXPERIENCE IN CANDIDATE_PROFILES")
    print("-" * 90)
    cur.execute("""
        SELECT 
            MIN(cp.years_of_experience) as min_years,
            MAX(cp.years_of_experience) as max_years,
            ROUND(AVG(COALESCE(cp.years_of_experience, 0))::numeric, 2) as avg_years,
            COUNT(CASE WHEN cp.years_of_experience = 0 THEN 1 END) as zero_count,
            COUNT(CASE WHEN cp.years_of_experience IS NULL THEN 1 END) as null_count,
            COUNT(*) as total
        FROM bulk_upload_files buf
        LEFT JOIN candidate_profiles cp ON buf.matched_candidate_id = cp.user_id
        WHERE buf.bulk_upload_id = %s AND buf.parsing_status = 'parsed'
    """, (batch_id,))
    stored_dist = cur.fetchone()
    if stored_dist:
        total = stored_dist['total']
        print(f"Min Years: {stored_dist['min_years']}")
        print(f"Max Years: {stored_dist['max_years']}")
        print(f"Avg Years: {stored_dist['avg_years']}")
        print(f"Zero Years: {stored_dist['zero_count']} ({100*stored_dist['zero_count']/total if total > 0 else 0:.1f}%)")
        print(f"NULL Years: {stored_dist['null_count']} ({100*stored_dist['null_count']/total if total > 0 else 0:.1f}%)")
    
    # 6. Top 20 Roles with Years
    print("\n6. TOP 20 EXTRACTED ROLES (with Years Range)")
    print("-" * 90)
    cur.execute("""
        SELECT 
            extracted_current_role as role,
            COUNT(*) as count,
            MIN(extracted_years_experience) as min_years,
            MAX(extracted_years_experience) as max_years,
            ROUND(AVG(COALESCE(extracted_years_experience, 0))::numeric, 2) as avg_years,
            COUNT(CASE WHEN extracted_years_experience = 0 THEN 1 END) as zero_count
        FROM bulk_upload_files 
        WHERE bulk_upload_id = %s AND parsing_status = 'parsed'
        GROUP BY extracted_current_role
        ORDER BY count DESC
        LIMIT 20
    """, (batch_id,))
    roles = cur.fetchall()
    for role in roles:
        if role['role']:
            zero_pct = 100 * role['zero_count'] / role['count'] if role['count'] > 0 else 0
            print(f"\n  {role['role']}")
            print(f"    Count: {role['count']}, Years: {role['min_years']}-{role['max_years']}, Avg: {role['avg_years']}, Zero: {role['zero_count']} ({zero_pct:.0f}%)")
    
    # 7. Extracted vs Stored Comparison (30 samples)
    print("\n7. EXTRACTED vs STORED COMPARISON (First 30 Records)")
    print("-" * 90)
    cur.execute("""
        SELECT 
            buf.extracted_name,
            buf.extracted_current_role,
            buf.extracted_years_experience as extracted_years,
            COALESCE(cp.years_of_experience, 0) as stored_years,
            buf.parsing_status,
            CASE 
                WHEN buf.extracted_years_experience IS NULL THEN 'NULL_EXTRACTED'
                WHEN cp.years_of_experience IS NULL THEN 'NULL_STORED'
                WHEN buf.extracted_years_experience = COALESCE(cp.years_of_experience, 0) THEN 'MATCH'
                ELSE 'MISMATCH'
            END as comparison_status
        FROM bulk_upload_files buf
        LEFT JOIN candidate_profiles cp ON buf.matched_candidate_id = cp.user_id
        WHERE buf.bulk_upload_id = %s
        ORDER BY buf.created_at DESC
        LIMIT 30
    """, (batch_id,))
    comparisons = cur.fetchall()
    
    mismatch_count = 0
    for comp in comparisons:
        status = comp['comparison_status']
        if status == 'MISMATCH':
            mismatch_count += 1
        name = comp['extracted_name'] or 'N/A'
        role = comp['extracted_current_role'] or 'N/A'
        ex_yr = comp['extracted_years'] or 'NULL'
        st_yr = comp['stored_years'] or 'NULL'
        print(f"  {name[:25]:<25} | Role: {role[:20]:<20} | Extracted: {str(ex_yr):<4} | Stored: {str(st_yr):<4} | {status}")
    
    print(f"\nMismatches in first 30: {mismatch_count}")
    
    # 8. Overall Accuracy
    print("\n8. OVERALL DATA ACCURACY METRICS")
    print("-" * 90)
    cur.execute("""
        WITH data AS (
            SELECT 
                COALESCE(buf.extracted_years_experience, 0) as extracted_years,
                COALESCE(cp.years_of_experience, 0) as stored_years
            FROM bulk_upload_files buf
            LEFT JOIN candidate_profiles cp ON buf.matched_candidate_id = cp.user_id
            WHERE buf.bulk_upload_id = %s AND buf.parsing_status = 'parsed'
        )
        SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN extracted_years = stored_years THEN 1 END) as matches,
            COUNT(CASE WHEN extracted_years != stored_years THEN 1 END) as mismatches,
            CASE WHEN COUNT(*) > 0 THEN ROUND(100.0 * COUNT(CASE WHEN extracted_years = stored_years THEN 1 END) / COUNT(*), 2) ELSE 0 END as accuracy_percent
        FROM data
    """, (batch_id,))
    metrics = cur.fetchone()
    if metrics and metrics['total'] > 0:
        total = metrics['total']
        matches = metrics['matches']
        accuracy = metrics['accuracy_percent']
        print(f"Total Records: {total}")
        print(f"Exact Matches: {matches} ({accuracy:.2f}%)")
        print(f"Mismatches: {metrics['mismatches']} ({100-accuracy:.2f}%)")
        print(f"\n>>> ACCURACY RATE: {accuracy:.2f}% <<<")
        
        if accuracy < 80:
            print("⚠️  CRITICAL: Accuracy is very low!")
        elif accuracy < 90:
            print("⚠️  WARNING: Accuracy below 90%")
        elif accuracy >= 95:
            print("✓ GOOD: Accuracy above 95%")
        else:
            print("~ ACCEPTABLE: Accuracy between 90-95%")
    else:
        print("No completed parsing records found")
    
    # 9. Parsing Errors
    print("\n9. PARSING ERRORS")
    print("-" * 90)
    cur.execute("""
        SELECT 
            COUNT(*) as count,
            parsing_error
        FROM bulk_upload_files 
        WHERE bulk_upload_id = %s AND parsing_status = 'failed'
        GROUP BY parsing_error
        LIMIT 10
    """, (batch_id,))
    errors = cur.fetchall()
    if errors:
        for error in errors:
            print(f"  {error['count']}: {error['parsing_error'][:80]}")
    else:
        print("  No failures recorded")
    
    print("\n" + "=" * 90)
    print("END OF ANALYSIS")
    print("=" * 90)
    
    cur.close()
    conn.close()

if __name__ == '__main__':
    analyze_batch()
