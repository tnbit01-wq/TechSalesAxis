"""
Simple dispatcher that polls BulkUploadProcessingQueue and dispatches Celery tasks.
Run this as a small process alongside workers (or under supervisor/systemd).
"""
import time
import logging
import os
import socket
from datetime import datetime
from sqlalchemy import select, update
from src.core.database import SessionLocal
from src.core.models import BulkUploadProcessingQueue, BulkUploadFile
from src.tasks.bulk_upload_tasks import parse_resume_file, detect_duplicates

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

POLL_INTERVAL = 2.0


def _celery_broker_reachable() -> bool:
    broker_url = os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0')
    if not broker_url.startswith('redis://'):
        return True

    try:
        host_port = broker_url.replace('redis://', '').split('/', 1)[0]
        host, port_str = host_port.split(':', 1) if ':' in host_port else (host_port, '6379')
        port = int(port_str)
        with socket.create_connection((host, port), timeout=0.35):
            return True
    except Exception:
        return False

JOB_TYPE_MAP = {
    'parse_resume': 'parse_resume',
    'detect_duplicates': 'detect_duplicates',
}


def claim_and_dispatch_one():
    with SessionLocal() as db:
        # find one queued job ordered by priority and scheduled_for
        stmt = select(BulkUploadProcessingQueue).where(BulkUploadProcessingQueue.job_status == 'queued').order_by(BulkUploadProcessingQueue.priority.desc(), BulkUploadProcessingQueue.scheduled_for.asc()).limit(1)
        job = db.execute(stmt).scalar_one_or_none()
        if not job:
            return False

        # Attempt to atomically claim the job by updating status from queued->processing
        upd = update(BulkUploadProcessingQueue).where(BulkUploadProcessingQueue.id == job.id, BulkUploadProcessingQueue.job_status == 'queued').values(job_status='processing', started_at=datetime.utcnow())
        res = db.execute(upd)
        db.commit()
        if res.rowcount == 0:
            # someone else claimed it
            return True

        # Refresh job
        job = db.query(BulkUploadProcessingQueue).filter(BulkUploadProcessingQueue.id == job.id).first()

        try:
            if job.job_type == 'parse_resume':
                # get file info
                file = db.query(BulkUploadFile).filter(BulkUploadFile.id == job.bulk_upload_file_id).first()
                if not file:
                    # mark job failed
                    job.job_status = 'failed'
                    job.error_message = 'file_not_found'
                    job.completed_at = datetime.utcnow()
                    db.commit()
                    return True

                s3_path = file.file_storage_path or ''
                bucket = None
                key = s3_path
                if s3_path.startswith('s3://'):
                    parts = s3_path[5:].split('/', 1)
                    if len(parts) == 2:
                        bucket = parts[0]
                        key = parts[1]
                # Dispatch Celery parse with job_id so task will update the job row.
                # Fallback to in-process run when broker is unavailable.
                try:
                    if _celery_broker_reachable():
                        parse_resume_file.delay(str(file.id), key, file.original_filename, bucket, str(job.id))
                        logger.info(f"Dispatched parse_resume task for file {file.id} (job {job.id})")
                    else:
                        raise RuntimeError('celery_broker_unreachable')
                except Exception as dispatch_exc:
                    logger.warning(
                        f"Celery dispatch unavailable for parse_resume job {job.id}; "
                        f"running in-process fallback. Error: {dispatch_exc}"
                    )
                    parse_resume_file.run(str(file.id), key, file.original_filename, bucket, str(job.id))
                    logger.info(f"Completed in-process parse fallback for file {file.id} (job {job.id})")

            elif job.job_type == 'detect_duplicates':
                # for detect duplicates, we expect the file to have parsed_data
                file = db.query(BulkUploadFile).filter(BulkUploadFile.id == job.bulk_upload_file_id).first()
                if not file or not file.parsed_data:
                    job.job_status = 'failed'
                    job.error_message = 'file_or_parsed_data_missing'
                    job.completed_at = datetime.utcnow()
                    db.commit()
                    return True
                # pass parsed_data to the task
                detect_duplicates.delay(str(file.id), file.parsed_data, str(job.id))
                logger.info(f"Dispatched detect_duplicates task for file {file.id} (job {job.id})")

            else:
                # support merge/create jobs
                if job.job_type == 'merge_candidate':
                    match_id = None
                    try:
                        match_id = job.job_result.get('match_id') if job.job_result else None
                    except Exception:
                        match_id = None
                    if match_id:
                        from src.tasks.bulk_upload_tasks import merge_candidate_job
                        merge_candidate_job.delay(str(match_id), str(job.bulk_upload_id), str(job.id))
                        logger.info(f"Dispatched merge_candidate job for match {match_id} (job {job.id})")
                    else:
                        job.job_status = 'failed'
                        job.error_message = 'missing_match_id'
                        job.completed_at = datetime.utcnow()
                        db.commit()
                elif job.job_type == 'create_account':
                    match_id = None
                    try:
                        match_id = job.job_result.get('match_id') if job.job_result else None
                    except Exception:
                        match_id = None
                    if match_id:
                        from src.tasks.bulk_upload_tasks import create_candidate_account_job
                        create_candidate_account_job.delay(str(match_id), str(job.bulk_upload_id), str(job.id))
                        logger.info(f"Dispatched create_account job for match {match_id} (job {job.id})")
                    else:
                        job.job_status = 'failed'
                        job.error_message = 'missing_match_id'
                        job.completed_at = datetime.utcnow()
                        db.commit()
                else:
                    job.job_status = 'failed'
                    job.error_message = f'unknown_job_type:{job.job_type}'
                    job.completed_at = datetime.utcnow()
                    db.commit()
                    logger.warning(f"Unknown job type {job.job_type} for job {job.id}")

        except Exception as exc:
            logger.exception(f"Dispatcher failed to dispatch job {job.id}: {exc}")
            try:
                job.job_status = 'failed'
                job.error_message = str(exc)
                job.completed_at = datetime.utcnow()
                db.commit()
            except Exception:
                pass

    return True


def run_dispatcher():
    logger.info("Starting queue dispatcher")
    try:
        while True:
            claimed = claim_and_dispatch_one()
            if not claimed:
                time.sleep(POLL_INTERVAL)
    except KeyboardInterrupt:
        logger.info("Queue dispatcher stopping via KeyboardInterrupt")


if __name__ == '__main__':
    run_dispatcher()
