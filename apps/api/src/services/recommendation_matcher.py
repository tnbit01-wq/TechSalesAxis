"""Recommendation scoring helpers used by the candidate service.

This module intentionally stays independent from ``candidate_service`` to avoid
import cycles during application startup.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from difflib import SequenceMatcher
from typing import List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from src.core.models import CandidateProfile, Company, Job, ProfileScore


def _clamp_score(value: float) -> int:
	return int(max(0, min(99, round(value))))


def _string_similarity(str1: str, str2: str) -> float:
	if not str1 or not str2:
		return 0.0
	return SequenceMatcher(None, str1.lower(), str2.lower()).ratio()


def benchmark_for_mode(filter_type: str) -> int:
	"""Return the minimum score required for a recommendation mode."""
	return {
		"culture_fit": 75,
		"hiring_intent": 60,
		"growth_hub": 62,
	}.get((filter_type or "").strip().lower(), 62)


def _score_candidate_company_culture(
	candidate: CandidateProfile,
	company: Company,
	profile_score: Optional[ProfileScore] = None,
) -> Tuple[int, str]:
	if not profile_score or (str(getattr(candidate, "assessment_status", "") or "").strip().lower() != "completed"):
		return 0, "Complete your assessment to see culture-fit companies."

	company_profile_score = float(company.profile_score or 0)
	if company_profile_score <= 0:
		return 0, "This company has not completed a recruiter assessment yet."

	behavioral = float(getattr(profile_score, "behavioral_score", 0) or 50)
	psychometric = float(getattr(profile_score, "psychometric_score", 0) or 50)
	skills = float(getattr(profile_score, "skills_score", 0) or 50)
	reference = float(getattr(profile_score, "reference_score", 0) or 50)
	final_profile = float(getattr(profile_score, "final_score", 0) or 50)
	readiness = float(getattr(candidate, "career_readiness_score", 0) or 50)

	candidate_culture_score = (
		behavioral * 0.18
		+ psychometric * 0.18
		+ skills * 0.20
		+ reference * 0.14
		+ final_profile * 0.22
		+ readiness * 0.08
	)
	company_alignment = max(0.0, 100.0 - abs(company_profile_score - candidate_culture_score))

	company_text = " ".join([
		company.description or "",
		" ".join(company.hiring_focus_areas or []),
		company.industry_category or "",
	]).lower()
	candidate_text = " ".join([
		candidate.bio or "",
		candidate.long_term_goal or "",
		" ".join(candidate.career_interests or []),
		" ".join(candidate.learning_interests or []),
	]).lower()

	value_terms = [
		"growth", "learning", "ownership", "transparency", "autonomy",
		"collaboration", "fairness", "impact", "mentorship", "innovation",
	]
	value_hits = sum(1 for term in value_terms if term in company_text and term in candidate_text)
	values_alignment = min(100.0, value_hits * 12.0)

	work_preference = 55.0
	job_type = (candidate.job_type or "").lower()
	contract_pref = (candidate.contract_preference or "").lower()
	if "remote" in company_text and (candidate.willing_to_relocate is False or "remote" in job_type):
		work_preference += 14
	if "hybrid" in company_text:
		work_preference += 8
	if contract_pref == "both":
		work_preference += 8
	elif contract_pref == "contract" and "contract" in company_text:
		work_preference += 8

	growth_orientation = 52.0
	growth_terms = ["mentorship", "development", "training", "leadership", "career path"]
	growth_hits = sum(1 for term in growth_terms if term in company_text)
	growth_orientation += min(24.0, growth_hits * 6.0)

	final_score = (
		company_alignment * 0.56
		+ values_alignment * 0.18
		+ max(0.0, min(100.0, work_preference)) * 0.16
		+ max(0.0, min(100.0, growth_orientation)) * 0.10
	)

	score_value = _clamp_score(final_score)
	note_parts: List[str] = []

	if score_value >= 85:
		note_parts.append("This company is a very strong reverse culture-fit match for your completed profile.")
	elif score_value >= 72:
		note_parts.append("This company is a strong match for your profile and recruiter culture signal.")
	else:
		note_parts.append("This company is a partial match and should be validated in conversation.")

	if company_alignment >= 70:
		note_parts.append(f"Their recruiter culture score ({company_profile_score:.0f}) is closely aligned with your assessment profile.")
	elif company_alignment >= 45:
		note_parts.append("Their recruiter culture score partially aligns with your assessment profile.")
	elif values_alignment >= 30:
		note_parts.append("There is partial values alignment based on current signals.")
	else:
		note_parts.append("Values alignment appears limited from currently available information.")

	if max(0.0, min(100.0, work_preference)) >= 70:
		note_parts.append("The work setup seems to fit your preferred way of working.")

	return score_value, " ".join(note_parts[:3])


def _score_candidate_company_hiring_intent(
	candidate: CandidateProfile,
	company: Company,
	db: Session,
	profile_score: Optional[ProfileScore] = None,
) -> Tuple[int, str]:
	reasoning_parts: List[str] = []
	urgency_score = 35.0
	role_fit_score = 35.0
	compensation_score = 45.0
	process_score = float(company.profile_score or 45)

	try:
		recent_jobs = db.query(func.count(Job.id)).filter(
			Job.company_id == company.id,
			Job.created_at >= datetime.now() - timedelta(days=30),
			Job.status == "active",
		).scalar() or 0

		if recent_jobs >= 5:
			urgency_score = 92
			reasoning_parts.append(f"Aggressively hiring ({recent_jobs} roles)")
		elif recent_jobs >= 2:
			urgency_score = 78
			reasoning_parts.append(f"Actively hiring ({recent_jobs} roles)")
		elif recent_jobs >= 1:
			urgency_score = 66
			reasoning_parts.append("Recently posted")
	except Exception:
		pass

	try:
		matching_roles = db.query(Job).filter(
			Job.company_id == company.id,
			Job.status == "active",
		).all()

		role_matches = 0
		for role in matching_roles:
			if _string_similarity(candidate.current_role or "", role.title or "") > 0.5:
				role_matches += 1

		if role_matches >= 3:
			role_fit_score = 90
			reasoning_parts.append("Multiple roles match your profile")
		elif role_matches >= 1:
			role_fit_score = 74
			reasoning_parts.append(f"{role_matches} matching role(s)")
	except Exception:
		matching_roles = []

	try:
		avg_salary_sum = 0.0
		job_count = 0
		for role in matching_roles:
			try:
				if role.salary_range:
					parts = str(role.salary_range).split("-")
					if len(parts) >= 1:
						salary = float(parts[-1].strip())
						avg_salary_sum += salary
						job_count += 1
			except Exception:
				pass

		if job_count > 0:
			avg_salary = avg_salary_sum / job_count
			if candidate.expected_salary and avg_salary >= candidate.expected_salary * 0.95:
				compensation_score = 86
				reasoning_parts.append("Budget available for you")
			elif candidate.expected_salary and avg_salary >= candidate.expected_salary * 0.80:
				compensation_score = 65
				reasoning_parts.append("Budget likely viable")
	except Exception:
		pass

	if process_score >= 75:
		reasoning_parts.append("Structured hiring process")
	else:
		reasoning_parts.append("Hiring process still maturing")

	exact_matches = 0
	try:
		for role in matching_roles:
			if candidate.current_role and candidate.current_role.lower() in (role.title or "").lower():
				exact_matches += 1
	except Exception:
		pass

	if exact_matches > 0:
		role_fit_score = min(98, role_fit_score + 10)
		reasoning_parts.append("Hiring for your exact role")

	motivation_signal = float(getattr(profile_score, "psychometric_score", 0) or 55)
	final_score = (
		urgency_score * 0.34
		+ role_fit_score * 0.30
		+ compensation_score * 0.20
		+ process_score * 0.10
		+ motivation_signal * 0.06
	)
	score_value = _clamp_score(final_score)
	note_parts: List[str] = []

	if score_value >= 85:
		note_parts.append("This company shows strong hiring momentum for profiles like yours.")
	elif score_value >= 72:
		note_parts.append("This company is actively hiring and has good role alignment for you.")
	else:
		note_parts.append("This company has moderate hiring intent for your profile right now.")

	if any("Aggressively hiring" in r or "Actively hiring" in r for r in reasoning_parts):
		note_parts.append("They are hiring actively, which can improve interview turnaround.")

	if any("Budget" in r for r in reasoning_parts):
		note_parts.append("Compensation signals suggest a workable range for your expectations.")

	if any("exact role" in r.lower() for r in reasoning_parts):
		note_parts.append("There are openings closely matching your current role.")

	return score_value, " ".join(note_parts[:3])


def _score_company_growth(
	candidate: CandidateProfile,
	company: Company,
	db: Session,
	profile_score: Optional[ProfileScore] = None,
) -> Tuple[int, str]:
	base_score = 40
	reasoning_parts: List[str] = []

	try:
		three_months_ago = datetime.now() - timedelta(days=90)
		jobs_last_quarter = db.query(func.count(Job.id)).filter(
			Job.company_id == company.id,
			Job.created_at >= three_months_ago,
			Job.status == "active",
		).scalar() or 0

		if jobs_last_quarter >= 10:
			growth_bonus = 24
			reasoning_parts.append("Hypergrowth company")
		elif jobs_last_quarter >= 5:
			growth_bonus = 18
			reasoning_parts.append("Rapid growth trajectory")
		else:
			growth_bonus = 10
			reasoning_parts.append("Steady growth")
		base_score += growth_bonus
	except Exception:
		base_score += 10

	high_growth_industries = ["ai", "fintech", "saas", "deeptech", "biotech"]
	industry_lower = (company.industry_category or "").lower()
	if any(ind in industry_lower for ind in high_growth_industries):
		base_score += 14
		reasoning_parts.append("High-growth industry")
	else:
		base_score += 8
		reasoning_parts.append("Established industry")

	base_score += 12
	reasoning_parts.append("Quality team composition")

	base_score += 8
	reasoning_parts.append("Equity growth potential")

	description = (company.description or "").lower()
	focus_areas = " ".join(company.hiring_focus_areas or []).lower()
	career_keywords = (candidate.bio or "").lower()
	if (description or focus_areas) and career_keywords:
		if any(word in (description + " " + focus_areas) for word in career_keywords.split()[:3]):
			base_score += 12
			reasoning_parts.append("Mission-aligned opportunity")
		else:
			base_score += 6
			reasoning_parts.append("Aligned with your interests")

	growth_readiness = float(getattr(profile_score, "psychometric_score", 0) or 50)
	final_score = min(99, base_score * 0.82 + growth_readiness * 0.18)
	score_value = _clamp_score(final_score)
	note_parts: List[str] = []

	if score_value >= 85:
		note_parts.append("This company looks like a high-upside growth opportunity.")
	elif score_value >= 72:
		note_parts.append("This company shows healthy growth momentum and good long-term upside.")
	else:
		note_parts.append("This company shows some growth potential worth exploring.")

	if any("Hypergrowth" in r or "Rapid growth" in r for r in reasoning_parts):
		note_parts.append("Hiring activity suggests strong expansion momentum.")

	return score_value, " ".join(note_parts[:2])


def score_candidate_company_match(
	candidate: CandidateProfile,
	company: Company,
	db: Session,
	mode: str = "culture_fit",
	profile_score: Optional[ProfileScore] = None,
) -> Tuple[int, str]:
	"""Score a company for the requested recommendation mode."""
	normalized_mode = (mode or "culture_fit").strip().lower()

	if normalized_mode == "hiring_intent":
		return _score_candidate_company_hiring_intent(candidate, company, db, profile_score)

	if normalized_mode == "growth_hub":
		return _score_company_growth(candidate, company, db, profile_score)

	return _score_candidate_company_culture(candidate, company, profile_score)


__all__ = ["benchmark_for_mode", "score_candidate_company_match"]
