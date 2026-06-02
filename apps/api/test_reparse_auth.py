import requests
from src.api.auth import create_access_token
from src.core.database import SessionLocal
from src.core.models import BulkUploadFile
import time

batch_uuid = '94c24941-deb4-4902-ad4d-fad0ef1877da'
user_id = '0e5fd2f8-fcec-4c3c-95b6-d10a121a2cdd'

# Create token for test user
token = create_access_token({'sub': user_id, 'role': 'admin'})

# Find a failed file
with SessionLocal() as db:
    failed_file = db.query(BulkUploadFile).filter(
        BulkUploadFile.bulk_upload_id == batch_uuid,
        BulkUploadFile.parsing_status == 'failed'
    ).first()
    
    if failed_file:
        print('Testing reparse with FAILED file:')
        print(f'  File ID: {failed_file.id}')
        print(f'  File name: {failed_file.original_filename}')
        
        url = f'http://localhost:8000/api/v1/bulk-upload/{batch_uuid}/file/{failed_file.id}/reparse'
        headers = {'Authorization': f'Bearer {token}'}
        
        print('Calling reparse endpoint...')
        response = requests.post(url, headers=headers)
        
        print(f'Response Status: {response.status_code}')
        print(f'Response Body: {response.json()}')
        
        print('Waiting 3 seconds for background task...')
        time.sleep(3)
        
        print('Done! Check backend terminal for debug output.')
