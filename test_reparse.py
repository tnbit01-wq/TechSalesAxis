import os
import sys
import requests

# Add the api src directory to path
api_src = os.path.join(os.getcwd(), 'apps', 'api', 'src')
sys.path.insert(0, api_src)

# Change to apps/api directory for proper imports
os.chdir(os.path.join(os.getcwd(), 'apps', 'api'))

from src.core.database import SessionLocal
from src.core.models import BulkUploadFile

batch_uuid = '94c24941-deb4-4902-ad4d-fad0ef1877da'

# Find a failed or pending file
with SessionLocal() as db:
    failed_file = db.query(BulkUploadFile).filter(
        BulkUploadFile.bulk_upload_id == batch_uuid,
        BulkUploadFile.parsing_status == 'failed'
    ).first()
    
    if not failed_file:
        # Try pending file instead
        failed_file = db.query(BulkUploadFile).filter(
            BulkUploadFile.bulk_upload_id == batch_uuid,
            BulkUploadFile.parsing_status == 'pending'
        ).first()
    
    if failed_file:
        print(f"Testing reparse with file: {failed_file.id} ({failed_file.original_filename})")
        print(f"Current status: {failed_file.parsing_status}")
        
        # Call the reparse endpoint
        url = f"http://localhost:8000/api/v1/bulk-upload/{batch_uuid}/file/{failed_file.id}/reparse"
        print(f"\nCalling: {url}")
        
        # Use a dummy token for testing
        headers = {"Authorization": "Bearer dummy_token_for_test"}
        
        try:
            response = requests.post(url, headers=headers)
            print(f"Response status: {response.status_code}")
            print(f"Response: {response.json()}")
            print("\n✅ Reparse request sent. Check backend logs for debug output.")
        except Exception as e:
            print(f"Error: {e}")
    else:
        print("No failed or pending files found")
