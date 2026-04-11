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
print("CANDIDATE PROFILES TABLE COLUMNS")
print("=" * 100)
cursor.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'candidate_profiles'
    ORDER BY ordinal_position
""")
for col, dtype in cursor.fetchall():
    print(f"  {col}: {dtype}")

print("\n" + "=" * 100)
print("CAREER GPS TABLE COLUMNS")
print("=" * 100)
cursor.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'career_gps'
    ORDER BY ordinal_position
""")
for col, dtype in cursor.fetchall():
    print(f"  {col}: {dtype}")

print("\n" + "=" * 100)
print("JOB APPLICATIONS TABLE COLUMNS (for context)")
print("=" * 100)
cursor.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'job_applications'
    ORDER BY ordinal_position
""")
cols = cursor.fetchall()
for col, dtype in cols[:10]:  # Show first 10
    print(f"  {col}: {dtype}")
if len(cols) > 10:
    print(f"  ... and {len(cols) - 10} more columns")

cursor.close()
conn.close()
