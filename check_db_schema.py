import psycopg2

conn = psycopg2.connect(
    host="talentflow-db.cjymcuai297y.ap-southeast-2.rds.amazonaws.com",
    database="talentflow",
    user="postgres",
    password="tX6v2KraCehQkZR"
)
cursor = conn.cursor()

# Get all tables
cursor.execute("""
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name
""")

tables = cursor.fetchall()
print("AVAILABLE TABLES IN DATABASE:")
print("=" * 50)
for (table_name,) in tables:
    print(f"  • {table_name}")

print("\n" + "=" * 50)
print("USERS TABLE COLUMNS:")
cursor.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'users'
    ORDER BY ordinal_position
""")
for col, dtype in cursor.fetchall():
    print(f"  {col}: {dtype}")

cursor.close()
conn.close()
