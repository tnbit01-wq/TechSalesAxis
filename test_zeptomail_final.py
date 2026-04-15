import os
import sys
from pathlib import Path

# Add the apps/api directory to sys.path
api_path = Path(__file__).resolve().parent / "apps" / "api"
sys.path.append(str(api_path))

from src.services.email_service import send_otp_email

def manual_test():
    test_email = "contactus@tnbit.in"
    test_otp = "998877"
    
    print(f"Attempting to send ZeptoMail test to {test_email}...")
    result = send_otp_email(test_email, test_otp)
    
    if result == "SUCCESS":
        print("✅ TEST SUCCESSFUL! Check the inbox.")
    else:
        print("❌ TEST FAILED. Check the console errors above.")

if __name__ == "__main__":
    manual_test()
