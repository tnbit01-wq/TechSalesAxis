import psycopg2

# Database connection parameters
conn_params = {
    'host': 'techsalesaxis-db.c34g4umwou6k.ap-south-1.rds.amazonaws.com',
    'database': 'postgres',
    'user': 'postgres',
    'password': 'tX6v2KraCehQkZR',
    'port': 5432
}

try:
    # Connect to the database
    conn = psycopg2.connect(**conn_params)
    cursor = conn.cursor()
    print('Connected to AWS RDS database successfully')
    
    # Run the ALTER TABLE command
    alter_sql = """
    ALTER TABLE public.assessment_sessions 
    ADD COLUMN IF NOT EXISTS queue_priority VARCHAR DEFAULT 'standard',
    ADD COLUMN IF NOT EXISTS queue_priority_reason TEXT,
    ADD COLUMN IF NOT EXISTS expected_completion_sla TIMESTAMP;
    """
    
    cursor.execute(alter_sql)
    conn.commit()
    print('ALTER TABLE command executed successfully')
    
    # Verify the columns were added
    verify_sql = """
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'assessment_sessions' 
    ORDER BY ordinal_position;
    """
    
    cursor.execute(verify_sql)
    columns = cursor.fetchall()
    
    print('\nColumn verification results:')
    print('-' * 60)
    for col_name, data_type in columns:
        print(f'{col_name:<40} | {data_type}')
    
    # Check for the new columns specifically
    print('\nNew columns status:')
    print('-' * 60)
    new_columns = {'queue_priority', 'queue_priority_reason', 'expected_completion_sla'}
    existing_new_cols = [col[0] for col in columns if col[0] in new_columns]
    
    for col in sorted(new_columns):
        status = 'ADDED' if col in existing_new_cols else 'NOT FOUND'
        print(f'{col:<40} {status}')
    
    cursor.close()
    conn.close()
    print('\nDatabase connection closed successfully')
    
except psycopg2.Error as e:
    print(f'Database error: {e}')
except Exception as e:
    print(f'Error: {e}')
