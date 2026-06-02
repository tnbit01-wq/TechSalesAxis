from src.core.database import SessionLocal
from src.core.models import BulkUploadFile, BulkUploadProcessingQueue

file_id = '40329df8-996f-4612-ac6d-0922424a83d3'

with SessionLocal() as db:
    file = db.query(BulkUploadFile).filter(BulkUploadFile.id == file_id).first()
    
    if file:
        print(f'File Status: {file.parsing_status}')
        print(f'Parsing Error: {file.parsing_error}')
        raw_text_len = len(file.raw_text or '')
        print(f'Raw Text Length: {raw_text_len}')
    
    queue_job = db.query(BulkUploadProcessingQueue).filter(
        BulkUploadProcessingQueue.bulk_upload_file_id == file_id
    ).order_by(BulkUploadProcessingQueue.created_at.desc()).first()
    
    if queue_job:
        print(f'Queue Job Status: {queue_job.job_status}')
        print(f'Job Completed: {queue_job.completed_at}')
        print(f'Job Result: {queue_job.job_result}')
