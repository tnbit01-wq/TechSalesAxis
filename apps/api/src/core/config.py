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
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "").strip()
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "").strip()
AWS_REGION = os.getenv("AWS_REGION", "ap-southeast-2").strip()
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "talentflow-files").strip()

# AWS RDS Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

# Auth Configuration (AWS)
JWT_SECRET = os.getenv("JWT_SECRET", "7c8e57bb9c29f040c2a83db8d27f4b1f8b22ca0096fa54333cae6bf28ad856a7").strip()
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 4320 # 3 days

if not DATABASE_URL:
    print("WARNING: DATABASE_URL not set. AWS RDS features will be unavailable.")
