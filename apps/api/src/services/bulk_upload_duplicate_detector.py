"""
BULK UPLOAD - DUPLICATE DETECTION ALGORITHM
Author: Implementation Team
Date: March 26, 2026
Purpose: Score & identify duplicate candidates from bulk uploads

THRESHOLDS:
- >90%: Auto-merge (definite duplicate)
- 70-90%: Flag for admin review (likely duplicate)  
- 50-70%: Soft match (possible duplicate)
- <50%: No match (new candidate)
"""

from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from difflib import SequenceMatcher
from datetime import datetime
import json
import re


@dataclass
class CandidateInfo:
    """Extracted candidate data from resume"""
    name: str
    email: str
    phone: str
    current_role: str
    years_of_experience: int
    location: str
    skills: List[str]
    companies: List[str]
    education: str
    extraction_confidence: float


@dataclass
class DuplicateMatch:
    """Result of duplicate detection scoring"""
    matched_candidate_id: Optional[str]
    matched_candidate_name: Optional[str]
    match_type: str  # exact_match, strong_match, moderate_match, soft_match, no_match
    match_confidence: float  # 0.5 - 1.0
    match_reason: str
    match_details: Dict
    admin_review_required: bool


class DuplicateDetector:
    """Production-grade duplicate detection for bulk resume uploads"""
    
    # Thresholds
    AUTO_MERGE_THRESHOLD = 0.90  # >90% = auto-merge
    ADMIN_REVIEW_THRESHOLD = 0.70  # 70-90% = ask admin
    SOFT_MATCH_THRESHOLD = 0.50  # 50-70% = soft match
    
    # Weights for scoring
    WEIGHTS = {
        'email_exact': 1.0,  # 100% if email matches exactly
        'phone_exact': 0.90,  # 90% if phone matches
        'name_similarity': 0.30,  # Up to 30%
        'skills_overlap': 0.15,  # Up to 15%
        'company_match': 0.15,  # Up to 15%
        'title_similarity': 0.10,  # Up to 10%
        'education_match': 0.10,  # Up to 10%
        'location_match': 0.10,  # Up to 10%
    }
    
    # Name fuzzy match tolerance
    NAME_FUZZY_THRESHOLD = 0.85  # 85% string similarity
    
    # Skills overlap threshold
    SKILLS_OVERLAP_MIN = 0.40  # 40% of skills must overlap
    
    def __init__(self):
        self.scoring_breakdowns = {}
    
    # =========================================================================
    # PHASE 1: EXACT MATCH DETECTION (High reliability)
    # =========================================================================
    
    def _normalize_email(self, email: str) -> str:
        """Normalize email for comparison"""
        if not email:
            return ""
        return email.lower().strip()
    
    def _normalize_phone(self, phone: str) -> str:
        """Normalize phone: remove all non-digits"""
        if not phone:
            return ""
        # Remove all non-digits
        digits = re.sub(r'\D', '', phone)
        # Keep last 10 digits (handles country codes)
        return digits[-10:] if len(digits) >= 10 else digits
    
    def _check_email_match(self, new_candidate: CandidateInfo, 
                          existing_email: str) -> Tuple[bool, float, str]:
        """
        Check if emails match exactly.
        
        Returns: (is_match, confidence, reason)
        """
        new_email = self._normalize_email(new_candidate.email)
        existing_email = self._normalize_email(existing_email)
        
        if not new_email or not existing_email:
            return False, 0.0, "email_missing"
        
        if new_email == existing_email:
            return True, 1.0, "email_exact_match"
        
        # Check if email prefix matches (before @)
        new_prefix = new_email.split('@')[0]
        existing_prefix = existing_email.split('@')[0]
        
        if new_prefix and existing_prefix and new_prefix == existing_prefix:
            # Same person, possibly different domain (Gmail vs corporate)
            similarity = SequenceMatcher(None, new_email, existing_email).ratio()
            if similarity > 0.80:
                return True, 0.95, "email_prefix_match_high_similarity"
        
        return False, 0.0, "email_no_match"
    
    def _check_phone_match(self, new_candidate: CandidateInfo,
                          existing_phone: str) -> Tuple[bool, float, str]:
        """
        Check if phone numbers match exactly or with minor typos.
        
        Returns: (is_match, confidence, reason)
        """
        new_phone = self._normalize_phone(new_candidate.phone)
        existing_phone = self._normalize_phone(existing_phone)
        
        if not new_phone or not existing_phone:
            return False, 0.0, "phone_missing"
        
        if new_phone == existing_phone:
            return True, 1.0, "phone_exact_match"
        
        # Allow up to 2 digit differences (typos)
        if len(new_phone) == len(existing_phone):
            differences = sum(1 for a, b in zip(new_phone, existing_phone) if a != b)
            if differences <= 2:
                confidence = 1.0 - (differences * 0.05)  # 0.90 for 2-digit typo
                return True, confidence, f"phone_minor_typo_{differences}_digits"
        
        return False, 0.0, "phone_no_match"
    
    # =========================================================================
    # PHASE 2: FUZZY MATCHING (Name, experience, skills)
    # =========================================================================
    
    def _string_similarity(self, str1: str, str2: str) -> float:
        """Levenshtein-based string similarity (0-1)"""
        if not str1 or not str2:
            return 0.0
        
        str1 = str1.lower().strip()
        str2 = str2.lower().strip()
        
        return SequenceMatcher(None, str1, str2).ratio()
    
    def _check_name_match(self, new_candidate: CandidateInfo,
                         existing_name: str) -> Tuple[float, str]:
        """
        Check name similarity using Levenshtein distance.
        
        Returns: (similarity_score, reason)
        """
        if not new_candidate.name or not existing_name:
            return 0.0, "name_missing"
        
        # Exact match
        if new_candidate.name.lower().strip() == existing_name.lower().strip():
            return 1.0, "name_exact"
        
        # Parse names (first, last)
        new_parts = new_candidate.name.lower().split()
        existing_parts = existing_name.lower().split()
        
        # Check if first and last names match (order-independent)
        if len(new_parts) >= 2 and len(existing_parts) >= 2:
            new_first, new_last = new_parts[0], new_parts[-1]
            existing_first, existing_last = existing_parts[0], existing_parts[-1]
            
            # Both names match
            if (new_first == existing_first and new_last == existing_last):
                return 0.98, "name_exact_reordered"
            
            # Last names match and first names similar
            if new_last == existing_last:
                first_similarity = self._string_similarity(new_first, existing_first)
                if first_similarity > 0.85:
                    return 0.90 + (first_similarity * 0.08), "name_last_exact_first_similar"
        
        # Full string similarity
        overall_similarity = self._string_similarity(new_candidate.name, existing_name)
        
        if overall_similarity > self.NAME_FUZZY_THRESHOLD:
            return overall_similarity, f"name_fuzzy_{overall_similarity:.2f}"
        
        return overall_similarity, f"name_low_similarity_{overall_similarity:.2f}"
    
    def _check_skills_overlap(self, new_candidate: CandidateInfo,
                             existing_skills: List[str]) -> Tuple[float, str]:
        """
        Calculate skills overlap percentage.
        
        Returns: (overlap_score 0-1, reason)
        """
        if not new_candidate.skills or not existing_skills:
            return 0.0, "skills_missing"
        
        new_skills_normalized = {s.lower().strip() for s in new_candidate.skills}
        existing_skills_normalized = {s.lower().strip() for s in existing_skills}
        
        if not new_skills_normalized or not existing_skills_normalized:
            return 0.0, "skills_empty"
        
        # Intersection of skills
        common_skills = new_skills_normalized & existing_skills_normalized
        
        # Overlap based on smaller set
        min_set_size = min(len(new_skills_normalized), len(existing_skills_normalized))
        overlap_ratio = len(common_skills) / max(min_set_size, 1)
        
        if overlap_ratio >= self.SKILLS_OVERLAP_MIN:
            return overlap_ratio * 0.15, f"skills_overlap_{overlap_ratio:.2f}_{len(common_skills)}_common"
        
        return 0.0, f"skills_overlap_low_{overlap_ratio:.2f}"
    
    def _check_company_match(self, new_candidate: CandidateInfo,
                            existing_companies: List[str]) -> Tuple[float, str]:
        """
        Calculate company experience overlap.
        
        Returns: (company_score 0-1, reason)
        """
        if not new_candidate.companies or not existing_companies:
            return 0.0, "companies_missing"
        
        new_companies = {c.lower().strip() for c in new_candidate.companies}
        existing_companies_set = {c.lower().strip() for c in existing_companies}
        
        common_companies = new_companies & existing_companies_set
        
        if not common_companies:
            return 0.0, "no_company_overlap"
        
        # Score based on number of common companies
        overlap_ratio = len(common_companies) / max(len(new_companies), 1)
        score = min(overlap_ratio * 0.15, 0.15)  # Max 15%
        
        return score, f"company_overlap_{len(common_companies)}_companies"
    
    def _check_location_match(self, new_candidate: CandidateInfo,
                             existing_location: str) -> Tuple[float, str]:
        """
        Check if locations match (city level).
        
        Returns: (location_score 0-1, reason)
        """
        if not new_candidate.location or not existing_location:
            return 0.0, "location_missing"
        
        new_loc = new_candidate.location.lower().strip()
        existing_loc = existing_location.lower().strip()
        
        if new_loc == existing_loc:
            return 0.10, "location_exact"
        
        # Check if city name appears in both
        new_parts = new_loc.split(',')
        existing_parts = existing_loc.split(',')
        
        if new_parts[0].strip() == existing_parts[0].strip():
            return 0.08, "location_city_match"
        
        # Fuzzy match
        similarity = self._string_similarity(new_loc, existing_loc)
        if similarity > 0.70:
            return similarity * 0.10, f"location_fuzzy_{similarity:.2f}"
        
        return 0.0, "location_no_match"
    
    def _check_title_similarity(self, new_candidate: CandidateInfo,
                               existing_title: str) -> Tuple[float, str]:
        """
        Check if current roles are similar.
        
        Returns: (title_score 0-1, reason)
        """
        if not new_candidate.current_role or not existing_title:
            return 0.0, "title_missing"
        
        if new_candidate.current_role.lower() == existing_title.lower():
            return 0.10, "title_exact"
        
        # Fuzzy match
        similarity = self._string_similarity(new_candidate.current_role, existing_title)
        if similarity > 0.75:
            return similarity * 0.10, f"title_fuzzy_{similarity:.2f}"
        
        return 0.0, "title_no_match"
    
    # =========================================================================
    # PHASE 3: MAIN SCORING FUNCTION
    # =========================================================================
    
    def score_duplicate_match(self, new_candidate: CandidateInfo,
                             existing_candidate: Dict) -> DuplicateMatch:
        """
        Score how likely this is a duplicate based on all factors.
        
        Args:
            new_candidate: Extracted data from uploaded resume
            existing_candidate: Dict with keys:
                - user_id
                - full_name
                - email
                - phone_number
                - current_role
                - years_of_experience
                - location
                - skills (list)
                - previous_companies (list)
                - qualification_held
        
        Returns:
            DuplicateMatch with score and decision recommendation
        """
        
        match_details = {}
        total_score = 0.0
        
        # ===== PHONE CHECK FIRST (PRIORITY) =====
        # If phone matches exactly, this is a definite duplicate
        # regardless of email being different (handles multi-email scenario)
        phone_match, phone_confidence, phone_reason = self._check_phone_match(
            new_candidate,
            existing_candidate.get('phone_number', '')
        )
        
        if phone_match and phone_confidence == 1.0:
            # Exact phone match = definite duplicate (person with multiple emails)
            match_details['phone_match'] = {
                'matched': True,
                'confidence': phone_confidence,
                'reason': phone_reason
            }
            return DuplicateMatch(
                matched_candidate_id=existing_candidate.get('user_id'),
                matched_candidate_name=existing_candidate.get('full_name'),
                match_type="exact_match",
                match_confidence=0.95,
                match_reason="Phone number match - Same candidate (possibly different emails)",
                match_details={'phone_match': match_details['phone_match'], 'primary_match': 'phone'},
                admin_review_required=False
            )
        
        # ===== EMAIL CHECK (Highest confidence) =====
        email_match, email_confidence, email_reason = self._check_email_match(
            new_candidate, 
            existing_candidate.get('email', '')
        )
        match_details['email_match'] = {
            'matched': email_match,
            'confidence': email_confidence,
            'reason': email_reason
        }
        if email_match:
            total_score += email_confidence * self.WEIGHTS['email_exact']
        
        # ===== PHONE CHECK =====
        phone_match, phone_confidence, phone_reason = self._check_phone_match(
            new_candidate,
            existing_candidate.get('phone_number', '')
        )
        match_details['phone_match'] = {
            'matched': phone_match,
            'confidence': phone_confidence,
            'reason': phone_reason
        }
        if phone_match:
            total_score += phone_confidence * self.WEIGHTS['phone_exact']
        
        # ===== NAME SIMILARITY =====
        name_similarity, name_reason = self._check_name_match(
            new_candidate,
            existing_candidate.get('full_name', '')
        )
        match_details['name_similarity'] = {
            'score': name_similarity,
            'reason': name_reason
        }
        total_score += name_similarity * self.WEIGHTS['name_similarity']
        
        # ===== SKILLS OVERLAP =====
        skills_score, skills_reason = self._check_skills_overlap(
            new_candidate,
            existing_candidate.get('skills', [])
        )
        match_details['skills_overlap'] = {
            'score': skills_score,
            'reason': skills_reason
        }
        total_score += skills_score
        
        # ===== COMPANY MATCH =====
        company_score, company_reason = self._check_company_match(
            new_candidate,
            existing_candidate.get('previous_companies', [])
        )
        match_details['company_match'] = {
            'score': company_score,
            'reason': company_reason
        }
        total_score += company_score
        
        # ===== LOCATION MATCH =====
        location_score, location_reason = self._check_location_match(
            new_candidate,
            existing_candidate.get('location', '')
        )
        match_details['location_match'] = {
            'score': location_score,
            'reason': location_reason
        }
        total_score += location_score
        
        # ===== TITLE SIMILARITY =====
        title_score, title_reason = self._check_title_similarity(
            new_candidate,
            existing_candidate.get('current_role', '')
        )
        match_details['title_similarity'] = {
            'score': title_score,
            'reason': title_reason
        }
        total_score += title_score
        
        # ===== EDUCATION MATCH =====
        education_match = 0.0
        education_reason = "education_not_checked"
        if new_candidate.education and existing_candidate.get('qualification_held'):
            if new_candidate.education.lower() == existing_candidate.get('qualification_held', '').lower():
                education_match = 0.10
                education_reason = "education_exact"
            else:
                similarity = self._string_similarity(
                    new_candidate.education,
                    existing_candidate.get('qualification_held', '')
                )
                if similarity > 0.70:
                    education_match = similarity * 0.10
                    education_reason = f"education_fuzzy_{similarity:.2f}"
        
        match_details['education_match'] = {
            'score': education_match,
            'reason': education_reason
        }
        total_score += education_match
        
        # Normalize total score (weights sum to ~1.95, so normalize)
        normalized_score = min(total_score / 1.95, 1.0)
        
        # Determine match type and admin review requirement
        if normalized_score > self.AUTO_MERGE_THRESHOLD:
            match_type = "exact_match"
            admin_review = False
            match_reason = "Definite duplicate - auto-mergeable"
        elif normalized_score > self.ADMIN_REVIEW_THRESHOLD:
            match_type = "strong_match"
            admin_review = True
            match_reason = "Likely duplicate - requires admin review"
        elif normalized_score > self.SOFT_MATCH_THRESHOLD:
            match_type = "moderate_match"
            admin_review = True
            match_reason = "Possible duplicate - soft match"
        else:
            match_type = "no_match"
            admin_review = False
            match_reason = "Not a duplicate - new candidate"
        
        return DuplicateMatch(
            matched_candidate_id=existing_candidate.get('user_id'),
            matched_candidate_name=existing_candidate.get('full_name'),
            match_type=match_type,
            match_confidence=normalized_score,
            match_reason=match_reason,
            match_details=match_details,
            admin_review_required=admin_review
        )
    
    def find_best_match(self, new_candidate: CandidateInfo,
                       existing_candidates: List[Dict]) -> DuplicateMatch:
        """
        Find the best matching candidate from a list.
        
        Priority:
        1. Exact phone match → Return immediately (definite duplicate)
        2. Exact email match → Return (high confidence)
        3. Best combined score above threshold
        
        Returns the match with highest confidence, or no_match if all < 50%.
        """
        best_match = None
        best_score = 0.0
        
        # OPTIMIZATION: Check for exact phone match first and return immediately
        # This handles the case where candidate has multiple emails
        for existing_candidate in existing_candidates:
            phone_match, phone_confidence, _ = self._check_phone_match(
                new_candidate,
                existing_candidate.get('phone_number', '')
            )
            if phone_match and phone_confidence == 1.0:
                # Found exact phone match, score it and return
                match = self.score_duplicate_match(new_candidate, existing_candidate)
                if match.match_type == "exact_match":
                    return match  # Return immediately for definite duplicate
        
        # If no exact phone match, continue with normal scoring
        for existing_candidate in existing_candidates:
            match = self.score_duplicate_match(new_candidate, existing_candidate)
            
            if match.match_confidence > best_score:
                best_score = match.match_confidence
                best_match = match
        
        # If best match is below threshold, return no_match
        if best_score < self.SOFT_MATCH_THRESHOLD:
            return DuplicateMatch(
                matched_candidate_id=None,
                matched_candidate_name=None,
                match_type="no_match",
                match_confidence=0.0,
                match_reason="No matching candidate found above threshold",
                match_details={},
                admin_review_required=False
            )
        
        return best_match


# ============================================================================
# TESTING & EXAMPLES
# ============================================================================

if __name__ == "__main__":
    
    detector = DuplicateDetector()
    
    # Example: New uploaded candidate
    new_candidate = CandidateInfo(
        name="John Smith",
        email="john.smith@gmail.com",
        phone="+91-9876543210",
        current_role="Sales Manager",
        years_of_experience=5,
        location="Mumbai, India",
        skills=["Sales", "CRM", "Lead Generation", "Team Management"],
        companies=["Tech Corp", "Sales Inc"],
        education="Bachelor of Commerce",
        extraction_confidence=0.92
    )
    
    # Example: Existing candidate in database
    existing_candidate = {
        'user_id': 'candidate-123',
        'full_name': 'Jon Smyth',  # Slight typo in name
        'email': 'john.smith@gmail.com',  # Same email
        'phone_number': '+91-9876543210',  # Same phone
        'current_role': 'Sales Manager',
        'years_of_experience': 5,
        'location': 'Mumbai',
        'skills': ['Sales', 'CRM', 'Client Management'],
        'previous_companies': ['Tech Corp', 'Finance Co'],
        'qualification_held': 'Bachelor of Commerce'
    }
    
    # Run match
    match = detector.score_duplicate_match(new_candidate, existing_candidate)
    
    print("\n" + "="*70)
    print("DUPLICATE DETECTION RESULT")
    print("="*70)
    print(f"Match Type: {match.match_type}")
    print(f"Confidence: {match.match_confidence:.2%}")
    print(f"Admin Review Required: {match.admin_review_required}")
    print(f"Reason: {match.match_reason}")
    print(f"\nDetailed Scoring:")
    print(json.dumps(match.match_details, indent=2))
    print("="*70)
