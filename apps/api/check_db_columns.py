import sys
sys.path.insert(0, '.')

from sqlalchemy import inspect, text
from src.core.database import engine

print('=' * 80)
print('CHECKING CAREER READINESS COLUMNS AND TABLE')
print('=' * 80)

target_columns = [
    'job_search_mode',
    'notice_period_days',
    'availability_date',
    'career_readiness_timestamp',
    'career_readiness_metadata',
    'willing_to_relocate'
]

try:
    inspector = inspect(engine)
    all_tables = inspector.get_table_names()
    print(f'\n? Connected to database')
    print(f'? Found {len(all_tables)} tables')
    
    print(f'\n--- CHECKING: candidate_profiles table ---')
    if 'candidate_profiles' in all_tables:
        print('? Table exists')
        
        columns = inspector.get_columns('candidate_profiles')
        existing_column_names = {col['name'] for col in columns}
        
        print(f'\nColumn Status:')
        print('-' * 60)
        for col_name in target_columns:
            if col_name in existing_column_names:
                col_info = next((c for c in columns if c['name'] == col_name), None)
                if col_info:
                    print(f'  ? {col_name:30} | Type: {col_info["type"]} | Nullable: {col_info["nullable"]}')
            else:
                print(f'  ? {col_name:30} | NOT FOUND')
        
        print(f'\nAll columns in candidate_profiles ({len(columns)} total):')
        print('-' * 60)
        for col in sorted(columns, key=lambda x: x['name']):
            print(f'  - {col["name"]:35} | Type: {col["type"]}')
        
        print(f'\nSample data from target columns:')
        print('-' * 60)
        with engine.connect() as conn:
            available_cols = [c for c in target_columns if c in existing_column_names]
            if available_cols:
                col_list = ', '.join(available_cols)
                query = text(f'SELECT id, {col_list} FROM candidate_profiles LIMIT 3')
                result = conn.execute(query)
                rows = result.fetchall()
                if rows:
                    print(f'Found {len(rows)} rows with data:')
                    for row in rows:
                        print(f'  {row}')
                else:
                    print('No data found in these columns')
            else:
                print('No target columns exist in table')
    else:
        print('? Table does not exist')
    
    print(f'\n--- CHECKING: career_readiness_history table ---')
    if 'career_readiness_history' in all_tables:
        print('? Table EXISTS')
        columns = inspector.get_columns('career_readiness_history')
        print(f'  Columns ({len(columns)} total):')
        for col in columns:
            print(f'    - {col["name"]:35} | Type: {col["type"]}')
        
        with engine.connect() as conn:
            query = text('SELECT COUNT(*) as row_count FROM career_readiness_history')
            result = conn.execute(query)
            count = result.scalar()
            print(f'  Total rows: {count}')
    else:
        print('? Table does NOT exist')
    
    print('\n' + '=' * 80)

except Exception as e:
    print(f'? Error: {type(e).__name__}')
    print(f'  {str(e)}')
    import traceback
    traceback.print_exc()
