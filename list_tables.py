import psycopg2

conn_params = {
    'host': 'techsalesaxis-db.c34g4umwou6k.ap-south-1.rds.amazonaws.com',
    'port': 5432,
    'user': 'postgres',
    'password': 'tX6v2KraCehQkZR',
    'database': 'techsalesaxis'
}

try:
    conn = psycopg2.connect(**conn_params)
    cursor = conn.cursor()
    
    print("Tables in techsalesaxis database:")
    cursor.execute("""
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name;
    """)
    tables = cursor.fetchall()
    for table in tables:
        print(f"  - {table[0]}")
    
    cursor.close()
    conn.close()
    
except Exception as e:
    print(f"Error: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()