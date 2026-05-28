from src.core.database import SessionLocal
from src.services.assessment_feedback_service import assessment_feedback_service
import traceback
import asyncio

USER_ID = 'e4154a4d-939f-450d-a000-6c21f8d378a7'

def main():
    db = SessionLocal()
    try:
        # Call the async implementation directly to capture exceptions
        report = asyncio.run(assessment_feedback_service.generate_feedback_report_async(USER_ID, db))
        print('REPORT:', report)
    except Exception as e:
        print('Exception when generating feedback:')
        traceback.print_exc()
    finally:
        db.close()

if __name__ == '__main__':
    main()
