import requests
import os
from dotenv import load_dotenv

load_dotenv(".env")
token = os.getenv("SMTP_PASSWORD")
from_email = os.getenv("SMTP_FROM_EMAIL")
otp_tmpl = os.getenv("ZEPTO_OTP_TEMPLATE_ID")

url = "https://api.zeptomail.in/v1.1/email/template"
# Trying BOTH common ZeptoMail API header formats
headers_v1 = {"Accept": "application/json", "Content-Type": "application/json", "Authorization": token}
headers_v2 = {"Accept": "application/json", "Content-Type": "application/json", "Authorization": f"Zoho-encz {token}"}

payload = {
    "template_key": otp_tmpl,
    "from": {"address": from_email, "name": "TechSalesAxis"},
    "to": [{"email_address": {"address": "mithunkaveriappa.mk@gmail.com"}}],
    "merge_info": {"OTP": "999888", "valid_time": "10m"}
}

print("--- Try 1: Raw Token ---")
r1 = requests.post(url, headers=headers_v1, json=payload)
print(f"Status: {r1.status_code}, Body: {r1.text}")

if r1.status_code != 200:
    print("\n--- Try 2: Zoho-encz Prefix ---")
    r2 = requests.post(url, headers=headers_v2, json=payload)
    print(f"Status: {r2.status_code}, Body: {r2.text}")

