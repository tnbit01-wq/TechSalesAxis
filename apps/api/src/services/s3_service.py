import boto3
from botocore.config import Config
from src.core.config import AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET_NAME
from typing import Optional
import logging

logger = logging.getLogger(__name__)

class S3Service:
    @staticmethod
    def get_client():
        return boto3.client(
            's3',
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
            region_name=AWS_REGION,
            config=Config(signature_version='s3v4')
        )

    @staticmethod
    def upload_file(file_content: bytes, file_path: str, content_type: str = "application/octet-stream") -> bool:
        try:
            s3 = S3Service.get_client()
            s3.put_object(
                Bucket=S3_BUCKET_NAME,
                Key=file_path,
                Body=file_content,
                ContentType=content_type
            )
            return True
        except Exception as e:
            logger.error(f"S3 Upload Error: {e}")
            return False

    @staticmethod
    def get_signed_url(file_path: str, expires_in: int = 3600) -> Optional[str]:
        if not file_path:
            return None
        
        # Determine content type and disposition
        is_pdf = file_path.lower().endswith('.pdf')
        content_type = 'application/pdf' if is_pdf else None
        
        # If it's a full URL, we need to extract the key to sign it
        if file_path.startswith("http"):
            if S3_BUCKET_NAME in file_path:
                # Extract the key after the bucket domain
                try:
                    parts = file_path.split(".com/")
                    if len(parts) > 1:
                        # Strip query parameters if they exist
                        file_path = parts[1].split('?')[0]
                    else:
                        parts = file_path.split(f"{S3_BUCKET_NAME}/")
                        if len(parts) > 1:
                            file_path = parts[1].split('?')[0]
                except:
                    pass
            else:
                return file_path
            
        try:
            s3 = S3Service.get_client()
            params = {
                'Bucket': S3_BUCKET_NAME, 
                'Key': file_path,
                'ResponseContentDisposition': 'inline'
            }
            if content_type:
                params['ResponseContentType'] = content_type

            url = s3.generate_presigned_url(
                'get_object',
                Params=params,
                ExpiresIn=expires_in
            )
            return url
        except Exception as e:
            logger.error(f"S3 Signed URL Error: {e}")
            return None

    @staticmethod
    def get_upload_presigned_url(file_path: str, content_type: str, expires_in: int = 3600) -> Optional[str]:
        """Generate a presigned URL for uploading a file directly from the browser."""
        try:
            s3 = S3Service.get_client()
            url = s3.generate_presigned_url(
                'put_object',
                Params={
                    'Bucket': S3_BUCKET_NAME,
                    'Key': file_path,
                    'ContentType': content_type
                },
                ExpiresIn=expires_in
            )
            return url
        except Exception as e:
            logger.error(f"S3 Presigned Upload URL Error: {e}")
            return None
