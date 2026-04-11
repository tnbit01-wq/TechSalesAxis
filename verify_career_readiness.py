import psycopg2
from psycopg2.extras import RealDictCursor

# Connection parameters
conn_params = {
    'host': 'techsalesaxis-db.c34g4umwou6k.ap-south-1.rds.amazonaws.com',
    'port': 5432,
    'user': 'postgres',
    'password': 'tX6v2KraCehQkZR',
    'database': 'techsalesaxis'
}

try:
    # Connect to techsalesaxis database
    conn = psycopg2.connect(**conn_params)
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    print("="*80)
    print("QUERY 1: Check if the 6 new columns exist in candidate_profiles table")
    print("="*80)
    
    query1 = """
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_name = 'candidate_profiles' 
      AND column_name IN ('job_search_mode', 'notice_period_days', 'availability_date', 'career_readiness_timestamp', 'career_readiness_metadata', 'willing_to_relocate')
    ORDER BY column_name;
    """
    
    cursor.execute(query1)
    results1 = cursor.fetchall()
    
    if results1:
        print(f"Found {len(results1)} columns:")
        for row in results1:
            print(f"  - {row['column_name']}: {row['data_type']} (nullable: {row['is_nullable']})")
    else:
        print("Migration NOT applied - No career readiness columns found!")
    
    print("\n" + "="*80)
    print("QUERY 2: Check if the career_readiness_history table exists")
    print("="*80)
    
    query2 = """
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name = 'career_readiness_history';
    """
    
    cursor.execute(query2)
    results2 = cursor.fetchall()
    
    if results2:
        print("career_readiness_history table EXISTS")
    else:
        print("career_readiness_history table does NOT exist")
    
    print("\n" + "="*80)
    print("QUERY 3: Check if any data was saved")
    print("="*80)
    
    query3 = """
    SELECT COUNT(*) as total_candidates, 
           COUNT(CASE WHEN job_search_mode IS NOT NULL THEN 1 END) as with_career_readiness
    FROM candidate_profiles;
    """
    
    cursor.execute(query3)
    results3 = cursor.fetchone()
    
    if results3:
        print(f"Total candidates: {results3['total_candidates']}")
        print(f"Candidates with career readiness data: {results3['with_career_readiness']}")
    
    cursor.close()
    conn.close()
    print("\n" + "="*80)
    print("MIGRATION VERIFICATION COMPLETE")
    print("="*80)
    
except Exception as e:
    print(f"Error: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()