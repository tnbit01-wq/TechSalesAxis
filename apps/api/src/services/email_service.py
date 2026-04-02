import boto3
from botocore.exceptions import ClientError
from src.core.config import (
    AWS_ACCESS_KEY_ID, 
    AWS_SECRET_ACCESS_KEY, 
    AWS_REGION,
    AWS_SES_SENDER_EMAIL
)
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
    """Universal SES email sender using AWS SDK."""
    try:
        response = ses_client.send_email(
            Source=AWS_SES_SENDER_EMAIL,
            Destination={
                'ToAddresses': [recipient],
            },
            Message={
                'Body': {
                    'Html': {
                        'Charset': "UTF-8",
                        'Data': body_html,
                    },
                    'Text': {
                        'Charset': "UTF-8",
                        'Data': body_text,
                    },
                },
                'Subject': {
                    'Charset': "UTF-8",
                    'Data': subject,
                },
            }
        )
        logger.info(f"Email sent successfully to {recipient}. Message ID: {response['MessageId']}")
        return response['MessageId']
    except ClientError as e:
        logger.error(f"Failed to send email to {recipient}: {e.response['Error']['Message']}")
        # Fallback to console print for debugging if identity not verified
        print(f"DEBUG: [SES ERROR] {e.response['Error']['Message']}")
        return None

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

def send_invite_email(email, invite_link, inviter_name="TalentFlow Team"):
    """Send platform invitation email."""
    subject = f"You're invited to join {inviter_name} on TechSales Axis"
    body_text = f"Welcome! You've been invited to join TechSales Axis. Click here to join: {invite_link}"
    body_html = f"""
    <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #2563eb;">You're Invited!</h2>
            <p>Hello,</p>
            <p><strong>{inviter_name}</strong> has invited you to join the TechSales Axis platform.</p>
            <p>Click the button below to accept your invitation and set up your account:</p>
            <div style="margin: 30px 0;">
                <a href="{invite_link}" style="background-color: #2563eb; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Accept Invitation</a>
            </div>
            <p>If the button above doesn't work, copy and paste this link into your browser:</p>
            <p style="color: #6b7280; font-size: 13px;">{invite_link}</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="font-size: 12px; color: #6b7280;">&copy; 2024 TechSales Axis. All rights reserved.</p>
        </body>
    </html>
    """
    return send_email_ses(email, subject, body_html, body_text)

def send_bulk_upload_complete_email(email, batch_id, total_count, success_count):
    """Send notification when bulk resume upload is processed."""
    subject = f"Bulk Upload Processing Complete - Batch {batch_id}"
    body_text = f"Your bulk upload (Batch {batch_id}) has been processed. {success_count} of {total_count} resumes were successfully parsed."
    body_html = f"""
    <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #059669;">Bulk Upload Processed</h2>
            <p>Your resume batch upload is complete.</p>
            <div style="background: #f0fdf4; border: 1px solid #dcfce7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Batch ID:</strong> {batch_id}</p>
                <p><strong>Total Resumes:</strong> {total_count}</p>
                <p><strong>Successfully Parsed:</strong> {success_count}</p>
                <p><strong>Failures:</strong> {total_count - success_count}</p>
            </div>
            <p>You can view the detailed report in your dashboard.</p>
        </body>
    </html>
    """
    return send_email_ses(email, subject, body_html, body_text)
