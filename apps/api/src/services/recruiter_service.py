from src.core.database import db_engine, SessionLocal
from src.core.models import (
    User, RecruiterProfile, Company, Job, JobApplication, 
    ProfileScore, ResumeData, JobApplicationHistory, ChatThread, ProfileMatch, CandidateProfile,
    RecruiterAssessmentResponse, AssessmentResponse, BlockedUser, RecruiterSetting
)
from src.models.invitation import TeamInvitation
from src.services.s3_service import S3Service
from src.core.config import S3_BUCKET_NAME, AWS_REGION
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, text, desc, and_, or_
import json
import random
import httpx
import asyncio
from bs4 import BeautifulSoup
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta
import re
from src.core.config import OPENAI_API_KEY
import uuid

def get_s3_url_with_fallback(file_path: Optional[str]) -> Optional[str]:
    """Get S3 URL with fallback to public URL if signed URL fails."""
    if not file_path:
        return None
    
    # Try to get signed URL first
    signed_url = S3Service.get_signed_url(file_path)
    if signed_url:
        return signed_url
    
    # Fallback to public S3 URL if signed URL fails
    if not file_path.startswith("http"):
        return f"https://{S3_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{file_path}"
    
    return file_path

# --- Utility for City Tiering ---
TIER_1_CITIES = ['bangalore', 'bengaluru', 'mumbai', 'delhi', 'hyderabad', 'chennai', 'kolkata', 'pune', 'ahmedabad']
TIER_2_CITIES = ['jaipur', 'lucknow', 'nagpur', 'indore', 'thiruvananthapuram', 'kochi', 'coimbatore', 'madurai', 'mysore', 'chandigarh', 'bhopal', 'surat', 'patna', 'ranchi']
CULTURE_FIT_BENCHMARK = 75

LOCATION_SYNONYMS = {
    "bengaluru": "bangalore",
    "bangalore": "bengaluru",
    "mumbai": "bombay",
    "bombay": "mumbai",
    "mysuru": "mysore",
    "mysore": "mysuru",
    "chennai": "madras",
    "madras": "chennai",
    "kolkata": "calcutta",
    "calcutta": "kolkata",
    "pune": "poona",
    "poona": "pune",
    "gurugram": "gurgaon",
    "gurgaon": "gurugram",
    "kochi": "cochin",
    "cochin": "kochi",
    "thiruvananthapuram": "trivandrum",
    "trivandrum": "thiruvananthapuram"
}

CITY_EQUIVALENCE_GROUPS = [
    {"bangalore", "bengaluru", "banglore"},
    {"mumbai", "bombay"},
    {"mysore", "mysuru", "mysur"},
    {"chennai", "madras"},
    {"kolkata", "calcutta"},
    {"pune", "poona"},
    {"gurugram", "gurgaon"},
    {"kochi", "cochin"},
    {"thiruvananthapuram", "trivandrum"},
]

def getCityTier(location: str | None) -> str:
    if not location: return "Tier 3"
    loc = str(location).lower()
    if any(city in loc for city in TIER_1_CITIES): return "Tier 1"
    if any(city in loc for city in TIER_2_CITIES): return "Tier 2"
    return "Tier 3"

def _extract_max_salary(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    nums = re.findall(r"\d+(?:\.\d+)?", str(value).replace(",", ""))
    if not nums:
        return 0.0
    parsed = [float(n) for n in nums]
    return max(parsed)

def _parse_salary_floor(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    nums = re.findall(r"\d+(?:\.\d+)?", str(value).replace(",", ""))
    if not nums:
        return 0.0
    parsed = [float(n) for n in nums]
    return min(parsed)

def _parse_salary_ceiling(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    nums = re.findall(r"\d+(?:\.\d+)?", str(value).replace(",", ""))
    if not nums:
        return 0.0
    parsed = [float(n) for n in nums]
    return max(parsed)

def _job_budget_range(value: Any) -> tuple[float, float]:
    return _parse_salary_floor(value), _parse_salary_ceiling(value)

def _candidate_matches_readiness(candidate: CandidateProfile, readiness: str, role_budget: Any = None) -> bool:
    employment_status = (candidate.current_employment_status or "").strip().lower()
    job_search_mode = (candidate.job_search_mode or "").strip().lower()
    between_detail = (candidate.between_role_detail or "").strip().lower()
    contract_preference = (candidate.contract_preference or "").strip().lower()
    target_segment = (candidate.target_market_segment or "any").strip().lower()
    preference_type = (candidate.job_type or "").strip().lower()
    expected_salary = float(candidate.expected_salary) if candidate.expected_salary is not None else None
    current_salary = float(candidate.current_salary) if candidate.current_salary is not None else None
    visa_needed = bool(candidate.visa_sponsorship_needed)
    willing_relocate = bool(candidate.willing_to_relocate)
    readiness_meta = candidate.career_readiness_metadata or {}
    work_location_preference = str(readiness_meta.get("work_location_preference") or "").strip().lower()
    role_urgency_level = (candidate.role_urgency_level or "").strip().lower()
    employment_readiness_status = (candidate.employment_readiness_status or "").strip().lower()
    notice_period_days = candidate.notice_period_days

    readiness = (readiness or "").strip().lower()
    if not readiness:
        return True

    # Frontend / visual status enums compatibility
    if readiness == "active":
        return job_search_mode == "active" or "active" in role_urgency_level or "active" in employment_readiness_status
    if readiness == "exploring":
        return "exploring" in job_search_mode or "exploring" in role_urgency_level or "exploring" in employment_readiness_status
    if readiness == "passive":
        return "passive" in job_search_mode or "passive" in role_urgency_level or "passive" in employment_readiness_status
    if readiness in ("urgent_30days", "urgent_immediate"):
        return "urgent" in role_urgency_level or "immediate" in role_urgency_level or notice_period_days == 0

    if readiness == "immediate":
        return job_search_mode == "active" or notice_period_days == 0 or "immediate" in role_urgency_level or "urgent" in role_urgency_level
    if readiness == "short_notice":
        return (notice_period_days is not None and 0 < notice_period_days <= 30) or "30days" in role_urgency_level or "urgent" in role_urgency_level
    if readiness == "long_notice":
        return notice_period_days is not None and notice_period_days >= 60
    if readiness == "active_job_seeker":
        return job_search_mode == "active" or "active" in role_urgency_level or "active" in employment_readiness_status
    if readiness == "passive_candidate":
        return job_search_mode == "passive" or "passive" in role_urgency_level or "passive" in employment_readiness_status
    if readiness == "between_roles":
        return employment_status in {"between", "between_roles"}
    if readiness == "laid_off_recently":
        return between_detail == "laid_off"
    if readiness == "requires_visa_sponsorship":
        return visa_needed is True
    if readiness == "willing_to_relocate":
        return willing_relocate is True
    if readiness == "remote_only":
        return willing_relocate is False and work_location_preference == "remote"
    if readiness == "contract_preferred":
        return contract_preference == "contract"
    if readiness == "flexible":
        return contract_preference == "both"
    if readiness == "salary_seeking_raise":
        if expected_salary is None or current_salary is None:
            return False
        return expected_salary >= (current_salary * 1.2)
    if readiness == "recent_graduate_student":
        return employment_status == "student"
    if readiness == "high_fit_by_compensation":
        if expected_salary is None or not role_budget:
            return False
        budget_min, budget_max = _job_budget_range(role_budget)
        if budget_max <= 0:
            return False
        return budget_min <= expected_salary <= budget_max
    if readiness == "needs_salary_clarification":
        return expected_salary is None and job_search_mode == "active"

    # Backward-compatible aliases from the prior UI
    if readiness == "actively_looking":
        return job_search_mode == "active" or "active" in role_urgency_level or "active" in employment_readiness_status

    return True

class RecruiterService:
    def __init__(self):
        self._client = httpx.AsyncClient(timeout=30.0)
        self.openai_key = OPENAI_API_KEY
        self._skill_expansion_cache = {}

    async def _call_ai(self, prompt: str, system_message: str = "You are a helpful recruitment assistant.") -> str:
        """Call OpenAI GPT-4o for recruiter operations."""
        if not self.openai_key:
            print("DEBUG: No OpenAI API key configured")
            return ""

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.openai_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "gpt-4o",
                        "messages": [
                            {"role": "system", "content": system_message},
                            {"role": "user", "content": prompt}
                        ],
                        "temperature": 0.7
                    }
                )
                if response.status_code == 200:
                    data = response.json()
                    return data['choices'][0]['message']['content'].strip()
                else:
                    print(f"DEBUG: OpenAI Failed ({response.status_code}): {response.text}")
                    return ""
        except Exception as oai_e:
            print(f"DEBUG: OpenAI Exception: {str(oai_e)}")
            return ""

    async def _call_ai_json(self, prompt: str, system_message: str = "You are a helpful recruitment assistant.") -> Dict[str, Any]:
        res_text = await self._call_ai(prompt, system_message)
        if not res_text:
            return {}
        try:
            text = res_text
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()
            return json.loads(text.strip())
        except Exception as e:
            print(f"DEBUG: Failed to parse AI JSON: {str(e)}")
            return {}

    def _normalize_skill_token(self, skill: str) -> str:
        if not skill:
            return ""

        normalized = str(skill).lower().strip()
        normalized = normalized.replace("c sharp", "csharp")
        normalized = normalized.replace("c plus plus", "cpp")
        normalized = normalized.replace("c#", "csharp")
        normalized = normalized.replace("c++", "cpp")
        normalized = normalized.replace("node.js", "nodejs")
        normalized = normalized.replace("react.js", "reactjs")
        normalized = normalized.replace(".net", "dotnet")
        normalized = normalized.replace("asp.net", "aspnet")
        normalized = re.sub(r"[^a-z0-9+#]+", "", normalized)

        alias_map = {
            "js": "javascript",
            "ts": "typescript",
            "py": "python",
            "postgres": "postgresql",
            "mongo": "mongodb",
            "nodejs": "nodejs",
            "reactjs": "reactjs",
            "csharp": "csharp",
            "cpp": "cpp",
            "dotnet": "dotnet",
            "aspnet": "aspnet",
            "html5": "html",
            "css3": "css",
        }
        return alias_map.get(normalized, normalized)

    def _canonicalize_skill_terms(self, skills) -> set:
        import re
        terms = set()
        for skill in skills or []:
            # Split compound skill names by common delimiters like & and , /
            sub_skills = re.split(r'\s+and\s+|\s+&\s+|\s*,\s*|\s*/\s*', str(skill))
            for s in sub_skills:
                token = self._normalize_skill_token(s)
                if token:
                    terms.add(token)
        return terms

    async def _expand_job_skills_with_ai(self, target_job, target_skills) -> list:
        if not self.openai_key or not target_job:
            return []

        job_title = target_job.title or ""
        job_description = target_job.description or ""
        provided_skills = [str(skill).strip() for skill in (target_skills or []) if skill and str(skill).strip()]

        prompt = f"""
Normalize recruiting skills for exact skill matching.

Return JSON only with this shape:
{{
  "skill_terms": ["canonical skill 1", "canonical skill 2"]
}}

Rules:
- Keep only direct technical skills, frameworks, libraries, databases, cloud tools, or languages.
- Include direct aliases, punctuation variants, and common abbreviations for the same skill.
- Do not add soft skills or unrelated adjacent technologies.
- If the role description clearly implies an essential skill that is missing from the provided list, you may add it.

Job title: {job_title}
Provided skills: {provided_skills}
Job description: {job_description}
""".strip()

        ai_result = await self._call_ai_json(
            prompt,
            system_message="You normalize job skills into canonical recruiting keywords."
        )

        skill_terms = ai_result.get("skill_terms") or ai_result.get("canonical_skills") or []
        if isinstance(skill_terms, str):
            skill_terms = [skill_terms]
        return [term for term in skill_terms if term]

    async def _resolve_target_skill_terms(self, target_job, target_skills) -> set:
        resolved_terms = self._canonicalize_skill_terms(target_skills)

        if target_job and self.openai_key:
            cache_key = f"{getattr(target_job, 'id', 'job')}:{target_job.title or ''}:{'|'.join(sorted(resolved_terms))}"
            cached_terms = self._skill_expansion_cache.get(cache_key)
            if cached_terms is not None:
                return cached_terms

            ai_terms = await self._expand_job_skills_with_ai(target_job, target_skills)
            resolved_terms.update(self._canonicalize_skill_terms(ai_terms))
            self._skill_expansion_cache[cache_key] = resolved_terms

        return resolved_terms

    async def _semantic_rerank_borderline_skill_matches(self, target_job, target_skills, borderline_candidates) -> list:
        if not self.openai_key or not target_job or not borderline_candidates:
            return []

        candidate_cards = []
        for item in borderline_candidates[:10]:
            candidate = item["candidate"]
            candidate_cards.append({
                "user_id": str(candidate.user_id),
                "full_name": candidate.full_name or "Anonymous Talent",
                "current_role": candidate.current_role or "",
                "years_of_experience": candidate.years_of_experience or 0,
                "skills": list(candidate.skills or []),
                "bio": candidate.bio or "",
                "experience": candidate.experience or "",
                "match_ratio": round(item["match_ratio"], 4),
                "matched_skills": sorted(item["matched_skills"]),
                "missing_skills": sorted(item["missing_skills"]),
            })

        prompt = f"""
You are reranking borderline candidates for a posted role.

Return JSON only in this shape:
{{
  "ranked_candidates": [
    {{
      "user_id": "candidate user id",
      "semantic_score": 0,
      "reason": "short reason"
    }}
  ]
}}

Rules:
- Only rank the candidates already provided.
- Treat the provided overlap as a hint, not the final answer.
- Only give high scores when the candidate is semantically close to the role, even if wording differs.
- Do not introduce candidates who are not in the list.
- Ignore candidates that are not clearly relevant to the role.

Role title: {target_job.title or ""}
Role description: {target_job.description or ""}
Required skills: {sorted(list(target_skills or []))}
Candidates: {candidate_cards}
""".strip()

        ai_result = await self._call_ai_json(
            prompt,
            system_message="You rerank borderline recruiting candidates by semantic fit."
        )

        ranked_candidates = ai_result.get("ranked_candidates") or []
        if isinstance(ranked_candidates, dict):
            ranked_candidates = [ranked_candidates]

        parsed_results = []
        for entry in ranked_candidates:
            if not isinstance(entry, dict):
                continue
            user_id = str(entry.get("user_id") or "").strip()
            if not user_id:
                continue
            try:
                semantic_score = int(round(float(entry.get("semantic_score", 0))))
            except Exception:
                semantic_score = 0
            parsed_results.append({
                "user_id": user_id,
                "semantic_score": max(0, min(100, semantic_score)),
                "reason": str(entry.get("reason") or "Semantic fit fallback"),
            })

        return parsed_results

    async def generate_company_bio(self, website_url: str) -> str:
        try:
            if not website_url:
                return ""
                
            if not website_url.startswith(('http://', 'https://')):
                website_url = 'https://' + website_url
            
            print(f"DEBUG: Fetching website: {website_url}")
            
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                response = await client.get(website_url)
                response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            for script in soup(["script", "style"]):
                script.decompose()
            
            clean_text = '\n'.join([line.strip() for line in soup.get_text().splitlines() if line.strip()])[:2000]
            
            if not clean_text.strip():
                print("DEBUG: No text extracted from website")
                return ""
            
            prompt = f"Extract a professional 2-3 sentence bio for a recruiter from this company website text:\n{clean_text}\nReturn ONLY the bio, no quotes or markdown."
            bio = await self._call_ai(prompt, "You are an elite company biographer. Extract professional company information.")
            
            if bio:
                cleaned = bio.replace('"', '').replace('**', '').strip()
                print(f"DEBUG: Generated bio: {cleaned}")
                return cleaned
            return ""
            
        except httpx.ConnectError as e:
            print(f"DEBUG: Network error connecting to website: {str(e)}")
            return ""
        except httpx.TimeoutException as e:
            print(f"DEBUG: Timeout fetching website: {str(e)}")
            return ""
        except Exception as e:
            print(f"DEBUG: Bio generation failed: {str(e)}")
            return ""

    async def analyze_email_and_detect_company(self, email: str) -> Dict[str, Any]:
        """
        Analyze recruiter email to detect company name, domain, website, and description.
        Smart detection: tries to find actual website across multiple TLDs, auto-generates bio.
        Returns: {"company_name": str, "domain": str, "confidence": str, "website": str, "description": str}
        """
        try:
            if not email:
                return {"company_name": "", "domain": "", "confidence": "low", "website": "", "description": ""}
            
            # Extract domain from email
            if "@" not in email:
                return {"company_name": "", "domain": "", "confidence": "low", "website": "", "description": ""}
            
            domain = email.split("@")[1].lower()
            domain_name = domain.split(".")[0]
            
            print(f"DEBUG: Analyzing email domain: {domain}, domain_name: {domain_name}")
            
            # Skip personal email domains
            personal_domains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "aol.com", "mail.com", "mailinator.com", "yahoo.co.in"]
            if domain in personal_domains:
                return {"company_name": "", "domain": domain, "confidence": "low", "website": "", "description": ""}
            
            # Build comprehensive URL list — start with the actual email domain,
            # then try many TLD variants so we don't miss .in, .ai, .io, etc.
            potential_urls = [
                f"https://{domain}",
                f"https://www.{domain}",
            ]
            
            common_tlds = [".com", ".in", ".ai", ".io", ".co", ".co.in", ".org", ".net", ".tech", ".dev", ".app"]
            for tld in common_tlds:
                potential_urls.append(f"https://{domain_name}{tld}")
                potential_urls.append(f"https://www.{domain_name}{tld}")
            
            # Deduplicate while preserving order (email domain URLs checked first)
            seen = set()
            unique_urls = []
            for url in potential_urls:
                if url not in seen:
                    seen.add(url)
                    unique_urls.append(url)
            potential_urls = unique_urls
            
            print(f"DEBUG: Trying {len(potential_urls)} URL candidates: {potential_urls[:6]}...")
            
            company_website = None
            for url in potential_urls:
                try:
                    async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
                        response = await client.get(url)
                        if response.status_code == 200:
                            company_website = url
                            print(f"DEBUG: Found valid website: {url}")
                            break
                except:
                    continue
            
            # If we found a valid website, extract company info from it
            if company_website:
                try:
                    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                        response = await client.get(company_website)
                        response.raise_for_status()
                    
                    soup = BeautifulSoup(response.text, 'html.parser')
                    page_text = soup.get_text()[:1500]
                    
                    # Use AI to extract company name from actual website content
                    prompt = f"""Extract the actual official company name from this website content:

{page_text}

Respond with ONLY the company name, nothing else. If unclear, respond with the domain name capitalized."""
                    
                    company_name = await self._call_ai(prompt, "You are an expert at extracting official company names from websites.")
                    
                    if company_name and company_name.strip():
                        print(f"DEBUG: Extracted company from website: {company_name}")
                        
                        # Also generate bio/description from the website we already found
                        description = await self.generate_company_bio(company_website)
                        print(f"DEBUG: Auto-generated description from website: {bool(description)}")
                        
                        return {
                            "company_name": company_name.strip(),
                            "domain": domain,
                            "confidence": "high",
                            "website": company_website,
                            "description": description or ""
                        }
                except Exception as e:
                    print(f"DEBUG: Failed to extract from website: {str(e)}")
            
            # Fallback: capitalize domain name conservatively (no AI guessing)
            fallback_name = " ".join([word.capitalize() for word in domain_name.split("-")])
            print(f"DEBUG: Using fallback name: {fallback_name}")
            return {
                "company_name": fallback_name,
                "domain": domain,
                "confidence": "low",
                "website": "",
                "description": ""
            }
            
        except Exception as e:
            print(f"DEBUG: Email analysis failed: {str(e)}")
            return {"company_name": "", "domain": "", "confidence": "low", "website": "", "description": ""}

    async def find_company_details_by_name(self, company_name: str) -> Dict[str, Any]:
        """
        Find company website and auto-generate description from website.
        Smart approach: tries multiple domain patterns, then AI prediction.
        Returns: {"website": str, "description": str, "found": bool}
        """
        try:
            if not company_name or company_name.lower() in ["unknown", ""]:
                return {"website": "", "description": "", "found": False}
            
            print(f"DEBUG: Finding details for company: {company_name}")
            
            # Step 1: Generate possible domain patterns from company name
            # Example: "Association of Indian Technology Sales Professionals" -> "aitsp", "association-of-indian-technology-sales-professionals", etc.
            name_lower = company_name.lower().strip()
            
            # Try different domain patterns
            domain_candidates = []
            
            # Pattern 1: Acronym (first letters)
            words = name_lower.split()
            if len(words) > 1:
                acronym = "".join([w[0] for w in words if w])
                domain_candidates.extend([
                    f"{acronym}.com",
                    f"{acronym}.in",
                    f"{acronym}.io",
                    f"www.{acronym}.com",
                    f"www.{acronym}.in",
                ])
            
            # Pattern 2: Direct domain with company name
            # Remove common words
            name_simplified = name_lower.replace(" pvt.", "").replace(" ltd.", "").replace(" inc.", "").replace(" llc.", "").strip()
            name_simplified = name_simplified.replace(" and ", "-").replace(" ", "-")
            
            domain_candidates.extend([
                f"{name_simplified}.com",
                f"{name_simplified}.in",
                f"{name_simplified}.io",
                f"www.{name_simplified}.com",
                f"www.{name_simplified}.in",
            ])
            
            # Pattern 3: Use AI to get the most likely domain
            ai_prompt = f"""You are an expert at finding company websites. Given the company name:

'{company_name}'

What is the MOST LIKELY official website domain? Think about:
1. The company's nature/industry
2. Common domain patterns (.com, .in, .io)
3. Acronyms from the company name
4. Simplified versions of the name

Respond with ONLY the domain in format: domain.com (no https://, no www., just the domain)"""
            
            ai_suggestion = await self._call_ai(ai_prompt, "You are an expert at identifying company websites.")
            
            if ai_suggestion and ai_suggestion.lower() not in ["unknown", ""]:
                ai_suggestion = ai_suggestion.strip()
                if not ai_suggestion.startswith(('http://', 'https://')):
                    domain_candidates.insert(0, ai_suggestion)  # Add AI suggestion at the top
            
            print(f"DEBUG: Domain candidates to try: {domain_candidates[:5]}")
            
            # Step 2: Try each domain until we find one that works
            for domain in domain_candidates:
                domain = domain.strip()
                if not domain:
                    continue
                
                # Try both http and https
                for protocol in ['https://', 'http://']:
                    url = f"{protocol}{domain}" if not domain.startswith(('http://', 'https://')) else domain
                    
                    try:
                        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
                            response = await client.get(url)
                            if response.status_code == 200:
                                print(f"DEBUG: Found working website: {url}")
                                
                                # Generate bio from the website
                                description = await self.generate_company_bio(url)
                                
                                return {
                                    "website": url,
                                    "description": description,
                                    "found": True
                                }
                    except Exception as e:
                        print(f"DEBUG: Domain {url} failed: {type(e).__name__}")
                        continue
            
            print(f"DEBUG: No working domain found for {company_name}")
            return {"website": "", "description": "", "found": False}
            
        except Exception as e:
            print(f"DEBUG: Company details lookup failed: {str(e)}")
            return {"website": "", "description": "", "found": False}

    async def get_or_create_profile(self, user_id: str):
        db = SessionLocal()
        try:
            profile = db.query(RecruiterProfile).options(joinedload(RecruiterProfile.company)).filter(RecruiterProfile.user_id == user_id).first()
            if profile:
                return profile

            # Ensure user entry exists in public.users to avoid FK violation
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                # If user doesn't exist in our RDS, we can't create a profile.
                # In the AWS-native flow, the user should be created at signup.
                return None

            # Create default profile if not exists
            # Start at INITIAL so frontend can trigger EMAIL_ANALYSIS
            new_profile = RecruiterProfile(
                user_id=user_id,
                onboarding_step="INITIAL",
                assessment_status="not_started"
            )
            db.add(new_profile)
            db.commit()
            db.refresh(new_profile)
            return new_profile
        finally:
            db.close()

    async def update_company_registration(self, user_id: str, registration_number: str):
        db = SessionLocal()
        try:
            # 1. Check if company with this registration exists or create new
            company = db.query(Company).filter(Company.registration_number == registration_number).first()
            
            has_score = False
            is_first_recruiter = False
            if company:
                company_id = company.id
                # Check if this company already has a profile score from another recruiter
                if (company.profile_score or 0) > 0:
                    has_score = True
            else:
                # Create a placeholder company
                company = Company(
                    name="Pending Verification",
                    registration_number=registration_number
                )
                db.add(company)
                db.commit()
                db.refresh(company)
                company_id = company.id
                is_first_recruiter = True

            # 2. Link recruiter to company and advance step
            next_step = "DETAILS"
            next_status = "not_started"
            
            if has_score:
                next_step = "COMPLETED"
                next_status = "completed"
                
            profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == user_id).first()
            if profile:
                profile.company_id = company_id
                profile.onboarding_step = next_step
                profile.assessment_status = next_status
                profile.team_role = "admin" if is_first_recruiter else "recruiter"
                db.commit()

            return {
                "status": "ok", 
                "company_id": str(company_id), 
                "onboarding_step": next_step,
                "assessment_status": next_status
            }
        finally:
            db.close()

    async def update_company_details(self, user_id: str, company_id: str, details: Dict):
        db = SessionLocal()
        try:
            # Update company table
            company = db.query(Company).filter(Company.id == company_id).first()
            if company:
                company.name = details.get("name")
                company.website = details.get("website")
                company.location = details.get("location")
                company.description = details.get("description")
                company.industry_category = details.get("industry_category")
                company.sales_model = details.get("sales_model")
                company.target_market = details.get("target_market")
                
                # Sanitize hiring_focus_areas to be a list for PostgreSQL text[]
                hiring_focus = details.get("hiring_focus_areas")
                if hiring_focus is None or hiring_focus == "null":
                    company.hiring_focus_areas = []
                elif isinstance(hiring_focus, str):
                    company.hiring_focus_areas = [hiring_focus]
                else:
                    company.hiring_focus_areas = hiring_focus

                company.avg_deal_size_range = details.get("avg_deal_size_range")

            # Advance recruiter step
            profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == user_id).first()
            if profile:
                profile.onboarding_step = "ASSESSMENT_PROMPT"
            
            db.commit()

            # Recalculate and update completion score
            await self.sync_completion_score(user_id)

            return {"status": "ok"}
        finally:
            db.close()

    async def get_applications_pipeline(self, recruiter_id: str):
        db = SessionLocal()
        try:
            profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == recruiter_id).first()
            if not profile or not profile.company_id:
                return []
            
            apps = db.query(JobApplication).join(Job).filter(Job.company_id == profile.company_id).order_by(JobApplication.created_at.desc()).all()
            
            pipeline = []
            for app in apps:
                job = db.query(Job).filter(Job.id == app.job_id).first()
                cand = db.query(CandidateProfile).filter(CandidateProfile.user_id == app.candidate_id).first()
                user = db.query(User).filter(User.id == app.candidate_id).first()
                score = db.query(ProfileScore).filter(ProfileScore.user_id == app.candidate_id).first()
                resume = db.query(ResumeData).filter(ResumeData.user_id == app.candidate_id).first()
                
                # Fetch Interviews & Slots for the Recruiter
                interviews_raw = db.execute(text("SELECT * FROM interviews WHERE application_id = :aid"), {"aid": app.id}).fetchall()
                interviews = []
                for r in interviews_raw:
                    i_dict = dict(r._mapping)
                    slots_raw = db.execute(text("SELECT * FROM interview_slots WHERE interview_id = :iid"), {"iid": i_dict["id"]}).fetchall()
                    i_dict["interview_slots"] = [dict(sr._mapping) for sr in slots_raw]
                    interviews.append(i_dict)

                app_dict = {
                    "id": str(app.id),
                    "status": app.status,
                    "created_at": app.created_at.isoformat() if app.created_at else None,
                    "job": {"id": str(job.id), "title": job.title} if job else None,
                    "candidate": {
                        "user_id": str(cand.user_id),
                        "full_name": cand.full_name,
                        "email": user.email if user else None,
                        "resume_url": S3Service.get_signed_url(cand.resume_path) if cand and cand.resume_path else None
                    } if cand else None,
                    "score": score.final_score if score else 0,
                    "interviews": interviews
                }
                pipeline.append(app_dict)
            return pipeline
        finally:
            db.close()

    async def get_recruiter_stats(self, user_id: str):
        db = SessionLocal()
        try:
            profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == user_id).first()
            if not profile or not profile.company_id:
                return {"active_jobs_count": 0, "total_hires_count": 0}
            
            active_jobs = db.query(Job).filter(Job.company_id == profile.company_id, Job.status == "active").count()
            total_apps = db.query(JobApplication).join(Job, JobApplication.job_id == Job.id).filter(Job.company_id == profile.company_id).count()
            hires = db.query(JobApplication).join(Job, JobApplication.job_id == Job.id).filter(Job.company_id == profile.company_id, JobApplication.status == "closed").count()
            
            company = db.query(Company).filter(Company.id == profile.company_id).first()
            
            return {
                "active_jobs_count": active_jobs,
                "total_hires_count": hires,
                "total_applications": total_apps,
                "company_quality_score": company.profile_score if company else 0,
                "assessment_status": profile.onboarding_step,
                "completion_score": profile.completion_score
            }
        finally:
            db.close()

    async def sync_completion_score(self, user_id: str):
        db = SessionLocal()
        try:
            profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == user_id).first()
            if not profile: return 0
            company = db.query(Company).filter(Company.id == profile.company_id).first()
            
            score = 0
            if profile.full_name: score += 10
            if profile.job_title: score += 10
            if profile.linkedin_url: score += 10
            
            if company:
                if company.name: score += 20
                if company.website: score += 10
                if company.description: score += 20
                if company.logo_url: score += 20
            
            profile.completion_score = min(score, 100)
            db.commit()
            return profile.completion_score
        finally:
            db.close()

    async def get_assessment_questions(self, user_id: str):
        """
        Get 5 assessment questions - one randomly selected from each of the 5 categories.
        Ensures no category repetition for each recruiter.
        """
        db = SessionLocal()
        try:
            from src.core.models import RecruiterAssessmentQuestion
            import random
            
            # Fetch all questions
            all_questions = db.query(RecruiterAssessmentQuestion).all()
            if not all_questions:
                return []
            
            # Group questions by category
            questions_by_category = {}
            for q in all_questions:
                if q.category not in questions_by_category:
                    questions_by_category[q.category] = []
                questions_by_category[q.category].append(q)
            
            # Select one random question from each category
            selected_questions = []
            for category, questions in questions_by_category.items():
                if questions:
                    selected_question = random.choice(questions)
                    selected_questions.append({
                        "id": str(selected_question.id),
                        "category": selected_question.category,
                        "driver": selected_question.driver,
                        "question_text": selected_question.question_text
                    })
            
            # Return the selected questions (should be 5 if all 5 categories exist)
            return selected_questions
        finally:
            db.close()

    async def evaluate_recruiter_answer(self, user_id: str, question_text: str, answer: str, category: str):
        db = SessionLocal()
        try:
            # Multi-grader ensemble: call the AI multiple times with slight prompt/system variations
            graders = [
                "You are an objective evaluator. Ignore promotional/company-bragging language and focus on concrete examples, metrics, timelines, and named processes. Do not penalize non-native phrasing. Return ONLY a single JSON object as specified.",
                "You are an unbiased rubric grader. Prioritize factual evidence and ownership over marketing language. Provide numeric subscores and brief reasoning. Return ONLY JSON.",
                "You are a recruitment assessment auditor. Evaluate on relevance, specificity, clarity, ownership, and fairness. Focus on concrete examples. Return a single JSON object with those fields and optional confidence."
            ]

            retry_schedule = [0, 1, 2]

            prompt_template = (
                "Evaluate this recruiter response for category {category}:\nQ: {q}\nA: {a}\n\n"
                "Return a JSON object with integer subscores 0-100 for: relevance, specificity, clarity, ownership, fairness. "
                "Also include a short 'reasoning' string and optional 'confidence' (0-1).\n"
                "Example output: {\"relevance\":85, \"specificity\":70, \"clarity\":90, \"ownership\":60, \"fairness\":80, \"reasoning\":\"Concrete examples and timelines provided.\", \"confidence\":0.87}"
            )

            async def _grade_once(system_message: str, attempt: int):
                prompt = prompt_template.format(category=category, q=question_text, a=answer)
                result = await self._call_ai_json(prompt, system_message)
                if isinstance(result, dict) and result:
                    return result
                return None

            async def _grade_with_retries(system_message: str):
                last_result = None
                for attempt in retry_schedule:
                    try:
                        result = await _grade_once(system_message, attempt)
                        if result:
                            return result
                        last_result = result
                    except Exception:
                        last_result = None
                return last_result

            grading_tasks = [asyncio.create_task(_grade_with_retries(sys_msg)) for sys_msg in graders]
            raw_results = [result for result in await asyncio.gather(*grading_tasks) if isinstance(result, dict) and result]

            # If no grader returned usable JSON, fall back to conservative defaults
            if not raw_results:
                raw_results = [{
                    "relevance": 50,
                    "specificity": 50,
                    "clarity": 50,
                    "ownership": 50,
                    "fairness": 50,
                    "reasoning": "Fallback default due to AI failure.",
                    "confidence": 0.0
                }]

            # Helper to compute median safely
            def median(values):
                vals = sorted([v for v in values if v is not None])
                if not vals:
                    return None
                n = len(vals)
                mid = n // 2
                if n % 2 == 1:
                    return vals[mid]
                return int(round((vals[mid - 1] + vals[mid]) / 2.0))

            # Collect numeric subscores
            relevance = median([int(r.get("relevance", 50)) for r in raw_results]) or 50
            specificity = median([int(r.get("specificity", 50)) for r in raw_results]) or 50
            clarity = median([int(r.get("clarity", 50)) for r in raw_results]) or 50
            ownership = median([int(r.get("ownership", 50)) for r in raw_results]) or 50
            fairness = median([int(r.get("fairness", 50)) for r in raw_results]) or 50
            # Combine reasoning entries
            reasoning_texts = [r.get("reasoning") for r in raw_results if r.get("reasoning")]
            reasoning = reasoning_texts[0] if reasoning_texts else ""
            # Confidence: median of provided confidences (scaled 0-1)
            confidences = [float(r.get("confidence", 0.0)) for r in raw_results if r.get("confidence") is not None]
            confidence = (median([int(c * 100) for c in confidences]) / 100.0) if confidences else None

            # Composite average (0-100)
            score = int(round((relevance + specificity + clarity + ownership + fairness) / 5.0))

            best_raw = raw_results[0] if raw_results else {}
            
            # Using table column names: answer_text, average_score, evaluation_metadata
            from src.core.models import RecruiterAssessmentResponse
            import uuid
            
            # Since the table uses jsonb for evaluation_metadata, convert dict if needed or use dict directly
            new_res = RecruiterAssessmentResponse(
                id=uuid.uuid4(),
                user_id=uuid.UUID(user_id) if isinstance(user_id, str) else user_id,
                category=category,
                question_text=question_text,
                answer_text=answer,
                average_score=score,
                relevance_score=relevance,
                specificity_score=specificity,
                clarity_score=clarity,
                ownership_score=ownership,
                evaluation_metadata={"reasoning": reasoning, "fairness": fairness, "confidence": confidence, "raw_ai": best_raw, "ensemble_size": len(raw_results)}
            )
            db.add(new_res)
            db.commit()
            return {"status": "ok", "score": score}
        except Exception as e:
            print(f"ERROR SAVING RECRUITER ANSWER: {str(e)}")
            db.rollback()
            raise e
        finally:
            db.close()

    async def get_assessment_summary(self, user_id: str):
        db = SessionLocal()
        try:
            from src.core.models import RecruiterAssessmentResponse, RecruiterProfile, Company
            responses = db.query(RecruiterAssessmentResponse).filter(RecruiterAssessmentResponse.user_id == user_id).all()
            if not responses: return {"score": 0, "status": "incomplete"}
            # average_score is stored on a 0-100 scale (composite of subscores)
            avg = sum([getattr(r, "average_score", 0) or 0 for r in responses]) / len(responses)
            normalized = int(round(avg))
            
            profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == user_id).first()
            if profile:
                profile.onboarding_step = "COMPLETED"
                profile.assessment_status = "completed"
                if profile.company_id:
                    company = db.query(Company).filter(Company.id == profile.company_id).first()
                    if company:
                        # store normalized 0-100 company profile score
                        company.profile_score = normalized
                db.commit()
            return {"score": normalized, "status": "completed"}
        finally:
            db.close()

    async def get_job_recommendations(self, candidate_id: str, priority: str = "skills", location: Optional[str] = None, min_salary: Optional[int] = None):
        db = SessionLocal()
        try:
            # 1. Get Candidate Skills
            resume = db.query(ResumeData).filter(ResumeData.user_id == candidate_id).first()
            candidate_skills = set([s.lower() for s in (resume.skills or [])]) if resume and resume.skills else set()

            # 2. Get active jobs
            query = db.query(Job).filter(Job.status == "active")
            
            if location:
                query = query.filter(Job.location.ilike(f"%{location}%"))
            
            all_jobs = query.all()
            res = []

            for j in all_jobs:
                job_skills = set([s.lower() for s in (j.skills_required or [])])
                
                # Default score
                score = 50
                reasons = []

                if candidate_skills and job_skills:
                    intersection = candidate_skills.intersection(job_skills)
                    match_ratio = len(intersection) / len(job_skills) if job_skills else 0
                    score = int(50 + (match_ratio * 50))
                    if intersection:
                        reasons.append(f"Matches skills: {', '.join(list(intersection)[:3])}")
                
                if not reasons:
                    reasons.append("Matches your professional profile and location interest.")

                # Only recommend if there's some baseline relevance (e.g., score > 60)
                # or if no skills are defined (fallback)
                if score > 60 or not job_skills:
                    res.append({
                        "job_id": str(j.id),
                        "job_title": j.title,
                        "company_id": str(j.company_id),
                        "location": j.location,
                        "match_score": min(score, 99),
                        "reasoning": " | ".join(reasons)
                    })

            # Sort by highest match
            res.sort(key=lambda x: x["match_score"], reverse=True)
            return res[:10]
        finally:
            db.close()

    async def get_candidate_recommendations_for_candidate(self, candidate_id: str, filter_type: str = "all", location: Optional[str] = None, min_salary: Optional[int] = None):
        db = SessionLocal()
        try:
            # 1. Get Candidate Skills
            resume = db.query(ResumeData).filter(ResumeData.user_id == candidate_id).first()
            candidate_skills = set([s.lower() for s in (resume.skills or [])]) if resume and resume.skills else set()

            # 2. Find recruiters whose companies are hiring for these skills
            query = db.query(RecruiterProfile).join(Job, RecruiterProfile.user_id == Job.recruiter_id)\
                      .filter(Job.status == "active")
            
            if location:
                query = query.filter(Job.location.ilike(f"%{location}%"))

            recruiters = query.distinct().limit(20).all()
            res = []

            for r in recruiters:
                comp = db.query(Company).filter(Company.id == r.company_id).first()
                # Find best matching job for this recruiter to justify the recommendation
                best_job = db.query(Job).filter(Job.recruiter_id == r.user_id, Job.status == "active").first()
                
                score = 80 # Default for active hiring managers
                reason = f"Actively hiring for {best_job.title}" if best_job else "Matching recruiter in your industry"

                res.append({
                    "id": str(r.user_id),
                    "full_name": r.full_name or "Talent Acquisition",
                    "job_title": r.job_title or "Recruiter",
                    "company_name": comp.name if comp else "Growth Startup",
                    "company_logo": comp.logo_url if comp else None,
                    "match_score": score,
                    "reasoning": reason
                })
            
            return res[:10]
        finally:
            db.close()

    async def get_recommended_candidates(self, user_id: str, filter_type: str = "culture_fit", params: Dict[str, Any] = {}):
        """
        AI-powered High-Precision Candidate Recommendation Engine - Master Matching Engine.
        
        Three distinct matching modes:
        1. 'culture_fit': Behavioral + ICP Alignment (40% weight) + Skills (30%) + Experience (20%) + Salary (10%)
        2. 'skill_match': Technical expertise focus (60% weight) + Experience (20%) + Skills matching (20%)
        3. 'profile_matching' (Expert View): Holistic Master Match - Synthesis of ALL factors via AI
           - Candidate Behavioral DNA vs Recruiter ICP (40%)
           - Technical Alignment (30%)
           - Experience Band Match (15%)
           - Profile Strength & Trust (15%)
        """
        db = SessionLocal()
        try:
            # Extract query parameters for filtering recommended candidates
            search_skills_list = params.get("required_skills") or []
            search_skills_lower = set([s.lower().strip() for s in search_skills_list if s])
            
            original_skills = params.get("original_skills")
            original_skills_list = []
            if original_skills:
                if isinstance(original_skills, list):
                    original_skills_list = [s.lower().strip() for s in original_skills if s]
                elif isinstance(original_skills, str):
                    original_skills_list = [s.lower().strip() for s in original_skills.split(",") if s.strip()]
            
            min_experience = params.get("min_experience")
            max_experience = params.get("max_experience")
            job_type_filter = params.get("job_type")
            job_title_filter = params.get("job_title")

            # 1. Context building
            target_job = None
            if params.get("job_id"):
                target_job = db.query(Job).filter(Job.id == params["job_id"]).first()
            
            # Recruiter assessment data for all AI-matching modes
            recruiter_assessments = None
            recruiter_icp = ""
            
            if filter_type in ["culture_fit", "profile_matching"]:
                recruiter_assessments = db.query(RecruiterAssessmentResponse).filter(
                    RecruiterAssessmentResponse.user_id == user_id
                ).all()
                if recruiter_assessments:
                    recruiter_icp = " | ".join([f"{r.question_text}: {r.answer_text}" for r in recruiter_assessments])

            if filter_type == "culture_fit" and not recruiter_assessments:
                filter_type = "skill_match"
                if not target_job:
                    target_job = db.query(Job).filter(
                        Job.recruiter_id == user_id,
                        Job.status == "active"
                    ).order_by(Job.created_at.desc()).first()
                    if not target_job:
                        target_job = db.query(Job).filter(
                            Job.recruiter_id == user_id
                        ).order_by(Job.created_at.desc()).first()

            if filter_type != "skill_match":
                target_job = None
            
            # 2. Base query: include every candidate profile in the pool
            # Verified, not-yet-verified, and shadow profiles all participate in matching.
            query = db.query(CandidateProfile)
            
            # 3. Dynamic Filters (Moved to module level)
            pass

            if params.get("location"):
                requested_location = str(params["location"]).strip().lower()
                equivalents = {requested_location}
                for group in CITY_EQUIVALENCE_GROUPS:
                    if any(name in requested_location or requested_location in name for name in group):
                        equivalents.update(group)
                
                loc_filters = []
                for eq in equivalents:
                    loc_filters.extend([
                        func.lower(CandidateProfile.location) == eq,
                        func.lower(CandidateProfile.location).ilike(f"{eq},%"),
                        func.lower(CandidateProfile.location).ilike(f"{eq} %"),
                    ])
                
                query = query.filter(
                    and_(
                        CandidateProfile.location.isnot(None),
                        or_(*loc_filters)
                    )
                )

            max_salary_cap = _extract_max_salary(params.get("max_salary"))
            if max_salary_cap > 0:
                query = query.filter(
                    and_(
                        CandidateProfile.expected_salary.isnot(None),
                        CandidateProfile.expected_salary <= max_salary_cap
                    )
                )

            min_current_salary = params.get("min_current_salary")
            max_current_salary = params.get("max_current_salary")

            if min_current_salary is not None:
                try:
                    val = float(min_current_salary)
                    if val < 100:
                        min_current_salary = val * 100000.0
                    query = query.filter(
                        and_(
                            CandidateProfile.current_salary.isnot(None),
                            CandidateProfile.current_salary >= min_current_salary
                        )
                    )
                except ValueError:
                    pass

            if max_current_salary is not None:
                try:
                    val = float(max_current_salary)
                    if val < 100:
                        max_current_salary = val * 100000.0
                    query = query.filter(
                        and_(
                            CandidateProfile.current_salary.isnot(None),
                            CandidateProfile.current_salary <= max_current_salary
                        )
                    )
                except ValueError:
                    pass

            career_readiness_values = [
                value.strip().lower()
                for value in str(params.get("career_readiness") or "").split(",")
                if value and value.strip()
            ]
            
            if params.get("experience_band") and params["experience_band"] != "all":
                if params["experience_band"] == "fresher":
                    query = query.filter(CandidateProfile.years_of_experience <= 1)
                elif params["experience_band"] == "mid":
                    query = query.filter(and_(CandidateProfile.years_of_experience > 1, CandidateProfile.years_of_experience <= 5))
                elif params["experience_band"] == "senior":
                    query = query.filter(and_(CandidateProfile.years_of_experience > 5, CandidateProfile.years_of_experience <= 10))
                elif params["experience_band"] == "leadership":
                    query = query.filter(CandidateProfile.years_of_experience > 10)

            candidates = query.all()
            
            # 4. Build target skills from the posted role or custom search skills.
            target_skills = set()
            if filter_type == "skill_match" and target_job and target_job.skills_required:
                target_skills = set([s.lower() for s in target_job.skills_required if s])
            
            # Fallback to search skills if no target job is defined
            if not target_skills and search_skills_lower:
                target_skills = search_skills_lower

            target_exp_band = target_job.experience_band if target_job else params.get("experience_band")

            resolved_target_skills = self._canonicalize_skill_terms(target_skills)
            
            target_max_salary = 0
            if target_job and target_job.salary_range:
                nums = re.findall(r"\d+", target_job.salary_range.replace(",","").replace("k","000"))
                if nums: target_max_salary = max(map(int, nums))
            elif params.get("max_salary"):
                try: target_max_salary = float(params["max_salary"])
                except: pass

            # 5. Score candidates according to filter_type (fixed to skill_match)
            results = []
            
            for c in candidates:
                is_shadow = getattr(c, 'is_shadow_profile', False)
                c_skills = self._canonicalize_skill_terms(c.skills or [])
                
                # A. Apply direct query skills hard filter if specified
                if search_skills_lower:
                    if not c_skills.intersection(search_skills_lower):
                        continue
                
                # B. Filter by min/max experience
                c_years = c.years_of_experience or 0
                if min_experience is not None:
                    try:
                        if c_years < int(min_experience):
                            continue
                    except ValueError:
                        pass
                if max_experience is not None:
                    try:
                        if c_years > int(max_experience):
                            continue
                    except ValueError:
                        pass
                        
                # C. Filter by job type
                if job_type_filter:
                    c_jt = str(c.job_type or "").lower().strip()
                    if job_type_filter.lower().strip() not in c_jt:
                        continue
                        
                # D. Filter by Job Title / Role match
                if job_title_filter:
                    c_role = str(c.current_role or "").lower().strip()
                    c_t_role = str(c.target_role or "").lower().strip()
                    jt_search = job_title_filter.lower().strip()
                    if jt_search not in c_role and jt_search not in c_t_role:
                        continue

                target_skills_lower = resolved_target_skills if resolved_target_skills else self._canonicalize_skill_terms(target_skills)
                skill_overlap = c_skills.intersection(target_skills_lower)
                
                # Must have at least one skill overlap to match (unless no target skills are defined)
                if target_skills_lower and not skill_overlap:
                    continue

                if target_skills_lower:
                    if not target_job and original_skills_list:
                        match_ratio = len(skill_overlap) / len(original_skills_list)
                        skills_match_score = min(100, int(round(match_ratio * 100)))
                    else:
                        match_ratio = len(skill_overlap) / len(target_skills_lower)
                        skills_match_score = int(round(match_ratio * 100))
                else:
                    skills_match_score = 0

                if career_readiness_values:
                    matched_all_readiness = True
                    for readiness_value in career_readiness_values:
                        if not _candidate_matches_readiness(
                            c,
                            readiness_value,
                            params.get("role_budget_range") or params.get("max_salary"),
                        ):
                            matched_all_readiness = False
                            break
                    if not matched_all_readiness:
                        continue

                # Compute culture fit score
                culture_score, culture_reason = await self._score_culture_fit(
                    c, target_skills, target_exp_band, target_max_salary,
                    is_shadow=is_shadow,
                    recruiter_icp=recruiter_icp,
                    recruiter_assessments=recruiter_assessments,
                    db=db
                )

                # Filter by min_culture_score
                min_culture_score = params.get("min_culture_score")
                if min_culture_score:
                    try:
                        if culture_score < float(min_culture_score):
                            continue
                    except ValueError:
                        pass

                # Filter by candidate_types
                candidate_types = params.get("candidate_types") or []
                if candidate_types:
                    is_completed = (c.assessment_status or "").strip().lower() == "completed"
                    c_type = ""
                    if is_shadow:
                        c_type = "passive"
                    elif is_completed:
                        c_type = "active_verified"
                    else:
                        c_type = "active_unverified"

                    if c_type not in candidate_types:
                        continue

                # Generate clean matched/missing skills list with casing preserved
                matched_skills_list = []
                missing_skills_list = []
                for s in (target_skills or []):
                    if s and self._normalize_skill_token(s) in skill_overlap:
                        matched_skills_list.append(s)
                    elif s:
                        missing_skills_list.append(s)

                results.append({
                    "user_id": str(c.user_id),
                    "full_name": c.full_name or ("Potential Lead" if is_shadow else "Anonymous Talent"),
                    "current_role": c.current_role or "Sales Professional",
                    "experience": self._get_exp_label(c.years_of_experience or 0),
                    "years_of_experience": c.years_of_experience or 0,
                    "culture_match_score": skills_match_score, # displays skills match score primarily
                    "actual_culture_fit_score": culture_score,
                    "match_reasoning": f"Matched {len(skill_overlap)} of {len(target_skills_lower)} required skills.",
                    "skills": c.skills or [],
                    "matched_skills": matched_skills_list,
                    "missing_skills": missing_skills_list,
                    "profile_photo_url": get_s3_url_with_fallback(c.profile_photo_url) or f"https://api.dicebear.com/7.x/avataaars/svg?seed={(c.full_name or 'User').replace(' ', '%20')}",
                    "resume_path": S3Service.get_signed_url(c.resume_path) if c.resume_path else None,
                    "identity_verified": c.identity_verified or False,
                    "profile_strength": "Lead" if is_shadow else (c.profile_strength or "Moderate"),
                    "expected_salary": float(c.expected_salary or 0),
                    "is_shadow": is_shadow,
                    "assessment_status": "verified" if not is_shadow else "passive_lead",
                    "assessment_completed": (c.assessment_status or "").strip().lower() == "completed" and not is_shadow
                })

            # Sort: High matching (Skills Match score) first, then Verified active first
            results.sort(
                key=lambda x: (
                    x["culture_match_score"],
                    x["assessment_completed"],
                    not x["is_shadow"]
                ),
                reverse=True
            )
            return results
        finally:
            db.close()

    async def _expert_match_score(self, candidate, target_skills, target_exp_band, target_max_salary, 
                                   recruiter_icp="", recruiter_assessments=None, user_id="", db=None):
        """
        **MASTER EXPERT VIEW SCORING**
        Holistic synthesis of behavioral DNA, ICP alignment, technical fit, and professional pedigree.
        """
        base_score = 35  # Lower base to allow factors to shine
        reasoning_steps = []
        
        # ==== A. BEHAVIORAL & PSYCHOMETRIC DNA (40% weight) ====
        profile_score = db.query(ProfileScore).filter(ProfileScore.user_id == candidate.user_id).first() if db else None
        behavioral_score = getattr(profile_score, 'behavioral_score', 0) or 0
        psychometric_score = getattr(profile_score, 'psychometric_score', 0) or 0
        
        if behavioral_score > 85:
            base_score += 15
            reasoning_steps.append("Outstanding Behavioral Profile")
        elif behavioral_score > 75:
            base_score += 10
            reasoning_steps.append("Strong Behavioral Fit")
        elif behavioral_score > 60:
            base_score += 5
            reasoning_steps.append("Acceptable Behavior Traits")
        
        if psychometric_score > 80:
            base_score += 10
            reasoning_steps.append("Excellent Psychometric Match")
        elif psychometric_score > 65:
            base_score += 5
            reasoning_steps.append("Solid Psychometric Alignment")
        
        # ==== B. AI ICP ALIGNMENT (15% weight) ====
        if recruiter_icp:
            candidate_data = f"Bio: {candidate.bio} | Role: {candidate.current_role} | Achievements: {candidate.major_achievements}"
            prompt = f"""You are an Expert Recruitment Strategist. Analyze this candidate's fit:
RECRUITER NEEDS: {recruiter_icp}
CANDIDATE: {candidate_data}

Rate ICP alignment on 0-100. Output format: SCORE: [number] | REASON: [one sentence]"""
            
            icp_res = await self._call_ai(prompt, "You are an expert recruiter analyzing ICP fit.")
            if icp_res and "SCORE:" in icp_res:
                try:
                    score_part = icp_res.split("SCORE:")[1].split("|")[0].strip()
                    icp_score = min(100, max(0, int(float(score_part))))
                    base_score += int((icp_score / 100) * 15)
                    reason_part = icp_res.split("REASON:")[1].strip() if "REASON:" in icp_res else ""
                    if reason_part:
                        reasoning_steps.append(f"ICP Match: {reason_part}")
                except:
                    pass
        
        # ==== C. TECHNICAL & SKILLS ALIGNMENT (25% weight) ====
        c_skills = set([s.lower() for s in (candidate.skills or [])])
        if target_skills:
            target_skills_lower = set([s.lower() for s in target_skills])
            overlap = c_skills.intersection(target_skills_lower)
            fuzzy_matches = 0
            
            if len(overlap) < len(target_skills_lower):
                remaining = target_skills_lower - overlap
                for ts in remaining:
                    if any(ts in cs or cs in ts for cs in c_skills):
                        fuzzy_matches += 1
            
            total_matches = len(overlap) + (fuzzy_matches * 0.5)
            match_ratio = total_matches / len(target_skills_lower) if target_skills_lower else 0
            skill_bonus = int(match_ratio * 20)
            base_score += skill_bonus
            
            if overlap:
                reasoning_steps.append(f"Exact Matches: {len(overlap)}")
            if fuzzy_matches:
                reasoning_steps.append(f"Related Skills: {fuzzy_matches}")
        
        # ==== D. EXPERIENCE BAND (10% weight) ====
        years = candidate.years_of_experience or 0
        exp_status = self._get_exp_label(years)
        if target_exp_band and target_exp_band.lower() == exp_status:
            base_score += 8
            reasoning_steps.append("Perfect Experience Band")
        elif target_exp_band:
            base_score += 3
            reasoning_steps.append("Adjacent Experience Level")
        
        # ==== E. PROFILE STRENGTH & TRUST (10% weight) ====
        profile_strength = candidate.final_profile_score or 0
        if profile_strength > 85:
            base_score += 8
            reasoning_steps.append("Elite Profile Quality")
        elif profile_strength > 70:
            base_score += 5
            reasoning_steps.append("Verified High-Trust")
        
        match_score = min(99, base_score)
        reasoning = " | ".join(reasoning_steps) if reasoning_steps else "Professional fit for your organization."
        return match_score, reasoning

    async def _expert_match_score_shadow(self, candidate, target_skills, target_exp_band, target_max_salary):
        """
        EXPERT VIEW for SHADOW PROFILES (passive leads from bulk upload).
        Uses pedigree and role analysis since no assessment data exists.
        """
        base_score = 30  # Lower base for passive leads
        reasoning_steps = []
        
        # Current Role as Proxy for Level
        role = (candidate.current_role or "").lower()
        years = candidate.years_of_experience or 0
        
        # Role sophistication scoring
        if any(kw in role for kw in ["director", "vp", "head", "chief", "founder"]):
            base_score += 15
            reasoning_steps.append("Leadership Background")
        elif any(kw in role for kw in ["manager", "senior", "lead"]):
            base_score += 10
            reasoning_steps.append("Management Experience")
        elif any(kw in role for kw in ["specialist", "engineer", "architect"]):
            base_score += 8
            reasoning_steps.append("Technical Expertise")
        
        # Experience band match
        exp_status = self._get_exp_label(years)
        if target_exp_band and target_exp_band.lower() == exp_status:
            base_score += 10
            reasoning_steps.append(f"Matches {target_exp_band} requirement")
        
        # Skills match (from parsed data if available)
        c_skills = set([s.lower() for s in (candidate.skills or [])])
        if c_skills and target_skills:
            target_skills_lower = set([s.lower() for s in target_skills])
            overlap = c_skills.intersection(target_skills_lower)
            if overlap:
                match_ratio = len(overlap) / len(target_skills_lower)
                skill_bonus = int(match_ratio * 20)
                base_score += skill_bonus
                reasoning_steps.append(f"Has {len(overlap)} key skills")
        
        # Salary alignment
        if candidate.expected_salary and target_max_salary:
            if candidate.expected_salary <= target_max_salary:
                base_score += 5
                reasoning_steps.append("Salary aligned")
        
        match_score = min(99, base_score)
        reasoning = " | ".join(reasoning_steps) if reasoning_steps else "Passive lead with relevant background."
        reasoning += " [Passive Candidate]"
        return match_score, reasoning

    async def _score_culture_fit(self, candidate, target_skills, target_exp_band, target_max_salary, 
                                  is_shadow=False, recruiter_icp="", recruiter_assessments=None, db=None):
        """Culture fit is recruiter-vector to candidate-vector alignment."""

        def _clamp(value: float) -> int:
            return int(max(0, min(100, round(value))))

        def _avg(values: list[float], default: float = 50.0) -> float:
            usable = [float(value) for value in values if value is not None]
            return float(sum(usable) / len(usable)) if usable else default

        def _recruiter_response_score(response) -> float:
            subscores = [
                float(getattr(response, "relevance_score", 0) or 50),
                float(getattr(response, "specificity_score", 0) or 50),
                float(getattr(response, "clarity_score", 0) or 50),
                float(getattr(response, "ownership_score", 0) or 50),
            ]
            fairness = 50.0
            metadata = getattr(response, "evaluation_metadata", None) or {}
            try:
                fairness = float(metadata.get("fairness", 50) or 50)
            except Exception:
                fairness = 50.0
            return _avg(subscores + [fairness], default=50.0)

        recruiter_category_map = {
            "recruiter_intent": "intent",
            "recruiter_icp": "icp",
            "recruiter_ethics": "ethics",
            "recruiter_cvp": "cvp",
            "recruiter_ownership": "ownership",
        }

        profile_score = db.query(ProfileScore).filter(ProfileScore.user_id == candidate.user_id).first() if db else None
        if not profile_score or (str(getattr(candidate, "assessment_status", "") or "").strip().lower() != "completed"):
            return 0, "Candidate does not have a completed assessment profile for culture-fit matching."

        behavioral_score = float(getattr(profile_score, "behavioral_score", 0) or 0)
        psychometric_score = float(getattr(profile_score, "psychometric_score", 0) or 0)
        skills_score = float(getattr(profile_score, "skills_score", 0) or 0)
        reference_score = float(getattr(profile_score, "reference_score", 0) or 0)
        final_score = float(getattr(profile_score, "final_score", 0) or getattr(candidate, "final_profile_score", 0) or 0)
        readiness_score = float(getattr(candidate, "career_readiness_score", 0) or 0)
        years = float(candidate.years_of_experience or 0)

        recruiter_vectors: Dict[str, list[float]] = {
            "intent": [],
            "icp": [],
            "ethics": [],
            "cvp": [],
            "ownership": [],
        }

        if recruiter_assessments:
            for response in recruiter_assessments:
                mapped_dimension = recruiter_category_map.get((response.category or "").strip().lower())
                if mapped_dimension:
                    recruiter_vectors[mapped_dimension].append(_recruiter_response_score(response))

        recruiter_vector = {
            "intent": _avg(recruiter_vectors["intent"], default=50.0),
            "icp": _avg(recruiter_vectors["icp"], default=50.0),
            "ethics": _avg(recruiter_vectors["ethics"], default=50.0),
            "cvp": _avg(recruiter_vectors["cvp"], default=50.0),
            "ownership": _avg(recruiter_vectors["ownership"], default=50.0),
        }

        candidate_vector = {
            "intent": _avg([psychometric_score, readiness_score], default=50.0),
            "icp": _avg([skills_score * 0.55, min(100.0, years * 10.0), final_score * 0.20], default=50.0),
            "ethics": _avg([behavioral_score * 0.50, reference_score * 0.20, final_score * 0.30], default=50.0),
            "cvp": _avg([psychometric_score * 0.50, readiness_score * 0.20, final_score * 0.30], default=50.0),
            "ownership": _avg([behavioral_score * 0.60, psychometric_score * 0.20, final_score * 0.20], default=50.0),
        }

        # Ethics is a fairness gate, not just another soft preference.
        if recruiter_vector["ethics"] < 55:
            return 0, "Recruiter ethics/fair hiring responses are not strong enough for culture-fit matching."
        if candidate_vector["ethics"] < 50:
            return 0, "Candidate trust and fairness signals are too weak for culture-fit matching."

        def _alignment(recruiter_value: float, candidate_value: float) -> int:
            return _clamp(100 - abs(float(recruiter_value) - float(candidate_value)))

        intent_alignment = _alignment(recruiter_vector["intent"], candidate_vector["intent"])
        icp_alignment = _alignment(recruiter_vector["icp"], candidate_vector["icp"])
        ethics_alignment = _alignment(recruiter_vector["ethics"], candidate_vector["ethics"])
        cvp_alignment = _alignment(recruiter_vector["cvp"], candidate_vector["cvp"])
        ownership_alignment = _alignment(recruiter_vector["ownership"], candidate_vector["ownership"])

        weighted_score = (
            intent_alignment * 0.16
            + icp_alignment * 0.22
            + ethics_alignment * 0.26
            + cvp_alignment * 0.14
            + ownership_alignment * 0.22
        )

        if weighted_score < CULTURE_FIT_BENCHMARK:
            return _clamp(weighted_score), (
                f"Below culture-fit benchmark. Intent {intent_alignment}% | ICP {icp_alignment}% | "
                f"Ethics {ethics_alignment}% | CVP {cvp_alignment}% | Ownership {ownership_alignment}%"
            )

        reasoning_steps = [
            f"Intent {intent_alignment}%",
            f"ICP {icp_alignment}%",
            f"Ethics {ethics_alignment}%",
            f"CVP {cvp_alignment}%",
            f"Ownership {ownership_alignment}%",
        ]

        if weighted_score >= 90:
            reasoning_steps.insert(0, "Excellent culture-fit alignment")
        elif weighted_score >= 80:
            reasoning_steps.insert(0, "Strong culture-fit alignment")
        else:
            reasoning_steps.insert(0, "Acceptable culture-fit alignment")

        return _clamp(weighted_score), " | ".join(reasoning_steps)

    def _score_skill_match(self, candidate, target_skills, target_exp_band, target_max_salary, is_shadow=False):
        """Skills-focused matching"""
        target_skills_lower = set([s.lower() for s in target_skills or []])
        c_skills = set([s.lower() for s in (candidate.skills or [])])
        overlap = c_skills.intersection(target_skills_lower)
        match_ratio = len(overlap) / len(target_skills_lower) if target_skills_lower else 0
        match_score = int(match_ratio * 100)
        reasoning_steps = []
        if overlap:
            reasoning_steps.append(f"Matched {len(overlap)} of {len(target_skills_lower)} required skills")
        if target_skills_lower and len(overlap) < len(target_skills_lower):
            missing = sorted(target_skills_lower - overlap)
            if missing:
                reasoning_steps.append(f"Missing: {', '.join(missing[:4])}")
        reasoning = " | ".join(reasoning_steps) if reasoning_steps else "Skills aligned with requirements."
        return match_score, reasoning

    def _get_exp_label(self, years: int) -> str:
        """Convert years of experience to experience band label"""
        if years <= 1:
            return "fresher"
        elif years > 10:
            return "leadership"
        elif years > 5:
            return "senior"
        return "mid"

    async def create_job(self, user_id: str, job_data: dict):
        db = SessionLocal()
        try:
            profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == user_id).first()
            if not profile or not profile.company_id:
                raise Exception("Recruiter profile or company not found")

            # Handle arrays for text[] in RDS
            def sanitize_array(val):
                if val is None or val == "null" or val == "":
                    return []
                if isinstance(val, str):
                    return [val]
                return list(val)

            metadata = job_data.get("metadata", {}) or {}
            metadata["min_salary"] = job_data.get("min_salary")
            metadata["max_salary"] = job_data.get("max_salary")
            metadata["currency"] = job_data.get("currency")
            metadata["salary_frequency"] = job_data.get("salary_frequency")
            metadata["assessment_template_id"] = job_data.get("assessment_template_id")

            new_job = Job(
                company_id=profile.company_id,
                recruiter_id=user_id,
                title=job_data.get("title"),
                description=job_data.get("description"),
                experience_band=job_data.get("experience_band"),
                job_type=job_data.get("job_type"),
                location=job_data.get("location"),
                salary_range=job_data.get("salary_range"),
                number_of_positions=job_data.get("number_of_positions", 1),
                is_ai_generated=job_data.get("is_ai_generated", False),
                requirements=sanitize_array(job_data.get("requirements")),
                skills_required=sanitize_array(job_data.get("skills_required")),
                metadata_=metadata,
                status=job_data.get("status", "active") or "active"
            )
            db.add(new_job)
            db.commit()
            db.refresh(new_job)

            # Send job posted confirmation email to recruiter
            try:
                from src.services.email_service import send_job_posted_recruiter_email
                recruiter_user = db.query(User).filter(User.id == user_id).first()
                company_obj = db.query(Company).filter(Company.id == profile.company_id).first()
                
                if recruiter_user:
                    rec_email = recruiter_user.email
                    rec_name = profile.full_name or recruiter_user.full_name or "Recruiter"
                    comp_name = company_obj.name if company_obj else "TechSales Axis Partner"
                    
                    send_job_posted_recruiter_email(
                        recipient=rec_email,
                        recruiter_name=rec_name,
                        job_title=new_job.title,
                        company_name=comp_name,
                        location=new_job.location,
                        salary_range=new_job.salary_range
                    )
            except Exception as email_err:
                print(f"ERROR sending job posted confirmation email: {email_err}")

            return {"id": str(new_job.id), "status": "success"}
        except Exception as e:
            db.rollback()
            print(f"ERROR creating job: {str(e)}")
            raise e
        finally:
            db.close()

    async def get_talent_pool(self):
        db = SessionLocal()
        try:
            candidates = db.query(CandidateProfile).all()
            results = []
            for c in candidates:
                # Basic normalization of experience band
                years = c.years_of_experience or 0
                exp_source = (c.experience or "").lower().strip()
                
                # Normalize common variations to standard bands
                if exp_source in ["fresher", "entry", "intern"]:
                    exp_band = "fresher"
                elif exp_source in ["mid", "intermediate", "associate"]:
                    exp_band = "mid"
                elif exp_source in ["senior", "sr", "expert"]:
                    exp_band = "senior"
                elif exp_source in ["leadership", "mgmt", "management", "director", "vp"]:
                    exp_band = "leadership"
                else:
                    # Fallback based on years if DB value is unknown (Updated Protocol: 0-1, 1-5, 5-10, 10+)
                    exp_band = "leadership" if years >= 10 else "senior" if years >= 5 else "mid" if years >= 1 else "fresher"
                
                results.append({
                    "user_id": str(c.user_id),
                    "full_name": c.full_name or "Unknown Candidate",
                    "experience": exp_band,
                    "years_of_experience": years,
                    "location": c.location or "Remote",
                    "location_tier": c.location_tier or getCityTier(c.location or "Remote"),
                    "expected_salary": float(c.expected_salary) if c.expected_salary else 0.0,
                    "current_salary": float(c.current_salary) if c.current_salary else 0.0,
                    "career_readiness_score": float(c.career_readiness_score) if c.career_readiness_score else 0.0,
                    "role_urgency_level": c.role_urgency_level or "passive",
                    "employment_readiness_status": c.employment_readiness_status or "not_specified",
                    "skills": c.skills or [],
                    "target_role": c.target_role,
                    "current_role": c.current_role,
                    "is_shadow": c.is_shadow_profile or False,
                    "assessment_status": c.assessment_status or "not_started",
                    "identity_verified": c.identity_verified or False,
                    "resume_path": S3Service.get_signed_url(c.resume_path) if c.resume_path else None
                })
            return results
        finally:
            db.close()

    def persist_profile_matches(self, recruiter_id: str, matches: List[Dict]) -> int:
        """
        Persist profile matches to database for caching and analytics.
        This is called after recommendations are generated to cache the results.
        
        Args:
            recruiter_id: UUID of the recruiter
            matches: List of candidate matches with scores and reasoning
        
        Returns:
            Number of matches successfully persisted
        """
        db = SessionLocal()
        try:
            count = 0
            for match in matches:
                try:
                    candidate_id = match.get("user_id") or match.get("candidate_id")
                    if not candidate_id:
                        continue
                    
                    # Check if match already exists
                    existing = db.query(ProfileMatch).filter(
                        ProfileMatch.candidate_id == candidate_id,
                        ProfileMatch.recruiter_id == recruiter_id,
                        ProfileMatch.match_type == "culture_fit"
                    ).first()
                    
                    match_score = int(match.get("culture_match_score", 0))
                    reasoning = match.get("match_reasoning", "")
                    
                    if existing:
                        # Update existing match
                        existing.match_score = match_score
                        existing.reasoning_text = reasoning
                        existing.updated_at = datetime.utcnow()
                    else:
                        # Create new match record
                        new_match = ProfileMatch(
                            candidate_id=candidate_id,
                            recruiter_id=recruiter_id,
                            match_score=match_score,
                            reasoning_text=reasoning,
                            match_type="culture_fit",
                            candidate_token=None,
                            recruiter_token=None
                        )
                        db.add(new_match)
                    
                    count += 1
                except Exception as e:
                    print(f"Error persisting match for candidate {candidate_id}: {str(e)}")
                    continue
            
            db.commit()
            return count
        except Exception as e:
            db.rollback()
            print(f"Error persisting profile matches: {str(e)}")
            return 0
        finally:
            db.close()

    async def search_talent_pool(self, params: Dict[str, Any] = {}):
        """
        Search and filter all candidates in the talent pool based on specified criteria.
        This performs pure database and in-memory filtering without enforcing recommendation benchmarks,
        making it perfect for direct searches and filters.
        """
        db = SessionLocal()
        try:
            query = db.query(CandidateProfile)
            candidates = query.all()
            results = []
            
            location = params.get("location")
            min_experience = params.get("min_experience")
            max_experience = params.get("max_experience")
            experience_band = params.get("experience_band")
            min_salary = params.get("min_salary")
            max_salary = params.get("max_salary")
            min_current_salary = params.get("min_current_salary")
            max_current_salary = params.get("max_current_salary")
            skills = params.get("skills") or []
            original_skills = params.get("original_skills")
            original_skills_list = []
            if original_skills:
                if isinstance(original_skills, list):
                    original_skills_list = [s.lower().strip() for s in original_skills if s]
                elif isinstance(original_skills, str):
                    original_skills_list = [s.lower().strip() for s in original_skills.split(",") if s.strip()]
            if not original_skills_list:
                original_skills_list = [s.lower().strip() for s in skills if s] if isinstance(skills, list) else [s.lower().strip() for s in str(skills).split(",") if s.strip()]

            job_type = params.get("job_type")
            career_readiness = params.get("career_readiness") or []
            job_title = params.get("job_title")
            
            # If min_salary or max_salary is under 100, treat as Lakhs and convert to absolute scale
            if min_salary is not None:
                try:
                    val = float(min_salary)
                    if val < 100:
                        min_salary = val * 100000.0
                    else:
                        min_salary = val
                except ValueError:
                    min_salary = None

            if max_salary is not None:
                try:
                    val = float(max_salary)
                    if val < 100:
                        max_salary = val * 100000.0
                    else:
                        max_salary = val
                except ValueError:
                    max_salary = None

            if min_current_salary is not None:
                try:
                    val = float(min_current_salary)
                    if val < 100:
                        min_current_salary = val * 100000.0
                    else:
                        min_current_salary = val
                except ValueError:
                    min_current_salary = None

            if max_current_salary is not None:
                try:
                    val = float(max_current_salary)
                    if val < 100:
                        max_current_salary = val * 100000.0
                    else:
                        max_current_salary = val
                except ValueError:
                    max_current_salary = None
            
            loc_search = str(location).strip().lower() if location else None
            loc_equivalents = {loc_search} if loc_search else set()
            if loc_search:
                for group in CITY_EQUIVALENCE_GROUPS:
                    if any(name in loc_search or loc_search in name for name in group):
                        loc_equivalents.update(group)
            
            skills_search = []
            if skills:
                if isinstance(skills, list):
                    skills_search = [s.lower().strip() for s in skills if s]
                elif isinstance(skills, str):
                    skills_search = [s.lower().strip() for s in skills.split(",") if s.strip()]
            
            readiness_search = []
            if career_readiness:
                if isinstance(career_readiness, list):
                    readiness_search = [r.lower().strip() for r in career_readiness if r]
                elif isinstance(career_readiness, str):
                    readiness_search = [r.lower().strip() for r in career_readiness.split(",") if r.strip()]

            def get_exp_band(years: int) -> str:
                if years <= 1:
                    return "fresher"
                elif years <= 5:
                    return "mid"
                elif years <= 10:
                    return "senior"
                else:
                    return "leadership"

            for c in candidates:
                # 1. Filter: Location with Synonyms
                if loc_search:
                    c_loc = str(c.location or "").lower().strip()
                    if not any(eq in c_loc for eq in loc_equivalents):
                        continue
                
                # 2. Filter: Years of Experience (Numeric range)
                c_years = c.years_of_experience or 0
                if min_experience is not None:
                    try:
                        if c_years < int(min_experience):
                            continue
                    except ValueError:
                        pass
                if max_experience is not None:
                    try:
                        if c_years > int(max_experience):
                            continue
                    except ValueError:
                        pass
                
                # 3. Filter: Experience Band (only apply if numeric range is not specified)
                if experience_band and experience_band != "all" and min_experience is None and max_experience is None:
                    c_band = get_exp_band(c_years)
                    if c_band != experience_band:
                        continue
                        
                # 4. Filter: Expected Salary Range
                c_salary = float(c.expected_salary) if c.expected_salary is not None else None
                if min_salary is not None:
                    try:
                        if c_salary is not None and c_salary < float(min_salary):
                            continue
                    except ValueError:
                        pass
                if max_salary is not None:
                    try:
                        if c_salary is not None and c_salary > float(max_salary):
                            continue
                    except ValueError:
                        pass

                # 4b. Filter: Current Salary Range
                c_current_salary = float(c.current_salary) if c.current_salary is not None else None
                if c_current_salary is not None and c_current_salary > 0:
                    if min_current_salary is not None:
                        try:
                            if c_current_salary < float(min_current_salary):
                                continue
                        except ValueError:
                            pass
                    if max_current_salary is not None:
                        try:
                            if c_current_salary > float(max_current_salary):
                                continue
                        except ValueError:
                            pass
                
                # 5. Filter: Job Type
                if job_type:
                    c_jt = str(c.job_type or "").lower().strip()
                    if job_type.lower().strip() not in c_jt:
                        continue
                
                # 6. Filter: Career Readiness
                if readiness_search:
                    matched_readiness = True
                    for r_val in readiness_search:
                        if not _candidate_matches_readiness(c, r_val, max_salary):
                            matched_readiness = False
                            break
                    if not matched_readiness:
                        continue
                
                # 7. Filter: Skills
                if skills_search:
                    c_skills_canonical = self._canonicalize_skill_terms(c.skills or [])
                    search_skills_canonical = self._canonicalize_skill_terms(skills_search)
                    if not c_skills_canonical.intersection(search_skills_canonical):
                        continue
                
                # 8. Filter: Job Title / Role
                if job_title:
                    c_role = str(c.current_role or "").lower().strip()
                    c_t_role = str(c.target_role or "").lower().strip()
                    jt_search = job_title.lower().strip()
                    if jt_search not in c_role and jt_search not in c_t_role:
                        continue

                # Compute strict Skills Match score (ratio of overlapping skills to total search skills)
                if skills_search:
                    c_skills_canonical = self._canonicalize_skill_terms(c.skills or [])
                    search_skills_canonical = self._canonicalize_skill_terms(skills_search)
                    overlap = c_skills_canonical.intersection(search_skills_canonical)
                    
                    original_skills_canonical = self._canonicalize_skill_terms(original_skills_list)
                    denominator = len(original_skills_canonical) if original_skills_canonical else len(search_skills_canonical)
                    match_ratio = len(overlap) / denominator if denominator > 0 else 0
                    final_match_score = min(100, int(round(match_ratio * 100)))
                else:
                    final_match_score = 100

                # Build descriptive reasoning
                reasoning_parts = []
                
                if skills_search:
                    c_skills_original = c.skills or []
                    matched_skills_names = []
                    for ss in skills_search:
                        for cs in c_skills_original:
                            if ss in cs.lower() or cs.lower() in ss:
                                matched_skills_names.append(cs)
                                break
                    matched_skills_names = sorted(list(set(matched_skills_names)))
                    if matched_skills_names:
                        reasoning_parts.append(f"Matches skills: {', '.join(matched_skills_names)}")
                elif c.skills:
                    reasoning_parts.append(f"Skills: {', '.join(c.skills[:3])}")
                
                exp_label = get_exp_band(c_years)
                reasoning_parts.append(f"Has {c_years} years of experience ({exp_label} level)")

                if c.location:
                    reasoning_parts.append(f"Based in {c.location}")
                else:
                    reasoning_parts.append("Location unspecified")

                if c_salary is not None and c_salary > 0:
                    lpa_val = c_salary / 100000.0
                    reasoning_parts.append(f"Expected salary: {lpa_val:.1f} LPA")

                match_reasoning = " · ".join(reasoning_parts)
                exp_label_returned = self._get_exp_label(c_years)

                is_completed = (c.assessment_status or "").strip().lower() == "completed"

                results.append({
                    "user_id": str(c.user_id),
                    "full_name": c.full_name or ("Potential Lead" if c.is_shadow_profile else "Anonymous Talent"),
                    "current_role": c.current_role or "Sales Professional",
                    "experience": exp_label_returned,
                    "years_of_experience": c_years,
                    "location": c.location or "Remote",
                    "skills": c.skills or [],
                    "profile_photo_url": get_s3_url_with_fallback(c.profile_photo_url) or f"https://api.dicebear.com/7.x/avataaars/svg?seed={(c.full_name or 'User').replace(' ', '%20')}",
                    "resume_path": S3Service.get_signed_url(c.resume_path) if c.resume_path else None,
                    "identity_verified": c.identity_verified or False,
                    "profile_strength": "Lead" if c.is_shadow_profile else (c.profile_strength or "Moderate"),
                    "expected_salary": float(c.expected_salary or 0.0),
                    "current_salary": float(c.current_salary or 0.0),
                    "career_readiness_score": float(c.career_readiness_score or 0.0),
                    "role_urgency_level": c.role_urgency_level or "passive",
                    "employment_readiness_status": c.employment_readiness_status or "not_specified",
                    "is_shadow": c.is_shadow_profile or False,
                    "assessment_status": c.assessment_status or "not_started",
                    "culture_match_score": final_match_score,
                    "match_reasoning": match_reasoning,
                    "assessment_completed": is_completed and not c.is_shadow_profile
                })
            
            # Sort: High matching (Skills Match score) first, then Verified active first
            results.sort(
                key=lambda x: (
                    x["culture_match_score"],
                    x["assessment_completed"],
                    not x["is_shadow"]
                ),
                reverse=True
            )
            return results
        finally:
            db.close()

recruiter_service = RecruiterService()
