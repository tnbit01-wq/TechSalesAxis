from src.core.database import SessionLocal
from src.core.models import AssessmentResponse
from sqlalchemy import desc

def main(limit=10):
    db = SessionLocal()
    try:
        rows = db.query(AssessmentResponse).order_by(desc(AssessmentResponse.created_at)).limit(limit).all()
        for r in rows:
            print('id:', r.id)
            print('candidate:', r.candidate_id)
            print('question_id:', r.question_id)
            print('score:', r.score)
            meta = r.evaluation_metadata or {}
            print('reasoning present:', 'reasoning' in meta)
            print('other keys:', list(meta.keys()))
            print('reasoning value:', meta.get('reasoning'))
            print('-'*40)
    finally:
        db.close()

if __name__ == '__main__':
    main()
