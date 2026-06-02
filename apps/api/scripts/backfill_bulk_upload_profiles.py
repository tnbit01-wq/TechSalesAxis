"""Backfill bulk-uploaded resumes into CandidateProfile rows.

This script scans parsed bulk upload files that do not yet have a linked
CandidateProfile and attempts to recover them safely.

Default mode is dry-run.

Examples:
    python apps/api/scripts/backfill_bulk_upload_profiles.py
    python apps/api/scripts/backfill_bulk_upload_profiles.py --apply
    python apps/api/scripts/backfill_bulk_upload_profiles.py --batch-id <uuid> --apply
    python apps/api/scripts/backfill_bulk_upload_profiles.py --file-id <uuid> --dry-run
"""

from __future__ import annotations

import argparse
import logging
import re
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from pathlib import Path
import sys


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from sqlalchemy import func

from src.core.database import SessionLocal
from src.core.models import (
    BulkUpload,
    BulkUploadAuditLog,
    BulkUploadCandidateMatch,
    BulkUploadFile,
    CandidateProfile,
    User,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("backfill_bulk_upload_profiles")


def _extract_phone_number(text: str) -> Optional[str]:
    if not text:
        return None

    phone_patterns = [
        r'\+91[\s\-\.]?(\d{5})[\s\-\.]?(\d{5})',
        r'\+91[\s\-]?(\d{10})',
        r'\+91(\d{10})',
        r'\+1[\s\-\.]?(\([0-9]{3}\))[\s\-\.]?([0-9]{3})[\s\-\.]?([0-9]{4})',
        r'\+\d{1,3}[\s\-]?(\d{7,12})',
        r'\b91(\d{10})\b',
        r'\b(\d{10})\b',
        r'\(([0-9]{3})\)[\s\-\.]?([0-9]{3})[\s\-\.]?([0-9]{4})',
    ]

    text_lower = text.lower()
    if any(keyword in text_lower for keyword in ['phone', 'mobile', 'contact', 'tel', 'whatsapp']):
        for keyword in ['phone', 'mobile', 'contact number', 'tel', 'whatsapp']:
            idx = text_lower.find(keyword)
            if idx != -1:
                section = text[idx:idx + 150]
                for pattern in phone_patterns:
                    match = re.search(pattern, section)
                    if match:
                        digits_only = re.sub(r'\D', '', match.group(0))
                        if len(digits_only) >= 10:
                            return digits_only[-10:]

    for pattern in phone_patterns:
        for match in re.finditer(pattern, text):
            digits_only = re.sub(r'\D', '', match.group(0))
            if len(digits_only) >= 10:
                return digits_only[-10:]

    return None


IRRELEVANT_ROLE_KEYWORDS = {
    'teacher', 'professor', 'instructor', 'lecturer', 'trainer', 'tutor', 'educator',
    'education', 'school', 'college', 'university', 'teaching', 'academic',
    'hr', 'human resources', 'recruitment', 'recruiter', 'hiring manager',
    'accountant', 'accounting', 'cpa', 'bookkeeper', 'financial analyst', 'cfo', 'finance manager',
    'retail', 'store manager', 'cashier', 'retail associate',
    'call center', 'call centre', 'bpo', 'bpo executive',
    'housekeeping', 'housemaid', 'cook', 'chef', 'waiter', 'bartender',
    'construction', 'carpenter', 'mason', 'electrician', 'plumber',
    'driver', 'taxi', 'uber driver', 'delivery executive'
}


def _classify_role_category(current_role: str, skills: list) -> str:
    if not current_role:
        return 'TECH' if skills else 'RELEVANT'

    role_lower = current_role.lower()
    if any(keyword in role_lower for keyword in IRRELEVANT_ROLE_KEYWORDS):
        return 'IRRELEVANT'

    tech_keywords = {
        'developer', 'engineer', 'programmer', 'software', 'architect',
        'data scientist', 'data engineer', 'analyst', 'business intelligence',
        'devops', 'sre', 'qa', 'automation', 'tech lead', 'scrum master',
        'product manager', 'it manager', 'tech manager',
        'system admin', 'network admin', 'database admin',
        'cloud', 'aws', 'azure', 'gcp', 'kubernetes', 'docker',
        'python', 'java', 'javascript', 'react', 'django', '.net',
        'sql', 'mongodb', 'postgres'
    }
    if any(keyword in role_lower for keyword in tech_keywords):
        return 'TECH'
    return 'RELEVANT'


def _calculate_it_tech_experience(total_years: int, current_role: str, skills: list, education: list) -> int:
    if total_years is None or total_years <= 0:
        return 0
    if _classify_role_category(current_role, skills) == 'IRRELEVANT':
        return 0
    return int(total_years)


def _normalize_name(parsed_data: Dict[str, Any]) -> Optional[str]:
    full_name = parsed_data.get('name') or parsed_data.get('full_name')
    if not full_name:
        return None
    return ' '.join(str(full_name).split())


def _flatten_skills(parsed_data: Dict[str, Any]) -> List[str]:
    raw_skills = parsed_data.get('skills', [])
    if isinstance(raw_skills, dict):
        flat = []
        for value in raw_skills.values():
            if isinstance(value, list):
                flat.extend(value)
        return [str(skill).strip() for skill in flat if skill]
    if isinstance(raw_skills, list):
        return [str(skill).strip() for skill in raw_skills if skill]
    return []


def _determine_experience(parsed_data: Dict[str, Any], raw_text: str) -> Tuple[int, str]:
    raw_exp = parsed_data.get('years_experience') or parsed_data.get('years_of_experience') or parsed_data.get('relevant_years_experience') or 0
    try:
        raw_exp = int(float(raw_exp))
    except Exception:
        raw_exp = 0

    skills = _flatten_skills(parsed_data)
    education = parsed_data.get('education') or parsed_data.get('education_history') or []
    current_role = parsed_data.get('current_role') or ''
    exp_years = _calculate_it_tech_experience(raw_exp, current_role, skills, education)
    if exp_years < 2:
        tier = 'fresher'
    elif exp_years <= 5:
        tier = 'mid'
    elif exp_years <= 10:
        tier = 'senior'
    else:
        tier = 'leadership'
    return exp_years, tier


def _build_shadow_email() -> str:
    return f"shadow_{uuid.uuid4().hex[:8]}@shadow.talentflow.pro"


def _audit(db, bulk_upload_id, action_type, affected_type, affected_id, details):
    db.add(
        BulkUploadAuditLog(
            bulk_upload_id=bulk_upload_id,
            action_type=action_type,
            actor_type='system',
            affected_resource_type=affected_type,
            affected_resource_id=affected_id,
            action_details=details,
            created_at=datetime.utcnow(),
        )
    )


def _ensure_profile_for_file(db, file_row: BulkUploadFile, apply_changes: bool) -> Dict[str, Any]:
    parsed = file_row.parsed_data or {}
    bulk_upload_id = file_row.bulk_upload_id
    report: Dict[str, Any] = {
        'file_id': str(file_row.id),
        'bulk_upload_id': str(bulk_upload_id),
        'filename': file_row.original_filename,
        'action': 'noop',
        'reason': None,
        'user_id': None,
        'created_profile': False,
        'linked_profile': False,
        'created_match': False,
    }

    name = _normalize_name(parsed) or 'Unknown Candidate'
    email = (parsed.get('email') or parsed.get('links', {}).get('email') or '').strip().lower()
    phone = parsed.get('phone') or parsed.get('phone_number') or None
    if not phone and file_row.raw_text:
        phone = _extract_phone_number(file_row.raw_text)
    if not email:
        email = _build_shadow_email()

    existing_user = db.query(User).filter(func.lower(User.email) == email.lower()).first()
    existing_profile = None
    if existing_user:
        existing_profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == existing_user.id).first()
    else:
        existing_profile = db.query(CandidateProfile).filter(CandidateProfile.bulk_file_id == file_row.id).first()

    exp_years, exp_tier = _determine_experience(parsed, file_row.raw_text or '')
    skills = _flatten_skills(parsed)
    education = parsed.get('education') or parsed.get('education_history') or []
    qualification = parsed.get('highest_education') or (education[0].get('degree') if isinstance(education, list) and education and isinstance(education[0], dict) else None)

    if existing_profile:
        report['action'] = 'link_existing_profile'
        report['user_id'] = str(existing_profile.user_id)
        if apply_changes:
            if not existing_profile.bulk_file_id:
                existing_profile.bulk_file_id = file_row.id
            if not existing_profile.resume_path:
                existing_profile.resume_path = file_row.file_storage_path
            if not existing_profile.full_name:
                existing_profile.full_name = name
            if phone and not existing_profile.phone_number:
                existing_profile.phone_number = phone
            if parsed.get('current_role') and not existing_profile.current_role:
                existing_profile.current_role = parsed.get('current_role')
            if not existing_profile.years_of_experience:
                existing_profile.years_of_experience = exp_years
            if not existing_profile.experience:
                existing_profile.experience = exp_tier
            if skills and not existing_profile.skills:
                existing_profile.skills = skills
            if education and not existing_profile.education_history:
                existing_profile.education_history = education
            if qualification and not existing_profile.qualification_held:
                existing_profile.qualification_held = qualification
            file_row.matched_candidate_id = existing_profile.user_id
            file_row.match_type = file_row.match_type or 'no_match'
            db.commit()
            _audit(
                db,
                bulk_upload_id,
                'backfill_link_existing_profile',
                'bulk_upload_file',
                file_row.id,
                f"Linked bulk upload file to existing CandidateProfile user_id={existing_profile.user_id}",
            )
            db.commit()
            report['linked_profile'] = True
            report['reason'] = 'existing_profile_found'
        else:
            report['reason'] = 'existing_profile_found'
        return report

    # Create a user/profile if missing and apply is enabled.
    if not apply_changes:
        report['action'] = 'create_shadow_profile'
        report['reason'] = 'missing_profile_would_create'
        report['user_id'] = None
        return report

    user = existing_user
    if not user:
        user = User(
            id=uuid.uuid4(),
            email=email,
            role='candidate',
            full_name=name,
            hashed_password='',
            is_verified=False,
        )
        db.add(user)
        db.flush()

    new_profile = CandidateProfile(
        user_id=user.id,
        full_name=name,
        phone_number=phone,
        current_role=parsed.get('current_role'),
        years_of_experience=exp_years,
        location=parsed.get('location'),
        skills=skills or None,
        education_history=education or None,
        qualification_held=qualification,
        resume_path=file_row.file_storage_path,
        bulk_file_id=file_row.id,
        is_shadow_profile=True,
        experience=exp_tier,
    )
    db.add(new_profile)
    file_row.matched_candidate_id = user.id
    file_row.match_type = file_row.match_type or 'no_match'
    db.commit()

    _audit(
        db,
        bulk_upload_id,
        'backfill_create_shadow_profile',
        'candidate_profile',
        user.id,
        f"Created shadow CandidateProfile for bulk file {file_row.id}",
    )
    db.commit()

    report['action'] = 'create_shadow_profile'
    report['reason'] = 'missing_profile_created'
    report['user_id'] = str(user.id)
    report['created_profile'] = True
    report['linked_profile'] = True
    return report


def _create_review_match(db, file_row: BulkUploadFile, apply_changes: bool, reason: str) -> Dict[str, Any]:
    parsed = file_row.parsed_data or {}
    if not apply_changes:
        return {
            'file_id': str(file_row.id),
            'bulk_upload_id': str(file_row.bulk_upload_id),
            'filename': file_row.original_filename,
            'action': 'create_review_match',
            'reason': reason,
            'created_match': False,
        }

    existing_match = db.query(BulkUploadCandidateMatch).filter(BulkUploadCandidateMatch.bulk_upload_file_id == file_row.id).first()
    if existing_match:
        return {
            'file_id': str(file_row.id),
            'bulk_upload_id': str(file_row.bulk_upload_id),
            'filename': file_row.original_filename,
            'action': 'review_match_exists',
            'reason': 'match_already_exists',
            'created_match': False,
        }

    match = BulkUploadCandidateMatch(
        id=uuid.uuid4(),
        bulk_upload_file_id=file_row.id,
        matched_candidate_user_id=file_row.matched_candidate_id,
        candidate_full_name=_normalize_name(parsed),
        candidate_email=(parsed.get('email') or '').strip().lower() or None,
        candidate_phone=parsed.get('phone') or parsed.get('phone_number') or None,
        match_type='soft_match',
        match_confidence=0.5,
        match_reason=reason,
        match_details={
            'backfill_created': True,
            'reason': reason,
            'parsed_email': parsed.get('email'),
            'parsed_name': parsed.get('name') or parsed.get('full_name'),
        },
        admin_decision='pending',
        created_at=datetime.utcnow(),
    )
    db.add(match)
    db.commit()
    _audit(
        db,
        file_row.bulk_upload_id,
        'backfill_create_review_match',
        'bulk_upload_candidate_match',
        match.id,
        f"Created pending duplicate-review match for bulk file {file_row.id}",
    )
    db.commit()
    return {
        'file_id': str(file_row.id),
        'bulk_upload_id': str(file_row.bulk_upload_id),
        'filename': file_row.original_filename,
        'action': 'create_review_match',
        'reason': reason,
        'created_match': True,
    }


def backfill(apply_changes: bool = False, batch_id: Optional[str] = None, file_id: Optional[str] = None, limit: Optional[int] = None) -> Dict[str, Any]:
    db = SessionLocal()
    try:
        query = db.query(BulkUploadFile).filter(BulkUploadFile.parsing_status == 'parsed')
        if batch_id:
            query = query.filter(BulkUploadFile.bulk_upload_id == batch_id)
        if file_id:
            query = query.filter(BulkUploadFile.id == file_id)
        query = query.order_by(BulkUploadFile.created_at.asc())
        if limit:
            query = query.limit(limit)

        rows = query.all()
        if not rows:
            logger.info('No parsed bulk upload files found for the selected scope.')
            return {
                'scanned': 0,
                'created_profiles': 0,
                'linked_profiles': 0,
                'created_review_matches': 0,
                'batches_touched': [],
                'details': [],
            }

        scanned = 0
        created_profiles = 0
        linked_profiles = 0
        created_review_matches = 0
        touched_batches = set()
        details: List[Dict[str, Any]] = []

        for row in rows:
            scanned += 1
            touched_batches.add(str(row.bulk_upload_id))
            try:
                profile = db.query(CandidateProfile).filter(CandidateProfile.bulk_file_id == row.id).first()
                if profile or row.matched_candidate_id:
                    report = _ensure_profile_for_file(db, row, apply_changes)
                else:
                    report = _ensure_profile_for_file(db, row, apply_changes)
                    if apply_changes:
                        if report.get('created_profile'):
                            created_profiles += 1
                        if report.get('linked_profile'):
                            linked_profiles += 1
                    else:
                        # dry-run classification only
                        pass

                if apply_changes and row.matched_candidate_id is None:
                    # if we still didn't link a candidate profile, create a pending review match so the file is visible in admin review
                    review_report = _create_review_match(db, row, apply_changes=True, reason='backfill_unlinked_parsed_file')
                    details.append({**report, **review_report})
                    created_review_matches += 1 if review_report.get('created_match') else 0
                else:
                    details.append(report)
                    if report.get('created_profile'):
                        created_profiles += 1
                    if report.get('linked_profile'):
                        linked_profiles += 1
            except Exception as exc:
                logger.exception(f"Failed to process file {row.id}: {exc}")
                details.append({
                    'file_id': str(row.id),
                    'bulk_upload_id': str(row.bulk_upload_id),
                    'filename': row.original_filename,
                    'action': 'error',
                    'reason': str(exc),
                })

        if apply_changes:
            # Recalculate per-batch counts for touched batches based on actual data.
            for batch_uuid in touched_batches:
                batch = db.query(BulkUpload).filter(BulkUpload.id == batch_uuid).first()
                if not batch:
                    continue
                batch.total_candidates_found = db.query(func.count(CandidateProfile.user_id)).filter(CandidateProfile.bulk_file_id.in_(
                    db.query(BulkUploadFile.id).filter(BulkUploadFile.bulk_upload_id == batch_uuid).subquery()
                )).scalar() or batch.total_candidates_found
                batch.new_candidates_identified = db.query(func.count(CandidateProfile.user_id)).filter(CandidateProfile.bulk_file_id.in_(
                    db.query(BulkUploadFile.id).filter(BulkUploadFile.bulk_upload_id == batch_uuid).subquery()
                )).scalar() or batch.new_candidates_identified
                batch.shadow_profiles_created = db.query(func.count(CandidateProfile.user_id)).filter(
                    CandidateProfile.bulk_file_id.in_(db.query(BulkUploadFile.id).filter(BulkUploadFile.bulk_upload_id == batch_uuid).subquery()),
                    CandidateProfile.is_shadow_profile.is_(True),
                ).scalar() or batch.shadow_profiles_created
                db.commit()

        return {
            'scanned': scanned,
            'created_profiles': created_profiles,
            'linked_profiles': linked_profiles,
            'created_review_matches': created_review_matches,
            'batches_touched': sorted(touched_batches),
            'details': details,
        }
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description='Backfill parsed bulk-upload files into CandidateProfile rows')
    parser.add_argument('--apply', action='store_true', help='Apply changes (default is dry-run)')
    parser.add_argument('--batch-id', help='Limit to a single bulk_upload_id')
    parser.add_argument('--file-id', help='Limit to a single bulk_upload_file_id')
    parser.add_argument('--limit', type=int, help='Limit number of files processed')
    args = parser.parse_args()

    result = backfill(
        apply_changes=args.apply,
        batch_id=args.batch_id,
        file_id=args.file_id,
        limit=args.limit,
    )

    mode = 'APPLY' if args.apply else 'DRY-RUN'
    logger.info(
        '%s summary: scanned=%s created_profiles=%s linked_profiles=%s created_review_matches=%s batches_touched=%s',
        mode,
        result['scanned'],
        result['created_profiles'],
        result['linked_profiles'],
        result['created_review_matches'],
        result['batches_touched'],
    )

    # Print a concise machine-readable summary for CI / logs.
    for item in result['details'][:50]:
        logger.info('detail=%s', item)


if __name__ == '__main__':
    main()
