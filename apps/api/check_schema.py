#!/usr/bin/env python3
"""Check actual table schemas"""

import os
import sys
from dotenv import load_dotenv
import psycopg2

load_dotenv()

DB_HOST = os.getenv('DB_HOST')
DB_USER = os.getenv('DB_USER')
DB_PASSWORD = os.getenv('DB_PASSWORD')
DB_NAME = os.getenv('DB_NAME', 'postgres')
DB_PORT = os.getenv('DB_PORT', '5432')

try:
    conn = psycopg2.connect(
        host=DB_HOST, user=DB_USER, password=DB_PASSWORD,
        database=DB_NAME, port=DB_PORT
    )
    cur = conn.cursor()
    
    # Get bulk_uploads columns
    print("BULK_UPLOADS TABLE SCHEMA:")
    cur.execute("""
        SELECT column_name, data_type FROM information_schema.columns
        WHERE table_name = 'bulk_uploads' ORDER BY ordinal_position
    """)
    for row in cur.fetchall():
        print(f"  {row[0]}: {row[1]}")
    
    print("\nBULK_UPLOAD_FILES TABLE SCHEMA:")
    cur.execute("""
        SELECT column_name, data_type FROM information_schema.columns
        WHERE table_name = 'bulk_upload_files' ORDER BY ordinal_position
    """)
    for row in cur.fetchall():
        print(f"  {row[0]}: {row[1]}")
    
    print("\nCANDIDATE_PROFILES TABLE SCHEMA:")
    cur.execute("""
        SELECT column_name, data_type FROM information_schema.columns
        WHERE table_name = 'candidate_profiles' ORDER BY ordinal_position
    """)
    for row in cur.fetchall():
        print(f"  {row[0]}: {row[1]}")
    
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
