"""Backfill script: scale historical recruiter assessment scores from 0-6 -> 0-100.

Run from repository root with the project's Python environment activated.
Example:
    python apps/api/scripts/backfill_recruiter_scores.py
"""
from src.core.database import SessionLocal
from src.core.models import RecruiterAssessmentResponse
from sqlalchemy import update

def scale_score(old: int) -> int:
    try:
        val = float(old)
    except Exception:
        return 0
    # If already in 0-100 range, leave unchanged
    if val > 10:
        return int(round(val))
    # Scale 0-6 -> 0-100
    return int(round((val / 6.0) * 100))

def main():
    db = SessionLocal()
    try:
        rows = db.query(RecruiterAssessmentResponse).all()
        changed = 0
        for r in rows:
            avg = r.average_score or 0
            # Detect legacy small-scale values (<=6)
            if avg is None:
                continue
            try:
                avg_f = float(avg)
            except Exception:
                continue
            if avg_f <= 6.5:
                new_avg = scale_score(avg_f)
                # Update subscores (they were mirrored earlier)
                r.average_score = new_avg
                if r.relevance_score is not None:
                    r.relevance_score = scale_score(r.relevance_score)
                if r.specificity_score is not None:
                    r.specificity_score = scale_score(r.specificity_score)
                if r.clarity_score is not None:
                    r.clarity_score = scale_score(r.clarity_score)
                if r.ownership_score is not None:
                    r.ownership_score = scale_score(r.ownership_score)
                # Add metadata tag
                meta = r.evaluation_metadata or {}
                meta["backfilled_from_0_6"] = True
                meta["backfilled_old_value"] = avg_f
                r.evaluation_metadata = meta
                changed += 1
        db.commit()
        print(f"Backfill complete. Rows updated: {changed}")
    finally:
        db.close()

if __name__ == '__main__':
    main()
