import smtplib, os, random
from email.message import EmailMessage
from dotenv import load_dotenv

load_dotenv(".env")

HOST = "smtp.zeptomail.in"
PORT = 587
USER = "emailapikey"
PASSWORD = os.getenv("SMTP_PASSWORD")
FROM_EMAIL = "noreply@techsalesaxis.com"
SENDER_NAME = "TechSales Axis"
TARGET = "mithunkaveriappa.mk@gmail.com"
RESET_LINK = "https://techsalesaxis.com/auth/reset?token=test-123"

def send_smtp_branded(subject, body_html, to_email):
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{SENDER_NAME} <{FROM_EMAIL}>"
    msg["To"] = to_email
    msg.set_content("Enable HTML to view.")
    msg.add_alternative(body_html, subtype="html")
    try:
        with smtplib.SMTP(HOST, PORT) as server:
            server.starttls()
            server.login(USER, PASSWORD)
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"SMTP Error: {e}")
        return False

otp = str(random.randint(100100, 999100))
html_otp = f"<html><body style=\"font-family: Arial, sans-serif;\"><h2>TechSales Axis Verification</h2><p>Hi Mithun,</p><p>Your code is <b>{otp}</b></p></body></html>"
html_reset = f"<html><body style=\"font-family: Arial, sans-serif;\"><h2>TechSales Axis Reset</h2><p>Hi Mithun,</p><p>Click below to reset:</p><p><a href=\"{RESET_LINK}\">Reset Password</a></p><p>Link: {RESET_LINK}</p></body></html>"

if send_smtp_branded("TechSales Axis: Your Verification Code", html_otp, TARGET):
    print("✅ OTP Sent!")
if send_smtp_branded("Reset Password - TechSales Axis", html_reset, TARGET):
    print("✅ Reset Sent!")
