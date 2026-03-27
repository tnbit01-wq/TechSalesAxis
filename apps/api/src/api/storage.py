from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
import uuid
from src.core.dependencies import get_current_user
from src.services.s3_service import S3Service

router = APIRouter(prefix="/storage", tags=["storage"])

# Global constants for storage
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB in bytes

async def _upload_to_s3(file: UploadFile, file_path: str):
    content = await file.read()
    
    # Backend File Size Guard
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413, 
            detail=f"File too large. Maximum allowed size is {MAX_FILE_SIZE // (1024 * 1024)}MB"
        )

    uploaded = S3Service.upload_file(
        content,
        file_path,
        file.content_type or "application/octet-stream",
    )
    if not uploaded:
        raise HTTPException(status_code=500, detail="Failed to upload file")
    return {
        "status": "uploaded",
        "path": file_path,
        "url": S3Service.get_signed_url(file_path),
    }

@router.post("/upload/recruiter-id")
async def upload_recruiter_id(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    user_id = user["sub"]
    # Map to legacy 'id-proofs' prefix
    file_path = f"id-proofs/recruiter/{user_id}/{uuid.uuid4()}-{file.filename}"
    return await _upload_to_s3(file, file_path)

@router.post("/upload/profile-photo")
async def upload_profile_photo(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    user_id = user["sub"]
    # Map to legacy 'avatars' prefix
    file_path = f"avatars/{user_id}/{uuid.uuid4()}-{file.filename}"
    return await _upload_to_s3(file, file_path)

@router.post("/upload/aadhaar")
async def upload_aadhaar(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    user_id = user["sub"]
    # Map to legacy 'id-proofs' prefix
    file_path = f"id-proofs/candidate/{user_id}/{uuid.uuid4()}-{file.filename}"
    return await _upload_to_s3(file, file_path)

@router.post("/upload/branding")
async def upload_branding_asset(
    file: UploadFile = File(...),
    category: str = "logo", # 'logo' or 'life'
    user: dict = Depends(get_current_user),
):
    user_id = user["sub"]
    # Map to legacy company prefixes
    prefix = "company-logos" if category == "logo" else "company-assets"
    file_path = f"{prefix}/{user_id}/{uuid.uuid4()}-{file.filename}"
    return await _upload_to_s3(file, file_path)

@router.post("/upload/resume")
async def upload_resume(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    user_id = user["sub"]
    # Unified 'resumes' prefix
    file_path = f"resumes/{user_id}/{uuid.uuid4()}-{file.filename}"
    return await _upload_to_s3(file, file_path)

@router.post("/upload")
async def upload_generic(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    user_id = user["sub"]
    file_path = f"uploads/{user_id}/{uuid.uuid4()}-{file.filename}"
    return await _upload_to_s3(file, file_path)
