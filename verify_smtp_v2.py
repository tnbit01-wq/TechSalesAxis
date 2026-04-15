import smtplib, os, random
from email.message import EmailMessage
from dotenv import load_dotenv

load_dotenv(".env")
host = "smtp.zeptomail.in"
port = 587
user = "emailapikey"
password = os.getenv("SMTP_PASSWORD")
from_email = os.getenv("SMTP_FROM_EMAIL")
target = "mithunkaveriappa.mk@gmail.com"

otp = str(random.randint(100000, 999999))

msg = EmailMessage()
msg["Subject"] = f"Your TalentFlow Verification Code: {otp}"
msg["From"] = f"TechSalesAxis <{from_email}>"
msg["To"] = target
msg.set_content(f"Hi Mithun,\\n\\nYour OTP for TalentFlow is: {otp}")

html_content = f"""
<html>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #2563eb;">TalentFlow Verification</h2>
      <p>Hi Mithun,</p>
      <p>Your one-time password for signing in is:</p>
      <div style="background: #f3f4f6; padding: 15px; text-align: center; border-radius: 5px; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #1e40af;">
        {otp}
      </div>
      <p>This code expires in 10 minutes.</p>
    </div>
  </body>
</html>
"""
msg.add_alternative(html_content, subtype="html")

try:
    with smtplib.SMTP(host, port) as server:
        server.starttls()
        server.login(user, password)
        server.send_message(msg)
    print("✅ OTP SENT SUCCESSFULLY VIA SMTP!")
except Exception as e:
    print(f"❌ FAILED TO SEND: {e}")
