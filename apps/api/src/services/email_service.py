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
    ZEPTO_API_KEY,
    SMTP_FROM_EMAIL,
    SMTP_SENDER_NAME,
    ZEPTO_OTP_TEMPLATE_ID,
    ZEPTO_PWD_RESET_TEMPLATE_ID,
    ZEPTO_JOB_INVITE_TEMPLATE_ID,
    ZEPTO_SHORTLIST_TEMPLATE_ID,
    ZEPTO_REJECTION_TEMPLATE_ID,
    ZEPTO_INTERVIEW_PROPOSED_TEMPLATE_ID,
    ZEPTO_INTERVIEW_CONFIRMED_TEMPLATE_ID,
    ZEPTO_OFFER_TEMPLATE_ID,
    FRONTEND_URL
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
    print(f"[TEMPLATED_EMAIL] ZEPTO_API_KEY is set: {bool(ZEPTO_API_KEY)}")
    
    if not ZEPTO_API_KEY:
        print(f"[TEMPLATED_EMAIL] ERROR: ZEPTO_API_KEY is empty, cannot proceed")
        return None

    # ZeptoMail App API
    url = "https://api.zeptomail.in/v1.1/email/template"
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        # ZeptoMail template API expects this auth scheme.
        "Authorization": f"Zoho-enczapikey {ZEPTO_API_KEY}"
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

def send_otp_email(email, otp, name="User"):
    print(f"[OTP_EMAIL] Called for {email} with OTP {otp} and name {name}")
    subject = f"{SMTP_SENDER_NAME}: Your Verification Code"
    html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f7fafc;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <h2 style="color: #2b6cb0;">{SMTP_SENDER_NAME} Verification</h2>
            <p>Hi {name},</p>
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

def send_password_reset_email(email, reset_link, username="User", token=None):
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
    merge_info = {
        "username": username,
        "reset_password_link": reset_link,
        "reset_link": reset_link,
        "reset_url": reset_link
    }

    if token:
        merge_info["token"] = token

    return send_templated_email(email, ZEPTO_PWD_RESET_TEMPLATE_ID, merge_info, subject, html)


def send_job_invite_email(recipient, candidate_name, recruiter_name, job_title, message, company_name="TechSales Axis"):
    print(f"[JOB_INVITE_EMAIL] Called for {recipient} regarding {job_title} at {company_name}")
    subject = f"New Career Opportunity: {job_title} at {company_name}"
    html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f7fafc; color: #2d3748;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #dd6b20; margin-top: 0;">New Opportunity Awaiting!</h2>
            <p>Hi {candidate_name},</p>
            <p><strong>{recruiter_name}</strong> has invited you to explore the <strong>{job_title}</strong> role at <strong>{company_name}</strong>.</p>
            <div style="background: #fffaf0; padding: 20px; border-left: 4px solid #dd6b20; border-radius: 6px; font-style: italic; margin: 20px 0;">
                "{message}"
            </div>
            <div style="text-align: center; margin: 30px 0;">
                <a href="{FRONTEND_URL}/login" style="background-color: #dd6b20; color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">View Opportunity</a>
            </div>
            <p style="color: #718096; font-size: 12px; border-top: 1px solid #edf2f7; padding-top: 20px;">This email was sent on behalf of {company_name}.</p>
        </div>
    </body>
    </html>
    """
    merge_info = {
        "candidate_name": candidate_name,
        "recruiter_name": recruiter_name,
        "job_title": job_title,
        "message": message,
        "company_name": company_name
    }
    return send_templated_email(recipient, ZEPTO_JOB_INVITE_TEMPLATE_ID, merge_info, subject, html)


def send_shortlist_email(recipient, candidate_name, job_title, custom_message=None, company_name="TechSales Axis"):
    print(f"[SHORTLIST_EMAIL] Called for {recipient} regarding {job_title} at {company_name}")
    subject = f"Application Status Update: Shortlisted for {job_title} at {company_name}"
    feedback_section = ""
    if custom_message:
        feedback_section = f"""
        <div style="background: #ebf8ff; padding: 20px; border-left: 4px solid #3182ce; border-radius: 6px; margin: 20px 0;">
            <strong style="color: #2b6cb0; display: block; margin-bottom: 5px;">Recruiter Note:</strong>
            "{custom_message}"
        </div>
        """
    html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f7fafc; color: #2d3748;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #3182ce; margin-top: 0;">Congratulations, {candidate_name}!</h2>
            <p>We are thrilled to let you know that you have been <strong>shortlisted</strong> for the <strong>{job_title}</strong> role at <strong>{company_name}</strong>.</p>
            {feedback_section}
            <p>Our team will reach out to you shortly, or you can check your dashboard to select/update interview slots.</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="{FRONTEND_URL}/dashboard/candidate/applications" style="background-color: #3182ce; color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Go to Dashboard</a>
            </div>
            <p style="color: #718096; font-size: 12px; border-top: 1px solid #edf2f7; padding-top: 20px;">This email was sent on behalf of {company_name}.</p>
        </div>
    </body>
    </html>
    """
    merge_info = {
        "candidate_name": candidate_name,
        "job_title": job_title,
        "message": custom_message or "Congratulations! You have been shortlisted.",
        "company_name": company_name
    }
    return send_templated_email(recipient, ZEPTO_SHORTLIST_TEMPLATE_ID, merge_info, subject, html)


def send_rejection_email(recipient, candidate_name, job_title, custom_message=None, company_name="TechSales Axis"):
    print(f"[REJECTION_EMAIL] Called for {recipient} regarding {job_title} at {company_name}")
    subject = f"Application Update: {job_title} at {company_name}"
    feedback_section = ""
    if custom_message:
        feedback_section = f"""
        <div style="background: #f7fafc; padding: 20px; border-left: 4px solid #a0aec0; border-radius: 6px; margin: 20px 0;">
            <strong style="color: #4a5568; display: block; margin-bottom: 5px;">Evaluation Feedback:</strong>
            "{custom_message}"
        </div>
        """
    html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f7fafc; color: #2d3748;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #4a5568; margin-top: 0;">Thank You, {candidate_name}</h2>
            <p>Thank you for taking the time to apply and interview for the <strong>{job_title}</strong> role at <strong>{company_name}</strong>.</p>
            <p>We appreciated learning about your skills and experience. Unfortunately, we have decided to move forward with other candidates at this time.</p>
            {feedback_section}
            <p>We wish you the very best in your job search and future professional endeavors.</p>
            <p style="color: #718096; font-size: 12px; border-top: 1px solid #edf2f7; padding-top: 20px;">This email was sent on behalf of {company_name}.</p>
        </div>
    </body>
    </html>
    """
    merge_info = {
        "candidate_name": candidate_name,
        "job_title": job_title,
        "message": custom_message or "Thank you for your interest. We decided to move forward with other candidates.",
        "company_name": company_name
    }
    return send_templated_email(recipient, ZEPTO_REJECTION_TEMPLATE_ID, merge_info, subject, html)


def send_interview_proposed_email(recipient, candidate_name, job_title, round_name, slots_details, company_name="TechSales Axis"):
    print(f"[INTERVIEW_PROPOSED_EMAIL] Called for {recipient} regarding {job_title} at {company_name}")
    subject = f"Interview Scheduling: {round_name} for {job_title} at {company_name}"
    html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f7fafc; color: #2d3748;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #805ad5; margin-top: 0;">Schedule Your Interview</h2>
            <p>Hi {candidate_name},</p>
            <p>A recruiter from <strong>{company_name}</strong> has proposed slots for your <strong>{round_name}</strong> for the <strong>{job_title}</strong> position.</p>
            <p><strong>Proposed Slots:</strong></p>
            <div style="background: #faf5ff; padding: 15px; border-radius: 8px; font-weight: bold; color: #805ad5; margin: 15px 0;">
                {slots_details}
            </div>
            <p>Please log in to your dashboard to confirm your preferred slot.</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="{FRONTEND_URL}/dashboard/candidate/applications" style="background-color: #805ad5; color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Confirm Slot</a>
            </div>
            <p style="color: #718096; font-size: 12px; border-top: 1px solid #edf2f7; padding-top: 20px;">This email was sent on behalf of {company_name}.</p>
        </div>
    </body>
    </html>
    """
    merge_info = {
        "candidate_name": candidate_name,
        "job_title": job_title,
        "round_name": round_name,
        "slots_details": slots_details,
        "company_name": company_name
    }
    return send_templated_email(recipient, ZEPTO_INTERVIEW_PROPOSED_TEMPLATE_ID, merge_info, subject, html)


def send_interview_confirmed_email(recipient, recipient_name, other_name, job_title, round_name, time_str, meeting_link=None, is_recruiter=False, company_name="TechSales Axis"):
    print(f"[INTERVIEW_CONFIRMED_EMAIL] Called for {recipient} (Recruiter: {is_recruiter}) at {company_name}")
    subject = f"Confirmed: {round_name} - {other_name} ({job_title}) at {company_name}"
    
    role_description = f"with candidate <strong>{other_name}</strong>" if is_recruiter else f"with recruiter <strong>{other_name}</strong> from <strong>{company_name}</strong>"
    meeting_details = ""
    if meeting_link:
        meeting_details = f"""
        <p><strong>Video Link (Jitsi):</strong></p>
        <div style="margin: 20px 0;">
            <a href="{meeting_link}" style="background-color: #38a169; color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Join Video Call</a>
        </div>
        """
        if is_recruiter:
            meeting_details += f"""
            <p style="font-size: 11px; color: #e53e3e; font-weight: bold;">Note: As a host, you might need to log in to Jitsi Meet to launch the room if prompted.</p>
            """
        else:
            meeting_details += f"""
            <p style="font-size: 11px; color: #718096;">Note: The meeting will start once the recruiter (host) logs in and joins the call.</p>
            """
        
    html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f7fafc; color: #2d3748;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #38a169; margin-top: 0;">Interview Confirmed!</h2>
            <p>Hi {recipient_name},</p>
            <p>Your <strong>{round_name}</strong> {role_description} for the <strong>{job_title}</strong> role is scheduled.</p>
            <p><strong>Time:</strong> {time_str}</p>
            {meeting_details}
            <p style="color: #718096; font-size: 12px; border-top: 1px solid #edf2f7; padding-top: 20px;">This email was sent on behalf of {company_name}.</p>
        </div>
    </body>
    </html>
    """
    merge_info = {
        "recipient_name": recipient_name,
        "other_name": other_name,
        "job_title": job_title,
        "round_name": round_name,
        "time_str": time_str,
        "meeting_link": meeting_link or "",
        "company_name": company_name
    }
    return send_templated_email(recipient, ZEPTO_INTERVIEW_CONFIRMED_TEMPLATE_ID, merge_info, subject, html)


def send_offer_email(recipient, candidate_name, job_title, custom_message=None, company_name="TechSales Axis"):
    print(f"[OFFER_EMAIL] Called for {recipient} regarding {job_title} at {company_name}")
    subject = f"Congratulations! Job Offer for {job_title} at {company_name}"
    feedback_section = ""
    if custom_message:
        feedback_section = f"""
        <div style="background: #f0fff4; padding: 20px; border-left: 4px solid #38a169; border-radius: 6px; margin: 20px 0;">
            <strong style="color: #276749; display: block; margin-bottom: 5px;">Hiring Team Feedback:</strong>
            "{custom_message}"
        </div>
        """
    html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f7fafc; color: #2d3748;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #38a169; margin-top: 0;">Congratulations, {candidate_name}!</h2>
            <p>We are absolutely thrilled to extend you a <strong>job offer</strong> for the <strong>{job_title}</strong> role at <strong>{company_name}</strong>.</p>
            {feedback_section}
            <p>Please log in to your dashboard to review the details and accept the offer. Welcome to the team!</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="{FRONTEND_URL}/dashboard/candidate/applications" style="background-color: #38a169; color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Review Offer</a>
            </div>
            <p style="color: #718096; font-size: 12px; border-top: 1px solid #edf2f7; padding-top: 20px;">This email was sent on behalf of {company_name}.</p>
        </div>
    </body>
    </html>
    """
    merge_info = {
        "candidate_name": candidate_name,
        "job_title": job_title,
        "message": custom_message or "Congratulations! You have received a job offer.",
        "company_name": company_name
    }
    return send_templated_email(recipient, ZEPTO_OFFER_TEMPLATE_ID, merge_info, subject, html)


