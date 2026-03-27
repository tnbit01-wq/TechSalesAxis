import boto3
from botocore.exceptions import ClientError
from src.core.config import AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET_NAME
import random
import string
import logging

logger = logging.getLogger(__name__)

# SES Client
ses_client = boto3.client(
    'ses',
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name=AWS_REGION
)

def generate_otp(length=6):
    """Generate a random numeric OTP."""
    return ''.join(random.choices(string.digits, k=length))

def send_email_ses(recipient, subject, body_html, body_text):
    """Universal SES email sender (MOCKED for testing)."""
    print(f"DEBUG: [MOCK SES] Sending email to {recipient}")
    print(f"DEBUG: [MOCK SES] Subject: {subject}")
    print(f"DEBUG: [MOCK SES] Text: {body_text}")
    return "MOCK_MESSAGE_ID"

def send_otp_email(email, otp):
    """Send OTP for registration/login."""
    subject = f"{otp} is your TechSales Axis verification code"
    body_text = f"Your verification code is {otp}. It will expire in 10 minutes."
    body_html = f"""
    <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #2563eb;">Verify your email</h2>
            <p>Use the following code to complete your sign-in to TechSales Axis:</p>
            <div style="background: #f3f4f6; padding: 15px; font-size: 24px; font-weight: bold; letter-spacing: 5px; text-align: center; border-radius: 8px;">
                {otp}
            </div>
            <p>This code will expire in 10 minutes. If you didn't request this, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="font-size: 12px; color: #6b7280;">&copy; 2024 TechSales Axis. All rights reserved.</p>
        </body>
    </html>
    """
    return send_email_ses(email, subject, body_html, body_text)

def send_password_reset_email(email, reset_link):
    """Send password reset link."""
    subject = "Reset your TechSales Axis password"
    body_text = f"Click the link to reset your password: {reset_link}"
    body_html = f"""
    <html>
        <body>
            <h2>Password Reset Request</h2>
            <p>We received a request to reset your password. Click the button below to proceed:</p>
            <a href="{reset_link}" style="display:inline-block; padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
            <p>If you didn't request this, no further action is required.</p>
        </body>
    </html>
    """
    return send_email_ses(email, subject, body_html, body_text)
