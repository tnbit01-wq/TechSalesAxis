import os
from dotenv import load_dotenv
from pathlib import Path

# Load .env from project root
# Path: apps/api/src/core/config.py -> ../../../../.env
current_dir = Path(__file__).resolve().parent
env_path = None

# Search up to 5 levels for the .env file
for _ in range(5):
    if (current_dir / ".env").exists():
        env_path = current_dir / ".env"
        break
    current_dir = current_dir.parent

if env_path:
    print(f"DEBUG: Loading environment from {env_path}")
    load_dotenv(dotenv_path=env_path)
else:
    print("DEBUG: No .env file found in parent directories, using system env")
    load_dotenv()

# External APIs
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "").strip()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "").strip()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()

# AWS Configuration
AWS_ACCESS_KEY_ID = os.getenv("MY_AWS_ACCESS_KEY_ID", "").strip()
AWS_SECRET_ACCESS_KEY = os.getenv("MY_AWS_SECRET_ACCESS_KEY", "").strip()
AWS_REGION = os.getenv("MY_AWS_REGION", "ap-south-1").strip()
S3_BUCKET_NAME = os.getenv("MY_S3_BUCKET_NAME", "techsalesaxis-storage").strip()

# AWS RDS Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

# Auth Configuration (AWS)
JWT_SECRET = os.getenv("JWT_SECRET", "7c8e57bb9c29f040c2a83db8d27f4b1f8b22ca0096fa54333cae6bf28ad856a7").strip()
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", JWT_SECRET).strip()  # Alias for compatibility
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256").strip()
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 4320 # 3 days

# ============================================================================
# PHASE 1: BULK UPLOAD CONFIGURATION
# ============================================================================

# File Storage - Bulk Upload (Supports 500-1000 resumes per batch)
BULK_UPLOAD_DIR = os.getenv("BULK_UPLOAD_DIR", "/uploads/bulk_uploads").strip()
MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "50"))  # 50MB per file (supports large PDFs)
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
MAX_BATCH_SIZE_MB = int(os.getenv("MAX_BATCH_SIZE_MB", "500"))  # 500MB total batch (500-1000 resumes)
MAX_BATCH_SIZE_BYTES = MAX_BATCH_SIZE_MB * 1024 * 1024
ALLOWED_UPLOAD_EXTENSIONS = os.getenv("ALLOWED_UPLOAD_EXTENSIONS", "pdf,doc,docx,txt").strip().split(",")

# Redis & Celery Configuration
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0").strip()
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/1").strip()
CELERY_TIMEZONE = os.getenv("CELERY_TIMEZONE", "UTC").strip()

# AWS SES Configuration
AWS_SES_REGION = os.getenv("AWS_SES_REGION", "us-east-1").strip()
AWS_SES_SENDER_EMAIL = os.getenv("AWS_SES_SENDER_EMAIL", "noreply@techsalesaxis.ai").strip()
AWS_SES_SENDER_NAME = os.getenv("AWS_SES_SENDER_NAME", "TalentFlow Team").strip()

# Admin Configuration
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@talentflow.com").strip()
TALENT_TEAM_EMAIL = os.getenv("TALENT_TEAM_EMAIL", "talent@techsalesaxis.ai").strip()

# Data Retention
BULK_UPLOAD_RETENTION_DAYS = int(os.getenv("BULK_UPLOAD_RETENTION_DAYS", "90"))
VIRUS_SCAN_ENABLED = os.getenv("VIRUS_SCAN_ENABLED", "true").lower() == "true"
CLAMAV_HOST = os.getenv("CLAMAV_HOST", "localhost").strip()
CLAMAV_PORT = int(os.getenv("CLAMAV_PORT", "3310"))

# Zoho Email (Fallback)
ZOHO_SMTP_HOST = os.getenv("ZOHO_SMTP_HOST", "smtp.zoho.in").strip()
ZOHO_SMTP_PORT = int(os.getenv("ZOHO_SMTP_PORT", "465"))
ZOHO_EMAIL = os.getenv("ZOHO_EMAIL", "admin@techsalesaxis.ai").strip()
ZOHO_USE_TLS = os.getenv("ZOHO_USE_TLS", "true").lower() == "true"

# 🆕 Generic SMTP Configuration (used by email_service.py)
# Defaults to ZOHO settings, but can be overridden for other SMTP providers
SMTP_HOST = os.getenv("SMTP_HOST", ZOHO_SMTP_HOST).strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", str(ZOHO_SMTP_PORT)))
SMTP_USER = os.getenv("SMTP_USER", ZOHO_EMAIL).strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").strip()  # Must be set in .env
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", ZOHO_EMAIL).strip()
SMTP_SENDER_NAME = os.getenv("SMTP_SENDER_NAME", "TalentFlow Team").strip()
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

# ZeptoMail Template IDs
ZEPTO_OTP_TEMPLATE_ID = os.getenv("ZEPTO_OTP_TEMPLATE_ID", "").strip()
ZEPTO_PWD_RESET_TEMPLATE_ID = os.getenv("ZEPTO_PWD_RESET_TEMPLATE_ID", "").strip()

if not DATABASE_URL:
    print("WARNING: DATABASE_URL not set. AWS RDS features will be unavailable.")
