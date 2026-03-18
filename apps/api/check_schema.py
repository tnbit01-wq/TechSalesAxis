import psycopg2, os

conn = psycopg2.connect(os.environ['DATABASE_URL'])
cur = conn.cursor()

cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='notifications' ORDER BY ordinal_position")
print('notifications columns:', [r[0] for r in cur.fetchall()])

cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='recruiter_profiles' ORDER BY ordinal_position")
print('recruiter_profiles columns:', [r[0] for r in cur.fetchall()])

conn.close()
