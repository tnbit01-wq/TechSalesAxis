#!/usr/bin/env python3
"""
Analyze why role extraction is failing - sample resumes
"""

import os
import sys
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor

load_dotenv()

DB_HOST = os.getenv('DB_HOST')
DB_USER = os.getenv('DB_USER')
DB_PASSWORD = os.getenv('DB_PASSWORD')
DB_NAME = os.getenv('DB_NAME', 'postgres')
DB_PORT = os.getenv('DB_PORT', '5432')

def analyze():
    conn = psycopg2.connect(
        host=DB_HOST, user=DB_USER, password=DB_PASSWORD,
        database=DB_NAME, port=DB_PORT
    )
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    print("=" * 100)
    print("ROLE EXTRACTION ANALYSIS - Sample of records with NULL/missing roles")
    print("=" * 100)
    
    # Get batch ID
    cur.execute("SELECT id FROM bulk_uploads WHERE batch_name = 'test_01' LIMIT 1")
    batch_id = cur.fetchone()['id']
    
    # Get records where role is extracted but empty/NULL
    print("\n1. RECORDS WITH NULL/EMPTY EXTRACTED ROLES (Should have roles)")
    print("-" * 100)
    cur.execute("""
        SELECT DISTINCT
            buf.id as file_id,
            buf.original_filename,
            buf.extracted_name as name,
            buf.extracted_current_role as extracted_role,
            buf.extracted_years_experience as years,
            buf.parsed_data::text as raw_parsed_data
        FROM bulk_upload_files buf
        WHERE buf.bulk_upload_id = %s
        AND buf.parsing_status = 'parsed'
        AND (buf.extracted_current_role IS NULL OR buf.extracted_current_role = '')
        LIMIT 10
    """, (batch_id,))
    
    records = cur.fetchall()
    print(f"Found {len(records)} records with NULL/empty roles\n")
    
    for i, rec in enumerate(records, 1):
        print(f"{i}. File: {rec['original_filename']}")
        print(f"   Name: {rec['name']}")
        print(f"   Years: {rec['years']}")
        print(f"   Extracted Role: {rec['extracted_role']}")
        try:
            import json
            if rec['raw_parsed_data']:
                data = json.loads(rec['raw_parsed_data'])
                exp_history = data.get('experience_history', [])
                if exp_history:
                    print(f"   Experience History: {len(exp_history)} entries")
                    for exp in exp_history[:2]:
                        print(f"     - {exp.get('position', 'N/A')} @ {exp.get('company', 'N/A')}")
                else:
                    print(f"   Experience History: Empty")
        except:
            pass
        print()
    
    # Get records where role IS extracted
    print("\n2. RECORDS WITH SUCCESSFULLY EXTRACTED ROLES (Examples)")
    print("-" * 100)
    cur.execute("""
        SELECT DISTINCT
            buf.extracted_name as name,
            buf.extracted_current_role as role,
            buf.extracted_years_experience as years
        FROM bulk_upload_files buf
        WHERE buf.bulk_upload_id = %s
        AND buf.parsing_status = 'parsed'
        AND buf.extracted_current_role IS NOT NULL AND buf.extracted_current_role != ''
        LIMIT 10
    """, (batch_id,))
    
    records = cur.fetchall()
    print(f"Found {len(records)} records with valid roles\n")
    
    for i, rec in enumerate(records, 1):
        print(f"{i}. {rec['name']:<30} | Role: {rec['role']:<30} | Years: {rec['years']}")
    
    # Summary statistics
    print("\n3. ROLE EXTRACTION SUMMARY")
    print("-" * 100)
    cur.execute("""
        SELECT 
            COUNT(*) as total,
            COUNT(extracted_current_role) FILTER (WHERE extracted_current_role IS NOT NULL AND extracted_current_role != '') as has_role,
            COUNT(extracted_current_role) FILTER (WHERE extracted_current_role IS NULL OR extracted_current_role = '') as missing_role
        FROM bulk_upload_files
        WHERE bulk_upload_id = %s AND parsing_status = 'parsed'
    """, (batch_id,))
    
    summary = cur.fetchone()
    total = summary['total']
    has_role = summary['has_role']
    missing_role = summary['missing_role']
    
    print(f"Total Parsed Files: {total}")
    print(f"With Role Extracted: {has_role} ({100*has_role/total if total > 0 else 0:.1f}%)")
    print(f"Without Role (Missing): {missing_role} ({100*missing_role/total if total > 0 else 0:.1f}%)")
    print(f"\n>>> ROLE EXTRACTION SUCCESS RATE: {100*has_role/total if total > 0 else 0:.1f}%")
    
    print("\n" + "=" * 100)
    
    cur.close()
    conn.close()

if __name__ == '__main__':
    analyze()
