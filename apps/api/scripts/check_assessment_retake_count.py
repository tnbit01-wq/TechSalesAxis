from dotenv import load_dotenv
import os
from pathlib import Path
from sqlalchemy import create_engine, text

env_path = Path(__file__).resolve().parents[1] / '.env'
if env_path.exists():
    load_dotenv(env_path)

db_url = os.getenv('DATABASE_URL')
if not db_url:
    print('DATABASE_URL not set')
    raise SystemExit(2)

engine = create_engine(db_url)
with engine.connect() as conn:
    try:
        r = conn.execute(text('SELECT count(*) FROM assessment_retake_eligibility')).fetchone()
        print('assessment_retake_eligibility rows:', r[0])
    except Exception as e:
        print('Error querying assessment_retake_eligibility:', e)
        raise
