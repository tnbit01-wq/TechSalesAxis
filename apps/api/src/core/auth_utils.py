from datetime import datetime, timedelta
from typing import Optional, Union
from jose import JWTError, jwt
from fastapi import HTTPException, status
from src.core.config import JWT_SECRET, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
import logging
import bcrypt

logger = logging.getLogger(__name__)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a hash."""
    if not hashed_password or not plain_password:
        return False
    try:
        # bcrypt.checkpw expects bytes
        password_bytes = plain_password.encode('utf-8')
        # Some older hashes might need to be encoded if they are strings
        hashed_bytes = hashed_password.encode('utf-8') if isinstance(hashed_password, str) else hashed_password
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception as e:
        logger.error(f"Password verification error: {e}")
        return False

def get_password_hash(password: str) -> str:
    """Hash a password for storage."""
    # bcrypt expects bytes
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Generate a JWT for a user."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> dict:
    """Verify and decode a JWT."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
