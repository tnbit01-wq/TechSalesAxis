import psycopg2, os

conn = psycopg2.connect(os.environ['DATABASE_URL'])
cur = conn.cursor()

tables = [
    'notifications', 'recruiter_profiles', 'candidate_profiles', 'users',
    'jobs', 'applications', 'posts', 'messages', 'interviews', 'chat_messages',
    'companies'
]
for t in tables:
    cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name=%s ORDER BY ordinal_position", (t,))
    cols = [r[0] for r in cur.fetchall()]
    print(f'{t}: {cols}')

conn.close()
