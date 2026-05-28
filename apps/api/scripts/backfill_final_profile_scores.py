"""Backfill script to populate CandidateProfile.final_profile_score from ProfileScore.final_score.

Usage:
  python backfill_final_profile_scores.py --user-id e4154a4d-939f-450d-a000-6c21f8d378a7
  python backfill_final_profile_scores.py        # backfill all where missing or mismatched

This script is safe to run multiple times; it only updates when values differ or are missing.
"""
import argparse
import logging
from typing import Optional

from src.core.database import SessionLocal
from src.core.models import CandidateProfile, ProfileScore

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("backfill_final_profile_scores")


def backfill(user_id: Optional[str] = None, commit: bool = True):
    db = SessionLocal()
    try:
        if user_id:
            scores = db.query(ProfileScore).filter(ProfileScore.user_id == user_id).all()
        else:
            scores = db.query(ProfileScore).all()

        if not scores:
            logger.info("No ProfileScore records found for the given query.")
            return 0

        updated = 0
        created = 0
        for ps in scores:
            try:
                uid = ps.user_id
                final = ps.final_score if ps.final_score is not None else None
                if final is None:
                    logger.debug(f"Skipping user {uid}: ProfileScore.final_score is null")
                    continue

                profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == uid).first()
                if profile:
                    cur = profile.final_profile_score
                    if cur is None or int(cur) != int(final):
                        logger.info(f"Updating CandidateProfile.final_profile_score for {uid}: {cur} -> {final}")
                        profile.final_profile_score = int(final)
                        profile.assessment_status = profile.assessment_status or 'completed'
                        db.add(profile)
                        updated += 1
                else:
                    logger.info(f"Creating CandidateProfile for {uid} with final_profile_score={final}")
                    newp = CandidateProfile(user_id=uid, final_profile_score=int(final), assessment_status='completed')
                    db.add(newp)
                    created += 1
            except Exception as e:
                logger.exception(f"Failed to process ProfileScore for user {ps.user_id}: {e}")

        if commit:
            db.commit()
            logger.info(f"Committed changes. updated={updated}, created={created}")
        else:
            db.rollback()
            logger.info(f"Dry-run: updated={updated}, created={created}")

        return updated + created
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="Backfill CandidateProfile.final_profile_score from ProfileScore.final_score")
    parser.add_argument("--user-id", help="Optional user id to backfill (UUID)")
    parser.add_argument("--dry-run", action="store_true", help="Do not commit changes")
    args = parser.parse_args()

    count = backfill(user_id=args.user_id, commit=not args.dry_run)
    logger.info(f"Backfill completed; total rows affected: {count}")


if __name__ == "__main__":
    main()
