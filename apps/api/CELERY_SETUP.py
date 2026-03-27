"""
CELERY CONFIGURATION - Job Queue for Async Processing
Files to create:
1. apps/api/src/celery_app.py
2. apps/api/src/tasks/__init__.py
3. apps/api/src/tasks/bulk_upload_tasks.py

This handles background processing for:
- Virus scanning
- Resume parsing
- Duplicate detection
- Account creation
- Email sending
"""

# FILE 1: apps/api/src/celery_app.py
# ============================================================================

from celery import Celery
from celery.schedules import crontab
import os
from dotenv import load_dotenv

load_dotenv()

# Redis connection string
CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND = os.getenv('CELERY_RESULT_BACKEND', 'redis://localhost:6379/1')

# Create Celery app
celery_app = Celery(
    __name__,
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND
)

# Configuration
celery_app.conf.update(
    # Task settings
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    
    # Task execution settings
    task_track_started=True,  # Track task start
    task_time_limit=30 * 60,  # 30 minutes hard limit
    task_soft_time_limit=25 * 60,  # 25 minutes soft limit
    
    # Worker settings
    worker_prefetch_multiplier=1,  # One task per worker at a time
    worker_max_tasks_per_child=1000,
    
    # Result backend settings
    result_expires=3600,  # Results expire after 1 hour
    
    # Scheduled tasks (Celery Beat)
    beat_schedule={
        'cleanup-old-uploads': {
            'task': 'src.tasks.bulk_upload_tasks.cleanup_old_uploads',
            'schedule': crontab(hour=2, minute=0),  # Run at 2 AM daily
            'kwargs': {'retention_days': 90}
        },
    },
)

# Auto-discover tasks
celery_app.autodiscover_tasks(['src.tasks'])

@celery_app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')


# FILE 2: apps/api/src/tasks/__init__.py
# ============================================================================

"""
Empty file to make tasks a package
"""

# FILE 3: apps/api/src/tasks/bulk_upload_tasks.py
# ============================================================================

from celery import shared_task
from typing import Optional, Dict
import logging
from datetime import datetime, timedelta
from pathlib import Path
import subprocess

# Import your services
from ..core.file_storage import LocalFileStorage, BULK_UPLOAD_BASE_DIR
from ..core.email_config import get_email_service, EmailTemplates
from ..services.bulk_upload_service import DuplicateDetector, CandidateInfo
from ..services.resume_extractor import ComprehensiveResumeExtractor

logger = logging.getLogger(__name__)

# ============================================================================
# VIRUS SCANNING TASK
# ============================================================================

@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60  # Retry after 1 minute
)
def virus_scan_file(
    self,
    file_id: str,
    file_path: str,
    batch_id: str
):
    """
    Task: Scan file for viruses using ClamAV
    
    Status updates:
    - pending → scanning → clean (or infected)
    """
    try:
        logger.info(f"Starting virus scan: {file_id}")
        
        # Check if file exists
        if not Path(file_path).exists():
            logger.error(f"File not found: {file_path}")
            return {
                'file_id': file_id,
                'status': 'error',
                'error': 'File not found'
            }
        
        # Run ClamAV scan
        result = subprocess.run(
            ['clamscan', '--stdout', file_path],
            capture_output=True,
            text=True,
            timeout=30  # 30 second timeout
        )
        
        if result.returncode == 0:
            # Clean
            logger.info(f"File clean: {file_id}")
            return {
                'file_id': file_id,
                'status': 'clean',
                'batch_id': batch_id
            }
        elif result.returncode == 1:
            # Infected
            logger.warning(f"Infected file detected: {file_id}")
            logger.warning(f"Scan output: {result.stdout}")
            return {
                'file_id': file_id,
                'status': 'infected',
                'details': result.stdout,
                'batch_id': batch_id
            }
        else:
            # Error
            logger.error(f"Clamscan error: {result.stderr}")
            raise Exception(f"Clamscan error: {result.stderr}")
    
    except subprocess.TimeoutExpired:
        logger.error(f"Virus scan timeout: {file_id}")
        raise self.retry(countdown=60)  # Retry after 1 minute
    except Exception as e:
        logger.error(f"Virus scan failed: {str(e)}")
        raise self.retry(countdown=60)


# ============================================================================
# RESUME PARSING TASK
# ============================================================================

@shared_task(bind=True, max_retries=2)
def parse_resume_file(
    self,
    file_id: str,
    file_path: str,
    batch_id: str,
    filename: str
):
    """
    Task: Extract text and structure from resume
    
    Returns:
    {
        'file_id': str,
        'batch_id': str,
        'parsed_data': {
            'name': str,
            'email': str,
            'phone': str,
            'location': str,
            'current_role': str,
            'years_of_experience': int,
            'education': str,
            'skills': [str],
            'companies': [str],
            'extraction_confidence': float
        }
    }
    """
    try:
        logger.info(f"Starting resume parse: {file_id}")
        
        # Read file
        file_content = Path(file_path).read_bytes()
        
        # Extract text (depends on file type - assuming PDF/DOC conversion first)
        # For now, assuming raw text file
        if filename.endswith('.txt'):
            resume_text = file_content.decode('utf-8', errors='replace')
        else:
            # Call PDF/DOC extraction service
            # This would need a separate service to extract text from PDF/DOC
            logger.warning(f"File type not directly supported: {filename}")
            resume_text = ""  # Placeholder
        
        # Parse resume using ComprehensiveResumeExtractor
        extractor = ComprehensiveResumeExtractor()
        
        parsed = {
            'name': extractor.extract_name(resume_text),
            'email': extractor.extract_email(resume_text),
            'phone': extractor.extract_phone(resume_text),
            'location': extractor.extract_location(resume_text),
            'current_role': extractor.extract_current_role(resume_text),
            'years_of_experience': extractor.extract_experience_years(resume_text),
            'education': extractor.extract_education(resume_text),
            'skills': extractor.extract_skills(resume_text),
            'companies': extractor.extract_companies(resume_text),
        }
        
        # Check if mandatory fields present
        mandatory_fields = ['name', 'email', 'phone', 'location', 'current_role']
        missing = [f for f in mandatory_fields if not parsed.get(f)]
        
        if missing:
            logger.warning(f"Missing mandatory fields ({', '.join(missing)}): {file_id}")
        
        logger.info(f"Resume parsed successfully: {file_id}")
        
        return {
            'file_id': file_id,
            'batch_id': batch_id,
            'status': 'success',
            'parsed_data': parsed,
            'missing_fields': missing,
            'extraction_confidence': 0.85  # TODO: Calculate actual confidence
        }
    
    except Exception as e:
        logger.error(f"Resume parsing failed: {str(e)}")
        raise self.retry(countdown=30)


# ============================================================================
# DUPLICATE DETECTION TASK
# ============================================================================

@shared_task(bind=True, max_retries=2)
def detect_duplicates(
    self,
    file_id: str,
    parsed_data: dict,
    batch_id: str,
    existing_candidates: list
):
    """
    Task: Detect if resume matches existing candidates
    
    Returns:
    {
        'file_id': str,
        'match_found': bool,
        'match_confidence': float,
        'matched_candidate_id': str or None,
        'match_type': str,  # exact_match, strong_match, moderate_match, soft_match, no_match
    }
    """
    try:
        logger.info(f"Starting duplicate detection: {file_id}")
        
        # Create candidate info from parsed data
        new_candidate = CandidateInfo(
            name=parsed_data.get('name', ''),
            email=parsed_data.get('email', ''),
            phone=parsed_data.get('phone', ''),
            current_role=parsed_data.get('current_role', ''),
            years_of_experience=parsed_data.get('years_of_experience', 0),
            location=parsed_data.get('location', ''),
            skills=parsed_data.get('skills', []),
            companies=parsed_data.get('companies', []),
            education=parsed_data.get('education', ''),
            extraction_confidence=0.85
        )
        
        # Find best match
        detector = DuplicateDetector()
        best_match = detector.find_best_match(new_candidate, existing_candidates)
        
        logger.info(
            f"Duplicate detection complete: {file_id} - "
            f"Confidence: {best_match.match_confidence}, "
            f"Type: {best_match.match_type}"
        )
        
        return {
            'file_id': file_id,
            'batch_id': batch_id,
            'status': 'complete',
            'match_found': best_match.match_type != 'no_match',
            'match_confidence': best_match.match_confidence,
            'match_type': best_match.match_type,
            'matched_candidate_id': best_match.matched_candidate_id,
            'matched_candidate_name': best_match.matched_candidate_name,
            'admin_review_required': best_match.admin_review_required,
        }
    
    except Exception as e:
        logger.error(f"Duplicate detection failed: {str(e)}")
        raise self.retry(countdown=30)


# ============================================================================
# SEND INVITATION EMAIL TASK
# ============================================================================

@shared_task(bind=True, max_retries=3)
def send_invitation_email(
    self,
    candidate_email: str,
    candidate_name: str,
    device_registration_url: str
):
    """
    Task: Send device registration email to candidate
    """
    try:
        logger.info(f"Sending invitation to: {candidate_email}")
        
        email_service = get_email_service()
        
        html_body = EmailTemplates.candidate_invitation_html(
            candidate_name=candidate_name,
            device_registration_url=device_registration_url
        )
        
        text_body = EmailTemplates.candidate_invitation_text(
            candidate_name=candidate_name,
            device_registration_url=device_registration_url
        )
        
        result = await email_service.send_email(
            to_email=candidate_email,
            subject="Welcome to TalentFlow - Complete Your Profile",
            html_body=html_body,
            text_body=text_body
        )
        
        if result:
            logger.info(f"Invitation sent: {candidate_email}")
            return {'status': 'success', 'email': candidate_email}
        else:
            logger.error(f"Failed to send invitation: {candidate_email}")
            raise Exception("Email send failed")
    
    except Exception as e:
        logger.error(f"Email task failed: {str(e)}")
        raise self.retry(countdown=60)


# ============================================================================
# CLEANUP TASK
# ============================================================================

@shared_task
def cleanup_old_uploads(retention_days: int = 90):
    """
    Task: Archive files older than retention_days
    Run daily via Celery Beat at 2 AM
    """
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
        archived_count = 0
        
        for batch_dir in BULK_UPLOAD_BASE_DIR.iterdir():
            if not batch_dir.is_dir() or batch_dir.name.startswith('_'):
                continue
            
            # Check modification time
            mtime = datetime.fromtimestamp(batch_dir.stat().st_mtime)
            
            if mtime < cutoff_date:
                try:
                    LocalFileStorage.archive_batch(batch_dir.name)
                    archived_count += 1
                except Exception as e:
                    logger.error(f"Archive failed for {batch_dir.name}: {str(e)}")
        
        logger.info(f"Cleanup completed: {archived_count} batches archived")
        return {'archived': archived_count}
    
    except Exception as e:
        logger.error(f"Cleanup task failed: {str(e)}")
        return {'error': str(e)}


# ============================================================================
# MONITORING TASK
# ============================================================================

@shared_task
def monitor_queue_size():
    """
    Task: Monitor Celery queue size
    Run every 5 minutes to track queue health
    """
    try:
        from celery_app import celery_app
        
        # Get queue stats
        inspect = celery_app.control.inspect()
        active = inspect.active()
        reserved = inspect.reserved()
        
        active_count = sum(len(v) for v in active.values()) if active else 0
        reserved_count = sum(len(v) for v in reserved.values()) if reserved else 0
        
        logger.info(
            f"Queue Status - Active: {active_count}, Reserved: {reserved_count}"
        )
        
        return {
            'active_tasks': active_count,
            'reserved_tasks': reserved_count,
            'timestamp': datetime.utcnow().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Monitor task failed: {str(e)}")
        return {'error': str(e)}


# ============================================================================
# TASK GROUPS & WORKFLOWS
# ============================================================================

"""
Example: Process a file through all stages

from celery import chain, group

def process_bulk_upload_file(file_id, file_path, batch_id, filename):
    # Create chain: scan → parse → detect_duplicates
    workflow = chain(
        virus_scan_file.s(file_id, file_path, batch_id),
        parse_resume_file.s(file_path, batch_id, filename),
        detect_duplicates.s(batch_id, existing_candidates)
    )
    
    # Execute chain
    result = workflow.apply_async()
    return result.id

# Use in bulk_upload_api.py:
from .tasks.bulk_upload_tasks import process_bulk_upload_file
celery_task_id = process_bulk_upload_file(file_id, path, batch_id, name)
"""
