import psycopg2
from psycopg2 import sql
import sys

# Connection parameters
conn_params = {
    'host': 'techsalesaxis-db.c34g4umwou6k.ap-south-1.rds.amazonaws.com',
    'database': 'postgres',
    'user': 'postgres',
    'password': 'tX6v2KraCehQkZR',
    'port': 5432
}

try:
    # Connect to the database
    print("Connecting to AWS RDS database...")
    conn = psycopg2.connect(**conn_params)
    conn.autocommit = True
    cursor = conn.cursor()
    
    # Execute ALTER TABLE command
    alter_table_sql = """
    ALTER TABLE public.candidate_profiles 
    ADD COLUMN IF NOT EXISTS notice_period_required_days INTEGER DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS career_readiness_score NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS role_urgency_level VARCHAR DEFAULT 'passive',
    ADD COLUMN IF NOT EXISTS employment_readiness_status VARCHAR DEFAULT 'not_specified',
    ADD COLUMN IF NOT EXISTS job_opportunity_type TEXT[] DEFAULT '{}';
    """
    
    print("Executing ALTER TABLE command...")
    cursor.execute(alter_table_sql)
    print("✓ ALTER TABLE command executed successfully")
    
    # Verify the columns were added
    verify_sql = """
    SELECT column_name, data_type, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'candidate_profiles' 
    ORDER BY ordinal_position;
    """
    
    print("\nVerifying columns...")
    cursor.execute(verify_sql)
    columns = cursor.fetchall()
    
    print("\n" + "="*80)
    print("CANDIDATE_PROFILES TABLE COLUMNS:")
    print("="*80)
    print(f"{'Column Name':<40} {'Data Type':<30} {'Default':<20}")
    print("-"*80)
    
    for col in columns:
        col_name, data_type, default = col
        default_str = str(default) if default else "None"
        print(f"{col_name:<40} {data_type:<30} {default_str:<20}")
    
    # Check specifically for the new columns we added
    new_columns = [
        'notice_period_required_days',
        'career_readiness_score',
        'role_urgency_level',
        'employment_readiness_status',
        'job_opportunity_type'
    ]
    
    print("\n" + "="*80)
    print("NEW COLUMNS VERIFICATION:")
    print("="*80)
    
    existing_cols = [col[0] for col in columns]
    for new_col in new_columns:
        status = "✓ Added" if new_col in existing_cols else "✗ Missing"
        print(f"{new_col:<40} {status}")
    
    cursor.close()
    conn.close()
    print("\n✓ Database connection closed successfully")
    
except psycopg2.Error as e:
    print(f"✗ Database Error: {e}")
    sys.exit(1)
except Exception as e:
    print(f"✗ Error: {e}")
    sys.exit(1)

