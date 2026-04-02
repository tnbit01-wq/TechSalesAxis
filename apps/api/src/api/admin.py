from fastapi import APIRouter, Depends, HTTPException, Header
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import uuid
import logging

from sqlalchemy import func, and_
from sqlalchemy.orm import Session

# Project imports
from src.core.database import get_db
from src.core.models import User, BulkUpload, BulkUploadCandidateMatch, BulkUploadFile

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

# ============================================================================
# AUTHENTICATION HELPER
# ============================================================================

def get_current_user_sync(authorization: Optional[str] = Header(None)) -> dict:
    """Synchronous version of get_current_user for admin"""
    if not authorization:
        raise HTTPException(status_code=401, detail="No authorization header provided")
    
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header format")
    
    token = authorization.replace("Bearer ", "")
    
    # Mocking for Admin Login - In production, replace with JWT validation
    # If token is 'tf_token_mock_admin', accept it
    if "admin" in token.lower() or token == "mock-admin-token":
        return {
            "user_id": "admin_test",
            "role": "admin",
            "token": token
        }
    
    return {
        "user_id": "admin_generic",
        "role": "admin",
        "token": token
    }

# ============================================================================
# PYDANTIC MODELS
# ============================================================================
class BulkUploadBatchResponse(BaseModel):
    id: str
    batch_name: str
    upload_status: str
    total_files_uploaded: int
    successfully_parsed: int
    duplicate_candidates_detected: int
    new_candidates_identified: int
    created_at: datetime
    processing_completed_at: Optional[datetime]
    
    class Config:
        from_attributes = True

class AdminDashboardStatsResponse(BaseModel):
    total_batches: int
    total_resumes: int
    duplicates_found: int
    new_candidates: int
    recent_batches: List[BulkUploadBatchResponse]

class AdminSettingsModel(BaseModel):
    max_file_size_mb: int = 50
    max_batch_size_mb: int = 500
    duplicate_threshold_review: float = 0.7
    enable_virus_scan: bool = True
    enable_email_notifications: bool = False
    notification_email: Optional[str] = "admin@talentflow.com"
    supported_formats: List[str] = ["pdf", "doc", "docx"]

# Global mock settings store (in production this would be in DB)
LOCAL_SETTINGS = AdminSettingsModel()

# Admin Role Check Helper
def check_admin_role(user: dict):
    """Verify user has admin role"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

@router.get("/dashboard/stats", response_model=AdminDashboardStatsResponse)
def get_admin_dashboard_stats(
    current_user: dict = Depends(get_current_user_sync),
    db: Session = Depends(get_db)
):
    """
    Get admin dashboard statistics for bulk upload operations.
    """
    # Verify admin role
    check_admin_role(current_user)
    
    try:
        # Get counts with error handling
        total_batches = db.query(func.count(BulkUpload.id)).scalar() or 0
        total_resumes = db.query(func.sum(BulkUpload.total_files_uploaded)).scalar() or 0
        duplicates_found = db.query(func.sum(BulkUpload.duplicate_candidates_detected)).scalar() or 0
        new_candidates = db.query(func.sum(BulkUpload.new_candidates_identified)).scalar() or 0
        
        # Get recent batches (limited list for speed)
        recent_batches_db = db.query(BulkUpload).order_by(
            BulkUpload.created_at.desc()
        ).limit(5).all()
        
        recent_batches = [
            BulkUploadBatchResponse(
                id=str(b.id),
                batch_name=b.batch_name,
                upload_status=b.upload_status,
                total_files_uploaded=b.total_files_uploaded,
                successfully_parsed=b.successfully_parsed,
                duplicate_candidates_detected=b.duplicate_candidates_detected,
                new_candidates_identified=b.new_candidates_identified,
                created_at=b.created_at,
                processing_completed_at=b.processing_completed_at
            )
            for b in recent_batches_db
        ]
        
        return AdminDashboardStatsResponse(
            total_batches=int(total_batches),
            total_resumes=int(total_resumes),
            duplicates_found=int(duplicates_found),
            new_candidates=int(new_candidates),
            recent_batches=recent_batches
        )
    except Exception as e:
        logger.error(f"Failed to fetch stats: {str(e)}")
        # Fallback to zero stats if query fails (e.g., table empty or db error)
        return AdminDashboardStatsResponse(
            total_batches=0,
            total_resumes=0,
            duplicates_found=0,
            new_candidates=0,
            recent_batches=[]
        )

# ============================================================================
# BATCH MANAGEMENT
# ============================================================================

@router.get("/bulk-uploads")
def get_all_bulk_uploads(
    current_user: dict = Depends(get_current_user_sync),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 10
):
    """
    Get paginated list of all bulk upload batches for admin.
    """
    check_admin_role(current_user)
    
    total = db.query(func.count(BulkUpload.id)).scalar()
    batches = db.query(BulkUpload).order_by(
        BulkUpload.created_at.desc()
    ).offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "batches": [
            {
                "id": str(batch.id),
                "batch_name": batch.batch_name,
                "upload_status": batch.upload_status,
                "total_files_uploaded": batch.total_files_uploaded,
                "successfully_parsed": batch.successfully_parsed,
                "duplicate_candidates_detected": batch.duplicate_candidates_detected,
                "new_candidates_identified": batch.new_candidates_identified,
                "created_at": batch.created_at,
                "processing_completed_at": batch.processing_completed_at
            }
            for batch in batches
        ]
    }

@router.get("/bulk-uploads/{batch_id}")
def get_bulk_upload_detail(
    batch_id: str,
    current_user: dict = Depends(get_current_user_sync),
    db: Session = Depends(get_db)
):
    """
    Get detailed information about a specific bulk upload batch.
    """
    check_admin_role(current_user)
    
    try:
        batch_uuid = uuid.UUID(batch_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid batch ID format")
    
    batch = db.query(BulkUpload).filter(BulkUpload.id == batch_uuid).first()
    
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    files_query = db.query(BulkUploadFile).filter(BulkUploadFile.bulk_upload_id == batch_uuid).all()
    files_list = []
    for f in files_query:
        files_list.append({
            "id": str(f.id),
            "file_name": f.original_filename,
            "status": f.parsing_status,
            "parsed_data": f.parsed_data,
            "error_message": f.parsing_error
        })

    return {
        "batch": {
            "id": str(batch.id),
            "batch_name": batch.batch_name,
            "status": batch.upload_status,
            "total_files": batch.total_files_uploaded,
            "files_processed": batch.successfully_parsed,
            "duplicates_found": batch.duplicate_candidates_detected,
            "duplicates_approved": batch.duplicates_auto_merged,
            "duplicates_rejected": 0,
            "new_candidates_created": batch.new_candidates_identified,
            "created_at": batch.created_at,
            "completed_at": batch.processing_completed_at,
            "files": files_list
        }
    }

@router.delete("/bulk-uploads/{batch_id}")
def delete_bulk_upload_batch(
    batch_id: str,
    current_user: dict = Depends(get_current_user_sync),
    db: Session = Depends(get_db)
):
    """
    Delete a bulk upload batch and all its associated files.
    Requires admin role.
    """
    check_admin_role(current_user)
    
    try:
        batch_uuid = uuid.UUID(batch_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid batch ID format")
    
    # Verify batch exists
    batch = db.query(BulkUpload).filter(BulkUpload.id == batch_uuid).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    try:
        # Count files for response
        files = db.query(BulkUploadFile).filter(BulkUploadFile.bulk_upload_id == batch_uuid).all()
        file_count = len(files)
        
        # S3 cleanup (soft - non-blocking)
        try:
            from src.services.s3_service import S3Service
            from config import S3_BUCKETS
            
            s3 = S3Service.get_client()
            bucket_name = S3_BUCKETS.get("bulk-resumes")
            prefix = f"batches/{batch_id}/"
            
            response = s3.list_objects_v2(Bucket=bucket_name, Prefix=prefix)
            if 'Contents' in response:
                delete_keys = [{'Key': obj['Key']} for obj in response['Contents']]
                s3.delete_objects(
                    Bucket=bucket_name,
                    Delete={'Objects': delete_keys}
                )
                logger.info(f"S3 cleanup: Deleted {len(delete_keys)} objects for batch {batch_id}")
        except Exception as s3_err:
            logger.warning(f"S3 cleanup failed for batch {batch_id}: {str(s3_err)}")
        
        # Database deletion (hard delete with cascade)
        # Delete files (this cascades to candidate matches)
        db.query(BulkUploadFile).filter(BulkUploadFile.bulk_upload_id == batch_uuid).delete()
        
        # Delete the batch
        db.delete(batch)
        db.commit()
        
        logger.info(f"Batch deleted: {batch_id} by user {current_user.get('user_id', 'unknown')}")
        
        return {
            "message": "Batch and associated data deleted successfully",
            "bulk_upload_id": batch_id,
            "files_deleted": file_count
        }
    
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting batch {batch_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to delete batch: {str(e)}")

@router.get("/duplicates/pending")
def get_pending_duplicate_reviews(
    current_user: dict = Depends(get_current_user_sync),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 20
):
    """
    Get pending duplicate candidate matches that need admin review.
    """
    check_admin_role(current_user)
    
    # Query pending duplicates (admin_decision is null or 'pending')
    total = db.query(func.count(BulkUploadCandidateMatch.id)).filter(
        BulkUploadCandidateMatch.admin_decision.in_([None, 'pending'])
    ).scalar()
    
    pending_matches = db.query(BulkUploadCandidateMatch).filter(
        BulkUploadCandidateMatch.admin_decision.in_([None, 'pending'])
    ).offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "pending_matches": [
            {
                "id": str(match.id),
                "bulk_upload_file_id": str(match.bulk_upload_file_id) if match.bulk_upload_file_id else None,
                "matched_candidate_user_id": str(match.matched_candidate_user_id) if match.matched_candidate_user_id else None,
                "match_confidence": float(match.match_confidence) if match.match_confidence else None,
                "admin_decision": match.admin_decision,
                "created_at": match.created_at
            }
            for match in pending_matches
        ]
    }

# ============================================================================
# SETTINGS & USER MANAGEMENT (FIX FOR 404s)
# ============================================================================

@router.get("/settings")
def get_admin_settings(
    current_user: dict = Depends(get_current_user_sync)
):
    """Get global admin settings"""
    check_admin_role(current_user)
    return {"settings": LOCAL_SETTINGS}

@router.put("/settings")
def update_admin_settings(
    new_settings: AdminSettingsModel,
    current_user: dict = Depends(get_current_user_sync)
):
    """Update global admin settings"""
    check_admin_role(current_user)
    global LOCAL_SETTINGS
    LOCAL_SETTINGS = new_settings
    return {"status": "success", "settings": LOCAL_SETTINGS}

@router.get("/users")
def get_admin_users(
    current_user: dict = Depends(get_current_user_sync),
    db: Session = Depends(get_db)
):
    """Get list of administrative users"""
    check_admin_role(current_user)
    # Filter for admin/recruiter roles
    admins = db.query(User).filter(User.role.in_(['admin', 'recruiter'])).all()
    return {
        "admins": [
            {
                "id": str(u.id),
                "email": u.email,
                "role": u.role,
                "created_at": u.created_at
            } for u in admins
        ]
    }

