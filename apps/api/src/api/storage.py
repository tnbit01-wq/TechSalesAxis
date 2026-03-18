from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
import uuid
from src.core.dependencies import get_current_user
from src.services.s3_service import S3Service

router = APIRouter(prefix="/storage", tags=["storage"])

async def _upload_to_s3(file: UploadFile, file_path: str):
    content = await file.read()
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
    file_path = f"recruiter/{user_id}/id/{uuid.uuid4()}-{file.filename}"
    return await _upload_to_s3(file, file_path)

@router.post("/upload/profile-photo")
async def upload_profile_photo(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    user_id = user["sub"]
    file_path = f"profiles/{user_id}/photo/{uuid.uuid4()}-{file.filename}"
    return await _upload_to_s3(file, file_path)

@router.post("/upload/aadhaar")
async def upload_aadhaar(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    user_id = user["sub"]
    file_path = f"profiles/{user_id}/aadhaar/{uuid.uuid4()}-{file.filename}"
    return await _upload_to_s3(file, file_path)

@router.post("/upload/branding")
async def upload_branding_asset(
    file: UploadFile = File(...),
    category: str = "logo", # 'logo' or 'life'
    user: dict = Depends(get_current_user),
):
    user_id = user["sub"]
    file_path = f"recruiter/{user_id}/{category}/{uuid.uuid4()}-{file.filename}"
    return await _upload_to_s3(file, file_path)

@router.post("/upload")
async def upload_generic(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    user_id = user["sub"]
    file_path = f"uploads/{user_id}/{uuid.uuid4()}-{file.filename}"
    return await _upload_to_s3(file, file_path)
