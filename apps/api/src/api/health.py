from fastapi import APIRouter, Depends
from src.core.database import SessionLocal
from sqlalchemy import text
from sqlalchemy.orm import Session

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/db")
def db_health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "db": "reachable"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}
