from fastapi import Depends, Header, HTTPException, status
from src.core.auth_utils import decode_access_token
from src.core.database import SessionLocal
from src.core.models import User
import logging

logger = logging.getLogger(__name__)

async def get_current_user(
    authorization: str = Header(...)
) -> dict:
    """Validate JWT and retrieve user from RDS."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Invalid authentication header"
        )

    token = authorization.split(" ")[1]
    
    try:
        # 1. Decode token
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        email = payload.get("email")
        purpose = payload.get("purpose")  # Extract purpose if it exists (e.g., "password_setup")
        
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload"
            )
        
        # 2. Check user in RDS
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User no longer exists in AWS"
                )
            
            # Build response - include purpose if it was in the token
            result = {
                "sub": str(user.id),
                "email": user.email,
                "role": user.role
            }
            if purpose:
                result["purpose"] = purpose
            
            return result
        finally:
            db.close()

    except Exception as e:
        logger.error(f"AUTH ERROR: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Forbidden: Could not validate credentials"
        )
