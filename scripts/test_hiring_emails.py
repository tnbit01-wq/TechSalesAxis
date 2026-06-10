import os
import sys
from pathlib import Path

# Add the apps/api directory to sys.path
api_path = Path(__file__).resolve().parent.parent / "apps" / "api"
sys.path.append(str(api_path))

from src.services.email_service import (
    send_job_invite_email,
    send_shortlist_email,
    send_rejection_email,
    send_interview_proposed_email,
    send_interview_confirmed_email,
    send_offer_email
)

def test_all_emails():
    test_email = "mithunkaveriappa.mk@gmail.com"
    print(f"Starting Hiring Pipeline Email Verification for: {test_email}\n" + "="*50)
    
    # 1. Job Invitation Email
    print("\n1. Testing Job Invite Email...")
    invite_res = send_job_invite_email(
        recipient=test_email,
        candidate_name="Mithun Kaveriappa",
        recruiter_name="Sarah Jenkins",
        job_title="Lead Account Executive",
        message="We were highly impressed by your experience leading high-velocity sales teams. We'd love for you to apply!",
        company_name="Google Inc."
    )
    print(f"Result: {invite_res}")
    
    # 2. Shortlist Email
    print("\n2. Testing Shortlist Email...")
    shortlist_res = send_shortlist_email(
        recipient=test_email,
        candidate_name="Mithun Kaveriappa",
        job_title="Lead Account Executive",
        custom_message="Congratulations! Your initial profile screening was successful. We want to move you to the presentation stage.",
        company_name="Google Inc."
    )
    print(f"Result: {shortlist_res}")

    # 3. Interview Proposed Email
    print("\n3. Testing Interview Proposed Email...")
    proposed_res = send_interview_proposed_email(
        recipient=test_email,
        candidate_name="Mithun Kaveriappa",
        job_title="Lead Account Executive",
        round_name="Technical Presentation & Q&A",
        slots_details="Option A: June 15, 10:00 AM EST | Option B: June 16, 2:00 PM EST",
        company_name="Google Inc."
    )
    print(f"Result: {proposed_res}")

    # 4. Interview Confirmed Email (to Candidate)
    print("\n4. Testing Interview Confirmed Email (to Candidate)...")
    confirmed_candidate_res = send_interview_confirmed_email(
        recipient=test_email,
        recipient_name="Mithun Kaveriappa",
        other_name="Sarah Jenkins",
        job_title="Lead Account Executive",
        round_name="Technical Presentation & Q&A",
        time_str="Monday, June 15 at 10:00 AM EST",
        meeting_link="https://meet.jit.si/TechSalesAxis_Presentation_Mithun",
        is_recruiter=False,
        company_name="Google Inc."
    )
    print(f"Result: {confirmed_candidate_res}")

    # 5. Interview Confirmed Email (to Recruiter)
    print("\n5. Testing Interview Confirmed Email (to Recruiter)...")
    confirmed_recruiter_res = send_interview_confirmed_email(
        recipient=test_email,
        recipient_name="Sarah Jenkins",
        other_name="Mithun Kaveriappa",
        job_title="Lead Account Executive",
        round_name="Technical Presentation & Q&A",
        time_str="Monday, June 15 at 10:00 AM EST",
        meeting_link="https://meet.jit.si/TechSalesAxis_Presentation_Mithun",
        is_recruiter=True,
        company_name="Google Inc."
    )
    print(f"Result: {confirmed_recruiter_res}")

    # 6. Offer Email
    print("\n6. Testing Job Offer Email...")
    offer_res = send_offer_email(
        recipient=test_email,
        candidate_name="Mithun Kaveriappa",
        job_title="Lead Account Executive",
        custom_message="We are thrilled to offer you the position. The team was blown away by your presentation and enterprise sales strategy!",
        company_name="Google Inc."
    )
    print(f"Result: {offer_res}")

    # 7. Rejection Email
    print("\n7. Testing Rejection Email...")
    rejection_res = send_rejection_email(
        recipient=test_email,
        candidate_name="Mithun Kaveriappa",
        job_title="Lead Account Executive",
        custom_message="While your presentation was excellent, we have decided to move forward with another candidate who has deeper enterprise SaaS experience.",
        company_name="Google Inc."
    )
    print(f"Result: {rejection_res}")

    print("\n" + "="*50 + "\nVerification Completed.")

if __name__ == "__main__":
    test_all_emails()
