from fastapi import Depends, Header, HTTPException, status
from src.core.aws_dependencies import get_current_user as get_aws_user
from src.core.database import SessionLocal

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def get_current_user(
    authorization: str = Header(...)
) -> dict:
    """Legacy wrapper that now points to AWS Auth."""
    return await get_aws_user(authorization)
