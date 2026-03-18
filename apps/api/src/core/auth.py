from fastapi import HTTPException, status
from .auth_utils import decode_access_token
from .database import SessionLocal
from .models import User
import asyncio

async def verify_token(token: str) -> dict:
    """
    Verifies the AWS RDS JWT token and returns standard user payload.
    """
    try:
        if not token:
            raise ValueError("Token is missing")
            
        # Remove 'Bearer ' prefix if present
        if token.startswith("Bearer "):
            token = token[7:]

        payload = decode_access_token(token)
        
        user_id = payload.get("sub")
        email = payload.get("email")
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
            )
        
        # Optionally verify user exists in DB and get latest role
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User no longer exists",
                )
            
            return {
                "sub": str(user.id),
                "email": user.email,
                "role": user.role
            }
        finally:
            db.close()

    except Exception as e:
        print(f"CRITICAL AUTH ERROR: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication token: {str(e)}",
        )
