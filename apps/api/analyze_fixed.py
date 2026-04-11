#!/usr/bin/env python3
import os
import sys
from datetime import datetime
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))
from core.config import DATABASE_URL

if not DATABASE_URL:
    print("ERROR: DATABASE_URL environment variable not set")
    sys.exit(1)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)

def get_db_session():
    return SessionLocal()

def analyze_batch():
    session = get_db_session()
    try:
        print("\n" + "="*80)
        print("TEST_01 BATCH - COMPREHENSIVE PARSING ANALYSIS")
        print("="*80)
        print(f"Analysis Date: {datetime.now().isoformat()}\n")

        # 1. Check if batch exists
        print("\n[1] BATCH INFO")
        print("-"*80)
        result = session.execute(text("""
            SELECT
                bu.id,
                bu.batch_name,
                bu.batch_description,
                bu.upload_status,
                bu.total_files_uploaded,
                bu.successfully_parsed,
                bu.parsing_failed,
                bu.total_candidates_found,
                bu.created_at
            FROM bulk_uploads bu
            WHERE bu.batch_name = 'test_01'
        """))
        batch = result.fetchone()
        if not batch:
            print("Batch 'test_01' not found!")
            return

        batch_id = batch[0]
        print(f"Batch ID: {batch[0]}")
        print(f"Batch Name: {batch[1]}")
        print(f"Description: {batch[2]}")
        print(f"Status: {batch[3]}")
        print(f"Total Files Uploaded: {batch[4]}")
        print(f"Successfully Parsed: {batch[5]}")
        print(f"Parsing Failed: {batch[6]}")
        print(f"Total Candidates Found: {batch[7]}")
        print(f"Created At: {batch[8]}")

        # 2. File processing status
        print("\n[2] FILE PROCESSING STATUS")
        print("-"*80)
        result = session.execute(text("""
            SELECT 
                parsing_status,
                COUNT(*) as count,
                ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM bulk_upload_files WHERE bulk_upload_id = :batch_id), 1) as percentage
            FROM bulk_upload_files
            WHERE bulk_upload_id = :batch_id
            GROUP BY parsing_status
            ORDER BY count DESC
        """), {"batch_id": str(batch_id)})

        for row in result.fetchall():
            status = row[0] or "NULL"
            print(f"  {status:20} | {row[1]:4} ({row[2]:5.1f}%)")

        # 3. Total files and matching
        print("\n[3] TOTAL FILES & MATCHING")
        print("-"*80)
        result = session.execute(text("""
            SELECT
                COUNT(DISTINCT buf.id) as total_files,
                COUNT(DISTINCT CASE WHEN bufm.id IS NOT NULL THEN bufm.id END) as with_matches
            FROM bulk_upload_files buf
            LEFT JOIN bulk_upload_candidate_matches bufm ON buf.id = bufm.bulk_upload_file_id
            WHERE buf.bulk_upload_id = :batch_id
        """), {"batch_id": str(batch_id)})

        files = result.fetchone()
        print(f"Total Files: {files[0]}")
        print(f"Files with Matches: {files[1]}")

        # 4. Extracted data quality
        print("\n[4] EXTRACTED DATA QUALITY")
        print("-"*80)
        result = session.execute(text("""
            SELECT
                SUM(CASE WHEN extracted_name IS NOT NULL THEN 1 ELSE 0 END) as names_extracted,
                SUM(CASE WHEN extracted_email IS NOT NULL THEN 1 ELSE 0 END) as emails_extracted,
                SUM(CASE WHEN extracted_phone IS NOT NULL THEN 1 ELSE 0 END) as phones_extracted,
                SUM(CASE WHEN extracted_current_role IS NOT NULL THEN 1 ELSE 0 END) as roles_extracted,
                SUM(CASE WHEN extracted_years_experience IS NOT NULL THEN 1 ELSE 0 END) as years_extracted,
                COUNT(*) as total_files
            FROM bulk_upload_files
            WHERE bulk_upload_id = :batch_id
        """), {"batch_id": str(batch_id)})

        data = result.fetchone()
        total = data[5] if data[5] else 1
        print(f"Names Extracted: {data[0]} ({(data[0]*100//total if data[0] else 0)}%)")
        print(f"Emails Extracted: {data[1]} ({(data[1]*100//total if data[1] else 0)}%)")
        print(f"Phones Extracted: {data[2]} ({(data[2]*100//total if data[2] else 0)}%)")
        print(f"Roles Extracted: {data[3]} ({(data[3]*100//total if data[3] else 0)}%)")
        print(f"Years Extracted: {data[4]} ({(data[4]*100//total if data[4] else 0)}%)")

        # 5. Experience years statistics
        print("\n[5] EXPERIENCE YEARS STATISTICS")
        print("-"*80)
        result = session.execute(text("""
            SELECT
                ROUND(AVG(extracted_years_experience::numeric), 1) as avg_extracted,
                MIN(extracted_years_experience) as min_extracted,
                MAX(extracted_years_experience) as max_extracted,
                COUNT(CASE WHEN extracted_years_experience = 0 THEN 1 END) as zero_years_count,
                COUNT(CASE WHEN extracted_years_experience IS NULL THEN 1 END) as null_years_count
            FROM bulk_upload_files
            WHERE bulk_upload_id = :batch_id
        """), {"batch_id": str(batch_id)})

        stats = result.fetchone()
        if stats[0]:
            print(f"Avg Years (Extracted): {stats[0]}")
            print(f"Range: {stats[1]} - {stats[2]} years")
            print(f"Zero Years: {stats[3]}")
            print(f"NULL Years: {stats[4]}")

        # 6. Top extracted roles
        print("\n[6] TOP EXTRACTED ROLES")
        print("-"*80)
        result = session.execute(text("""
            SELECT
                LOWER(SUBSTRING(extracted_current_role, 1, 30)) as role,
                COUNT(*) as count
            FROM bulk_upload_files
            WHERE bulk_upload_id = :batch_id AND extracted_current_role IS NOT NULL
            GROUP BY LOWER(SUBSTRING(extracted_current_role, 1, 30))
            ORDER BY count DESC
            LIMIT 15
        """), {"batch_id": str(batch_id)})

        print(f"{'Role (30 chars)':33} | Count")
        print("-"*40)
        for row in result.fetchall():
            role = str(row[0] or "")[:30]
            print(f"{role:33} | {row[1]:5}")

        # 7. Parsing errors
        print("\n[7] PARSING ERRORS & STATUS")
        print("-"*80)
        result = session.execute(text("""
            SELECT
                parsing_error,
                COUNT(*) as count
            FROM bulk_upload_files
            WHERE bulk_upload_id = :batch_id AND parsing_status = 'failed'
            GROUP BY parsing_error
            ORDER BY count DESC
            LIMIT 10
        """), {"batch_id": str(batch_id)})

        errors = result.fetchall()
        if errors:
            for row in errors:
                error = row[0] or "Unknown"
                print(f"  {error[:60]:60} | {row[1]:3}")
        else:
            print("  No parsing errors reported")

        print("\n" + "="*80)
        print("END OF REPORT")
        print("="*80)

    except Exception as e:
        print(f"ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        session.close()

if __name__ == "__main__":
    analyze_batch()
