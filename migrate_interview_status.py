import psycopg2
import sys

conn_params = {
    'host': 'techsalesaxis-db.c34g4umwou6k.ap-south-1.rds.amazonaws.com',
    'database': 'postgres',
    'user': 'postgres',
    'password': 'tX6v2KraCehQkZR',
    'port': 5432
}

try:
    print("Connecting to AWS RDS database...")
    conn = psycopg2.connect(**conn_params)
    conn.autocommit = True
    cursor = conn.cursor()
    
    print("Adding 'not_conducted' and 'no_show' to interview_status enum...")
    
    # We must use IF NOT EXISTS or handle the error if it already exists
    # ALTER TYPE ADD VALUE IF NOT EXISTS is supported in PG 10+
    try:
        cursor.execute("ALTER TYPE interview_status ADD VALUE IF NOT EXISTS 'not_conducted';")
        print("OK: 'not_conducted' added successfully or already exists")
    except psycopg2.Error as e:
        print(f"Info/Warning adding not_conducted: {e}")
        
    try:
        cursor.execute("ALTER TYPE interview_status ADD VALUE IF NOT EXISTS 'no_show';")
        print("OK: 'no_show' added successfully or already exists")
    except psycopg2.Error as e:
        print(f"Info/Warning adding no_show: {e}")
        
    cursor.close()
    conn.close()
    print("OK: Migration completed and connection closed.")
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
