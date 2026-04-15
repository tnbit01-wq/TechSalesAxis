import requests
import os
from dotenv import load_dotenv

load_dotenv(".env")
# ZeptoMail App API requires the "Send Mail Token" as the Authorization header.
# Often requires the Zoho-encz prefix if it is an account token, 
# but for a "Send Mail Token" it should be the raw token.
token = os.getenv("SMTP_PASSWORD")
from_email = os.getenv("SMTP_FROM_EMAIL")
otp_tmpl = "2518b.7d3e2e53b0992208.k1.d0d7c440-3895-11f1-9334-ae9c7e0b6a9f.19d8fdd8684"

url = "https://api.zeptomail.in/v1.1/email/template"
# Trying with prefix
headers = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Authorization": f"Zoho-encz {token}"
}
payload = {
    "template_key": otp_tmpl,
    "from": {"address": from_email, "name": "TechSalesAxis"},
    "to": [{"email_address": {"address": "contactus@tnbit.in"}}],
    "merge_info": {"OTP": "111222", "valid_time": "10m"}
}
print("Trying with Zoho-encz prefix...")
r = requests.post(url, headers=headers, json=payload)
print(f"Status: {r.status_code}, Response: {r.text}")

