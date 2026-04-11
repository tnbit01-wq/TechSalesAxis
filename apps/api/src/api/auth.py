from fastapi import APIRouter, Depends, HTTPException, Body, status
from src.core.aws_dependencies import get_current_user
from src.core.database import SessionLocal, get_db
from src.core.models import User, RecruiterProfile, CandidateProfile
from sqlalchemy.orm import Session
from src.core.auth_utils import get_password_hash, verify_password, create_access_token
from src.services.email_service import send_otp_email, generate_otp
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta
import uuid
from fastapi.responses import RedirectResponse

router = APIRouter(tags=["auth"])

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    role: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class OTPVerifyRequest(BaseModel):
    email: EmailStr
    otp: str

class EmailValidationRequest(BaseModel):
    email: EmailStr
    role: str

class UpdatePasswordRequest(BaseModel):
    old_password: str
    new_password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    password: str

@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Generate a password reset token and send via SES.
    """
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        # Don't reveal if user exists for security
        return {"status": "success", "message": "If this email is registered, a reset link has been sent."}

    # Generate reset token (using a UUID for simplicity, or we could reuse OTP logic)
    token = str(uuid.uuid4())
    user.reset_token = token
    user.reset_token_expires_at = datetime.utcnow() + timedelta(hours=1)
    db.commit()

    # Create reset link
    reset_link = f"https://techsalesaxis.app/reset-password?token={token}"
    from src.services.email_service import send_password_reset_email
    send_password_reset_email(user.email, reset_link)

    return {"status": "success", "message": "If this email is registered, a reset link has been sent."}

@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    """
    Verify reset token and update password.
    """
    user = db.query(User).filter(
        User.reset_token == request.token,
        User.reset_token_expires_at > datetime.utcnow()
    ).first()

    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user.hashed_password = get_password_hash(request.password)
    user.reset_token = None
    user.reset_token_expires_at = None
    db.commit()

    return {"status": "success", "message": "Password reset successfully."}

class ProfileInitializeRequest(BaseModel):
    role: str
    display_name: str

PERSONAL_DOMAINS = [
    "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com",
    "me.com", "msn.com", "live.com", "aol.com", "zoho.com",
    "protonmail.com", "proton.me", "yandex.com", "mail.com", "gmx.com",
    "rediffmail.com", "rocketmail.com", "tutanota.com", "fastmail.com", "hushmail.com"
]

@router.post("/signup")
async def signup(request: SignupRequest):
    """
    Step 1 of AWS registration: Create unverified user and send OTP via SES.
    """
    db = SessionLocal()
    try:
        # Check if user exists
        existing = db.query(User).filter(User.email == request.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Cloud ID already registered")

        # Validation logic (Candidate must be personal, Recruiter must be work)
        domain = request.email.split("@")[1].lower()
        is_personal = domain in PERSONAL_DOMAINS
        if request.role == "candidate" and not is_personal:
            raise HTTPException(status_code=400, detail="Candidates must use a personal email address")
        if request.role == "recruiter" and is_personal:
            raise HTTPException(status_code=400, detail="Recruiters must use a professional email address")

        otp = generate_otp()
        new_user = User(
            id=uuid.uuid4(),
            email=request.email,
            role=request.role,
            hashed_password=get_password_hash(request.password),
            is_verified=False,
            otp_code=otp,
            otp_expires_at=datetime.utcnow() + timedelta(minutes=10)
        )
        db.add(new_user)
        db.commit()

        # Send OTP via SES
        send_otp_email(request.email, otp)
        
        return {"status": "success", "message": "Verification code sent to email."}
    finally:
        db.close()

@router.post("/verify-otp")
async def verify_otp(request: OTPVerifyRequest):
    """
    Step 2 of AWS registration: Verify OTP and activate user account.
    """
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == request.email).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        if user.otp_code != request.otp:
            raise HTTPException(status_code=400, detail="Invalid verification code")

        if datetime.utcnow() > (user.otp_expires_at or datetime.min):
            raise HTTPException(status_code=400, detail="Verification code expired")

        user.is_verified = True
        user.otp_code = None # Clear OTP
        db.commit()

        access_token = create_access_token(data={"sub": str(user.id), "email": user.email, "role": user.role})
        return {"access_token": access_token, "token_type": "bearer"}
    finally:
        db.close()

@router.post("/login")
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    AWS Login: Verify password and issue JWT token.
    """
    user = db.query(User).filter(User.email == request.email).first()
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_verified:
        # Resend OTP if not verified
        otp = generate_otp()
        user.otp_code = otp
        user.otp_expires_at = datetime.utcnow() + timedelta(minutes=10)
        db.commit()
        send_otp_email(user.email, otp)
        return {"status": "unverified", "message": "Account not verified. New OTP sent."}

    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role}
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/validate-email")
def validate_email(request: EmailValidationRequest):
    domain = request.email.split("@")[1].lower()
    is_personal = domain in PERSONAL_DOMAINS
    
    if request.role == "candidate" and not is_personal:
        raise HTTPException(status_code=400, detail="Candidates must use a personal email address")
    
    if request.role == "recruiter" and is_personal:
        raise HTTPException(status_code=400, detail="Recruiters must use a professional email address")
    
    return {"status": "valid"}

@router.post("/post-login")
async def post_login(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Find where to send the user after successful JWT login.
    """
    user_id = current_user["sub"]
    user_role = current_user["role"]

    if user_role == "admin":
        return {"next_step": "/admin/dashboard", "role": "admin"}

    if user_role == "candidate":
        profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
        if not profile:
            return {"next_step": "/onboarding/candidate", "role": "candidate"}
            
        if profile.onboarding_step == "COMPLETED" or profile.assessment_status != "not_started":
            return {"next_step": "/dashboard/candidate", "role": "candidate"}
            
        # If they haven't finished onboarding, send them back to the chat
        return {"next_step": "/onboarding/candidate", "role": "candidate"}

    elif user_role == "recruiter":
        profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == user_id).first()
        if profile and profile.onboarding_step == "completed":
            return {"next_step": "/dashboard/recruiter", "role": "recruiter"}
        return {"next_step": "/onboarding/recruiter", "role": "recruiter"}

    elif user_role == "admin":
        return {"next_step": "/admin/dashboard", "role": "admin"}

    return {"next_step": "/", "role": user_role}

@router.post("/update-password")
async def update_password(
    request: UpdatePasswordRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Updates user password in AWS RDS after verifying the old password.
    """
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == current_user["sub"]).first()
        if not user or not verify_password(request.old_password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Current password incorrect.")

        user.hashed_password = get_password_hash(request.new_password)
        db.commit()
        return {"status": "success", "message": "Password updated successfully"}
    finally:
        db.close()

@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """
    Sends a password reset link via SES.
    """
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == request.email).first()
        if not user:
            # Silently return success to avoid email enum
            return {"status": "success", "message": "Recovery instructions sent if email exists."}
        
        # In a real app, generate a signed reset token. For now, sending OTP logic can be reused.
        otp = generate_otp()
        user.otp_code = otp
        user.otp_expires_at = datetime.utcnow() + timedelta(minutes=15)
        db.commit()
        
        # Link would normally point to frontend reset page with token
        reset_link = f"https://techsalesaxis.cloud/reset-password?email={request.email}&token={otp}"
        from src.services.email_service import send_password_reset_email
        send_password_reset_email(request.email, reset_link)

        return {"status": "success", "message": "Recovery instructions sent to your email."}
    finally:
        db.close()

@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """
    Finalizes password reset using the token from the email.
    """
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == request.email).first()
        if not user or user.otp_code != request.token:
             raise HTTPException(status_code=400, detail="Invalid reset token.")
        
        if datetime.utcnow() > (user.otp_expires_at or datetime.min):
            raise HTTPException(status_code=400, detail="Reset token expired.")

        user.hashed_password = get_password_hash(request.password)
        user.otp_code = None # Clear
        db.commit()
        return {"status": "success", "message": "Password reset successful."}
    except Exception as e:
        print(f"RESET PASSWORD ERROR: {e}")
        raise HTTPException(status_code=400, detail="Invalid or expired reset link.")
    finally:
        db.close()

@router.delete("/delete-account")
async def delete_account(
    current_user: dict = Depends(get_current_user)
):
    """
    Permanently deletes a user's account and all associated data from AWS.
    """
    db = SessionLocal()
    try:
        user_id = current_user["sub"]
        db.query(User).filter(User.id == user_id).delete()
        db.commit()
        return {"status": "success", "message": "Account terminated permanently."}
    except Exception as e:
        db.rollback()
        print(f"ACCOUNT DELETION ERROR: {e}")
        raise HTTPException(status_code=500, detail="Failed to terminate account.")
    finally:
        db.close()

@router.post("/initialize")
def initialize_profile(
    request: ProfileInitializeRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = user["sub"]
    email = user["email"]
    
    # 1. Update user role if needed
    try:
        db_user = db.query(User).filter(User.id == user_id).first()
        if db_user:
            db_user.role = request.role
            db.commit()
        
        # 2. Create profile based on role
        if request.role == "candidate":
            existing_prof = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
            if not existing_prof:
                new_prof = CandidateProfile(
                    user_id=user_id,
                    experience_band="fresher",
                    full_name=request.display_name
                )
                db.add(new_prof)
                db.commit()
            else:
                # Update existing profile with display_name
                existing_prof.full_name = request.display_name
                db.commit()
        elif request.role == "recruiter":
            existing_prof = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == user_id).first()
            if not existing_prof:
                new_prof = RecruiterProfile(
                    user_id=user_id,
                    full_name=request.display_name
                )
                db.add(new_prof)
                db.commit()
            else:
                # Update existing profile with display_name
                existing_prof.full_name = request.display_name
                db.commit()
            
        return {"status": "initialized"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/post-login")
async def post_login(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = user["sub"]
    email = user["email"]
    
    print(f"HANDSHAKE START (POST): User {user_id} ({email})")
    
    try:
        # 1. Fetch user role
        db_user = db.query(User).filter(User.id == user_id).first()
        
        if not db_user:
            print(f"HANDSHAKE: User {user_id} not found in users table. Initializing recovery...")
            from src.utils.email_validation import is_personal_email
            
            recovered_role = "candidate" if is_personal_email(email) else "recruiter"
            
            # Initialize them now
            new_user = User(id=user_id, email=email, role=recovered_role)
            db.add(new_user)
            db.commit()
            
            if recovered_role == "candidate":
                from src.core.models import CandidateProfile
                new_prof = CandidateProfile(user_id=user_id, assessment_status="not_started")
                db.add(new_prof)
                db.commit()
            else:
                # Recruiter recovery
                from src.services.recruiter_service import RecruiterService
                recruiter_service = RecruiterService()
                await recruiter_service.get_or_create_profile(user_id)
            
            print(f"HANDSHAKE RECOVERY SUCCESS: Role={recovered_role}")
            return {
                "next_step": f"/onboarding/{recovered_role}",
                "role": recovered_role,
                "status": "not_started"
            }
        
        role = db_user.role
        print(f"HANDSHAKE: Found role '{role}' for user {user_id}")
        
        # 2. Check assessment status
        from src.core.models import CandidateProfile, RecruiterProfile
        if role == "candidate":
            profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
        else:
            profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == user_id).first()
            
        # Safe access to profile data
        status = "not_started"
        if profile:
            status = getattr(profile, "assessment_status", "not_started")
            print(f"HANDSHAKE: Assessment status is '{status}'")
        
        # 3. Determine next step
        if role == "candidate":
            # Just send to onboarding for now if status is not started
            if status == "not_started":
                next_step = "/onboarding/candidate"
            else:
                next_step = "/dashboard/candidate"
        else: # recruiter
            if status == "completed":
                next_step = "/dashboard/recruiter"
            else:
                next_step = "/onboarding/recruiter"
            
        print(f"HANDSHAKE COMPLETED: Redirecting to {next_step}")
        return {
            "next_step": next_step,
            "role": role,
            "status": status
        }
    except Exception as e:
        db.rollback()
        print(f"HANDSHAKE ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/post-login")
async def post_login_get(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Maintain GET version for session check if needed, but redirects to the main logic"""
    return await post_login(user, db)
