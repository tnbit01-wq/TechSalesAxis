import sys
sys.path.insert(0, '/apps/api/src')

from core.database import SessionLocal, db_engine
from core.models import User

# Create table
User.__table__.create(db_engine, checkfirst=True)
print("✓ User table initialized")

# Test if full_name column exists
db = SessionLocal()
try:
    # Try to query all columns
    from sqlalchemy import inspect
    mapper = inspect(User)
    columns = [c.name for c in mapper.columns]
    print(f"✓ User table columns: {columns}")
    
    if 'full_name' in columns:
        print("✓ full_name column exists")
    else:
        print("✗ full_name column missing")
        # Add it
        from sqlalchemy import text
        db.execute(text("""
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS full_name TEXT;
        """))
        db.commit()
        print("✓ Added full_name column")
finally:
    db.close()
