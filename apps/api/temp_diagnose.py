import os
import sys
from urllib.parse import urlparse

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

    # 2. Years of Experience Analysis
    print("\n2. YEARS OF EXPERIENCE ANALYSIS")
    print("-" * 90)
    cursor.execute("""
        SELECT
            COUNT(*) as total,
            COUNT(CASE WHEN cp.years_of_experience IS NOT NULL THEN 1 END) as populated,
            COUNT(CASE WHEN cp.years_of_experience IS NULL THEN 1 END) as null_values,
            MIN(cp.years_of_experience) as min_years,
            MAX(cp.years_of_experience) as max_years,
            AVG(cp.years_of_experience) as avg_years,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cp.years_of_experience) as median_years
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
        avg_val = stats['avg_years']
        if avg_val is not None:
            print(f"Avg Years: {float(avg_val):.1f}")
        else:
            print(f"Avg Years: N/A")
        print(f"Median Years: {stats['median_years']}")

    # 3. Experience band distribution
    print("\n3. EXPERIENCE BAND DISTRIBUTION")
    print("-" * 90)

    cursor.execute("""
        SELECT
            COALESCE(cp.experience, 'N/A') as band,
            COUNT(*) as count,
            AVG(cp.years_of_experience) as avg_years
        FROM candidate_profiles cp
        JOIN users u ON cp.user_id = u.id
        JOIN bulk_upload_files buf ON u.id = buf.matched_candidate_id
        JOIN bulk_uploads bu ON buf.bulk_upload_id = bu.id
        WHERE bu.batch_name = 'test_01'
        GROUP BY cp.experience
        ORDER BY cp.experience
    """)

    for row in cursor.fetchall():
        avg_yoe = row['avg_years']
        avg_str = f"{float(avg_yoe):.1f}" if avg_yoe else "N/A"
        print(f"{row['band']}: {row['count']} candidates (Avg YOE: {avg_str})")

    # 4. Data Mismatches
    print("\n4. DATA MISMATCHES (Extracted vs Stored Years)")
    print("-" * 90)

    cursor.execute("""
        SELECT
            COUNT(*) as total,
            COUNT(CASE WHEN COALESCE(e.experience_years, 0) != COALESCE(cp.years_of_experience, 0) THEN 1 END) as mismatches
        FROM candidate_profiles cp
        JOIN users u ON cp.user_id = u.id
        JOIN bulk_upload_files buf ON u.id = buf.matched_candidate_id
        JOIN bulk_uploads bu ON buf.bulk_upload_id = bu.id
        LEFT JOIN extraction_results e ON buf.id = e.file_id
        WHERE bu.batch_name = 'test_01'
    """)

    mismatch = cursor.fetchone()
    if mismatch:
        total = mismatch['total']
        mismatches = mismatch['mismatches'] or 0
        print(f"Total Records: {total}")
        if total > 0:
            print(f"Mismatches: {mismatches} ({100*mismatches/total:.1f}%)")
            print(f"Matches: {total - mismatches} ({100*(total-mismatches)/total:.1f}%)")

    # 5. Role analysis and IT/Tech detection
    print("\n5. ROLE ANALYSIS AND IT/TECH DETECTION")
    print("-" * 90)

    cursor.execute("""
        SELECT
            CASE WHEN cp.current_role ILIKE '%developer%' OR cp.current_role ILIKE '%engineer%' OR cp.current_role ILIKE '%architect%' OR cp.current_role ILIKE '%analyst%' THEN true ELSE false END as is_tech,
            COUNT(*) as count
        FROM candidate_profiles cp
        JOIN users u ON cp.user_id = u.id
        JOIN bulk_upload_files buf ON u.id = buf.matched_candidate_id
        JOIN bulk_uploads bu ON buf.bulk_upload_id = bu.id
        WHERE bu.batch_name = 'test_01'
        GROUP BY is_tech
    """)

    for row in cursor.fetchall():
        role = "IT/Tech" if row['is_tech'] else "Non-IT/Tech"
        print(f"{role}: {row['count']} candidates")

    # 6. Parsing Status
    print("\n6. PARSING STATUS")
    print("-" * 90)

    cursor.execute("""
        SELECT
            COALESCE(parsing_status, 'unknown') as status,
            COUNT(*) as count
        FROM bulk_upload_files buf
        JOIN bulk_uploads bu ON buf.bulk_upload_id = bu.id
        WHERE bu.batch_name = 'test_01'
        GROUP BY parsing_status
        ORDER BY status
    """)

    for row in cursor.fetchall():
        print(f"{row['status']}: {row['count']} files")

    print("\n" + "="*90)
    conn.close()

except Exception as e:
    print(f"\nError: {type(e).__name__}: {str(e)}")
    import traceback
    traceback.print_exc()
