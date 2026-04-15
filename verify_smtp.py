import smtplib, os
from email.message import EmailMessage
from dotenv import load_dotenv

load_dotenv(".env")
host = "smtp.zeptomail.in"
port = 587
user = "emailapikey"
password = os.getenv("SMTP_PASSWORD")
from_email = os.getenv("SMTP_FROM_EMAIL")
target = "mithunkaveriappa.mk@gmail.com"

msg = EmailMessage()
msg["Subject"] = "SMTP Test (Confirming Token)"
msg["From"] = f"TechSalesAxis <{from_email}>"
msg["To"] = target
msg.set_content("If you receive this, your Send Mail Token works for SMTP but might be restricted for the Template API until KYC is complete.")

try:
    with smtplib.SMTP(host, port) as server:
        server.starttls()
        server.login(user, password)
        server.send_message(msg)
    print("✅ SMTP SUCCESS!")
except Exception as e:
    print(f"❌ SMTP FAILED: {e}")
