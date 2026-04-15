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
RESET_LINK = "https://techsalesaxis.com/auth/reset?token=verified-test-token"

def send(sub, body):
    msg = EmailMessage()
    msg["Subject"] = sub
    msg["From"] = f"{SENDER_NAME} <{FROM_EMAIL}>"
    msg["To"] = TARGET
    msg.set_content("HTML Needed.")
    msg.add_alternative(body, subtype="html")
    with smtplib.SMTP(HOST, PORT) as server:
        server.starttls()
        server.login(USER, PASSWORD)
        server.send_message(msg)

otp = str(random.randint(100100, 999100))
h_o = f"<html><body><h2>TechSales Axis Verification</h2><p>Hi Mithun,</p><p>Code: <b>{otp}</b></p></body></html>"
h_r = f"<html><body><h2>TechSales Axis Reset</h2><p>Hi Mithun,</p><a href='{RESET_LINK}'>Reset Password</a><p>URL: {RESET_LINK}</p></body></html>"

send("TechSales Axis: Your Verification Code", h_o)
send("Reset Password - TechSales Axis", h_r)
print("SUCCESS")
