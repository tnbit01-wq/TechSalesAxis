import os
from src.core.config import SMTP_PASSWORD
print(f"Token length: {len(SMTP_PASSWORD)}")
print(f"Starts with: {SMTP_PASSWORD[:10]}...")

