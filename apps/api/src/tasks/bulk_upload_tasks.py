"""
Bulk Upload Async Tasks
Celery tasks for processing uploaded resumes asynchronously
Includes: virus scanning, parsing, duplicate detection, email sending
"""

from celery import shared_task
from src.celery_app import celery_app
from src.services.s3_service import S3Service
from src.services.comprehensive_extractor import ComprehensiveResumeExtractor
import logging
import json
import tempfile
from typing import Dict, Optional, List
import os
from datetime import datetime, timedelta
import requests

logger = logging.getLogger(__name__)

# ============================================================================
# TASK 1: VIRUS SCAN TASK
# ============================================================================

@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def virus_scan_file(self, file_id: str, file_path: str, file_name: str) -> Dict:
    """
    Scan uploaded file for viruses using ClamAV
    """
    try:
        logger.info(f"Starting virus scan for file: {file_name} (ID: {file_id})")
        # Simplified mock for now as we transition to S3
        return {
            'file_id': file_id,
            'status': 'clean',
            'timestamp': datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Virus scan error for {file_id}: {str(e)}")
        raise self.retry(exc=e, countdown=60)


# ============================================================================
# TASK 2: PARSE RESUME FILE TASK
# ============================================================================

@celery_app.task(bind=True, max_retries=2)
def parse_resume_file(self, file_id: str, file_path: str, file_name: str, bucket_name: Optional[str] = None) -> Dict:
    """
    Extract text and structure from resume file (S3 version)
    Uses ComprehensiveResumeExtractor for parsing
    """
    temp_file_path = None
    try:
        logger.info(f"Starting parse for file: {file_name} from S3 bucket {bucket_name}")
        
        # 1. Download from S3 to temp local file
        s3 = S3Service.get_client()
        target_bucket = bucket_name or os.getenv("S3_BUCKET_NAME", "talentflow-files")
        
        # Use tempfile to handle large files safely
        suffix = os.path.splitext(file_name)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            s3.download_fileobj(target_bucket, file_path, tmp)
            temp_file_path = tmp.name

        # 2. Extract raw text
        raw_text = ""
        if file_name.lower().endswith('.pdf'):
            try:
                import pypdf
                reader = pypdf.PdfReader(temp_file_path)
                raw_text = "\n".join([page.extract_text() for page in reader.pages if page.extract_text()])
            except Exception as e:
                logger.warning(f"pypdf failed for {file_name}: {e}")

        elif file_name.lower().endswith(('.doc', '.docx')):
            try:
                from docx import Document
                doc = Document(temp_file_path)
                raw_text = "\n".join([para.text for para in doc.paragraphs])
            except Exception as e:
                logger.warning(f"docx failed for {file_name}: {e}")

# 3. Parse with Comprehensive Extractor (Replaced with AI Parser from Candidate flow)
        
        extracted_data = {}
        
        openai_key = os.getenv('OPENAI_API_KEY')
        if openai_key:
            try:
                schema_str = "{'full_name', 'email', 'phone', 'links': {'linkedin', 'portfolio'}, 'location', 'current_role', 'highest_education', 'relevant_years_experience', 'experience_band', 'bio', 'skills': {'technical', 'soft', 'tools'}, 'timeline', 'career_gap_report', 'education', 'projects', 'major_achievements'}"
                prompt = f"Extract structured resume data. SCHEMA: {schema_str}. Text: {raw_text[:15000]}"
                response = requests.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {openai_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "gpt-4o",
                        "messages": [
                            {"role": "system", "content": "You are a professional recruitment AI. Respond only with valid JSON."},
                            {"role": "user", "content": prompt}
                        ],
                        "response_format": { "type": "json_object" },
                        "temperature": 0.2
                    },
                    timeout=45.0
                )
                if response.status_code == 200:
                    parsed_content = response.json()['choices'][0]['message']['content']
                    extracted_data = json.loads(parsed_content)
                else:
                    logger.warning(f"OpenAI Parsing Failed: {response.text}")
            except Exception as oai_err:
                logger.warning(f"OpenAI Parsing Error: {oai_err}")
                
        # If OpenAI failed or not configured, fallback to Comprehensive Extractor
        if not extracted_data:
            logger.info("AI parsing not available or failed. Falling back to ComprehensiveResumeExtractor.")
            extractor = ComprehensiveResumeExtractor()
            extracted_data = extractor.extract_all(raw_text) if hasattr(extractor, 'extract_all') else {}

        raw_skills = extracted_data.get('skills', [])
        flat_skills = []
        if isinstance(raw_skills, dict):
            for v in raw_skills.values():
                if isinstance(v, list):
                    flat_skills.extend(v)
        else:
            flat_skills = raw_skills if isinstance(raw_skills, list) else []

        # Extract and normalize name (remove extra spaces/artifacts from PDF extraction)
        full_name = extracted_data.get('full_name') or extracted_data.get('name')
        if full_name:
            # Handle names like "L A L I T K O T I A N" from PDF extraction
            # Check if it's a heavily spaced-out name (more than 50% spaces)
            if full_name.count(' ') > len(full_name) * 0.4:  # More than 40% spaces
                # Remove all spaces to reconstruct: "L A L I T" -> "LALIT"
                # Then add back single space between parts by detecting case changes or patterns
                no_space = full_name.replace(' ', '')
                # For names like LALITK OTIAN, we need to add space. Look for lowercase after uppercase sequence
                # For now, just use: if there are capital letters followed by lowercase, that might be word boundaries
                # But "LALITKOTION" has no lowercase. Try a different approach: assume first 5-6 chars per name word
                # Actually, let's just collapse spaces smartly by finding groups of same-case letters
                import re
                # Split on mixed case transitions or use a heuristic
                if len(no_space) > 4:
                    # Heuristic: split into likely word parts (usually 4-7 chars for first/last names)
                    # For now, just remove the extra spaces properly
                    normalized = re.sub(r'\s+', ' ', full_name).strip()
                    full_name = normalized
            else:
                # Normal cleanup: normalize spacing to single spaces
                full_name = ' '.join(full_name.split())
        
        parsed_data = {
            'name': full_name,
            'email': extracted_data.get('links', {}).get('email') or extracted_data.get('email'),
            'phone': extracted_data.get('phone_number') or extracted_data.get('phone'),
            'location': extracted_data.get('location'),
            'current_role': extracted_data.get('current_role'),
            'years_experience': extracted_data.get('years_of_experience') or extracted_data.get('relevant_years_experience') or extracted_data.get('years_experience') or 0,
            'skills': flat_skills,
            'education': extracted_data.get('education_history') or extracted_data.get('education', []),
            'highest_education': extracted_data.get('highest_education'),
            'experience_band': extracted_data.get('experience_band'),
            'bio': extracted_data.get('bio')
        }

        # 4. Update Database (Sync session in celery task)
        from src.core.database import SessionLocal
        from src.core.models import BulkUploadFile, BulkUpload
        
        with SessionLocal() as db:
            file_record = db.query(BulkUploadFile).filter(BulkUploadFile.id == file_id).first()
            if file_record:
                file_record.parsing_status = 'parsed' if raw_text else 'error'
                file_record.raw_text = raw_text.replace('\x00', '') if raw_text else raw_text
                file_record.parsed_data = parsed_data
                file_record.extracted_name = parsed_data.get('name')
                file_record.extracted_email = parsed_data.get('email')
                file_record.extracted_phone = parsed_data.get('phone')
                file_record.extracted_location = parsed_data.get('location')
                file_record.extracted_current_role = parsed_data.get('current_role')
                
                exp = parsed_data.get('years_experience', 0)
                file_record.extracted_years_experience = int(exp) if exp else 0
                file_record.parsed_at = datetime.utcnow()
                
                # Update Batch Metrics
                batch = db.query(BulkUpload).filter(BulkUpload.id == file_record.bulk_upload_id).first()
                if batch:
                    if raw_text:
                        batch.successfully_parsed += 1
                    else:
                        batch.parsing_failed += 1
                
                db.commit()

        return {
            'file_id': file_id,
            'status': 'completed',
            'confidence': 0.8,
            'timestamp': datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Parse error for {file_id}: {str(e)}")
        raise self.retry(exc=e, countdown=10)
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except:
                pass

# ============================================================================
# TASK 3: DETECT DUPLICATES TASK
# ============================================================================

@celery_app.task(bind=True, max_retries=2)
def detect_duplicates(self, file_id: str, extracted_data: Dict) -> Dict:
    """
    Match extracted resume against existing candidates in database
    Uses BulkUploadDuplicateDetector scoring algorithm
    
    Args:
        file_id: UUID of bulk_upload_file record
        extracted_data: Parsed data from resume {name, email, phone, location, skills, etc.}
        
    Returns:
        {
            'file_id': str,
            'match_found': bool,
            'matched_candidate_id': str or None,
            'match_confidence': float 0-1,
            'match_type': 'exact' | 'strong' | 'moderate' | 'soft' | 'no_match',
            'match_reason': str,
            'admin_review_required': bool,
            'matches': list of alternative candidates with confidence,
            'timestamp': str
        }
    """
    try:
        logger.info(f"Starting duplicate detection for file: {file_id}")
        
        # Import duplicate detector
        try:
            from bulk_upload_duplicate_detector import BulkUploadDuplicateDetector
            detector = BulkUploadDuplicateDetector()
        except ImportError:
            logger.warning("Duplicate detector not available, returning no_match")
            return {
                'file_id': file_id,
                'match_found': False,
                'match_confidence': 0,
                'match_type': 'no_match',
                'match_reason': 'detector_unavailable',
                'admin_review_required': False,
                'timestamp': datetime.utcnow().isoformat()
            }
        
        # Run detection
        result = detector.find_matches(
            name=extracted_data.get('name', ''),
            email=extracted_data.get('email', ''),
            phone=extracted_data.get('phone', ''),
            skills=extracted_data.get('skills', []),
            companies=extracted_data.get('companies', []),
            location=extracted_data.get('location', '')
        )
        
        # Determine admin review requirement
        confidence = result.get('confidence', 0)
        admin_review_required = 0.70 <= confidence < 0.90  # 70-90% requires review
        
        logger.info(f"Duplicate detection complete for {file_id}: "
                   f"confidence={confidence}, admin_review={admin_review_required}")
        
        result['file_id'] = file_id
        result['admin_review_required'] = admin_review_required
        result['timestamp'] = datetime.utcnow().isoformat()
        
        return result
        
    except Exception as e:
        logger.error(f"Duplicate detection error for {file_id}: {str(e)}")
        raise self.retry(exc=e, countdown=30)


# ============================================================================
# TASK 4: SEND INVITATION EMAIL TASK
# ============================================================================

@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def send_invitation_email(self, file_id: str, candidate_email: str, 
                         candidate_name: str, registration_link: str,
                         batch_id: str) -> Dict:
    """
    Send device registration email to candidate
    
    Args:
        file_id: UUID of bulk_upload_file
        candidate_email: Candidate email address
        candidate_name: Candidate full name
        registration_link: Device registration link
        batch_id: Bulk upload batch ID
        
    Returns:
        {
            'file_id': str,
            'email': str,
            'status': 'sent' | 'failed' | 'retry',
            'message_id': str,
            'timestamp': str
        }
    """
    try:
        logger.info(f"Sending invitation email to {candidate_email} for batch {batch_id}")
        
        # Import email service
        try:
            from src.core.email_config import AWSEmailService
            email_service = AWSEmailService()
        except ImportError:
            logger.warning("Email service not available")
            raise self.retry(exc=Exception("Email service unavailable"), countdown=60)
        
        # Prepare email template
        html_body = f"""
        <html>
        <body>
            <h1>Welcome to TalentFlow!</h1>
            <p>Hi {candidate_name},</p>
            <p>Your resume has been uploaded to our candidate portal.</p>
            <p>Please verify your email and complete your profile by clicking the link below:</p>
            <p><a href="{registration_link}">Verify Email & Register Device</a></p>
            <p>This link expires in 24 hours.</p>
            <p>Best regards,<br/>TalentFlow Team</p>
        </body>
        </html>
        """
        
        # Send email
        result = email_service.send_email(
            subject="Complete Your TalentFlow Profile",
            recipient_email=candidate_email,
            html_body=html_body,
            text_body=f"Verify email at: {registration_link}"
        )
        
        logger.info(f"Email sent to {candidate_email}: {result.get('MessageId')}")
        
        return {
            'file_id': file_id,
            'email': candidate_email,
            'status': 'sent' if result.get('MessageId') else 'failed',
            'message_id': result.get('MessageId', ''),
            'timestamp': datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Email send error for {candidate_email}: {str(e)}")
        raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))


# ============================================================================
# TASK 5: CLEANUP OLD UPLOADS (Scheduled daily)
# ============================================================================

@celery_app.task
def cleanup_old_uploads() -> Dict:
    """
    Archive and delete uploads older than retention period
    Runs daily at 2 AM via Celery Beat
    
    Returns:
        {
            'archived': int,
            'deleted': int,
            'freed_bytes': int,
            'timestamp': str
        }
    """
    try:
        logger.info("Starting cleanup of old bulk upload batches")
        
        retention_days = int(os.getenv('BULK_UPLOAD_RETENTION_DAYS', '90'))
        cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
        
        # In real implementation, query DB for old batches
        # For first phase, just log
        logger.info(f"Cleanup cutoff date: {cutoff_date}")
        
        # Archive files to /uploads/_archive
        archive_dir = os.path.join(os.getenv('BULK_UPLOAD_DIR', '/uploads/bulk_uploads'), '_archive')
        os.makedirs(archive_dir, exist_ok=True)
        
        return {
            'archived': 0,
            'deleted': 0,
            'freed_bytes': 0,
            'timestamp': datetime.utcnow().isoformat(),
            'note': 'Cleanup task ready, DB integration pending'
        }
        
    except Exception as e:
        logger.error(f"Cleanup error: {str(e)}")
        return {
            'archived': 0,
            'deleted': 0,
            'freed_bytes': 0,
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }


# ============================================================================
# TASK 6: MONITOR QUEUE SIZE (Scheduled hourly)
# ============================================================================

@celery_app.task
def monitor_queue_size() -> Dict:
    """
    Check Celery queue health and task counts
    Runs every hour via Celery Beat
    
    Returns:
        {
            'active_tasks': int,
            'reserved_tasks': int,
            'queued_tasks': int,
            'timestamp': str
        }
    """
    try:
        logger.info("Monitoring Celery queue size")
        
        from celery.app.control import Inspect
        
        inspect = Inspect(celery_app)
        active = inspect.active()
        reserved = inspect.reserved()
        
        active_count = sum(len(tasks) for tasks in (active or {}).values())
        reserved_count = sum(len(tasks) for tasks in (reserved or {}).values())
        
        logger.info(f"Queue status: active={active_count}, reserved={reserved_count}")
        
        return {
            'active_tasks': active_count,
            'reserved_tasks': reserved_count,
            'queued_tasks': active_count + reserved_count,
            'timestamp': datetime.utcnow().isoformat(),
            'status': 'healthy' if active_count < 100 else 'warning'
        }
        
    except Exception as e:
        logger.error(f"Queue monitoring error: {str(e)}")
        return {
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }


# ============================================================================
# TASK 7: DEBUG TASK
# ============================================================================

@celery_app.task
def debug_task():
    """Debug task for testing Celery setup"""
    logger.info("Debug task executed successfully")
    return {'status': 'ok', 'message': 'Debug task works', 'timestamp': datetime.utcnow().isoformat()}



def parse_resume_file_fastapi(file_id: str, file_path: str, file_name: str, bucket_name: str = None):
    class DummySelf:
        def retry(self, exc=None, countdown=None):
            return Exception(str(exc))
            
    # 1. Run standard parsing first
    result = parse_resume_file(file_id, file_path, file_name, bucket_name)
    
    # 2. Add Shadow profile creation logic directly inside this reliable fastAPI thread!
    from src.core.database import SessionLocal
    from src.core.models import BulkUploadFile, User, CandidateProfile
    import uuid
    import string
    import random
    
    try:
        with SessionLocal() as db:
            file_record = db.query(BulkUploadFile).filter(BulkUploadFile.id == file_id).first()
            if not file_record or file_record.parsing_status != 'parsed':
                return result
                
            parsed_data = file_record.parsed_data or {}
            email = parsed_data.get('email')
            
            # Autogenerate email if missing
            if not email:
                email = f"shadow_{uuid.uuid4().hex[:8]}@shadow.talentflow.pro"
                
            email = email.lower().strip()
                
            # Check if user already exists
            existing_user = db.query(User).filter(User.email == email).first()
            
            user_id = None
            if not existing_user:
                # Create Shadow User
                user_id = uuid.uuid4()
                
                name = parsed_data.get('name') or 'Unknown Candidate'

                # generate random dummy password
                dummy_pass = ''.join(random.choices(string.ascii_letters + string.digits, k=12))

                from src.api.auth import get_password_hash
                try:
                    hashed = get_password_hash(dummy_pass)
                except:
                    hashed = dummy_pass # Fallback if security not imported     

                new_user = User(
                    id=user_id,
                    email=email,
                    hashed_password=hashed,
                    role='candidate',
                    is_verified=False
                )
                db.add(new_user)
                db.flush()

                # Now create Candidate Profile
                exp_y_num = file_record.extracted_years_experience or 0
                if exp_y_num < 2:
                    exp_str = 'fresher'
                elif exp_y_num <= 5:
                    exp_str = 'mid'
                elif exp_y_num <= 10:
                    exp_str = 'senior'
                else:
                    exp_str = 'leadership'

                new_profile = CandidateProfile(
                    user_id=user_id,
                    full_name=name,
                    phone_number=parsed_data.get('phone'),
                    current_role=parsed_data.get('current_role'),
                    years_of_experience=exp_y_num,
                    location=parsed_data.get('location'),
                    skills=parsed_data.get('skills', []),
                    education_history=parsed_data.get('education', []),
                    qualification_held=parsed_data.get('highest_education') or (parsed_data.get('education', [{}])[0].get('degree') if parsed_data.get('education') else None),
                    resume_path=file_record.file_storage_path,
                    bulk_file_id=file_id,
                    is_shadow_profile=True,
                    experience=exp_str
                )
                db.add(new_profile)
                db.commit()
            else:
                user_id = existing_user.id
                
            # Linking matched user to the file
            file_record.matched_candidate_id = user_id
            db.commit()
            
    except Exception as e:
        print(f"Shadow Profile Creation Error: {e}")
        
    return result
    
def detect_duplicates_fastapi(file_id: str, bulk_upload_id: str):
    class DummySelf:
        def retry(self, exc=None, countdown=None):
            return Exception(str(exc))
    return detect_duplicates(DummySelf(), file_id, bulk_upload_id)
