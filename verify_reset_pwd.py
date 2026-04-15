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
reset_link = "http://localhost:3000/auth/reset?token=random-test-token"

msg = EmailMessage()
msg["Subject"] = "Reset Your TalentFlow Password"
msg["From"] = f"TechSalesAxis <{from_email}>"
msg["To"] = target
msg.set_content(f"Hi Mithun,\\n\\nTo reset your TalentFlow password, please click the link below:\\n\\n{reset_link}")

html_content = f"""
<html>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #2563eb;">TalentFlow Password Reset</h2>
      <p>Hi Mithun,</p>
      <p>We received a request to reset your password. Click the button below to proceed:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{reset_link}" style="background-color: #2563eb; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset Password</a>
      </div>
      <p>If the button does not work, copy and paste this link into your browser:</p>
      <p style="color: #666; font-size: 13px;">{reset_link}</p>
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
    print("✅ RESET PASSWORD SENT SUCCESSFULLY VIA SMTP!")
except Exception as e:
    print(f"❌ FAILED TO SEND: {e}")
