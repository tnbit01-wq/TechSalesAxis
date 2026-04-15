import os
from dotenv import load_dotenv
load_dotenv(".env")

host = os.getenv("SMTP_HOST")
port = os.getenv("SMTP_PORT")
user = os.getenv("SMTP_USER")
password = os.getenv("SMTP_PASSWORD")
from_email = os.getenv("SMTP_FROM_EMAIL")

print(f"SMTP_HOST: {host}")
print(f"SMTP_PORT: {port}")
print(f"SMTP_USER: {user}")
print(f"SMTP_FROM_EMAIL: {from_email}")
print(f"Has Password: {len(password) > 0 if password else False}")

# Test sending
from src.services.email_service import send_otp_email, generate_otp
otp = generate_otp()
print(f"Generated OTP: {otp}")
print("Testing email send...")
result = send_otp_email("test.user@gmail.com", otp)
print(f"Send result: {result}")
