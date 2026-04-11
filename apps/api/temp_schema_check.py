import os
from urllib.parse import urlparse
import psycopg2

DB_URL = os.environ.get('DATABASE_URL', 'postgresql://postgres:tX6v2KraCehQkZR@techsalesaxis-db.c34g4umwou6k.ap-south-1.rds.amazonaws.com:5432/postgres')
parsed = urlparse(DB_URL)
conn = psycopg2.connect(host=parsed.hostname, user=parsed.username, password=parsed.password, database=parsed.path.lstrip('/'), port=parsed.port or 5432)
cursor = conn.cursor()

# Check for any table with experience_band
cursor.execute(`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE column_name LIKE '%experience%band%' OR column_name LIKE '%band%'
    ORDER BY table_name
`)
print('Tables with experience/band columns:')
for row in cursor.fetchall():
    print(f'  {row[0]}.{row[1]}')

# Show some sample experience values
cursor.execute('''
    SELECT DISTINCT experience FROM candidate_profiles LIMIT 10
''')
print('\nSample experience values in candidate_profiles:')
for row in cursor.fetchall():
    print(f'  {row[0]}')

conn.close()
