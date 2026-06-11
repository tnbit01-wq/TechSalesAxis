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

def ensure_www_in_urls(text_or_dict):
    if isinstance(text_or_dict, str):
        s = text_or_dict
        s = s.replace("https://www.techsalesaxis.com", "https://techsalesaxis.com")
        s = s.replace("https://techsalesaxis.com", "https://www.techsalesaxis.com")
        s = s.replace("http://www.techsalesaxis.com", "http://techsalesaxis.com")
        s = s.replace("http://techsalesaxis.com", "http://www.techsalesaxis.com")
        return s
    elif isinstance(text_or_dict, dict):
        return {k: ensure_www_in_urls(v) for k, v in text_or_dict.items()}
    elif isinstance(text_or_dict, list):
        return [ensure_www_in_urls(item) for item in text_or_dict]
    else:
        return text_or_dict

def send_templated_email(recipient, template_id, merge_info, fallback_subject="", fallback_html=""):
    # Enforce www.techsalesaxis.com for all links
    merge_info = ensure_www_in_urls(merge_info)
    fallback_subject = ensure_www_in_urls(fallback_subject)
    fallback_html = ensure_www_in_urls(fallback_html)

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
    <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
    <html xmlns="http://www.w3.org/1999/xhtml">
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
        <title>New Opportunity Awaiting</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    </head>
    <body style="margin: 0; padding: 0; background-color: #F6F9FC; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#F6F9FC" style="table-layout: fixed;">
            <tr>
                <td align="center" style="padding: 40px 0;">
                    <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 12px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                        <!-- Brand Header -->
                        <tr>
                            <td bgcolor="#FF8A00" align="left" style="padding: 30px 40px;">
                                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                    <tr>
                                        <td style="color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">
                                            TechSales<span style="color: #FFE6CC;">Axis</span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="color: #FFE6CC; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; padding-top: 4px;">
                                            Elite Talent Matching
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        
                        <!-- Content Body -->
                        <tr>
                            <td style="padding: 40px 40px 30px 40px; color: #334155; font-size: 16px; line-height: 24px;">
                                <h2 style="color: #0F172A; font-size: 20px; font-weight: 800; margin-top: 0; margin-bottom: 16px;">
                                    Exclusive Career Invitation
                                </h2>
                                <p style="margin-top: 0; margin-bottom: 16px;">
                                    Hi {candidate_name},
                                </p>
                                <p style="margin-top: 0; margin-bottom: 20px;">
                                    <strong>{recruiter_name}</strong> from <strong>{company_name}</strong> has invited you to explore the <strong>{job_title}</strong> role in their team. They reviewed your profile on TechSales Axis and believe your background is a strong match.
                                </p>
                                
                                <!-- Personalized Message Block -->
                                <table border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#FFF8F1" style="border-left: 4px solid #FF8A00; border-radius: 6px; margin-bottom: 24px;">
                                    <tr>
                                        <td style="padding: 18px 20px; font-size: 14px; line-height: 22px; color: #1E293B; font-style: italic;">
                                            <strong style="color: #C96B00; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; display: block; font-style: normal; margin-bottom: 6px;">
                                                Personal Note from {recruiter_name}
                                            </strong>
                                            "{message}"
                                        </td>
                                    </tr>
                                </table>

                                <!-- Platform Benefits -->
                                <p style="margin-top: 0; margin-bottom: 8px; font-weight: bold; font-size: 14px; text-transform: uppercase; color: #0F172A; letter-spacing: 0.5px;">
                                    Explore the Role on TechSales Axis
                                </p>
                                <ul style="margin-top: 0; margin-bottom: 30px; padding-left: 20px; font-size: 14px; line-height: 22px; color: #475569;">
                                    <li style="margin-bottom: 6px;">
                                        <strong>Direct Interaction:</strong> Chat directly with the hiring manager without filters.
                                    </li>
                                    <li style="margin-bottom: 6px;">
                                        <strong>Full Transparency:</strong> See full specifications, requirements, and compatibility scores.
                                    </li>
                                </ul>

                                <!-- Bulletproof CTA Button -->
                                <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin-top: 10px; margin-bottom: 10px;">
                                    <tr>
                                        <td align="center" style="border-radius: 8px;" bgcolor="#FF8A00">
                                            <a href="{FRONTEND_URL}/login" target="_blank" style="font-size: 14px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; border-radius: 8px; padding: 14px 28px; border: 1px solid #FF8A00; display: inline-block; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
                                                View Opportunity
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        <!-- Footer -->
                        <tr>
                            <td bgcolor="#F8FAFC" style="padding: 30px 40px; border-top: 1px solid #E2E8F0; text-align: center; color: #94A3B8; font-size: 12px; line-height: 18px;">
                                This email was sent by TechSales Axis on behalf of {company_name}. If you wish to manage your notification preferences, please log in and update your account settings.
                                <br/><br/>
                                © 2026 TechSales Axis. All Rights Reserved.
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
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


def send_job_application_candidate_email(recipient, candidate_name, candidate_email, job_title, company_name, recruiter_name, recruiter_email):
    from datetime import datetime
    print(f"[CANDIDATE_APPLICATION_EMAIL] Called for {recipient} regarding {job_title} at {company_name}")
    subject = f"Application Received: {job_title} at {company_name}"
    date_str = datetime.now().strftime("%B %d, %Y")
    
    html = f"""
    <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
    <html xmlns="http://www.w3.org/1999/xhtml">
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
        <title>Application Received</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    </head>
    <body style="margin: 0; padding: 0; background-color: #F6F9FC; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#F6F9FC" style="table-layout: fixed;">
            <tr>
                <td align="center" style="padding: 40px 0;">
                    <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 12px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                        <!-- Brand Header -->
                        <tr>
                            <td bgcolor="#FF8A00" align="left" style="padding: 30px 40px;">
                                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                    <tr>
                                        <td style="color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">
                                            TechSales<span style="color: #FFE6CC;">Axis</span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="color: #FFE6CC; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; padding-top: 4px;">
                                            Elite Talent Matching
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        
                        <!-- Content Body -->
                        <tr>
                            <td style="padding: 40px 40px 30px 40px; color: #334155; font-size: 16px; line-height: 24px;">
                                <h2 style="color: #0F172A; font-size: 20px; font-weight: 800; margin-top: 0; margin-bottom: 16px;">
                                    Application Received!
                                </h2>
                                <p style="margin-top: 0; margin-bottom: 16px;">
                                    Hi {candidate_name},
                                </p>
                                <p style="margin-top: 0; margin-bottom: 20px;">
                                    Thank you for applying for the <strong>{job_title}</strong> position at <strong>{company_name}</strong> via TechSales Axis. We have successfully transmitted your profile to the hiring team.
                                </p>
                                
                                <!-- Details Table -->
                                <table border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#F8FAFC" style="border-radius: 8px; margin-bottom: 24px;">
                                    <tr>
                                        <td style="padding: 20px; font-size: 14px; line-height: 22px; color: #1E293B;">
                                            <strong style="color: #FF8A00; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 8px;">
                                                Application Details
                                            </strong>
                                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                                <tr>
                                                    <td width="40%" style="color: #64748B; padding: 6px 0;">Candidate Name:</td>
                                                    <td style="font-weight: bold; color: #0F172A; padding: 6px 0;">{candidate_name}</td>
                                                </tr>
                                                <tr>
                                                    <td style="color: #64748B; padding: 6px 0;">Candidate Email:</td>
                                                    <td style="color: #0F172A; padding: 6px 0;">{candidate_email}</td>
                                                </tr>
                                                <tr>
                                                    <td style="color: #64748B; padding: 6px 0;">Applied Role:</td>
                                                    <td style="font-weight: bold; color: #0F172A; padding: 6px 0;">{job_title}</td>
                                                </tr>
                                                <tr>
                                                    <td style="color: #64748B; padding: 6px 0;">Company Name:</td>
                                                    <td style="font-weight: bold; color: #0F172A; padding: 6px 0;">{company_name}</td>
                                                </tr>
                                                <tr>
                                                    <td style="color: #64748B; padding: 6px 0;">Recruiter Name:</td>
                                                    <td style="color: #0F172A; padding: 6px 0;">{recruiter_name}</td>
                                                </tr>
                                                <tr>
                                                    <td style="color: #64748B; padding: 6px 0;">Recruiter Email:</td>
                                                    <td style="color: #0F172A; padding: 6px 0;">{recruiter_email}</td>
                                                </tr>
                                                <tr>
                                                    <td style="color: #64748B; padding: 6px 0;">Application Date:</td>
                                                    <td style="color: #0F172A; padding: 6px 0;">{date_str}</td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>

                                <p style="margin-top: 0; margin-bottom: 24px;">
                                    You can track the status of your application, receive updates, and interact directly with the recruiter from your candidate dashboard.
                                </p>

                                <!-- Bulletproof CTA Button -->
                                <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin-top: 10px; margin-bottom: 10px;">
                                    <tr>
                                        <td align="center" style="border-radius: 8px;" bgcolor="#FF8A00">
                                            <a href="{FRONTEND_URL}/dashboard/candidate/applications" target="_blank" style="font-size: 14px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; border-radius: 8px; padding: 14px 28px; border: 1px solid #FF8A00; display: inline-block; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
                                                Track Application
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        <!-- Footer -->
                        <tr>
                            <td bgcolor="#F8FAFC" style="padding: 30px 40px; border-top: 1px solid #E2E8F0; text-align: center; color: #94A3B8; font-size: 12px; line-height: 18px;">
                                This email was sent by TechSales Axis. If you wish to manage your notification preferences, please log in and update your account settings.
                                <br/><br/>
                                © 2026 TechSales Axis. All Rights Reserved.
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    merge_info = {
        "candidate_name": candidate_name,
        "candidate_email": candidate_email,
        "job_title": job_title,
        "company_name": company_name,
        "recruiter_name": recruiter_name,
        "recruiter_email": recruiter_email,
        "date_str": date_str
    }
    return send_templated_email(recipient, "", merge_info, subject, html)


def send_job_application_recruiter_email(recipient, recruiter_name, recruiter_email, candidate_name, candidate_email, job_title, company_name, experience_str, resume_link=None, skills=None):
    from datetime import datetime
    print(f"[RECRUITER_APPLICATION_EMAIL] Called for {recipient} regarding {candidate_name} applying for {job_title}")
    subject = f"New Job Application: {candidate_name} - {job_title}"
    date_str = datetime.now().strftime("%B %d, %Y")
    
    skills_section = ""
    if skills:
        skills_section = f"""
        <tr>
            <td style="color: #64748B; padding: 6px 0; vertical-align: top;">Key Skills:</td>
            <td style="color: #0F172A; padding: 6px 0;">{skills}</td>
        </tr>
        """
        
    resume_section = ""
    if resume_link:
        resume_section = f"""
        <tr>
            <td style="color: #64748B; padding: 6px 0; vertical-align: top;">Resume:</td>
            <td style="padding: 6px 0;"><a href="{resume_link}" style="color: #FF8A00; font-weight: bold; text-decoration: none;">View Resume Document</a></td>
        </tr>
        """

    html = f"""
    <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
    <html xmlns="http://www.w3.org/1999/xhtml">
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
        <title>New Job Application</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    </head>
    <body style="margin: 0; padding: 0; background-color: #F6F9FC; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#F6F9FC" style="table-layout: fixed;">
            <tr>
                <td align="center" style="padding: 40px 0;">
                    <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 12px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                        <!-- Brand Header -->
                        <tr>
                            <td bgcolor="#FF8A00" align="left" style="padding: 30px 40px;">
                                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                    <tr>
                                        <td style="color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">
                                            TechSales<span style="color: #FFE6CC;">Axis</span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="color: #FFE6CC; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; padding-top: 4px;">
                                            Elite Talent Matching
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        
                        <!-- Content Body -->
                        <tr>
                            <td style="padding: 40px 40px 30px 40px; color: #334155; font-size: 16px; line-height: 24px;">
                                <h2 style="color: #0F172A; font-size: 20px; font-weight: 800; margin-top: 0; margin-bottom: 16px;">
                                    New Job Application Received
                                </h2>
                                <p style="margin-top: 0; margin-bottom: 16px;">
                                    Hi {recruiter_name},
                                </p>
                                <p style="margin-top: 0; margin-bottom: 20px;">
                                    A new candidate has applied for the <strong>{job_title}</strong> position at <strong>{company_name}</strong>. Below is a summary of their application details.
                                </p>
                                
                                <!-- Details Table -->
                                <table border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#F8FAFC" style="border-radius: 8px; margin-bottom: 24px;">
                                    <tr>
                                        <td style="padding: 20px; font-size: 14px; line-height: 22px; color: #1E293B;">
                                            <strong style="color: #FF8A00; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 8px;">
                                                Candidate Profile Summary
                                            </strong>
                                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                                <tr>
                                                    <td width="40%" style="color: #64748B; padding: 6px 0;">Recruiter Name:</td>
                                                    <td style="font-weight: bold; color: #0F172A; padding: 6px 0;">{recruiter_name}</td>
                                                </tr>
                                                <tr>
                                                    <td style="color: #64748B; padding: 6px 0;">Recruiter Email:</td>
                                                    <td style="color: #0F172A; padding: 6px 0;">{recruiter_email}</td>
                                                </tr>
                                                <tr>
                                                    <td style="color: #64748B; padding: 6px 0;">Candidate Name:</td>
                                                    <td style="font-weight: bold; color: #0F172A; padding: 6px 0;">{candidate_name}</td>
                                                </tr>
                                                <tr>
                                                    <td style="color: #64748B; padding: 6px 0;">Candidate Email:</td>
                                                    <td style="color: #0F172A; padding: 6px 0;">{candidate_email}</td>
                                                </tr>
                                                <tr>
                                                    <td style="color: #64748B; padding: 6px 0;">Candidate Experience:</td>
                                                    <td style="font-weight: bold; color: #0F172A; padding: 6px 0;">{experience_str}</td>
                                                </tr>
                                                <tr>
                                                    <td style="color: #64748B; padding: 6px 0;">Applied Role:</td>
                                                    <td style="font-weight: bold; color: #0F172A; padding: 6px 0;">{job_title}</td>
                                                </tr>
                                                <tr>
                                                    <td style="color: #64748B; padding: 6px 0;">Company Name:</td>
                                                    <td style="font-weight: bold; color: #0F172A; padding: 6px 0;">{company_name}</td>
                                                </tr>
                                                {skills_section}
                                                {resume_section}
                                                <tr>
                                                    <td style="color: #64748B; padding: 6px 0;">Application Date:</td>
                                                    <td style="color: #0F172A; padding: 6px 0;">{date_str}</td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>

                                <p style="margin-top: 0; margin-bottom: 24px;">
                                    You can review their full candidate profile, manage application status, and schedule interviews directly from the recruiter dashboard.
                                </p>

                                <!-- Bulletproof CTA Button -->
                                <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin-top: 10px; margin-bottom: 10px;">
                                    <tr>
                                        <td align="center" style="border-radius: 8px;" bgcolor="#FF8A00">
                                            <a href="{FRONTEND_URL}/dashboard/recruiter/applications" target="_blank" style="font-size: 14px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; border-radius: 8px; padding: 14px 28px; border: 1px solid #FF8A00; display: inline-block; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
                                                Review Application
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        <!-- Footer -->
                        <tr>
                            <td bgcolor="#F8FAFC" style="padding: 30px 40px; border-top: 1px solid #E2E8F0; text-align: center; color: #94A3B8; font-size: 12px; line-height: 18px;">
                                This email was sent by TechSales Axis on behalf of {company_name}. If you wish to manage your notification preferences, please log in and update your settings.
                                <br/><br/>
                                © 2026 TechSales Axis. All Rights Reserved.
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    merge_info = {
        "recruiter_name": recruiter_name,
        "recruiter_email": recruiter_email,
        "candidate_name": candidate_name,
        "candidate_email": candidate_email,
        "job_title": job_title,
        "company_name": company_name,
        "experience_str": experience_str,
        "skills": skills or "",
        "resume_link": resume_link or "",
        "date_str": date_str
    }
    return send_templated_email(recipient, "", merge_info, subject, html)


def send_job_posted_recruiter_email(recipient, recruiter_name, job_title, company_name, location, salary_range):
    print(f"[JOB_POSTED_EMAIL] Called for {recipient} regarding {job_title} at {company_name}")
    subject = f"Job Posted Successfully: {job_title} - {company_name}"
    html = f"""
    <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
    <html xmlns="http://www.w3.org/1999/xhtml">
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
        <title>Job Posted Successfully</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    </head>
    <body style="margin: 0; padding: 0; background-color: #F6F9FC; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#F6F9FC" style="table-layout: fixed;">
            <tr>
                <td align="center" style="padding: 40px 0;">
                    <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 12px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                        <!-- Brand Header -->
                        <tr>
                            <td bgcolor="#FF8A00" align="left" style="padding: 30px 40px;">
                                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                    <tr>
                                        <td style="color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">
                                            TechSales<span style="color: #FFE6CC;">Axis</span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="color: #FFE6CC; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; padding-top: 4px;">
                                            Elite Talent Matching
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        
                        <!-- Content Body -->
                        <tr>
                            <td style="padding: 40px 40px 30px 40px; color: #334155; font-size: 16px; line-height: 24px;">
                                <h2 style="color: #0F172A; font-size: 20px; font-weight: 800; margin-top: 0; margin-bottom: 16px;">
                                    Job Listing Active!
                                </h2>
                                <p style="margin-top: 0; margin-bottom: 16px;">
                                    Hi {recruiter_name},
                                </p>
                                <p style="margin-top: 0; margin-bottom: 20px;">
                                    Your job post for <strong>{job_title}</strong> is now live on the TechSales Axis marketplace. Candidate applications will begin transmitting to your dashboard immediately.
                                </p>
                                
                                <!-- Details Table -->
                                <table border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#F8FAFC" style="border-radius: 8px; margin-bottom: 24px;">
                                    <tr>
                                        <td style="padding: 20px; font-size: 14px; line-height: 22px; color: #1E293B;">
                                            <strong style="color: #FF8A00; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 8px;">
                                                Job Details
                                            </strong>
                                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                                <tr>
                                                    <td width="40%" style="color: #64748B; padding: 6px 0;">Title:</td>
                                                    <td style="font-weight: bold; color: #0F172A; padding: 6px 0;">{job_title}</td>
                                                </tr>
                                                <tr>
                                                    <td style="color: #64748B; padding: 6px 0;">Company:</td>
                                                    <td style="font-weight: bold; color: #0F172A; padding: 6px 0;">{company_name}</td>
                                                </tr>
                                                <tr>
                                                    <td style="color: #64748B; padding: 6px 0;">Location:</td>
                                                    <td style="color: #0F172A; padding: 6px 0;">{location or 'Remote'}</td>
                                                </tr>
                                                <tr>
                                                    <td style="color: #64748B; padding: 6px 0;">Salary Range:</td>
                                                    <td style="color: #0F172A; padding: 6px 0;">{salary_range or 'Not specified'}</td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>

                                <!-- Bulletproof CTA Button -->
                                <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin-top: 10px; margin-bottom: 10px;">
                                    <tr>
                                        <td align="center" style="border-radius: 8px;" bgcolor="#FF8A00">
                                            <a href="{FRONTEND_URL}/dashboard/recruiter/applications" target="_blank" style="font-size: 14px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; border-radius: 8px; padding: 14px 28px; border: 1px solid #FF8A00; display: inline-block; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
                                                View Recruiter Dashboard
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        <!-- Footer -->
                        <tr>
                            <td bgcolor="#F8FAFC" style="padding: 30px 40px; border-top: 1px solid #E2E8F0; text-align: center; color: #94A3B8; font-size: 12px; line-height: 18px;">
                                This email was sent by TechSales Axis. If you wish to manage your notification preferences, please log in and update your account settings.
                                <br/><br/>
                                © 2026 TechSales Axis. All Rights Reserved.
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    merge_info = {
        "recruiter_name": recruiter_name,
        "job_title": job_title,
        "company_name": company_name,
        "location": location,
        "salary_range": salary_range
    }
    return send_templated_email(recipient, "", merge_info, subject, html)


def send_daily_limit_reached_email(recipient, candidate_name):
    print(f"[LIMIT_REACHED_EMAIL] Called for {recipient}")
    subject = f"Daily Application Limit Reached - {SMTP_SENDER_NAME}"
    html = f"""
    <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
    <html xmlns="http://www.w3.org/1999/xhtml">
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
        <title>Daily Application Limit Reached</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    </head>
    <body style="margin: 0; padding: 0; background-color: #F6F9FC; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#F6F9FC" style="table-layout: fixed;">
            <tr>
                <td align="center" style="padding: 40px 0;">
                    <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 12px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                        <!-- Brand Header -->
                        <tr>
                            <td bgcolor="#FF8A00" align="left" style="padding: 30px 40px;">
                                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                    <tr>
                                        <td style="color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">
                                            TechSales<span style="color: #FFE6CC;">Axis</span>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        
                        <!-- Content Body -->
                        <tr>
                            <td style="padding: 40px 40px 30px 40px; color: #334155; font-size: 16px; line-height: 24px;">
                                <h2 style="color: #0F172A; font-size: 20px; font-weight: 800; margin-top: 0; margin-bottom: 16px;">
                                    Transmission Buffer Full!
                                </h2>
                                <p style="margin-top: 0; margin-bottom: 16px;">
                                    Hi {candidate_name},
                                </p>
                                <p style="margin-top: 0; margin-bottom: 20px;">
                                    You have reached your daily transmission limit of **5 applications** for today. To maintain elite candidate-matching quality, your application slot resets daily.
                                </p>
                                <p style="margin-top: 0; margin-bottom: 20px;">
                                    In the meantime, you can review your active applications, practice role pitches, or complete pending assessment components to elevate your compatibility profile.
                                </p>

                                <!-- Bulletproof CTA Button -->
                                <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin-top: 10px; margin-bottom: 10px;">
                                    <tr>
                                        <td align="center" style="border-radius: 8px;" bgcolor="#FF8A00">
                                            <a href="{FRONTEND_URL}/dashboard/candidate/applications" target="_blank" style="font-size: 14px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; border-radius: 8px; padding: 14px 28px; border: 1px solid #FF8A00; display: inline-block; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
                                                Go to Candidate Dashboard
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        <!-- Footer -->
                        <tr>
                            <td bgcolor="#F8FAFC" style="padding: 30px 40px; border-top: 1px solid #E2E8F0; text-align: center; color: #94A3B8; font-size: 12px; line-height: 18px;">
                                This email was sent by TechSales Axis. If you wish to manage your notification preferences, please log in and update your account settings.
                                <br/><br/>
                                © 2026 TechSales Axis. All Rights Reserved.
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    merge_info = {
        "candidate_name": candidate_name
    }
    return send_templated_email(recipient, "", merge_info, subject, html)


def send_profile_completion_reminder_email(recipient, user_name, role, completion_score, missing_fields=None, has_pending_assessment=False):
    print(f"[PROFILE_REMINDER_EMAIL] Called for {recipient} (Role: {role})")
    subject = f"Elevate Your Profile: Complete Your Account Setup"
    
    missing_fields_section = ""
    if missing_fields:
        fields_list_items = "".join([f"<li style='margin-bottom: 6px;'><strong>{field}</strong></li>" for field in missing_fields])
        missing_fields_section = f"""
        <p style="margin-top: 0; margin-bottom: 8px; font-weight: bold; font-size: 14px; text-transform: uppercase; color: #0F172A; letter-spacing: 0.5px;">
            Missing Crucial Information:
        </p>
        <ul style="margin-top: 0; margin-bottom: 30px; padding-left: 20px; font-size: 14px; line-height: 22px; color: #475569;">
            {fields_list_items}
        </ul>
        """
        
    assessment_section = ""
    if has_pending_assessment and role.lower() == "candidate":
        assessment_section = f"""
        <table border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#FFF8F1" style="border-left: 4px solid #FF8A00; border-radius: 6px; margin-bottom: 24px;">
            <tr>
                <td style="padding: 18px 20px; font-size: 14px; line-height: 22px; color: #1E293B;">
                    <strong style="color: #C96B00; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 6px;">
                        Pending Assessment
                    </strong>
                    You have not completed your psychometric/behavioral assessment yet. High-trust recruiters prioritize candidates with completed assessment scores!
                </td>
            </tr>
        </table>
        """
        
    dashboard_path = "dashboard/candidate" if role.lower() == "candidate" else "dashboard/recruiter"
    button_text = "Complete Profile & Assessment" if (has_pending_assessment and role.lower() == "candidate") else "Complete Profile"

    html = f"""
    <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
    <html xmlns="http://www.w3.org/1999/xhtml">
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
        <title>Action Required: Complete Your Profile</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    </head>
    <body style="margin: 0; padding: 0; background-color: #F6F9FC; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#F6F9FC" style="table-layout: fixed;">
            <tr>
                <td align="center" style="padding: 40px 0;">
                    <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 12px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                        <!-- Brand Header -->
                        <tr>
                            <td bgcolor="#FF8A00" align="left" style="padding: 30px 40px;">
                                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                    <tr>
                                        <td style="color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">
                                            TechSales<span style="color: #FFE6CC;">Axis</span>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        
                        <!-- Content Body -->
                        <tr>
                            <td style="padding: 40px 40px 30px 40px; color: #334155; font-size: 16px; line-height: 24px;">
                                <h2 style="color: #0F172A; font-size: 20px; font-weight: 800; margin-top: 0; margin-bottom: 16px;">
                                    Complete Your Account Setup
                                </h2>
                                <p style="margin-top: 0; margin-bottom: 16px;">
                                    Hi {user_name},
                                </p>
                                <p style="margin-top: 0; margin-bottom: 20px;">
                                    We noticed your profile setup is currently at **{completion_score}%**. To unlock the full power of TechSales Axis elite talent-matching and get noticed by recruiters/candidates, complete your profile today.
                                </p>
                                
                                {assessment_section}
                                {missing_fields_section}

                                <!-- Bulletproof CTA Button -->
                                <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin-top: 10px; margin-bottom: 10px;">
                                    <tr>
                                        <td align="center" style="border-radius: 8px;" bgcolor="#FF8A00">
                                            <a href="{FRONTEND_URL}/{dashboard_path}" target="_blank" style="font-size: 14px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; border-radius: 8px; padding: 14px 28px; border: 1px solid #FF8A00; display: inline-block; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
                                                {button_text}
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        <!-- Footer -->
                        <tr>
                            <td bgcolor="#F8FAFC" style="padding: 30px 40px; border-top: 1px solid #E2E8F0; text-align: center; color: #94A3B8; font-size: 12px; line-height: 18px;">
                                This email was sent by TechSales Axis. If you wish to manage your notification preferences, please log in and update your account settings.
                                <br/><br/>
                                © 2026 TechSales Axis. All Rights Reserved.
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    merge_info = {
        "user_name": user_name,
        "completion_score": completion_score,
        "role": role,
        "missing_fields": missing_fields,
        "has_pending_assessment": has_pending_assessment
    }
    return send_templated_email(recipient, "", merge_info, subject, html)



