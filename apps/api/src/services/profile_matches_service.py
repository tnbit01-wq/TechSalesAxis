"""Profile matches service for company-candidate culture fit matching."""
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from uuid import UUID
from typing import Dict, List, Optional
from src.core.models import (
    CandidateProfile, Company, User, RecruiterProfile
)
from datetime import datetime
import json


class ProfileMatchesService:
    """Service for calculating company culture fit matches for candidates."""
    
    @staticmethod
    def get_company_recommendations(
        db: Session,
        candidate_id: UUID,
        limit: int = 10,
        offset: int = 0,
        min_score: float = 50.0
    ) -> Dict:
        """
        Get company culture fit recommendations for a candidate.
        
        Process:
        1. Get candidate profile and career interests
        2. Get all active companies
        3. Calculate culture fit scores
        4. Return paginated results
        
        Scoring Algorithm (100 points):
        - Industry alignment (30 pts): Does company industry match career interests?
        - Company size fit (20 pts): Does company size match career stage?
        - Location match (20 pts): Remote/Hybrid/Onsite alignment
        - Company growth (15 pts): Growing companies tend to have better opportunities
        - Culture factors (15 pts): Based on available company data
        """
        print(f"[PROFILE_MATCH] Getting company matches for candidate: {candidate_id}")
        
        # Get candidate profile
        candidate = db.query(CandidateProfile).filter(
            CandidateProfile.user_id == candidate_id
        ).first()
        
        if not candidate:
            print(f"[PROFILE_MATCH] Candidate not found")
            return {"total": 0, "matches": []}
        
        print(f"[PROFILE_MATCH] Candidate: {candidate.full_name}")
        print(f"[PROFILE_MATCH] Primary industry: {candidate.primary_industry_focus}")
        print(f"[PROFILE_MATCH] Career interests: {candidate.career_interests}")
        print(f"[PROFILE_MATCH] Location: {candidate.location}")
        
        # Get all companies (no status filter - all companies are fair game)
        companies = db.query(Company).all()
        
        print(f"[PROFILE_MATCH] Total companies: {len(companies)}")
        
        # Calculate matches for all companies
        matches = []
        for company in companies:
            match_result = ProfileMatchesService.calculate_culture_fit(
                candidate, company
            )
            
            if match_result["match_score"] >= min_score:
                matches.append({
                    "company": company,
                    "match_result": match_result
                })
            
            print(f"[PROFILE_MATCH]   {company.name}: {match_result['match_score']}%")
        
        print(f"[PROFILE_MATCH] Companies matching (>= {min_score}%): {len(matches)}")
        
        # Sort by match score descending
        matches.sort(
            key=lambda x: x["match_result"]["match_score"],
            reverse=True
        )
        
        # Apply pagination
        paginated_matches = matches[offset : offset + limit]
        
        # Transform response
        response_matches = []
        for match in paginated_matches:
            company = match["company"]
            score_data = match["match_result"]
            
            # Get recruiter count for this company
            recruiter_count = db.query(func.count(RecruiterProfile.user_id)).filter(
                RecruiterProfile.company_id == company.id
            ).scalar()
            
            response_matches.append({
                "match_id": str(company.id),
                "company": {
                    "id": str(company.id),
                    "name": company.name,
                    "industry": company.industry_category,
                    "description": company.description,
                    "size": company.size_band,
                    "location": company.location,
                    "website": company.website,
                    "logo_url": company.logo_url,
                },
                "match_score": score_data["match_score"],
                "match_explanation": score_data["explanation"],
                "strength_areas": score_data["strength_areas"],
                "improvement_areas": score_data["improvement_areas"],
                "scores_breakdown": {
                    "industry_alignment": score_data.get("industry_score", 0),
                    "size_fit": score_data.get("size_score", 0),
                    "location_match": score_data.get("location_score", 0),
                    "company_growth": score_data.get("growth_score", 0),
                    "culture_factors": score_data.get("culture_score", 0),
                },
                "recruiter_count": recruiter_count or 0,
            })
        
        return {
            "status": "success",
            "total": len(matches),
            "count": len(response_matches),
            "offset": offset,
            "limit": limit,
            "matches": response_matches
        }
    
    @staticmethod
    def calculate_culture_fit(
        candidate: CandidateProfile,
        company: 'Company'
    ) -> Dict:
        """
        Calculate culture fit score between candidate and company.
        
        Returns Dict with:
        - match_score: 0-100
        - explanation: Human-readable summary
        - strength_areas: List of why they match
        - improvement_areas: List of areas to work on
        - Individual component scores
        """
        print(f"\n[MATCH_CALC] Calculating fit: {candidate.full_name} <-> {company.name}")
        
        # Initialize scores
        industry_score = 0.0
        size_score = 0.0
        location_score = 0.0
        growth_score = 0.0
        culture_score = 0.0
        
        strength_areas = []
        improvement_areas = []
        
        # 1. INDUSTRY ALIGNMENT (30 points max)
        print(f"[MATCH_CALC] 1. Industry alignment")
        if candidate.primary_industry_focus and company.industry_category:
            candidate_industry = candidate.primary_industry_focus.lower()
            company_industry = company.industry_category.lower()
            
            if candidate_industry == company_industry:
                industry_score = 30.0
                strength_areas.append(f"Perfect industry match: {company.industry_category}")
                print(f"[MATCH_CALC]    ✓ Exact match: {industry_score} pts")
            elif any(keyword in company_industry for keyword in candidate_industry.split()):
                industry_score = 20.0
                strength_areas.append(f"Related industry: {company.industry_category}")
                print(f"[MATCH_CALC]    ✓ Related: {industry_score} pts")
            else:
                industry_score = 10.0
                improvement_areas.append(f"Different industry (they: {company.industry_category})")
                print(f"[MATCH_CALC]    ~ Different industry: {industry_score} pts")
        else:
            industry_score = 15.0
            print(f"[MATCH_CALC]    ? No industry data: {industry_score} pts")
        
        # 2. COMPANY SIZE FIT (20 points max)
        print(f"[MATCH_CALC] 2. Company size fit")
        candidate_level = ProfileMatchesService._get_experience_level(
            candidate.years_of_experience
        )
        company_size = company.size_band or "medium"
        
        size_fit_matrix = {
            "entry": {"startup": 15, "small": 20, "medium": 10, "large": 5},
            "mid": {"startup": 10, "small": 15, "medium": 20, "large": 15},
            "senior": {"startup": 15, "small": 20, "medium": 15, "large": 20},
            "lead": {"startup": 5, "small": 15, "medium": 20, "large": 20},
        }
        
        size_score = size_fit_matrix.get(candidate_level, {}).get(company_size, 10.0)
        if size_score >= 15:
            strength_areas.append(f"Good size fit for {candidate_level} level ({company_size})")
        else:
            improvement_areas.append(f"Company size ({company_size}) may not match experience level")
        print(f"[MATCH_CALC]    Score: {size_score} pts (level: {candidate_level}, size: {company_size})")
        
        # 3. LOCATION MATCH (20 points max)
        print(f"[MATCH_CALC] 3. Location match")
        if candidate.location and company.location:
            candidate_loc = candidate.location.lower()
            company_loc = company.location.lower()
            
            if "remote" in company_loc.lower():
                location_score = 20.0
                strength_areas.append("Remote opportunity")
                print(f"[MATCH_CALC]    ✓ Remote: {location_score} pts")
            elif candidate_loc == company_loc:
                location_score = 20.0
                strength_areas.append(f"Same location: {company.location}")
                print(f"[MATCH_CALC]    ✓ Same location: {location_score} pts")
            elif "hybrid" in company_loc.lower():
                location_score = 15.0
                strength_areas.append("Hybrid work available")
                print(f"[MATCH_CALC]    ~ Hybrid: {location_score} pts")
            else:
                location_score = 5.0
                improvement_areas.append(f"Location mismatch (they: {company.location})")
                print(f"[MATCH_CALC]    ~ Different location: {location_score} pts")
        else:
            location_score = 10.0
            print(f"[MATCH_CALC]    ? No location data: {location_score} pts")
        
        # 4. COMPANY GROWTH (15 points max)
        print(f"[MATCH_CALC] 4. Company growth")
        if company.description and any(
            word in company.description.lower()
            for word in ["growing", "expansion", "scale", "rapid", "startup"]
        ):
            growth_score = 15.0
            strength_areas.append("Growing company with opportunities")
            print(f"[MATCH_CALC]    ✓ Growing: {growth_score} pts")
        elif company.size_band == "startup":
            growth_score = 12.0
            strength_areas.append("Startup with growth potential")
            print(f"[MATCH_CALC]    ✓ Startup: {growth_score} pts")
        else:
            growth_score = 8.0
            print(f"[MATCH_CALC]    ~ Stable company: {growth_score} pts")
        
        # 5. CULTURE FACTORS (15 points max)
        # Based on company description and available metadata
        print(f"[MATCH_CALC] 5. Culture factors")
        culture_indicators = {
            "collaborative": 3,
            "innovative": 3,
            "learning": 3,
            "diversity": 2,
            "inclusion": 2,
            "remote-first": 2,
        }
        
        for indicator, points in culture_indicators.items():
            if company.description and indicator in company.description.lower():
                culture_score += points
        
        # Cap at 15
        culture_score = min(culture_score, 15.0)
        print(f"[MATCH_CALC]    Culture score: {culture_score} pts")
        
        # CALCULATE FINAL SCORE
        total_score = industry_score + size_score + location_score + growth_score + culture_score
        
        # Generate explanation
        explanation = ProfileMatchesService._generate_explanation(
            candidate, company, total_score, strength_areas
        )
        
        print(f"[MATCH_CALC] Final Score: {total_score}/100")
        print(f"[MATCH_CALC]   Industry: {industry_score}")
        print(f"[MATCH_CALC]   Size: {size_score}")
        print(f"[MATCH_CALC]   Location: {location_score}")
        print(f"[MATCH_CALC]   Growth: {growth_score}")
        print(f"[MATCH_CALC]   Culture: {culture_score}")
        
        return {
            "match_score": int(total_score),
            "explanation": explanation,
            "strength_areas": strength_areas,
            "improvement_areas": improvement_areas,
            "industry_score": int(industry_score),
            "size_score": int(size_score),
            "location_score": int(location_score),
            "growth_score": int(growth_score),
            "culture_score": int(culture_score),
        }
    
    @staticmethod
    def _get_experience_level(years: Optional[int]) -> str:
        """Map years of experience to career level."""
        if years is None or years == 0:
            return "entry"
        elif years <= 2:
            return "entry"
        elif years <= 5:
            return "mid"
        elif years <= 10:
            return "senior"
        else:
            return "lead"
    
    @staticmethod
    def _generate_explanation(
        candidate: CandidateProfile,
        company: 'Company',
        score: int,
        strength_areas: List[str]
    ) -> str:
        """Generate human-readable match explanation."""
        if score >= 85:
            rating = "Excellent match"
        elif score >= 70:
            rating = "Strong match"
        elif score >= 60:
            rating = "Good match"
        elif score >= 50:
            rating = "Potential match"
        else:
            rating = "Limited match"
        
        strengths_text = ""
        if strength_areas:
            strengths_text = " " + " • ".join(strength_areas[:2])
        
        return f"{rating} for {candidate.full_name} at {company.name}.{strengths_text}"
    
    @staticmethod
    def get_company_match_details(
        db: Session,
        candidate_id: UUID,
        company_id: UUID
    ) -> Dict:
        """Get detailed match breakdown for a specific company."""
        
        # Get candidate and company
        candidate = db.query(CandidateProfile).filter(
            CandidateProfile.user_id == candidate_id
        ).first()
        
        company = db.query(Company).filter(
            Company.id == company_id
        ).first()
        
        if not candidate or not company:
            return {"error": "Candidate or company not found"}
        
        # Calculate match
        match_result = ProfileMatchesService.calculate_culture_fit(candidate, company)
        
        return {
            "status": "success",
            "candidate": {
                "name": candidate.full_name,
                "level": ProfileMatchesService._get_experience_level(
                    candidate.years_of_experience
                ),
                "industry": candidate.primary_industry_focus,
                "interests": candidate.career_interests,
                "location": candidate.location,
            },
            "company": {
                "name": company.name,
                "industry": company.industry_category,
                "size": company.size_band,
                "location": company.location,
            },
            **match_result
        }
