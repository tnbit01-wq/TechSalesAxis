"""Reconcile bulk upload batch counters and processing state.

This script recalculates batch metrics from bulk_upload_files, bulk_upload_candidate_matches,
and bulk_upload_processing_queue, then updates bulk_uploads records.

Usage:
    python apps/api/scripts/reconcile_bulk_upload_counters.py
    python apps/api/scripts/reconcile_bulk_upload_counters.py --batch-id <uuid> --apply
    python apps/api/scripts/reconcile_bulk_upload_counters.py --limit 10 --dry-run
"""

from __future__ import annotations

import argparse
import logging
import sys
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from sqlalchemy import func, or_, select
from src.core.database import SessionLocal
from src.core.models import (
    BulkUpload,
    BulkUploadCandidateMatch,
    BulkUploadFile,
    BulkUploadProcessingQueue,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("reconcile_bulk_upload_counters")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Reconcile bulk upload counters and update batch status.")
    parser.add_argument("--batch-id", help="Restrict reconciliation to a single bulk upload batch")
    parser.add_argument("--limit", type=int, default=0, help="Limit number of batches to reconcile")
    parser.add_argument("--apply", action="store_true", help="Apply changes to the database")
    parser.add_argument("--verbose", action="store_true", help="Show detailed metrics for each batch")
    return parser.parse_args()


def calculate_metrics(db, batch: BulkUpload) -> dict:
    total_files = db.execute(
        select(func.count())
        .select_from(BulkUploadFile)
        .where(BulkUploadFile.bulk_upload_id == batch.id)
    ).scalar_one()

    successfully_parsed = db.execute(
        select(func.count())
        .select_from(BulkUploadFile)
        .where(
            BulkUploadFile.bulk_upload_id == batch.id,
            BulkUploadFile.parsing_status == 'completed',
        )
    ).scalar_one()

    parsing_failed = db.execute(
        select(func.count())
        .select_from(BulkUploadFile)
        .where(
            BulkUploadFile.bulk_upload_id == batch.id,
            BulkUploadFile.parsing_status == 'failed',
        )
    ).scalar_one()

    queued_jobs = db.execute(
        select(func.count())
        .select_from(BulkUploadProcessingQueue)
        .where(
            BulkUploadProcessingQueue.bulk_upload_id == batch.id,
            BulkUploadProcessingQueue.job_status.in_(['queued', 'processing']),
        )
    ).scalar_one()

    confidence_avg = db.execute(
        select(func.avg(BulkUploadFile.parsing_confidence))
        .where(
            BulkUploadFile.bulk_upload_id == batch.id,
            BulkUploadFile.parsing_confidence.isnot(None),
        )
    ).scalar_one() or 0.0

    duplicate_candidates_detected = db.execute(
        select(func.count(func.distinct(BulkUploadCandidateMatch.bulk_upload_file_id)))
        .join(BulkUploadFile, BulkUploadCandidateMatch.bulk_upload_file_id == BulkUploadFile.id)
        .where(BulkUploadFile.bulk_upload_id == batch.id)
    ).scalar_one()

    duplicates_admin_reviewed = db.execute(
        select(func.count())
        .join(BulkUploadFile, BulkUploadCandidateMatch.bulk_upload_file_id == BulkUploadFile.id)
        .where(
            BulkUploadFile.bulk_upload_id == batch.id,
            BulkUploadCandidateMatch.admin_decision.isnot(None),
            BulkUploadCandidateMatch.admin_decision != 'pending',
        )
    ).scalar_one()

    duplicates_auto_merged = db.execute(
        select(func.count())
        .join(BulkUploadFile, BulkUploadCandidateMatch.bulk_upload_file_id == BulkUploadFile.id)
        .where(
            BulkUploadFile.bulk_upload_id == batch.id,
            BulkUploadCandidateMatch.merge_status == 'completed',
        )
    ).scalar_one()

    new_candidates_identified = db.execute(
        select(func.count())
        .select_from(BulkUploadFile)
        .where(
            BulkUploadFile.bulk_upload_id == batch.id,
            BulkUploadFile.parsing_status == 'completed',
            or_(
                BulkUploadFile.match_type == 'no_match',
                BulkUploadFile.matched_candidate_id.is_(None),
            ),
        )
    ).scalar_one()

    total_candidates_found = db.execute(
        select(func.count(func.distinct(BulkUploadCandidateMatch.matched_candidate_user_id)))
        .join(BulkUploadFile, BulkUploadCandidateMatch.bulk_upload_file_id == BulkUploadFile.id)
        .where(
            BulkUploadFile.bulk_upload_id == batch.id,
            BulkUploadCandidateMatch.matched_candidate_user_id.isnot(None),
        )
    ).scalar_one()

    pending_or_processing_files = db.execute(
        select(func.count())
        .select_from(BulkUploadFile)
        .where(
            BulkUploadFile.bulk_upload_id == batch.id,
            BulkUploadFile.parsing_status.in_(['pending', 'processing']),
        )
    ).scalar_one()

    if queued_jobs > 0 or pending_or_processing_files > 0:
        upload_status = 'processing'
    elif total_files == 0:
        upload_status = batch.upload_status or 'uploaded'
    elif parsing_failed > 0 and successfully_parsed == 0:
        upload_status = 'failed'
    elif parsing_failed > 0:
        upload_status = 'partially_failed'
    else:
        upload_status = 'completed'

    return {
        'total_files_uploaded': int(total_files or 0),
        'successfully_parsed': int(successfully_parsed or 0),
        'parsing_failed': int(parsing_failed or 0),
        'extraction_confidence_avg': float(confidence_avg),
        'duplicate_candidates_detected': int(duplicate_candidates_detected or 0),
        'duplicates_admin_reviewed': int(duplicates_admin_reviewed or 0),
        'duplicates_auto_merged': int(duplicates_auto_merged or 0),
        'new_candidates_identified': int(new_candidates_identified or 0),
        'total_candidates_found': int(total_candidates_found or 0),
        'job_queue_size': int(queued_jobs or 0),
        'upload_status': upload_status,
        'processing_started_at': batch.processing_started_at,
        'processing_completed_at': batch.processing_completed_at,
    }


def reconcile_batch(db, batch: BulkUpload, apply: bool) -> None:
    metrics = calculate_metrics(db, batch)

    if apply:
        batch.total_files_uploaded = metrics['total_files_uploaded']
        batch.successfully_parsed = metrics['successfully_parsed']
        batch.parsing_failed = metrics['parsing_failed']
        batch.extraction_confidence_avg = metrics['extraction_confidence_avg']
        batch.duplicate_candidates_detected = metrics['duplicate_candidates_detected']
        batch.duplicates_admin_reviewed = metrics['duplicates_admin_reviewed']
        batch.duplicates_auto_merged = metrics['duplicates_auto_merged']
        batch.new_candidates_identified = metrics['new_candidates_identified']
        batch.total_candidates_found = metrics['total_candidates_found']
        batch.upload_status = metrics['upload_status']

        if not batch.processing_started_at and (metrics['successfully_parsed'] + metrics['parsing_failed'] > 0 or metrics['job_queue_size'] > 0):
            batch.processing_started_at = datetime.utcnow()

        if metrics['upload_status'] != 'processing' and batch.processing_completed_at is None:
            if metrics['total_files_uploaded'] > 0 and metrics['successfully_parsed'] + metrics['parsing_failed'] == metrics['total_files_uploaded']:
                batch.processing_completed_at = datetime.utcnow()

        db.add(batch)
        db.commit()

    logger.info("Batch %s reconciliation summary:", batch.id)
    logger.info("  upload_status=%s", metrics['upload_status'])
    logger.info("  total_files_uploaded=%d", metrics['total_files_uploaded'])
    logger.info("  successfully_parsed=%d", metrics['successfully_parsed'])
    logger.info("  parsing_failed=%d", metrics['parsing_failed'])
    logger.info("  duplicate_candidates_detected=%d", metrics['duplicate_candidates_detected'])
    logger.info("  duplicates_admin_reviewed=%d", metrics['duplicates_admin_reviewed'])
    logger.info("  new_candidates_identified=%d", metrics['new_candidates_identified'])
    logger.info("  job_queue_size=%d", metrics['job_queue_size'])
    if apply:
        logger.info("  Changes saved.")
    else:
        logger.info("  Dry-run only. No changes were applied.")


def main() -> None:
    args = parse_args()
    db = SessionLocal()

    try:
        query = select(BulkUpload).order_by(BulkUpload.created_at.desc())
        if args.batch_id:
            query = query.where(BulkUpload.id == args.batch_id)

        if args.limit and not args.batch_id:
            query = query.limit(args.limit)

        batches = db.execute(query).scalars().all()
        if not batches:
            logger.warning("No bulk upload batches found to reconcile.")
            return

        logger.info("Reconciling %d bulk upload batch(es) %s", len(batches), "(apply enabled)" if args.apply else "(dry-run)")

        for batch in batches:
            if args.verbose:
                logger.info("Processing batch %s (%s)", batch.id, batch.batch_name)
            reconcile_batch(db, batch, args.apply)

    finally:
        db.close()


if __name__ == '__main__':
    main()
