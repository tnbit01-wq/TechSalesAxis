import requests
import json
import os
from dotenv import load_dotenv

# Re-load env manually for this test
load_dotenv(".env")

token = os.getenv("SMTP_PASSWORD")
from_email = os.getenv("SMTP_FROM_EMAIL")
otp_tmpl = "2518b.7d3e2e53b0992208.k1.d0d7c440-3895-11f1-9334-ae9c7e0b6a9f.19d8fdd8684"

url = "https://api.zeptomail.in/v1.1/email/template"
headers = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Authorization": token
}

payload = {
    "template_key": otp_tmpl,
    "from": {"address": from_email, "name": "TechSalesAxis"},
    "to": [{"email_address": {"address": "contactus@tnbit.in"}}],
    "merge_info": {"OTP": "776655", "valid_time": "15 mins"}
}

print(f"Sending with Token: {token[:10]}...")
r = requests.post(url, headers=headers, json=payload)
print(f"Status: {r.status_code}")
print(f"Response: {r.text}")

