from .config import DATABASE_URL
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

# AWS RDS (SQLAlchemy) Configuration
if not DATABASE_URL:
    print("FATAL: DATABASE_URL not set.")
    # Fallback to prevent startup crash if testing or mock run
    DATABASE_URL_VAL = "postgresql://postgres:postgres@localhost:5432/postgres"
else:
    DATABASE_URL_VAL = DATABASE_URL

db_engine = create_engine(
    DATABASE_URL_VAL, 
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20
)

# Create a session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)

# Base class for models (optional if using pure SQL)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
