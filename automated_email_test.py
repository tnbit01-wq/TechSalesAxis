import requests
import json
import os
from dotenv import load_dotenv

# Load credentials
load_dotenv(".env")

token = os.getenv("SMTP_PASSWORD")
from_email = os.getenv("SMTP_FROM_EMAIL")
otp_tmpl = os.getenv("ZEPTO_OTP_TEMPLATE_ID")
pwd_tmpl = os.getenv("ZEPTO_PWD_RESET_TEMPLATE_ID")

target_email = "mithunkaveriappa.mk@gmail.com"
url = "https://api.zeptomail.in/v1.1/email/template"
headers = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Authorization": f"{token}"  # For ZeptoMail Send Mail Token
}

def send_test(name, tmpl_id, merge_info):
    print(f"\n--- Testing {name} ---")
    payload = {
        "template_key": tmpl_id,
        "from": {"address": from_email, "name": "TechSalesAxis"},
        "to": [{"email_address": {"address": target_email}}],
        "merge_info": merge_info
    }
    r = requests.post(url, headers=headers, json=payload)
    if r.status_code == 200 or r.status_code == 201:
        print(f"✅ SUCCESS: {name} sent!")
    else:
        print(f"❌ FAILED: {r.status_code} - {r.text}")

if __name__ == "__main__":
    # Test OTP
    send_test("OTP Template", otp_tmpl, {"OTP": "987654", "valid_time": "15 minutes"})
    
    # Test Password Reset
    # Note: Link should use techsalesaxis.com domain
    reset_link = "https://www.techsalesaxis.com/reset-password?token=automated_test_token_123"
    send_test("Password Reset", pwd_tmpl, {
        "username": "Mithun Kaveriappa",
        "reset_password_link": reset_link,
        "data_time": "30 minutes"
    })

