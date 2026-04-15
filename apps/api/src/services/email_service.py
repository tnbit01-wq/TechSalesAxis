import smtplib
from email.message import EmailMessage
import requests
import json
import logging
import random
import string
from src.core.config import (
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASSWORD,
    SMTP_FROM_EMAIL,
    SMTP_SENDER_NAME,
    ZEPTO_OTP_TEMPLATE_ID,
    ZEPTO_PWD_RESET_TEMPLATE_ID
)

# Configure logging to actually output messages
logging.basicConfig(
    level=logging.INFO,
    format='[%(name)s] %(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Debug: Print the configuration on load
print(f"[EMAIL_SERVICE] DEBUG: SMTP_HOST={SMTP_HOST}, SMTP_PORT={SMTP_PORT}, SMTP_USER={SMTP_USER}, SMTP_FROM_EMAIL={SMTP_FROM_EMAIL}")
print(f"[EMAIL_SERVICE] DEBUG: ZEPTO_OTP_TEMPLATE_ID={ZEPTO_OTP_TEMPLATE_ID}")
print(f"[EMAIL_SERVICE] DEBUG: SMTP_PASSWORD is set: {bool(SMTP_PASSWORD)}")


def generate_otp(length=6):
    return "".join(random.choices(string.digits, k=length))

def send_smtp_fallback(recipient, subject, html_content):
    """
    Fallback to standard SMTP for TechSales Axis branding 
    while ZeptoMail Template API (401) is being validated by Zoho.
    """
    print(f"[SMTP_FALLBACK] Attempting to send email to {recipient}")
    print(f"[SMTP_FALLBACK] SMTP_HOST={SMTP_HOST}, SMTP_PORT={SMTP_PORT}, SMTP_USER={SMTP_USER}")
    
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{SMTP_SENDER_NAME} <{SMTP_FROM_EMAIL}>"
    msg["To"] = recipient
    msg.set_content("Please enable HTML to view this email.")
    msg.add_alternative(html_content, subtype="html")

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        print(f"[SMTP_FALLBACK] SUCCESS: SMTP Email sent to {recipient}")
        logger.info(f"SMTP Email sent to {recipient}")
        return "SUCCESS"
    except Exception as e:
        print(f"[SMTP_FALLBACK] ERROR: SMTP Failed for {recipient}: {str(e)}")
        logger.error(f"SMTP Failed for {recipient}: {e}")
        return None

def send_templated_email(recipient, template_id, merge_info, fallback_subject="", fallback_html=""):
    print(f"[TEMPLATED_EMAIL] Attempting to send to {recipient} with template_id={template_id}")
    print(f"[TEMPLATED_EMAIL] SMTP_PASSWORD is set: {bool(SMTP_PASSWORD)}")
    
    if not SMTP_PASSWORD:
        print(f"[TEMPLATED_EMAIL] ERROR: SMTP_PASSWORD is empty, cannot proceed")
        return None

    # ZeptoMail App API
    url = "https://api.zeptomail.in/v1.1/email/template"
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": SMTP_PASSWORD # Raw token often works better for .in
    }
    
    payload = {
        "mail_template_key": template_id,
        "from": {
            "address": SMTP_FROM_EMAIL,
            "name": SMTP_SENDER_NAME
        },
        "to": [
            {
                "email_address": {
                    "address": recipient
                }
            }
        ],
        "merge_info": merge_info
    }

    try:
        print(f"[TEMPLATED_EMAIL] Making request to {url}")
        response = requests.post(url, headers=headers, json=payload, timeout=10)
        print(f"[TEMPLATED_EMAIL] ZeptoMail API response: status_code={response.status_code}")
        
        if response.status_code in [200, 201]:
            print(f"[TEMPLATED_EMAIL] SUCCESS: Template API sent to {recipient}")
            logger.info(f"Template API sent to {recipient}")
            return "SUCCESS"
        
        # If API fails (401/500), use SMTP fallback with manual branding
        print(f"[TEMPLATED_EMAIL] WARNING: Template API failed ({response.status_code}). Using SMTP Fallback.")
        logger.warning(f"Template API failed ({response.status_code}). Using SMTP Fallback.")
        return send_smtp_fallback(recipient, fallback_subject, fallback_html)
    except Exception as e:
        print(f"[TEMPLATED_EMAIL] ERROR: Failed to call ZeptoMail API: {str(e)}")
        logger.error(f"Failed to call ZeptoMail API: {e}")
        return send_smtp_fallback(recipient, fallback_subject, fallback_html)

def send_otp_email(email, otp):
    print(f"[OTP_EMAIL] Called for {email} with OTP {otp}")
    subject = f"{SMTP_SENDER_NAME}: Your Verification Code"
    html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f7fafc;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <h2 style="color: #2b6cb0;">{SMTP_SENDER_NAME} Verification</h2>
            <p>Hi,</p>
            <p>Your verification code is:</p>
            <div style="background: #ebf8ff; padding: 20px; text-align: center; border-radius: 6px; font-size: 32px; font-weight: bold; color: #2b6cb0; letter-spacing: 5px;">
                {otp}
            </div>
            <p style="color: #718096; font-size: 14px; margin-top: 30px;">Expires in 10 minutes.</p>
        </div>
    </body>
    </html>
    """
    print(f"[OTP_EMAIL] Calling send_templated_email with template_id={ZEPTO_OTP_TEMPLATE_ID}")
    result = send_templated_email(email, ZEPTO_OTP_TEMPLATE_ID, {"OTP": otp}, subject, html)
    print(f"[OTP_EMAIL] send_templated_email returned: {result}")
    return result

def send_password_reset_email(email, reset_link, username="User"):
    subject = f"Reset Password - {SMTP_SENDER_NAME}"
    html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <h2>Password Reset Request</h2>
            <p>Hi {username},</p>
            <p>Click the button below to reset your {SMTP_SENDER_NAME} password:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="{reset_link}" style="background-color: #3182ce; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
            </div>
            <p>Or copy this link: {reset_link}</p>
        </div>
    </body>
    </html>
    """
    return send_templated_email(email, ZEPTO_PWD_RESET_TEMPLATE_ID, {
        "username": username,
        "reset_password_link": reset_link
    }, subject, html)


