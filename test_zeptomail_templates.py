import sys
from pathlib import Path

# Add the apps/api directory to sys.path
api_path = Path(__file__).resolve().parent / "apps" / "api"
sys.path.append(str(api_path))

from src.services.email_service import send_otp_email, send_password_reset_email

def test_templates():
    test_email = "contactus@tnbit.in"
    
    print("\n--- 1. Testing OTP Template ---")
    otp_res = send_otp_email(test_email, "554433")
    print(f"Result: {otp_res}")
    
    print("\n--- 2. Testing Password Reset Template ---")
    reset_res = send_password_reset_email(test_email, "https://techsalesaxis.com/reset?token=test123", username="Mithun")
    print(f"Result: {reset_res}")

if __name__ == "__main__":
    test_templates()
