import psycopg2

# Connection parameters - connect to default postgres database first
conn_params = {
    'host': 'techsalesaxis-db.c34g4umwou6k.ap-south-1.rds.amazonaws.com',
    'port': 5432,
    'user': 'postgres',
    'password': 'tX6v2KraCehQkZR',
    'database': 'postgres'
}

try:
    conn = psycopg2.connect(**conn_params)
    cursor = conn.cursor()
    
    print("Available databases:")
    cursor.execute("SELECT datname FROM pg_database WHERE datistemplate = false;")
    databases = cursor.fetchall()
    for db in databases:
        print(f"  - {db[0]}")
    
    cursor.close()
    conn.close()
    
except Exception as e:
    print(f"Error: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()