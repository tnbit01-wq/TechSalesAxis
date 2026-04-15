"""
EMAIL CONFIGURATION - AWS SES + ZOHO SETUP
Add to: apps/api/src/core/email_config.py (NEW FILE)

Configured for AWS SES with Zoho mail forwarding
Domain: techsalesaxis.ai
"""

import os
import logging
from typing import Optional, List
import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

# ============================================================================
# CONFIGURATION
# ============================================================================

AWS_REGION = os.getenv('MY_AWS_REGION', 'ap-south-1')
AWS_SES_SENDER_EMAIL = os.getenv(
    'AWS_SES_SENDER_EMAIL',
    'noreply@techsalesaxis.ai'
)

# Zoho mail credentials (for fallback if needed)
ZOHO_SMTP_HOST = os.getenv('ZOHO_SMTP_HOST', 'smtp.zoho.in')
ZOHO_SMTP_PORT = int(os.getenv('ZOHO_SMTP_PORT', '465'))
ZOHO_EMAIL = os.getenv('ZOHO_EMAIL', 'admin@techsalesaxis.ai')
ZOHO_PASSWORD = os.getenv('ZOHO_PASSWORD', '')

# Admin emails
ADMIN_EMAIL = 'admin@talentflow.com'
TALENT_TEAM_EMAIL = os.getenv('TALENT_TEAM_EMAIL', 'talent@techsalesaxis.ai')

# ============================================================================
# AWS SES CLIENT
# ============================================================================

class AWSEmailService:
    """AWS SES email service"""
    
    def __init__(self):
        self.client = boto3.client('ses', region_name=AWS_REGION)
    
    async def verify_email_address(self, email: str) -> bool:
        """
        Verify an email address in AWS SES.
        Only required for test environments. Production addresses are pre-verified.
        
        Args:
            email: Email address to verify
        
        Returns:
            True if verification email sent
        """
        try:
            response = self.client.verify_email_identity(EmailAddress=email)
            logger.info(f"Verification email sent to {email}")
            return True
        except ClientError as e:
            logger.error(f"Error verifying email {email}: {str(e)}")
            return False
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: Optional[str] = None,
        cc_emails: Optional[List[str]] = None,
        bcc_emails: Optional[List[str]] = None
    ) -> bool:
        """
        Send email via AWS SES.
        
        Args:
            to_email: Recipient email
            subject: Email subject
            html_body: HTML email body
            text_body: Plain text fallback
            cc_emails: CC recipients
            bcc_emails: BCC recipients
        
        Returns:
            True if sent successfully
        """
        try:
            # Prepare recipients
            destination = {'ToAddresses': [to_email]}
            if cc_emails:
                destination['CcAddresses'] = cc_emails
            if bcc_emails:
                destination['BccAddresses'] = bcc_emails
            
            # Send email
            response = self.client.send_email(
                Source=AWS_SES_SENDER_EMAIL,
                Destination=destination,
                Message={
                    'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                    'Body': {
                        'Html': {'Data': html_body, 'Charset': 'UTF-8'},
                    }
                }
            )
            
            logger.info(
                f"Email sent to {to_email} (MessageId: {response['MessageId']})"
            )
            return True
        
        except ClientError as e:
            logger.error(f"Error sending email to {to_email}: {str(e)}")
            return False
    
    async def send_bulk_email(
        self,
        to_emails: List[str],
        subject: str,
        html_body: str,
        text_body: Optional[str] = None
    ) -> dict:
        """
        Send bulk emails (one per recipient for personalization).
        
        Returns:
            {'success': int, 'failed': int, 'failed_emails': List[str]}
        """
        success = 0
        failed = 0
        failed_emails = []
        
        for email in to_emails:
            result = await self.send_email(email, subject, html_body, text_body)
            if result:
                success += 1
            else:
                failed += 1
                failed_emails.append(email)
        
        return {
            'success': success,
            'failed': failed,
            'failed_emails': failed_emails
        }


# ============================================================================
# EMAIL TEMPLATES
# ============================================================================

class EmailTemplates:
    """Email templates for bulk upload feature"""
    
    @staticmethod
    def candidate_invitation_html(
        candidate_name: str,
        device_registration_url: str,
        company_name: str = "TalentFlow"
    ) -> str:
        """HTML template for candidate invitation"""
        return f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2>Welcome to {company_name}!</h2>
                    
                    <p>Hi {candidate_name},</p>
                    
                    <p>Your resume has been added to our talent pool by our HR team. 
                    To complete your profile and explore job opportunities, please register your device:</p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{device_registration_url}" 
                           style="background-color: #007bff; color: white; padding: 12px 30px; 
                                  text-decoration: none; border-radius: 5px; display: inline-block;">
                            Complete Your Registration
                        </a>
                    </div>
                    
                    <p>Once registered, you'll be able to:</p>
                    <ul>
                        <li>View job recommendations matching your profile</li>
                        <li>Apply to open positions</li>
                        <li>Manage your professional profile</li>
                        <li>Receive job alerts</li>
                    </ul>
                    
                    <p>This link will expire in 7 days.</p>
                    
                    <p>Questions? Reply to this email or contact our support team.</p>
                    
                    <hr style="margin-top: 40px; border: none; border-top: 1px solid #ddd;">
                    <p style="font-size: 12px; color: #666;">
                        {company_name} | techsalesaxis.ai<br>
                        You received this email because your resume was uploaded for job matching.
                    </p>
                </div>
            </body>
        </html>
        """
    
    @staticmethod
    def candidate_invitation_text(
        candidate_name: str,
        device_registration_url: str,
        company_name: str = "TalentFlow"
    ) -> str:
        """Plain text template for candidate invitation"""
        return f"""
Welcome to {company_name}!

Hi {candidate_name},

Your resume has been added to our talent pool by our HR team. 
To complete your profile and explore job opportunities, please register your device:

{device_registration_url}

Once registered, you'll be able to:
- View job recommendations matching your profile
- Apply to open positions
- Manage your professional profile
- Receive job alerts

This link will expire in 7 days.

Questions? Reply to this email or contact our support team.

---
{company_name} | techsalesaxis.ai
You received this email because your resume was uploaded for job matching.
        """
    
    @staticmethod
    def admin_batch_completion_html(
        batch_name: str,
        total_candidates: int,
        new_profiles: int,
        duplicates_detected: int,
        dashboard_url: str
    ) -> str:
        """HTML template for admin batch completion notification"""
        return f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2>✓ Bulk Upload Complete</h2>
                    
                    <p>Batch: <strong>{batch_name}</strong></p>
                    
                    <div style="background-color: #f0f0f0; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p><strong>Processing Results:</strong></p>
                        <ul style="list-style: none; padding: 0;">
                            <li>📋 Total Candidates: <strong>{total_candidates}</strong></li>
                            <li>✨ New Profiles Created: <strong>{new_profiles}</strong></li>
                            <li>🔍 Duplicates Detected: <strong>{duplicates_detected}</strong></li>
                        </ul>
                    </div>
                    
                    <p>Review details and manage candidates in your admin dashboard:</p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{dashboard_url}" 
                           style="background-color: #28a745; color: white; padding: 12px 30px; 
                                  text-decoration: none; border-radius: 5px; display: inline-block;">
                            View Batch Details
                        </a>
                    </div>
                    
                    <hr style="margin-top: 40px; border: none; border-top: 1px solid #ddd;">
                    <p style="font-size: 12px; color: #666;">
                        TalentFlow Admin System<br>
                        {batch_name}
                    </p>
                </div>
            </body>
        </html>
        """


# ============================================================================
# ENVIRONMENT SETUP FOR .env FILE
# ============================================================================

"""
Add these to your .env file:

# AWS SES Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_SES_SENDER_EMAIL=noreply@techsalesaxis.ai

# Admin Emails
ADMIN_EMAIL=admin@talentflow.com
TALENT_TEAM_EMAIL=talent@techsalesaxis.ai

# Zoho Fallback (optional)
ZOHO_SMTP_HOST=smtp.zoho.in
ZOHO_SMTP_PORT=465
ZOHO_EMAIL=admin@techsalesaxis.ai
ZOHO_PASSWORD=your-zoho-password

To get AWS credentials:
1. Go to AWS IAM Console
2. Create new user: talentflow-ses
3. Attach policy: AmazonSESFullAccess
4. Generate access key (CSV)
5. Add key/secret to .env

To set up Zoho email forwarding:
1. Go to Zoho Mail Admin Console
2. Create email: talent@techsalesaxis.ai
3. Set up forwarding to admin@talentflow.com (optional)
4. Store credentials in .env
"""

# ============================================================================
# INITIALIZATION
# ============================================================================

def init_email_service():
    """Initialize email service (called on app startup)"""
    try:
        service = AWSEmailService()
        logger.info(f"Email service initialized (AWS SES, Region: {AWS_REGION})")
        logger.info(f"Sender: {AWS_SES_SENDER_EMAIL}")
        return service
    except Exception as e:
        logger.error(f"Failed to initialize email service: {str(e)}")
        raise

# Global instance
email_service = None

def get_email_service() -> AWSEmailService:
    """Get email service instance"""
    global email_service
    if email_service is None:
        email_service = init_email_service()
    return email_service
