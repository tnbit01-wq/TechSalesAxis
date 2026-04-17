import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

# Connect to database
conn = psycopg2.connect(
    host="talentflow-db.c5jrkmltwwks.ap-south-1.rds.amazonaws.com",
    user="postgres",
    password="postgres123",
    database="talentflow_db"
)
conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
cursor = conn.cursor()

try:
    # Add full_name column if it doesn't exist
    cursor.execute("""
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS full_name TEXT;
    """)
    print("✓ full_name column added/verified")
    
    # Verify the column exists
    cursor.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'full_name';
    """)
    result = cursor.fetchone()
    if result:
        print("✓ Column verified in database")
    else:
        print("✗ Column not found after migration")
        
except Exception as e:
    print(f"✗ Error: {e}")
finally:
    cursor.close()
    conn.close()
