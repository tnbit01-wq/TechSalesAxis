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
    
    # Check schemas
    print("Schemas in database:")
    cursor.execute("""
    SELECT schema_name FROM information_schema.schemata
    WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
    ORDER BY schema_name;
    """)
    schemas = cursor.fetchall()
    for schema in schemas:
        print(f"  - {schema[0]}")
        
        # List tables in each schema
        cursor.execute(f"""
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = '{schema[0]}'
        ORDER BY table_name;
        """)
        tables = cursor.fetchall()
        if tables:
            print(f"    Tables in {schema[0]}:")
            for table in tables:
                print(f"      - {table[0]}")
        else:
            print(f"    (No tables in {schema[0]})")
    
    cursor.close()
    conn.close()
    
except Exception as e:
    print(f"Error: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()