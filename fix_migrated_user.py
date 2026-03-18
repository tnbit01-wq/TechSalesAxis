
import os
from sqlalchemy import create_engine, text

def fix_user():
    db_url = "postgresql://postgres:tX6v2KraCehQkZR@talentflow-db.cjymcuai297y.ap-southeast-2.rds.amazonaws.com:5432/talentflow"
    engine = create_engine(db_url)
    with engine.connect() as conn:
        conn.execute(text("UPDATE users SET is_verified = TRUE WHERE is_verified = FALSE"))
        conn.commit()
        print("Successfully verified all existing users in the database.")

if __name__ == '__main__':
    fix_user()
