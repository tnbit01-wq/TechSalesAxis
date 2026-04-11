#!/usr/bin/env python3
"""
Comprehensive diagnostic for the newly re-created test_01 batch.
Checks parsing accuracy, data quality, and identifies issues.
"""

import os
import sys
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
from collections import defaultdict

# Load environment variables
load_dotenv()

# Database connection details
DB_HOST = os.getenv('DB_HOST')
DB_USER = os.getenv('DB_USER')
DB_PASSWORD = os.getenv('DB_PASSWORD')
DB_NAME = os.getenv('DB_NAME', 'postgres')
DB_PORT = os.getenv('DB_PORT', '5432')

def connect_db():
    """Create database connection"""
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            port=DB_PORT
        )
        return conn
    except Exception as e:
        print(f"Database connection error: {e}")
        sys.exit(1)

def analyze_batch():
    """Analyze the new test_01 batch"""
    conn = connect_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    print("=" * 80)
    print("NEW TEST_01 BATCH PARSING ACCURACY ANALYSIS")
    print(f"Analysis Timestamp: {datetime.now().isoformat()}")
    print("=" * 80)
    
    # 1. Get batch info
    print("\n1. BATCH INFORMATION")
    print("-" * 80)
    try:
        cur.execute("""
            SELECT 
                id, batch_name, created_at, updated_at,
                COUNT(*) OVER () as total_files
            FROM bulk_uploads 
            WHERE batch_name = 'test_01'
            LIMIT 1
        """)
        batch = cur.fetchone()
        if batch:
            print(f"Batch ID: {batch['id']}")
            print(f"Batch Name: {batch['batch_name']}")
            print(f"Created: {batch['created_at']}")
            print(f"Updated: {batch['updated_at']}")
        else:
            print("ERROR: test_01 batch not found!")
            return
    except Exception as e:
        print(f"Error fetching batch info: {e}")
        return
    
    # 2. Get file statistics
    print("\n2. FILE STATISTICS")
    print("-" * 80)
    try:
        cur.execute("""
            SELECT 
                COUNT(*) as total_files,
                SUM(CASE WHEN parsing_status = 'completed' THEN 1 ELSE 0 END) as parsed_success,
                SUM(CASE WHEN parsing_status = 'failed' THEN 1 ELSE 0 END) as parse_failed,
                SUM(CASE WHEN parsing_status IS NULL THEN 1 ELSE 0 END) as not_started
            FROM bulk_upload_files 
            WHERE batch_id = (SELECT id FROM bulk_uploads WHERE batch_name = 'test_01' LIMIT 1)
        """)
        stats = cur.fetchone()
        total = stats['total_files'] or 0
        success = stats['parsed_success'] or 0
        failed = stats['parse_failed'] or 0
        not_started = stats['not_started'] or 0
        
        print(f"Total Files: {total}")
        print(f"Parsed Successfully: {success} ({100*success/total if total > 0 else 0:.1f}%)")
        print(f"Parse Failed: {failed} ({100*failed/total if total > 0 else 0:.1f}%)")
        print(f"Not Started: {not_started} ({100*not_started/total if total > 0 else 0:.1f}%)")
    except Exception as e:
        print(f"Error fetching file statistics: {e}")
    
    # 3. Candidate data quality
    print("\n3. CANDIDATE DATA QUALITY")
    print("-" * 80)
    try:
        cur.execute("""
            SELECT 
                COUNT(*) as total_records,
                COUNT(CASE WHEN candidate_name IS NOT NULL AND candidate_name != '' THEN 1 END) as has_name,
                COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END) as has_email,
                COUNT(CASE WHEN phone IS NOT NULL AND phone != '' THEN 1 END) as has_phone,
                COUNT(CASE WHEN years_of_experience IS NOT NULL THEN 1 END) as has_years,
                COUNT(CASE WHEN current_role IS NOT NULL AND current_role != '' THEN 1 END) as has_role,
                COUNT(CASE WHEN skills IS NOT NULL AND array_length(skills, 1) > 0 THEN 1 END) as has_skills
            FROM candidate_profiles cp
            WHERE cp.id IN (
                SELECT DISTINCT candidate_id FROM bulk_upload_files 
                WHERE batch_id = (SELECT id FROM bulk_uploads WHERE batch_name = 'test_01' LIMIT 1)
                AND candidate_id IS NOT NULL
            )
        """)
        quality = cur.fetchone()
        total = quality['total_records'] or 0
        
        print(f"Total Candidate Records: {total}")
        if total > 0:
            print(f"Has Name: {quality['has_name']} ({100*quality['has_name']/total:.1f}%)")
            print(f"Has Email: {quality['has_email']} ({100*quality['has_email']/total:.1f}%)")
            print(f"Has Phone: {quality['has_phone']} ({100*quality['has_phone']/total:.1f}%)")
            print(f"Has Years of Experience: {quality['has_years']} ({100*quality['has_years']/total:.1f}%)")
            print(f"Has Current Role: {quality['has_role']} ({100*quality['has_role']/total:.1f}%)")
            print(f"Has Skills: {quality['has_skills']} ({100*quality['has_skills']/total:.1f}%)")
    except Exception as e:
        print(f"Error fetching data quality: {e}")
    
    # 4. Years of experience distribution
    print("\n4. YEARS OF EXPERIENCE DISTRIBUTION")
    print("-" * 80)
    try:
        cur.execute("""
            SELECT 
                MIN(years_of_experience) as min_years,
                MAX(years_of_experience) as max_years,
                ROUND(AVG(years_of_experience)::numeric, 2) as avg_years,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY years_of_experience) as median_years,
                COUNT(CASE WHEN years_of_experience = 0 THEN 1 END) as zero_years_count,
                COUNT(CASE WHEN years_of_experience > 0 AND years_of_experience <= 3 THEN 1 END) as fresher_0_3,
                COUNT(CASE WHEN years_of_experience > 3 AND years_of_experience <= 8 THEN 1 END) as junior_3_8,
                COUNT(CASE WHEN years_of_experience > 8 AND years_of_experience <= 15 THEN 1 END) as senior_8_15,
                COUNT(CASE WHEN years_of_experience > 15 THEN 1 END) as leadership_15plus
            FROM candidate_profiles cp
            WHERE cp.id IN (
                SELECT DISTINCT candidate_id FROM bulk_upload_files 
                WHERE batch_id = (SELECT id FROM bulk_uploads WHERE batch_name = 'test_01' LIMIT 1)
                AND candidate_id IS NOT NULL
            )
        """)
        exp_dist = cur.fetchone()
        total = quality['total_records'] or 0
        
        print(f"Min Years: {exp_dist['min_years']}")
        print(f"Max Years: {exp_dist['max_years']}")
        print(f"Avg Years: {exp_dist['avg_years']}")
        print(f"Median Years: {exp_dist['median_years']}")
        print(f"\nZero Years: {exp_dist['zero_years_count']} ({100*exp_dist['zero_years_count']/total if total > 0 else 0:.1f}%)")
        print(f"Fresher (0-3 yrs): {exp_dist['fresher_0_3']} ({100*exp_dist['fresher_0_3']/total if total > 0 else 0:.1f}%)")
        print(f"Junior (3-8 yrs): {exp_dist['junior_3_8']} ({100*exp_dist['junior_3_8']/total if total > 0 else 0:.1f}%)")
        print(f"Senior (8-15 yrs): {exp_dist['senior_8_15']} ({100*exp_dist['senior_8_15']/total if total > 0 else 0:.1f}%)")
        print(f"Leadership (15+ yrs): {exp_dist['leadership_15plus']} ({100*exp_dist['leadership_15plus']/total if total > 0 else 0:.1f}%)")
    except Exception as e:
        print(f"Error fetching experience distribution: {e}")
    
    # 5. Top 20 roles distribution
    print("\n5. TOP 20 ROLES (with Year Ranges)")
    print("-" * 80)
    try:
        cur.execute("""
            SELECT 
                current_role,
                COUNT(*) as role_count,
                MIN(years_of_experience) as min_years,
                MAX(years_of_experience) as max_years,
                ROUND(AVG(years_of_experience)::numeric, 2) as avg_years,
                COUNT(CASE WHEN years_of_experience = 0 THEN 1 END) as zero_years
            FROM candidate_profiles cp
            WHERE cp.id IN (
                SELECT DISTINCT candidate_id FROM bulk_upload_files 
                WHERE batch_id = (SELECT id FROM bulk_uploads WHERE batch_name = 'test_01' LIMIT 1)
                AND candidate_id IS NOT NULL
            )
            AND current_role IS NOT NULL
            GROUP BY current_role
            ORDER BY role_count DESC
            LIMIT 20
        """)
        roles = cur.fetchall()
        for role in roles:
            zero_pct = 100 * role['zero_years'] / role['role_count'] if role['role_count'] > 0 else 0
            print(f"\n{role['current_role']}")
            print(f"  Count: {role['role_count']} | Years: {role['min_years']}-{role['max_years']} | Avg: {role['avg_years']} | Zero: {role['zero_years']} ({zero_pct:.0f}%)")
    except Exception as e:
        print(f"Error fetching roles: {e}")
    
    # 6. Experience band distribution
    print("\n6. EXPERIENCE BAND DISTRIBUTION")
    print("-" * 80)
    try:
        cur.execute("""
            SELECT 
                experience,
                COUNT(*) as count,
                ROUND(AVG(years_of_experience)::numeric, 2) as avg_years
            FROM candidate_profiles cp
            WHERE cp.id IN (
                SELECT DISTINCT candidate_id FROM bulk_upload_files 
                WHERE batch_id = (SELECT id FROM bulk_uploads WHERE batch_name = 'test_01' LIMIT 1)
                AND candidate_id IS NOT NULL
            )
            GROUP BY experience
            ORDER BY count DESC
        """)
        bands = cur.fetchall()
        for band in bands:
            print(f"{band['experience']}: {band['count']} candidates (Avg: {band['avg_years']} years)")
    except Exception as e:
        print(f"Error fetching experience bands: {e}")
    
    # 7. Extracted vs Stored Comparison (sample of 30)
    print("\n7. EXTRACTED VS STORED DATA COMPARISON (First 30 Records)")
    print("-" * 80)
    try:
        cur.execute("""
            SELECT 
                cp.candidate_name,
                cp.current_role,
                COALESCE(cp.years_of_experience, 0) as stored_years,
                COALESCE(buf.extracted_years_experience, 0) as extracted_years,
                COALESCE(buf.extracted_current_role, 'N/A') as extracted_role,
                buf.parsing_status,
                CASE 
                    WHEN COALESCE(cp.years_of_experience, 0) != COALESCE(buf.extracted_years_experience, 0) THEN 'MISMATCH'
                    ELSE 'MATCH'
                END as status
            FROM bulk_upload_files buf
            LEFT JOIN candidate_profiles cp ON buf.candidate_id = cp.id
            WHERE buf.batch_id = (SELECT id FROM bulk_uploads WHERE batch_name = 'test_01' LIMIT 1)
            ORDER BY buf.created_at DESC
            LIMIT 30
        """)
        comparisons = cur.fetchall()
        mismatch_count = 0
        
        print(f"{'Name':<20} {'Stored Yrs':<12} {'Extracted Yrs':<14} {'Status':<10}")
        print("-" * 80)
        for comp in comparisons:
            status = comp['status']
            if status == 'MISMATCH':
                mismatch_count += 1
            print(f"{comp['candidate_name'][:20]:<20} {comp['stored_years']:<12} {comp['extracted_years']:<14} {status:<10}")
        
        print(f"\nMismatches in first 30: {mismatch_count}")
    except Exception as e:
        print(f"Error fetching comparison data: {e}")
    
    # 8. Parsing errors/issues
    print("\n8. PARSING ERRORS/ISSUES")
    print("-" * 80)
    try:
        cur.execute("""
            SELECT 
                parsing_status,
                COUNT(*) as count,
                STRING_AGG(DISTINCT error_message, ' | ') as errors
            FROM bulk_upload_files 
            WHERE batch_id = (SELECT id FROM bulk_uploads WHERE batch_name = 'test_01' LIMIT 1)
            GROUP BY parsing_status
        """)
        errors = cur.fetchall()
        for error in errors:
            print(f"\nStatus: {error['parsing_status']}")
            print(f"Count: {error['count']}")
            if error['errors']:
                print(f"Errors: {error['errors'][:200]}...")
    except Exception as e:
        print(f"Error fetching parsing errors: {e}")
    
    # 9. Overall accuracy metrics
    print("\n9. OVERALL ACCURACY METRICS")
    print("-" * 80)
    try:
        cur.execute("""
            WITH data AS (
                SELECT 
                    COALESCE(cp.years_of_experience, 0) as stored_years,
                    COALESCE(buf.extracted_years_experience, 0) as extracted_years
                FROM bulk_upload_files buf
                LEFT JOIN candidate_profiles cp ON buf.candidate_id = cp.id
                WHERE buf.batch_id = (SELECT id FROM bulk_uploads WHERE batch_name = 'test_01' LIMIT 1)
                AND cp.id IS NOT NULL
            )
            SELECT 
                COUNT(*) as total_records,
                COUNT(CASE WHEN stored_years = extracted_years THEN 1 END) as matches,
                COUNT(CASE WHEN stored_years != extracted_years THEN 1 END) as mismatches,
                ROUND(100.0 * COUNT(CASE WHEN stored_years = extracted_years THEN 1 END) / COUNT(*), 2) as accuracy_percent
            FROM data
        """)
        metrics = cur.fetchone()
        total = metrics['total_records'] or 0
        matches = metrics['matches'] or 0
        mismatches = metrics['mismatches'] or 0
        accuracy = metrics['accuracy_percent'] or 0
        
        print(f"Total Records: {total}")
        print(f"Exact Matches: {matches} ({accuracy:.2f}%)")
        print(f"Mismatches: {mismatches} ({100-accuracy:.2f}%)")
        print(f"\nAccuracy Rate: {accuracy:.2f}%")
        
        if accuracy < 90:
            print("\n⚠️  WARNING: Accuracy below 90%! Investigation needed.")
        elif accuracy >= 95:
            print("\n✓ GOOD: Accuracy above 95%")
        else:
            print("\n~ ACCEPTABLE: Accuracy between 90-95%")
    except Exception as e:
        print(f"Error fetching accuracy metrics: {e}")
    
    print("\n" + "=" * 80)
    print("END OF ANALYSIS")
    print("=" * 80)
    
    cur.close()
    conn.close()

if __name__ == '__main__':
    analyze_batch()
