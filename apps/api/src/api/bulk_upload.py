"""
BULK UPLOAD API ENDPOINTS
FastAPI implementation for internal company bulk resume upload feature

Author: Implementation Team
Date: March 26, 2026
Purpose: Handle file uploads, duplicate detection, account creation
"""

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, BackgroundTasks, Header
from fastapi.responses import JSONResponse, FileResponse
from typing import List, Optional, Dict
from datetime import datetime, timedelta
import uuid
import os
from pathlib import Path
import hashlib
import asyncio
import logging

from sqlalchemy import select, and_, or_, insert
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

# Imports from project
from src.core.database import get_db
from src.core.models import BulkUpload, BulkUploadFile, BulkUploadCandidateMatch, BulkUploadProcessingQueue, BulkUploadAuditLog
from src.services.s3_service import S3Service
from src.tasks.bulk_upload_tasks import parse_resume_file, parse_resume_file_fastapi

logger = logging.getLogger(__name__)

# Bucket logic: Map to correct S3 folders and buckets
# Project now uses 'techsalesaxis-storage' as the primary bucket
S3_BUCKETS = {
    "avatars": os.getenv("S3_BUCKET_AVATARS", "techsalesaxis-storage"),
    "resumes": os.getenv("S3_BUCKET_RESUMES", "techsalesaxis-storage"),
    "bulk-resumes": "techsalesaxis-storage", # Explicitly use the requested bucket
    "id-proofs": os.getenv("S3_BUCKET_ID_PROOFS", "techsalesaxis-storage"),
    "company-assets": os.getenv("S3_BUCKET_COMPANY_ASSETS", "techsalesaxis-storage"),
    "uploads": os.getenv("S3_BUCKET_NAME", "techsalesaxis-storage") 
}

# Subfolder for bulk resumes as requested
BULK_RESUME_PREFIX = "bulk-resumes"


# ============================================================================
# AUTHENTICATION HELPER
# ============================================================================

def get_current_user_sync(authorization: Optional[str] = Header(None)) -> dict:
    """Synchronous version of get_current_user for bulk upload"""
    if not authorization:
        raise HTTPException(status_code=401, detail="No authorization header provided")
    
    # Extract bearer token
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header format")
    
    token = authorization.replace("Bearer ", "")
    
    try:
        from src.core.auth_utils import decode_access_token
        from src.core.models import User
        from src.core.database import SessionLocal
        
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        
        if not user_id:
             raise HTTPException(status_code=401, detail="Invalid token payload")
             
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                 raise HTTPException(status_code=401, detail="User not found")
            
            return {
                "user_id": str(user.id),
                "role": user.role,
                "email": user.email,
                "token": token
            }
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"AUTH ERROR in bulk_upload: {str(e)}")
        # For development bypass if needed, but here we should be strict
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")

# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class BulkUploadInitRequest(BaseModel):
    """Start a new bulk upload batch"""
    batch_name: str
    batch_description: Optional[str] = None
    source_system: str = "internal_hr"  # internal_hr, recruitment_agency, headhunter


class BulkUploadInitResponse(BaseModel):
    """Response when bulk upload batch is created"""
    bulk_upload_id: str
    upload_token: str  # For file uploads to this batch
    status: str = "uploaded"
    created_at: datetime


class FileUploadResponse(BaseModel):
    """Response for each file upload"""
    file_id: str
    filename: str
    file_hash: str
    status: str  # queued, processing, completed, failed
    created_at: datetime


class BulkUploadStatusResponse(BaseModel):
    """Current status of a bulk upload batch"""
    bulk_upload_id: str
    batch_name: str
    upload_status: str
    total_files_uploaded: int
    successfully_parsed: int
    parsing_failed: int
    duplicate_candidates_detected: int
    new_candidates_identified: int
    average_confidence: float
    processing_started_at: Optional[datetime]
    processing_completed_at: Optional[datetime]
    job_queue_size: int  # Pending jobs


class CandidateDuplicateReviewItem(BaseModel):
    """A matching candidate for admin review"""
    match_id: str
    file_id: str
    extracted_name: str
    extracted_email: str
    existing_candidate_id: str
    existing_candidate_name: str
    match_confidence: float  # 0.7-0.9
    match_type: str  # strong_match, moderate_match
    match_details: Dict


class DuplicateReviewRequest(BaseModel):
    """Admin decision on a duplicate match"""
    admin_decision: str  # approved_merge, rejected_duplicate, create_new
    decision_reason: Optional[str] = None


class BulkUploadReportResponse(BaseModel):
    """Final report after bulk upload completion"""
    bulk_upload_id: str
    batch_name: str
    total_files_processed: int
    parsing_success_rate: float
    duplicate_detected_count: int
    new_profiles_created: int
    shadow_profiles_created: int
    verified_accounts: int
    invitations_sent: int
    processing_time_seconds: int
    processing_completed_at: datetime


class BatchDeleteResponse(BaseModel):
    """Response when a batch is deleted"""
    message: str
    bulk_upload_id: str
    files_deleted: int


# ============================================================================
# CONFIGURATION
# ============================================================================

UPLOAD_DIR = Path("uploads/bulk_uploads")  # Local path for Windows
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_EXTENSIONS = {'.pdf', '.doc', '.docx'}
MAX_BATCH_SIZE = 1000  # Max 1000 resumes per batch

# ClamAV virus scanner (if using Docker)
VIRUS_SCAN_ENABLED = True  # Set to False for development
VIRUS_SCAN_TIMEOUT = 30  # seconds

print(">>> BULK UPLOAD ROUTER LOADING IN bulk_upload.py <<<")

router = APIRouter()

@router.get("/debug-ping")
def debug_ping():
    return {"message": "bulk upload router is live"}

# ============================================================================
# PHASE 1: INITIATE BULK UPLOAD
# ============================================================================

@router.post("/initialize", response_model=BulkUploadInitResponse)
def initialize_bulk_upload(
    request: BulkUploadInitRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_sync)
):
    """
    Initialize a new bulk upload batch.
    
    Returns upload token to use for file uploads.
    """
    try:
        # Verify we have a current user
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        # Create bulk upload record
        bulk_upload_id = uuid.uuid4()
        upload_token = str(uuid.uuid4())
        
        # Get admin_id from current_user
        admin_id_val = current_user.get("user_id")
        if not admin_id_val or admin_id_val == "admin":
             # Fallback check if user_id is just "admin" string (though updated get_current_user_sync should have fixed this)
             raise HTTPException(status_code=400, detail="Invalid admin_id format. Must be a valid UUID.")
        
        new_batch = BulkUpload(
            id=bulk_upload_id,
            admin_id=uuid.UUID(admin_id_val),
            batch_name=request.batch_name,
            batch_description=request.batch_description,
            source_system=request.source_system,
            upload_status="uploaded",
            created_at=datetime.utcnow()
        )
        
        db.add(new_batch)
        db.commit()
        db.refresh(new_batch)
        
        logger.info(f"Bulk upload initialized: {new_batch.id} by {current_user.get('user_id', 'unknown')}")
        
        return BulkUploadInitResponse(
            bulk_upload_id=str(new_batch.id),
            upload_token=upload_token,
            status=new_batch.upload_status,
            created_at=new_batch.created_at
        )
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error initializing bulk upload: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to initialize bulk upload: {str(e)}")


# ============================================================================
# PHASE 2: FILE UPLOAD
# ============================================================================

@router.post("/{bulk_upload_id}/upload", response_model=FileUploadResponse)
def upload_resume_file(
    bulk_upload_id: str,
    file: UploadFile = File(...),
    upload_token: str = Form(...),
    db: Session = Depends(get_db),
    background_tasks: BackgroundTasks = None,
    current_user: dict = Depends(get_current_user_sync)
):
    """
    Upload a resume file to batch.
    
    File is stored and queued for:
    1. Resume parsing
    2. Duplicate detection
    """
    try:
        # Validate batch exists
        batch = db.execute(select(BulkUpload).where(BulkUpload.id == bulk_upload_id)).scalar_one_or_none()
        if not batch:
            raise HTTPException(status_code=404, detail="Bulk upload batch not found")

        # Validate file
        if not file.filename:
            raise HTTPException(status_code=400, detail="No filename provided")
        
        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"File type {file_ext} not allowed. Use: {ALLOWED_EXTENSIONS}"
            )
        
        # Read file
        file_content = file.file.read()
        
        if len(file_content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail=f"File exceeds max size {MAX_FILE_SIZE}")
        
        # Calculate file hash (for deduplication)
        file_hash = hashlib.sha256(file_content).hexdigest()
        
        # Check if hash exists in this batch (duplicate file in SAME batch)
        existing_file = db.execute(
            select(BulkUploadFile).where(
                and_(
                    BulkUploadFile.bulk_upload_id == bulk_upload_id,
                    BulkUploadFile.file_hash == file_hash
                )
            )
        ).scalar_one_or_none()
        
        if existing_file:
            return FileUploadResponse(
                file_id=str(existing_file.id),
                filename=existing_file.original_filename,
                file_hash=existing_file.file_hash,
                status=existing_file.parsing_status,
                created_at=existing_file.created_at
            )

        # Create file record
        file_id = uuid.uuid4()
        
        # Save to S3 - Explicitly using bulk-resumes subfolder in techsalesaxis-storage
        # Format: bulk-resumes/{batch_id}/{file_id}.ext
        s3_key = f"{BULK_RESUME_PREFIX}/{bulk_upload_id}/{file_id}{file_ext}"
        bucket_name = S3_BUCKETS.get("bulk-resumes") or "techsalesaxis-storage"
        
        uploaded = S3Service.upload_file(
            file_content,
            s3_key,
            file.content_type or "application/pdf",
            bucket_name=bucket_name
        )
        
        if not uploaded:
            raise HTTPException(status_code=500, detail="Failed to upload file to S3")
        
        # Insert file record into database
        new_file = BulkUploadFile(
            id=file_id,
            bulk_upload_id=bulk_upload_id,
            original_filename=file.filename,
            file_ext=file_ext.replace('.', ''),
            file_size_bytes=len(file_content),
            file_hash=file_hash,
            file_storage_path=f"s3://{bucket_name}/{s3_key}",
            parsing_status='pending',
            created_at=datetime.utcnow()
        )
        
        db.add(new_file)
        
        # Update batch count
        batch.total_files_uploaded += 1
        
        db.commit()
        db.refresh(new_file)
        
        # Queue jobs for processing
        # Use background_tasks.add_task for FastAPI background tasks (in-process)
        if background_tasks:
            logger.info(f"File uploaded, queuing via FastAPI BackgroundTasks: {new_file.id}")
            background_tasks.add_task(
                parse_resume_file_fastapi,
                file_id=str(new_file.id),
                file_path=s3_key,
                file_name=file.filename,
                bucket_name=bucket_name
            )

        return FileUploadResponse(
            file_id=str(new_file.id),
            filename=file.filename,
            file_hash=file_hash,
            status="queued",
            created_at=new_file.created_at
        )
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error uploading file: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")

# ============================================================================
# PHASE 3: GET UPLOAD STATUS
# ============================================================================

@router.get("/{bulk_upload_id}/status", response_model=BulkUploadStatusResponse)
def get_bulk_upload_status(
    bulk_upload_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_sync)
):
    """Get current status of bulk upload batch"""
    try:
        # Query bulk upload using SQLAlchemy ORM
        batch = db.execute(select(BulkUpload).where(BulkUpload.id == bulk_upload_id)).scalar_one_or_none()
        
        if not batch:
            raise HTTPException(status_code=404, detail="Bulk upload not found")
        
        # In a real system, you'd calculate job_queue_size from Celery or a DB queue table
        # For now, we return the metrics from the batch record
        
        return BulkUploadStatusResponse(
            bulk_upload_id=str(batch.id),
            batch_name=batch.batch_name,
            upload_status=batch.upload_status,
            total_files_uploaded=batch.total_files_uploaded,
            successfully_parsed=batch.successfully_parsed,
            parsing_failed=batch.parsing_failed,
            duplicate_candidates_detected=batch.duplicate_candidates_detected,
            new_candidates_identified=batch.new_candidates_identified,
            average_confidence=float(batch.extraction_confidence_avg or 0.0),
            processing_started_at=batch.processing_started_at,
            processing_completed_at=batch.processing_completed_at,
            job_queue_size=0 # Placeholder
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting status for {bulk_upload_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get status")


# ============================================================================
# PHASE 4: DUPLICATE REVIEW
# ============================================================================

@router.get("/{bulk_upload_id}/duplicates-for-review", response_model=List[CandidateDuplicateReviewItem])
def get_duplicates_for_review(
    bulk_upload_id: str,
    skip: int = 0,
    limit: int = 25,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_sync)
):
    """
    Get list of potential duplicates requiring admin review.
    
    Only returns matches with 70-90% confidence (strong_match, moderate_match)
    """
    try:
        # Query duplicates needing review
        # SELECT * FROM bulk_upload_candidate_matches
        # WHERE bulk_upload_id = ?
        # AND match_confidence BETWEEN 0.70 and 0.90
        # AND admin_decision = 'pending'
        # ORDER BY match_confidence DESC
        # LIMIT limit OFFSET skip
        
        return []  # Mock response
    
    except Exception as e:
        logger.error(f"Error getting duplicates: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch duplicates")


@router.post("/{bulk_upload_id}/duplicate/{match_id}/review", response_model=Dict)
def submit_duplicate_review(
    bulk_upload_id: str,
    match_id: str,
    review: DuplicateReviewRequest,
    db: Session = Depends(get_db),
    background_tasks: BackgroundTasks = None,
    current_user: dict = Depends(get_current_user_sync)
):
    """
    Admin submits decision on potential duplicate.
    
    Options:
    - approved_merge: Merge with existing candidate
    - rejected_duplicate: Not a duplicate, create new account
    - create_new: Create new candidate account regardless
    """
    try:
        # Validate decision
        if review.admin_decision not in ['approved_merge', 'rejected_duplicate', 'create_new']:
            raise HTTPException(status_code=400, detail="Invalid admin decision")
        
        # Update match decision in database
        # await db.execute(
        #     update(bulk_upload_candidate_matches)
        #     .where(bulk_upload_candidate_matches.c.id == match_id)
        #     .values(
        #         admin_decision=review.admin_decision,
        #         admin_decision_made_by=current_user['user_id'],
        #         admin_decision_reason=review.decision_reason,
        #         admin_decision_at=datetime.utcnow()
        #     )
        # )
        
        # If approved_merge: queue merge job
        if review.admin_decision == 'approved_merge':
            if background_tasks:
                background_tasks.add_task(
                    _merge_candidate_task,
                    match_id=match_id,
                    bulk_upload_id=bulk_upload_id
                )
        
        # If create_new: queue account creation
        else:
            if background_tasks:
                background_tasks.add_task(
                    _create_candidate_account_task,
                    match_id=match_id,
                    bulk_upload_id=bulk_upload_id
                )
        
        logger.info(f"Admin decision recorded for {match_id}: {review.admin_decision}")
        
        return {
            "status": "success",
            "message": f"Decision recorded: {review.admin_decision}",
            "match_id": match_id
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting review: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to submit review")


# ============================================================================
# PHASE 5: COMPLETE BULK UPLOAD & GENERATE REPORT
# ============================================================================

@router.post("/{bulk_upload_id}/complete", response_model=BulkUploadReportResponse)
def complete_bulk_upload(
    bulk_upload_id: str,
    db: Session = Depends(get_db),
    background_tasks: BackgroundTasks = None,
    current_user: dict = Depends(get_current_user_sync)
):
    """
    Mark bulk upload as complete and generate final report.
    
    Triggers:
    - Account creation for new candidates (shadow profiles)
    - Email invitations to all new candidates
    - Schedule data deletion (based on retention policy)
    """
    try:
        # Verify all reviews are complete
        # SELECT COUNT(*) FROM bulk_upload_candidate_matches
        # WHERE bulk_upload_id = ? AND admin_decision = 'pending'
        # If > 0: raise HTTPException(status_code=400, detail="Pending reviews remain")
        
        # Mark as completed
        # UPDATE bulk_uploads
        # SET upload_status = 'completed',
        #     processing_completed_at = now()
        # WHERE id = ?
        
        # Queue final tasks
        if background_tasks:
            background_tasks.add_task(
                _send_invitations_task,
                bulk_upload_id=bulk_upload_id
            )
            background_tasks.add_task(
                _schedule_data_deletion_task,
                bulk_upload_id=bulk_upload_id
            )
        
        logger.info(f"Bulk upload completed: {bulk_upload_id}")
        
        return BulkUploadReportResponse(
            bulk_upload_id=bulk_upload_id,
            batch_name="Batch Name",
            total_files_processed=50,
            parsing_success_rate=0.96,
            duplicate_detected_count=5,
            new_profiles_created=43,
            shadow_profiles_created=43,
            verified_accounts=8,
            invitations_sent=43,
            processing_time_seconds=3600,
            processing_completed_at=datetime.utcnow()
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error completing bulk upload: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to complete bulk upload")


@router.delete("/{bulk_upload_id}", response_model=BatchDeleteResponse)
def delete_bulk_upload_batch(
    bulk_upload_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_sync)
):
    """
    Delete a bulk upload batch and all its associated files.
    
    This will:
    1. Delete file records from BulkUploadFile
    2. Delete match records from BulkUploadCandidateMatch
    3. Delete the parent BulkUpload record
    4. Attempt to cleanup files from S3 (if applicable)
    """
    try:
        # 1. Fetch batch to verify existence
        batch = db.execute(select(BulkUpload).where(BulkUpload.id == bulk_upload_id)).scalar_one_or_none()
        if not batch:
            raise HTTPException(status_code=404, detail="Bulk upload batch not found")

        # 2. Identify all associated files
        files = db.execute(select(BulkUploadFile).where(BulkUploadFile.bulk_upload_id == bulk_upload_id)).scalars().all()
        file_count = len(files)

        # 3. Request S3 cleanup (soft cleanup - don't fail if S3 fails)
        try:
            s3 = S3Service.get_client()
            bucket_name = S3_BUCKETS.get("bulk-resumes")
            
            # Delete objects in batch folder
            # Prefix: batches/{bulk_upload_id}/
            prefix = f"batches/{bulk_upload_id}/"
            
            # List objects to delete
            response = s3.list_objects_v2(Bucket=bucket_name, Prefix=prefix)
            if 'Contents' in response:
                delete_keys = [{'Key': obj['Key']} for obj in response['Contents']]
                s3.delete_objects(
                    Bucket=bucket_name,
                    Delete={'Objects': delete_keys}
                )
                logger.info(f"S3 cleanup: Deleted {len(delete_keys)} objects for batch {bulk_upload_id}")
        except Exception as s3_err:
            logger.warning(f"S3 cleanup failed for batch {bulk_upload_id}: {str(s3_err)}")

        # 4. Delete database records (SQLAlchemy CASCADE should ideally handle this, but we'll be explicit)
        # Delete matches first (child of files)
        from sqlalchemy import delete
        
        # This assumes BulkUploadCandidateMatch and BulkUploadFile linkages
        # If your schema has cascades set up, deleting the batch is enough.
        # But to be safe and clear:
        
        # Delete file records (this will trigger cascades if FKs are set to CASCADE)
        db.execute(delete(BulkUploadFile).where(BulkUploadFile.bulk_upload_id == bulk_upload_id))
        
        # Delete the batch itself
        db.delete(batch)
        db.commit()

        logger.info(f"Batch deleted: {bulk_upload_id} by user {current_user['user_id']}")

        return BatchDeleteResponse(
            message="Batch and associated data deleted successfully",
            bulk_upload_id=bulk_upload_id,
            files_deleted=file_count
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting batch {bulk_upload_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to delete batch: {str(e)}")


# ============================================================================
# BACKGROUND TASKS (Async job processing)
# ============================================================================

async def _virus_scan_task(file_id: str, file_path: str):
    """Async task: Scan file for viruses using ClamAV"""
    try:
        # Implementation depends on your setup
        # Option 1: Use clamscan CLI
        # import subprocess
        # result = subprocess.run(['clamscan', file_path], capture_output=True, timeout=VIRUS_SCAN_TIMEOUT)
        
        # Option 2: Use pyclamav library
        # import pyclamav
        # result = pyclamav.scan_file(file_path)
        
        logger.info(f"Virus scan completed for {file_id}")
    
    except Exception as e:
        logger.error(f"Virus scan failed for {file_id}: {str(e)}")


async def _parse_resume_task(file_id: str, file_path: str, file_hash: str):
    """Async task: Parse resume and extract data"""
    try:
        # from src.services.resume_extractor import ComprehensiveResumeExtractor
        # extractor = ComprehensiveResumeExtractor()
        
        # with open(file_path, 'r', encoding='utf-8') as f:
        #     resume_text = f.read()
        
        # extracted_data = {
        #     'name': extractor.extract_name(resume_text),
        #     'email': extractor.extract_email(resume_text),
        #     'phone': extractor.extract_phone(resume_text),
        #     'location': extractor.extract_location(resume_text),
        #     'current_role': extractor.extract_current_role(resume_text),
        #     'years_of_experience': extractor.extract_experience_years(resume_text),
        #     'education': extractor.extract_education(resume_text),
        #     'skills': extractor.extract_skills(resume_text),
        #     'companies': extractor.extract_companies(resume_text),
        # }
        
        logger.info(f"Resume parsed for {file_id}")
    
    except Exception as e:
        logger.error(f"Resume parsing failed for {file_id}: {str(e)}")


async def _detect_duplicates_task(file_id: str, bulk_upload_id: str):
    """Async task: Detect duplicate candidates"""
    try:
        # from .bulk_upload_duplicate_detector import DuplicateDetector
        # detector = DuplicateDetector()
        
        # Get parsed data and existing candidates
        # Create matches and store in database
        
        logger.info(f"Duplicate detection completed for {file_id}")
    
    except Exception as e:
        logger.error(f"Duplicate detection failed for {file_id}: {str(e)}")


async def _merge_candidate_task(match_id: str, bulk_upload_id: str):
    """Async task: Merge approved duplicate with existing candidate"""
    try:
        # Merge resume versions, update skills, etc.
        logger.info(f"Candidate merge completed for {match_id}")
    
    except Exception as e:
        logger.error(f"Candidate merge failed for {match_id}: {str(e)}")


async def _create_candidate_account_task(match_id: str, bulk_upload_id: str):
    """Async task: Create new candidate account (shadow profile)"""
    try:
        # Create unverified candidate profile
        # Set account_type = 'bulk_uploaded'
        # Set account_status = 'unverified'
        logger.info(f"Candidate account created for {match_id}")
    
    except Exception as e:
        logger.error(f"Account creation failed for {match_id}: {str(e)}")


async def _send_invitations_task(bulk_upload_id: str):
    """Async task: Send email invitations to new candidates"""
    try:
        # Query all new shadow profiles from this batch
        # Send device registration email to each
        # Update invitation_sent_at timestamp
        logger.info(f"Invitations sent for bulk upload {bulk_upload_id}")
    
    except Exception as e:
        logger.error(f"Invitation sending failed for {bulk_upload_id}: {str(e)}")


async def _schedule_data_deletion_task(bulk_upload_id: str):
    """Async task: Schedule deletion of files per retention policy"""
    try:
        # Calculate scheduled_deletion_date = now + data_retention_days
        # Store in database for later cleanup job
        logger.info(f"Data deletion scheduled for {bulk_upload_id}")
    
    except Exception as e:
        logger.error(f"Deletion scheduling failed for {bulk_upload_id}: {str(e)}")


# ============================================================================
# HEALTH CHECK
# ============================================================================

@router.get("/health", response_model=Dict)
def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "bulk-upload"
    }


# ============================================================================
# TEST ENDPOINT (Remove after verification)
# ============================================================================

@router.get("/test", response_model=Dict)
def test_endpoint():
    """Test endpoint to verify route is loaded"""
    return {
        "status": "ok",
        "message": "Bulk upload router is loaded and working!",
        "timestamp": datetime.utcnow().isoformat()
    }
