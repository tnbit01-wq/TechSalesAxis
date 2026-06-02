from sqlalchemy import or_
from src.core.database import SessionLocal
from src.core.models import BulkUploadFile

if __name__ == '__main__':
    db = SessionLocal()
    try:
        total = db.query(BulkUploadFile).count()
        parsed = db.query(BulkUploadFile).filter(or_(BulkUploadFile.parsing_status.in_(['parsed','completed']), BulkUploadFile.parsed_at != None)).count()
        print('TOTAL_FILES:', total)
        print('PARSED_OR_COMPLETED:', parsed)
    finally:
        db.close()
