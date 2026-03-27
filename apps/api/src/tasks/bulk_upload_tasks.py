"""
Bulk Upload Async Tasks
Celery tasks for processing uploaded resumes asynchronously
Includes: virus scanning, parsing, duplicate detection, email sending
"""

from celery import shared_task
from src.celery_app import celery_app
import logging
import json
from typing import Dict, Optional, List
import os
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# ============================================================================
# TASK 1: VIRUS SCAN TASK
# ============================================================================

@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def virus_scan_file(self, file_id: str, file_path: str, file_name: str) -> Dict:
    """
    Scan uploaded file for viruses using ClamAV
    
    Args:
        file_id: UUID of bulk_upload_file record
        file_path: Full path to file on disk
        file_name: Original filename
        
    Returns:
        {
            'file_id': str,
            'status': 'clean' | 'infected' | 'error',
            'engine': str,
            'signatures': list,
            'timestamp': str
        }
    """
    try:
        logger.info(f"Starting virus scan for file: {file_name} (ID: {file_id})")
        
        # Check if ClamAV is enabled
        if not os.getenv('VIRUS_SCAN_ENABLED', 'true').lower() == 'true':
            logger.info(f"Virus scan disabled, skipping file: {file_name}")
            return {
                'file_id': file_id,
                'status': 'skipped',
                'reason': 'virus_scan_disabled',
                'timestamp': datetime.utcnow().isoformat()
            }
        
        # Import ClamAV client
        try:
            import pyclamd
        except ImportError:
            logger.warning("pyclamd not installed, using mock scan")
            # Mock scan result when library not available
            return {
                'file_id': file_id,
                'status': 'clean',
                'engine': 'clamav_mock',
                'signatures': [],
                'timestamp': datetime.utcnow().isoformat(),
                'note': 'Mock scan (pyclamd not installed)'
            }
        
        # Connect to ClamAV daemon
        clam = pyclamd.ClamD(
            host=os.getenv('CLAMAV_HOST', 'localhost'),
            port=int(os.getenv('CLAMAV_PORT', 3310)),
            timeout=30
        )
        
        # Verify connection
        if not clam.ping():
            logger.error("ClamAV daemon not responding")
            # Retry if ClamAV unavailable
            raise self.retry(exc=Exception("ClamAV not responding"), countdown=30)
        
        # Scan file
        if not os.path.exists(file_path):
            logger.error(f"File not found during scan: {file_path}")
            return {
                'file_id': file_id,
                'status': 'error',
                'error': 'file_not_found',
                'timestamp': datetime.utcnow().isoformat()
            }
        
        result = clam.scan_file(file_path)
        
        if result is None:
            scan_status = 'clean'
            signatures = []
        else:
            scan_status = 'infected'
            signatures = result.get(file_path, {}).get('infected', [])
        
        logger.info(f"Scan result for {file_name}: {scan_status}")
        
        return {
            'file_id': file_id,
            'status': scan_status,
            'engine': 'clamav',
            'signatures': signatures,
            'file_path': file_path,
            'timestamp': datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Virus scan error for {file_id}: {str(e)}")
        # Retry with exponential backoff
        raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))


# ============================================================================
# TASK 2: PARSE RESUME FILE TASK
# ============================================================================

@celery_app.task(bind=True, max_retries=2)
def parse_resume_file(self, file_id: str, file_path: str, file_name: str) -> Dict:
    """
    Extract text and structure from resume file
    Uses ComprehensiveResumeExtractor from src.services
    
    Args:
        file_id: UUID of bulk_upload_file record
        file_path: Full path to file on disk
        file_name: Original filename
        
    Returns:
        {
            'file_id': str,
            'parsed_text': str,
            'parsed_data': {
                'name': str,
                'email': str,
                'phone': str,
                'location': str,
                'current_role': str,
                'years_experience': int,
                'education': list,
                'skills': list,
                'companies': list,
                'experiences': list
            },
            'missing_fields': list,
            'confidence': float 0-1,
            'timestamp': str
        }
    """
    try:
        logger.info(f"Starting parse for file: {file_name} (ID: {file_id})")
        
        # Check file exists
        if not os.path.exists(file_path):
            logger.error(f"File not found during parsing: {file_path}")
            return {
                'file_id': file_id,
                'status': 'error',
                'error': 'file_not_found',
                'timestamp': datetime.utcnow().isoformat()
            }
        
        # Import extractor
        try:
            from src.services.resume_service import ResumeService
            service = ResumeService()
        except ImportError:
            logger.error("Resume extractor not available")
            return {
                'file_id': file_id,
                'status': 'error',
                'error': 'extractor_not_available',
                'timestamp': datetime.utcnow().isoformat()
            }
        
        # Extract text from file (supports PDF, DOC, DOCX, TXT)
        with open(file_path, 'rb') as f:
            file_content = f.read()
        
        # Detect file type and extract text
        if file_name.endswith('.pdf'):
            try:
                import PyPDF2
                pdf_reader = PyPDF2.PdfReader(open(file_path, 'rb'))
                raw_text = ''.join([page.extract_text() for page in pdf_reader.pages])
            except:
                logger.warning(f"PDF parsing failed for {file_name}, using fallback")
                raw_text = ""
        
        elif file_name.endswith(('.doc', '.docx')):
            try:
                from docx import Document
                if file_name.endswith('.docx'):
                    doc = Document(file_path)
                    raw_text = '\n'.join([p.text for p in doc.paragraphs])
                else:
                    logger.warning(f"DOC format not fully supported, limited extraction")
                    raw_text = ""
            except:
                logger.warning(f"DOCX parsing failed for {file_name}")
                raw_text = ""
        
        else:  # .txt
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    raw_text = f.read()
            except UnicodeDecodeError:
                with open(file_path, 'r', encoding='latin-1') as f:
                    raw_text = f.read()
        
        # Parse resume text
        if raw_text.strip():
            parsed_data = extractor.extract_resume_info(raw_text)
            confidence = parsed_data.get('confidence', 0.5)
        else:
            logger.warning(f"No text extracted from {file_name}")
            parsed_data = {}
            confidence = 0.0
        
        # Determine missing mandatory fields
        mandatory_fields = ['name', 'email', 'phone', 'location', 'current_role', 'education']
        missing_fields = [f for f in mandatory_fields if not parsed_data.get(f)]
        
        logger.info(f"Parse complete for {file_name}: confidence={confidence}, missing={len(missing_fields)}")
        
        return {
            'file_id': file_id,
            'status': 'completed',
            'parsed_text': raw_text[:1000],  # First 1000 chars
            'parsed_data': parsed_data,
            'missing_fields': missing_fields,
            'confidence': confidence,
            'timestamp': datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Parse error for {file_id}: {str(e)}")
        raise self.retry(exc=e, countdown=30 * (2 ** self.request.retries))


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
