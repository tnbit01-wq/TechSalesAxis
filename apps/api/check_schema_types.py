
import sys
import os
sys.path.insert(0, os.getcwd())
try:
    from src.core.database import SessionLocal
    from sqlalchemy import text
    db = SessionLocal()
    q = text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'companies'")
    rows = db.execute(q).fetchall()
    for r in rows:
        print(f"COL:{r[0]} TYPE:{r[1]}")
    db.close()
except Exception as e:
    print(f"ERROR: {e}")
