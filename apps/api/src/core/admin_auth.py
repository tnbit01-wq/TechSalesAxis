"""
ADMIN AUTHENTICATION & AUTHORIZATION
Add to: apps/api/src/core/auth.py (NEW FILE)

Implements admin role checking and permissions for bulk upload feature
"""

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from .database import get_db
from .models import RecruiterProfile, User
import jwt
from .config import JWT_SECRET_KEY, JWT_ALGORITHM

# Exception for unauthorized access
class AdminUnauthorizedException(HTTPException):
    def __init__(self, detail: str = "Admin access required"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail
        )


async def get_current_user_id(token: str) -> str:
    """Extract user ID from JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise ValueError("No user_id in token")
        return user_id
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}"
        )


async def get_current_admin_user(
    token: str,
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Verify user has admin privileges.
    
    Returns admin user data with required fields:
    {
        'user_id': str,
        'email': str,
        'role': str,  # 'admin' or 'super_admin'
        'can_bulk_upload': bool,
        'can_review_duplicates': bool,
        'can_create_accounts': bool
    }
    """
    try:
        # Extract user ID from token
        user_id = await get_current_user_id(token)
        
        # Query recruiter profile to check is_admin flag
        query = select(RecruiterProfile).where(
            RecruiterProfile.user_id == user_id
        )
        result = await db.execute(query)
        recruiter = result.scalar_one_or_none()
        
        if not recruiter:
            raise AdminUnauthorizedException("User is not a recruiter")
        
        if not recruiter.is_admin:
            raise AdminUnauthorizedException("User does not have admin privileges")
        
        # Get user details
        user_query = select(User).where(User.id == user_id)
        user_result = await db.execute(user_query)
        user = user_result.scalar_one_or_none()
        
        if not user:
            raise AdminUnauthorizedException("User not found")
        
        return {
            'user_id': str(user_id),
            'email': user.email,
            'role': recruiter.team_role or 'admin',  # 'admin' or 'recruiter'
            'company_id': str(recruiter.company_id),
            # Permissions (can expand based on role)
            'can_bulk_upload': True,
            'can_review_duplicates': True,
            'can_create_accounts': True,
            'can_export_data': True,
        }
    
    except (AdminUnauthorizedException, HTTPException):
        raise
    except Exception as e:
        raise AdminUnauthorizedException(f"Authentication failed: {str(e)}")


async def require_bulk_upload_permission(
    current_admin: dict = Depends(get_current_admin_user),
) -> dict:
    """
    Middleware: Verify admin has bulk upload permission
    
    Usage in endpoint:
        @router.post("/bulk-upload/initialize")
        async def init(
            request: BulkUploadInitRequest,
            admin: dict = Depends(require_bulk_upload_permission)
        ):
    """
    if not current_admin.get('can_bulk_upload'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No bulk upload permission"
        )
    return current_admin


async def require_duplicate_review_permission(
    current_admin: dict = Depends(get_current_admin_user),
) -> dict:
    """Verify admin can review duplicates"""
    if not current_admin.get('can_review_duplicates'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No duplicate review permission"
        )
    return current_admin


async def require_data_export_permission(
    current_admin: dict = Depends(get_current_admin_user),
) -> dict:
    """Verify admin can export data"""
    if not current_admin.get('can_export_data'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No data export permission"
        )
    return current_admin


# ============================================================================
# HOW TO USE IN ENDPOINTS
# ============================================================================

"""
EXAMPLE 1: Simple dependency
@router.post("/admin/bulk-upload/initialize")
async def initialize_bulk_upload(
    request: BulkUploadInitRequest,
    db: AsyncSession = Depends(get_db),
    current_admin: dict = Depends(get_current_admin_user)  # ← Add this
):
    print(f"Admin {current_admin['email']} initializing upload")
    # ... implementation

EXAMPLE 2: With specific permission
@router.get("/admin/duplicates/review")
async def get_duplicates(
    db: AsyncSession = Depends(get_db),
    admin = Depends(require_duplicate_review_permission)  # ← Specific permission
):
    # Only reaches here if admin has permission
    # ... implementation

EXAMPLE 3: Extract admin info in endpoint
@router.post("/admin/batch/{batch_id}/complete")
async def complete_batch(
    batch_id: str,
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_current_admin_user)
):
    admin_id = admin['user_id']
    admin_email = admin['email']
    admin_company = admin['company_id']
    # ... implementation
"""
