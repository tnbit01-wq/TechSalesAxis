import psycopg2

conn = psycopg2.connect(
    host="talentflow-db.cjymcuai297y.ap-southeast-2.rds.amazonaws.com",
    database="talentflow",
    user="postgres",
    password="tX6v2KraCehQkZR"
)
cursor = conn.cursor()

print("RESUME_DATA TABLE COLUMNS:")
cursor.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'resume_data'
    ORDER BY ordinal_position
""")
for col, dtype in cursor.fetchall():
    print(f"  {col}: {dtype}")

cursor.close()
conn.close()
