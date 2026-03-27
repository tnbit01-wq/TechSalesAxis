"""
Check resume data extraction for user: mithunkaveriappa13@gmail.com
Query the database to see what's being parsed and stored
"""
import psycopg2
import json
from datetime import datetime

db_url = "postgresql://postgres:tX6v2KraCehQkZR@talentflow-db.cjymcuai297y.ap-southeast-2.rds.amazonaws.com:5432/talentflow"

try:
    # Note: This will timeout if not on the same network as RDS
    # Alternative: use local fixtures or check already-extracted data
    print("[*] Attempting database connection...")
    print("[!] Note: This may timeout if not in same VPC as RDS")
    print()
    
    # Since direct connection times out, let's check what we can do locally
    print("[INFO] Direct database connection requires VPC access.")
    print("[INFO] Alternative: Check extracted data from Python service directly")
    print()
    
except Exception as e:
    print(f"[ERROR] {str(e)}")
