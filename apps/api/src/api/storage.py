from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
import uuid
import os
from src.core.dependencies import get_current_user
from src.services.s3_service import S3Service

router = APIRouter(prefix="/storage", tags=["storage"])

# Global constants for storage
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB in bytes

# Bucket logic (Supabase conversion to AWS)
S3_BUCKETS = {
    "avatars": os.getenv("S3_BUCKET_AVATARS", "techsalesaxis-storage"),
    "resumes": os.getenv("S3_BUCKET_RESUMES", "techsalesaxis-storage"),
    "id-proofs": os.getenv("S3_BUCKET_ID_PROOFS", "techsalesaxis-storage"),
    "company-assets": os.getenv("S3_BUCKET_COMPANY_ASSETS", "techsalesaxis-storage"),
    "posts": os.getenv("S3_BUCKET_POSTS", "techsalesaxis-storage"),
    "uploads": os.getenv("S3_BUCKET_NAME", "techsalesaxis-storage") # Fallback
}

async def _upload_to_s3(file: UploadFile, file_path: str, bucket_key: str = "uploads"):
    content = await file.read()
    
    # Backend File Size Guard
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413, 
            detail=f"File too large. Maximum allowed size is {MAX_FILE_SIZE // (1024 * 1024)}MB"
        )

    target_bucket = S3_BUCKETS.get(bucket_key, S3_BUCKETS["uploads"])
    
    # FOLDER PREFIX CONSOLIDATION
    # Ensure file_path starts with the correct folder prefix for the bucket key
    prefix_map = {
        "avatars": "profile-pictures/",
        "resumes": "resumes/",
        "id-proofs": "id-proofs/",
        "company-assets": "company-assets/",
        "posts": "" # Posts handles its own sub-folders (videos/post-images)
    }
    
    folder_prefix = prefix_map.get(bucket_key, "")
    
    if folder_prefix and not file_path.startswith(folder_prefix):
        file_path = f"{folder_prefix}{file_path}"

    print(f"DEBUG S3: Uploading to {target_bucket} with key: {file_path}")

    uploaded = S3Service.upload_file(
        content,
        file_path,
        file.content_type or "application/octet-stream",
        bucket_name=target_bucket
    )
    if not uploaded:
        raise HTTPException(status_code=500, detail="Failed to upload file")
    
    # Return path MUST match the S3 Key exactly
    return {
        "status": "uploaded",
        "path": file_path,
        "bucket": target_bucket,
        "url": S3Service.get_signed_url(file_path, bucket_name=target_bucket),
    }

@router.post("/upload/recruiter-id")
async def upload_recruiter_id(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    user_id = user["sub"]
    file_path = f"{user_id}/{uuid.uuid4()}-{file.filename}"
    return await _upload_to_s3(file, file_path, bucket_key="id-proofs")

@router.post("/upload/profile-photo")
async def upload_profile_photo(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    user_id = user["sub"]
    file_path = f"{user_id}/{uuid.uuid4()}-{file.filename}"
    return await _upload_to_s3(file, file_path, bucket_key="avatars")

@router.post("/upload/aadhaar")
async def upload_aadhaar(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    user_id = user["sub"]
    file_path = f"{user_id}/{uuid.uuid4()}-{file.filename}"
    return await _upload_to_s3(file, file_path, bucket_key="id-proofs")

@router.post("/upload/branding")
async def upload_branding_asset(
    file: UploadFile = File(...),
    category: str = "logo", # 'logo' or 'life'
    user: dict = Depends(get_current_user),
):
    user_id = user["sub"]
    # Internal folder structure within bucket
    prefix_type = "company-logos" if category == "logo" else "company-assets"
    file_path = f"{prefix_type}/{user_id}/{uuid.uuid4()}-{file.filename}"
    return await _upload_to_s3(file, file_path, bucket_key="company-assets")

@router.post("/upload/resume")
async def upload_resume(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    user_id = user["sub"]
    # Path relative to folder
    file_path = f"{user_id}/{uuid.uuid4()}-{file.filename}"
    return await _upload_to_s3(file, file_path, bucket_key="resumes")

@router.post("/upload")
async def upload_generic(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    user_id = user["sub"]
    file_path = f"{user_id}/{uuid.uuid4()}-{file.filename}"
    return await _upload_to_s3(file, file_path, bucket_key="uploads")

@router.post("/upload/post-media")
async def upload_post_media(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    # Detect if video or image to use correct folder
    is_video = file.content_type and file.content_type.startswith("video/")
    folder = "videos" if is_video else "post-images"
    
    user_id = user["sub"]
    file_path = f"{folder}/{user_id}/{uuid.uuid4()}-{file.filename}"
    return await _upload_to_s3(file, file_path, bucket_key="posts")
