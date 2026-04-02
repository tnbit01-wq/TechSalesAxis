"""
Comprehensive Resume Extractor using OCR + NLP
Fallback when all AI APIs fail
Maps extracted data to correct candidate_profiles and resume_data columns
"""
import re
import json
from datetime import datetime
from typing import Dict, List, Optional, Tuple

class ComprehensiveResumeExtractor:
    """
    Ultimate fallback extractor for resume parsing.
    Uses pattern matching, regex, and rule-based NLP for field extraction.
    """
    
    # Common skill keywords mapped by experience level
    SKILL_KEYWORDS = {
        "fresher": [
            "Python", "Java", "JavaScript", "HTML", "CSS", "React", "Git", "SQL", "MySQL",
            "REST API", "Postman", "VS Code", "Linux", "Problem Solving", "Communication",
            "Team Work", "Learning", "Quick Learner", "Eager to Learn"
        ],
        "mid": [
            "Python", "Java", "JavaScript", "Node.js", "React", "Vue", "Angular", "Django",
            "Flask", "Spring", "SQL", "MongoDB", "PostgreSQL", "Docker", "Git", "AWS",
            "Azure", "API Development", "Database Design", "Project Leadership", "Mentoring",
            "Agile", "SCRUM", "Problem Solving", "Technical Leadership"
        ],
        "senior": [
            "Architecture Design", "System Design", "Microservices", "Cloud Architecture",
            "AWS", "Azure", "GCP", "Kubernetes", "Docker", "CI/CD", "DevOps", "Leadership",
            "Team Management", "Stakeholder Management", "Strategic Planning", "Mentoring",
            "Code Review", "Best Practices", "Performance Optimization", "Security", "ML/AI"
        ],
        "leadership": [
            "Team Management", "P&L", "Budget Management", "Strategic Planning", "Leadership",
            "Stakeholder Management", "Business Development", "Client Relations", "Negotiation",
            "Change Management", "Organizational Skills", "Communication", "Decision Making",
            "Analytics", "Data Analysis", "Forecasting"
        ]
    }
    
    # Degree patterns (case-insensitive)
    DEGREE_PATTERNS = {
        r"\bb\.?tech\b|\bundergrad": "B.Tech",
        r"\bb\.?sc\b|\bbachelor of science": "B.Sc.",
        r"\bb\.?a\b|\bbachelor of arts": "B.A.",
        r"\bb\.?com\b|\bbachelor of commerce": "B.Com.",
        r"\bm\.?tech\b|\bmaster of technology": "M.Tech",
        r"\bm\.?sc\b|\bmaster of science": "M.Sc.",
        r"\bmba\b|\bmaster of business": "MBA",
        r"\bm\.?a\b|\bmaster of arts": "M.A.",
        r"\bm\.?com\b|\bmaster of commerce": "M.Com.",
        r"\bphd\b|\bdoctorate": "PhD",
        r"\bpg diploma\b": "PG Diploma",
        r"\bdiplomai\b": "Diploma"
    }
    
        # Tech/Sales industry keywords for filtering experience
    INDUSTRY_KEYWORDS = {
        "tech": [
            "software", "developer", "engineer", "programmer", "architect", "devops",
            "data scientist", "machine learning", "ai", "ml", "cloud", "aws", "azure",
            "django", "react", "node", "python", "java", "javascript", "database",
            "backend", "frontend", "fullstack", "saas", "startup", "tech",
            "mobile", "android", "ios", "web", "api", "rest", "graphql",
            "kubernetes", "docker", "microservices", "agile", "scrum"
        ],
        "sales": [
            "sales", "business development", "account executive", "sales manager",
            "saas sales", "enterprise sales", "solution sales", "inside sales",
            "sales representative", "sales consultant", "sales engineer",
            "business consultant", "account manager", "key account", "revenue"
        ]
    }
    
    @staticmethod
    def _is_tech_or_sales_role(role_text: str) -> bool:
        """Check if a role is in tech/sales industry."""
        if not role_text:
            return False
        text_lower = role_text.lower()
        all_keywords = ComprehensiveResumeExtractor.INDUSTRY_KEYWORDS["tech"] + \
                       ComprehensiveResumeExtractor.INDUSTRY_KEYWORDS["sales"]
        return any(kw in text_lower for kw in all_keywords)

    
    @staticmethod
    def extract_name(text: str) -> Optional[str]:
        """Extract person name from resume text with high accuracy."""
        lines = text.split('\n')
        
        # Strategy 1: Look for header pattern (name usually at top, all caps or Title Case)
        # Also handle names with spaces between characters (e.g., "L A L I T  K O T I A N" from PDF extraction)
        for i, line in enumerate(lines[:15]):  # Check first 15 lines
            line = line.strip()
            if not line or len(line) < 3 or len(line) > 100:
                continue
            
            # Skip common headers
            if any(x in line.lower() for x in ['curriculum', 'resume', 'cv', 'objective', 'summary', 'profile', 'core', 'skill', 'experience', 'education']):
                continue
            
            # Check if line has email/phone/date (unlikely to be name line)
            if any(x in line for x in ['@', '+91', '+1', '(', '/']):
                continue
            
            # For lines that might have spaces between characters (PDF extraction artifact)
            # E.g., "L A L I T  K O T I A N" -> collect words with spaces
            # Check pattern: words can be single letters or normal words with potential space between caps
            if i < 3:  # Priority to very first lines
                # More lenient pattern for spaced names
                # Allow "X X X" or "Name Surname" or mixed
                words_with_potential_space = re.sub(r'\s+', ' ', line).split()
                # Check if looks like names (2-5 words, mostly capitalized)
                if 1 <= len(words_with_potential_space) <= 5:
                    capital_words = sum(1 for w in words_with_potential_space if w and w[0].isupper())
                    if capital_words >= len(words_with_potential_space) * 0.7:  # 70% capitalized
                        name_candidate = ' '.join(words_with_potential_space)
                        # Remove internal spaces within words for name-like patterns
                        # E.g., "L A L I T" -> "LALIT"  
                        if len([c for c in name_candidate if c.isalpha()]) >= 4:
                            return name_candidate
            
            # Check if line matches standard name pattern
            if re.match(r'^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s*[A-Z]\.)*\s*)*$', line):
                words = line.split()
                if 1 <= len(words) <= 5 and all(len(w) >= 2 for w in words):
                    return line
        
        # Strategy 2: Look for "Name:" or "Full Name:" pattern
        name_match = re.search(r'(?:full\s*)?name\s*:?\s*([A-Za-z\s]+?)(?:\n|,|$)', text, re.IGNORECASE)
        if name_match:
            name = name_match.group(1).strip()
            if 3 < len(name) < 100 and name.count(' ') <= 8:  # Allow more spaces for spaced names
                return name
        
        # Strategy 3: First meaningful line that looks like a name
        for line in lines:
            line = line.strip()
            if 3 < len(line) < 80:
                # Check word boundaries - allow for names with spaces
                words = line.split()
                if all(w and w[0].isupper() for w in words if len(w) > 1):
                    if not any(digit in line for digit in '0123456789'):
                        if not any(sym in line for sym in ['@', '+', '/', '\\']):
                            return line
        
        return None
    
    @staticmethod
    def extract_contact(text: str) -> Dict[str, Optional[str]]:
        """Extract email, phone, and social links."""
        contact = {
            "email": None,
            "phone": None,
            "linkedin": None,
            "portfolio": None
        }
        
        # Extract email - also try links like "email: address"
        email_patterns = [
            r'([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})',
            r'(?:email|mail):\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})'
        ]
        for pattern in email_patterns:
            email_match = re.search(pattern, text, re.IGNORECASE)
            if email_match:
                contact["email"] = email_match.group(1)
                break
        
        # Extract phone - multiple patterns for different formats
        phone_patterns = [
            r'\+91\s?[\d\s\-]{10,}',  # India with +91
            r'\+\d{1,2}\s?[\d\s\-]{8,}',  # International with + prefix
            r'(?:phone|mobile|contact):\s*([\d\s\-\+]+)',  # Label format
            r'(?:^|\s)(\d{10})(?:\s|•|$)',  # 10 digit phone anywhere (with boundaries)
            r'^[\d\s\-\+]{10,}$'  # Standalone phone (multiline)
        ]
        for pattern in phone_patterns:
            phone_match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
            if phone_match:
                # Extract just the digits from the last 12 characters of match (to get full number)
                matched_text = phone_match.group(1) if phone_match.lastindex else phone_match.group(0)
                digits_only = ''.join(filter(str.isdigit, matched_text.strip()))
                if len(digits_only) >= 10:
                    # Take last 10 digits if more than 10 (handles +91 country code)
                    contact["phone"] = digits_only[-10:] if len(digits_only) > 10 else digits_only
                    break
        
        # Extract LinkedIn
        linkedin_match = re.search(r'linkedin\.com/in/([a-zA-Z0-9\-]+)', text, re.IGNORECASE)
        if linkedin_match:
            contact["linkedin"] = f"https://www.linkedin.com/in/{linkedin_match.group(1)}"
        
        # Extract portfolio
        portfolio_match = re.search(r'(https?://[a-zA-Z0-9\-\.]+(?:\.com|\.io|\.dev|\.net))', text)
        if portfolio_match:
            contact["portfolio"] = portfolio_match.group(1)
        
        return contact
    
    @staticmethod
    def extract_location(text: str) -> Optional[str]:
        """Extract location (city, state/country) with high accuracy."""
        location_patterns = [
            # Explicit "Location: City, Country" format with colon
            (r'(?:^|\n)location\s*:\s*([A-Z][a-zA-Z\s]+?,\s*[A-Z][a-zA-Z\s]+?)(?:\n|$)', re.MULTILINE | re.IGNORECASE),
            # "Based in: City, Country" or "Currently in: City, Country"
            (r'(?:based\s+in|currently\s+in)\s*:\s*([A-Z][a-zA-Z\s]+?,\s*[A-Z][a-zA-Z\s]{2,}?)(?:\n|$)', re.IGNORECASE | re.MULTILINE),
            # "Based in City" or "Currently in City" without colon
            (r'(?:based\s+in|currently\s+in)\s+([A-Z][a-zA-Z\s]+?)(?:\n|,|$)', re.IGNORECASE | re.MULTILINE),
            # City, State/Country format (e.g., "Bangalore, India")
            (r'(?:^|\n)([A-Z][a-zA-Z]+,\s*[A-Z][a-zA-Z]+)(?:\n|$)', re.MULTILINE),
            # Major cities/countries (with word boundaries)
            (r'\b(New York|London|San Francisco|Bangalore|Mumbai|Delhi|Chennai|Pune|Hyderabad|Singapore|Sydney|Toronto|Vancouver|Dubai)\b', re.IGNORECASE),
            # "Location: Single City"
            (r'(?:^|\n)location\s*:\s*([A-Z][a-zA-Z\s]+?)(?:\n|$)', re.MULTILINE | re.IGNORECASE),
        ]
        
        for pattern, flags in location_patterns:
            match = re.search(pattern, text, flags)
            if match:
                loc = match.group(1).strip()
                if 3 < len(loc) < 150:
                    return loc
        
        return None
    
    @staticmethod
    def extract_experience_years(text: str) -> Optional[int]:
        """Extract years of industry experience (exclude teaching, volunteering)."""
        # Look for "X years of experience" - prioritize explicit mentions
        patterns = [
            r'(\d+)\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:experience|exp)',
            r'experience[:\s]+(\d+)\+?\s*(?:years?|yrs?)',
            r'total\s+experience[:\s]*(\d+)',
            r'(\d+)\+?\s*(?:years?|yrs?).*?experience',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    years = int(match.group(1))
                    # Filter out outliers
                    if 0 < years <= 60:
                        return years
                except (ValueError, IndexError):
                    pass
        
        # Alternative: Count dates in work experience section
        date_pattern = r'(?:20\d{2}|19\d{2})'
        dates = re.findall(date_pattern, text)
        if len(dates) >= 2:
            try:
                years_list = [int(d) for d in dates if d.isdigit()]
                if len(years_list) >= 2:
                    start_year = min(years_list)
                    end_year = max(years_list)
                    years = end_year - start_year
                    if 0 < years <= 60:
                        return years
            except (ValueError, TypeError):
                pass
        
        return None
    
    @staticmethod
    def extract_education(text: str) -> List[Dict[str, Optional[str]]]:
        """Extract education history (degree, institution, year)."""
        education_list = []
        
        # Find education section
        education_section = ""
        ed_match = re.search(
            r'(?:Education|Academic Qualifications?):(.*?)(?=\n(?:Experience|Work|Professional|Projects|Skills|Certifications|$))',
            text,
            re.IGNORECASE | re.DOTALL
        )
        if ed_match:
            education_section = ed_match.group(1)
        else:
            education_section = text
        
        # Extract individual education entries (usually one per line or block)
        # Look for degree patterns to find education entries
        degree_pattern = r'([A-Z][a-zA-Z\.]*(?:Tech|Science|Arts|Commerce|Administration|Engineering|Management)(?:\s+(?:in|\(|/|,))?(?:[^\n]*)?(?:University|Institute|College|School)?[^\n]*(?:20\d{2}|Graduated|Graduated:|Awarded)?(?:[^\n]*)?(?:20\d{2})?)'  # Flexible but still captures most degrees
        
        lines = education_section.split('\n')
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            i += 1
            
            if not line or len(line) < 5:
                continue
            
            edu_entry = {
                "degree": None,
                "institution": None,
                "year": None
            }
            
            # Extract degree
            for pattern, degree_name in ComprehensiveResumeExtractor.DEGREE_PATTERNS.items():
                if re.search(pattern, line, re.IGNORECASE):
                    edu_entry["degree"] = degree_name
                    break
            
            if not edu_entry["degree"]:
                continue
            
            # Extract institution from current or next line(s)
            # Check current line first
            if 'university' in line.lower() or 'institute' in line.lower() or 'college' in line.lower():
                # Institution is in same line as degree
                inst_match = re.search(r'(?:from|at)?\s*,?\s*([A-Z][a-zA-Z\s&\-\.()]+(?:University|Institute|College|School|IIT|NIT|VTU))',
                                     line, re.IGNORECASE)
                if inst_match:
                    edu_entry["institution"] = inst_match.group(1).strip().replace('|', ' ').strip()
            else:
                # Look ahead in text for institution (next line might have it)
                if i < len(lines):
                    next_line = lines[i].strip()
                    if any(x in next_line.lower() for x in ['university', 'institute', 'college', 'school']):
                        # Clean up institutional name
                        inst_text = next_line.split('|')[0].strip()  # Take first part if pipe-separated
                        inst_text = re.sub(r'\s*(?:Graduated|Awarded|GPA|CGPA).*', '', inst_text, flags=re.IGNORECASE)
                        if len(inst_text) > 3:
                            edu_entry["institution"] = inst_text
            
            # Extract year - look in current and next line
            year_match = re.search(r'(?:Graduated:|Awarded:|Graduated\s+)?(?:in\s+)?(19\d{2}|20\d{2})', line, re.IGNORECASE)
            if not year_match and i < len(lines):
                year_match = re.search(r'(19\d{2}|20\d{2})', lines[i], re.IGNORECASE)
            
            if year_match:
                edu_entry["year"] = int(year_match.group(1))
            
            if edu_entry["degree"]:
                education_list.append(edu_entry)
        
        return education_list
    
    @staticmethod
    def extract_experience(text: str) -> Tuple[List[Dict], Optional[str], Optional[str]]:
        """
        Extract experience timeline, current role, and previous role.
        Supports multiple resume formats:
        - Pipe-separated: | Position | Company | Location | Dates |
        - Dash-separated: Position – Company (Location) with dates on next line
        - Multi-line: Position, Company, Dates on separate lines
        """
        experience_list = []
        current_role = None
        previous_role = None
        
        if not text or not isinstance(text, str):
            return [], None, None
        
        # Fix corrupted UTF-8 sequences from OCR/PDF encoding issues
        # ÔÇô = corrupted UTF-8 for em-dash (–)
        text = text.replace('ÔÇô', '–').replace('ÔÇô', '–')
        
        # Find experience section
        exp_section = None
        exp_patterns = [
            r'(?:professional\s+)?experience\s*\n+(.*?)(?=\n(?:education|projects|skills|certifications|languages|awards|volunteer|personal|key\s+achievements|$))',
            r'work\s+experience\s*\n+(.*?)(?=\n(?:education|projects|skills|certifications|languages|awards|volunteer|personal|key\s+achievements|$))',
            r'experience\s*\n+(.*?)(?=\n[A-Z\s]{3,}|$)',  # Fallback: experience section until next capitalized header
        ]
        
        for pattern in exp_patterns:
            exp_match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
            if exp_match:
                exp_section = exp_match.group(1)
                break
        
        if not exp_section or not exp_section.strip():
            return [], None, None
        
        job_entries = []
        lines = exp_section.split('\n')
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            i += 1
            
            # Skip empty lines, bullets, pure dashes
            if not line or line.startswith('•') or line.startswith('–') or line.startswith('-') or line.startswith('ÔÇó'):
                continue
            
            # Check if line is ONLY date/year information (like "Jun 2024 – Present" or "2021 ÔÇô 2023")
            # Don't skip - let the parsing method handle it
            if re.match(r'^(\w+\s+)?\d{4}\s*[–\-–ÔÇô]\s*(?:(\w+\s+)?\d{4}|present|current)', line, re.IGNORECASE):
                # This line will be picked up by the appropriate parser as a date line
                # For now, skip it as a main entry
                continue
            
            # ===== FORMAT 1: PIPE-SEPARATED =====
            # Check if line has multiple pipes (3+ pipes = pipe separated format)
            if line.count('|') >= 3:
                parts = [p.strip() for p in line.split('|') if p.strip()]
                if len(parts) >= 2:
                    job_entry = ComprehensiveResumeExtractor._parse_pipe_format(parts)
                    if job_entry.get("position"):
                        job_entries.append(job_entry)
            
            # ===== FORMAT 2: DASH-SEPARATED WITH DATES ON NEXT LINE =====
            elif ('–' in line or '—' in line or 'ÔÇô' in line) and line.count('|') < 3:
                job_entry = ComprehensiveResumeExtractor._parse_dash_format_with_dates(line, lines, i)
                if job_entry.get("position"):
                    job_entries.append(job_entry)
        
        # Set current and previous roles
        for idx, entry in enumerate(job_entries):
            if entry.get("position"):
                if idx == 0:
                    current_role = entry["position"]
                elif idx == 1 and previous_role is None:
                    previous_role = entry["position"]
        
        # Build experience_list in return format
        for entry in job_entries:
            experience_list.append({
                "position": entry.get("position"),
                "company": entry.get("company"),
                "start_date": entry.get("start_date"),
                "end_date": entry.get("end_date"),
            })
        
        return experience_list, current_role, previous_role
    
    @staticmethod
    def _parse_pipe_format(parts: List[str]) -> Dict:
        """
        Parse pipe-separated format.
        Expected format: | Position | Company | Location | [Dates]
        
        Returns dict with position, company, location, start_date, end_date.
        """
        result = {
            "position": None,
            "company": None,
            "location": None,
            "start_date": None,
            "end_date": None,
        }
        
        if len(parts) >= 1:
            result["position"] = parts[0].strip()
        if len(parts) >= 2:
            result["company"] = parts[1].strip()
        if len(parts) >= 3:
            result["location"] = parts[2].strip()
        if len(parts) >= 4:
            # Handle dates in pipe format
            date_str = parts[3].strip()
            # Try to split date range by dash or hyphen
            date_parts = date_str.split('–', 1) if '–' in date_str else date_str.split('-', 1)
            if len(date_parts) >= 1:
                result["start_date"] = date_parts[0].strip()
            if len(date_parts) >= 2:
                result["end_date"] = date_parts[1].strip()
        
        return result
    
    @staticmethod
    def _parse_dash_format_with_dates(line: str, all_lines: List[str], line_index: int) -> Dict:
        """
        Parse dash-separated format with dates potentially on the next line:
        "Position – Company (Location)" or "Position – Company, Location"
        "Jun 2024 – Present"
        """
        position = None
        company = None
        location = None
        start_date = None
        end_date = None
        
        # Split by dash (–) or em dash (—)
        dash_char = '–' if '–' in line else '—' if '—' in line else '-'
        part_parts = line.split(dash_char)
        
        # Check if this line contains dates (like "Jun 2024 – Mar 2023")
        if len(part_parts) == 2 and re.match(r'^\w+\s+\d{4}', part_parts[0].strip()):
            # This is a date line, not a position line - skip it
            return {"position": None}
        
        # Extract position and company from this line
        if len(part_parts) >= 1:
            position = part_parts[0].strip()
        
        if len(part_parts) >= 2:
            remainder = part_parts[1].strip()
            
            # Look for pipe separator (for dates in same line)
            if '|' in remainder:
                company_part, dates_part = remainder.split('|', 1)
                company = company_part.strip()
            else:
                company = remainder
            
            # Extract location from company - try multiple separators
            if company:
                # Try parentheses first: Company (Location)
                if '(' in company and ')' in company:
                    match = re.search(r'\(([^)]+)\)', company)
                    if match:
                        location = match.group(1).strip()
                        company = company[:match.start()].strip()
                
                # If no parentheses, try comma: Company, Location
                if not location and ',' in company:
                    parts = company.split(',', 1)
                    if len(parts) == 2:
                        company = parts[0].strip()
                        location = parts[1].strip()
        
        # Look at next line for dates if not found on current line
        if line_index < len(all_lines):
            next_line = all_lines[line_index].strip()
            # Check if next line looks like a date line
            # Matches: "Jun 2024", "2024", "Jun 2024 – Present", "2023 – Present", etc.
            if re.match(r'^((\w+\s+)?\d{4})', next_line, re.IGNORECASE):
                # This is likely the date line - try to extract dates
                # Handle both "Month Year – Month Year" and "Year – Year" formats
                date_parts = next_line.split('–', 1)
                if len(date_parts) == 1:
                    date_parts = next_line.split('-', 1)
                if len(date_parts) == 1:
                    # Try the corrupted dash format
                    date_parts = next_line.split('ÔÇô', 1)
                
                if len(date_parts) >= 1:
                    start_date = date_parts[0].strip()
                if len(date_parts) >= 2:
                    end_date = date_parts[1].strip()
        
        return {
            "position": position,
            "company": company,
            "location": location,
            "start_date": start_date,
            "end_date": end_date,
        }
    
    @staticmethod
    def extract_skills(text: str, experience_band: str = "mid") -> List[str]:
        """Extract skills from resume and include suggested skills for the band."""
        extracted_skills = set()
        
        if not text or not isinstance(text, str):
            return []
        
        # Find skills section
        skills_section = ""
        skills_match = re.search(
            r'(?:Technical\s+)?Skills|Core\s+Competencies|Key\s+Skills:(.*?)(?=\n(?:Experience|Projects|Education|Certifications|$))',
            text,
            re.IGNORECASE | re.DOTALL
        )
        
        if skills_match and skills_match.group(1):
            skills_section = skills_match.group(1)
        else:
            skills_section = text  # Fall back to full text
        
        if not isinstance(skills_section, str) or not skills_section:
            skills_section = text
        
        # Extract from keyword matching
        ALL_KEYWORDS = set()
        for band_keywords in ComprehensiveResumeExtractor.SKILL_KEYWORDS.values():
            ALL_KEYWORDS.update(band_keywords)
        
        for keyword in ALL_KEYWORDS:
            if re.search(rf'\b{re.escape(keyword)}\b', skills_section, re.IGNORECASE):
                extracted_skills.add(keyword)
        
        # Get suggested skills for the band (that weren't found but should be suggested)
        suggested_skills = set(ComprehensiveResumeExtractor.SKILL_KEYWORDS.get(experience_band, []))
        suggested_skills -= extracted_skills  # Only suggest what's not already extracted
        
        # Return extracted + some suggested (up to 5 suggestions)
        result = list(extracted_skills)
        result.extend(list(suggested_skills)[:5])
        
        return list(set(result))  # Remove duplicates
    
    @staticmethod
    def extract_career_gaps(text: str, experience_list: List[Dict]) -> Optional[Dict]:
        """Detect career gaps in employment history."""
        if len(experience_list) < 2:
            return None
        
        career_gaps = []
        
        for i in range(len(experience_list) - 1):
            current = experience_list[i]
            next_job = experience_list[i + 1]
            
            # Extract years
            current_end = current.get("end_date", "")
            next_start = next_job.get("start_date", "")
            
            if current_end and next_start and current_end.lower() != "present":
                try:
                    current_year = int(re.search(r'\d{4}', current_end).group())
                    next_year = int(re.search(r'\d{4}', next_start).group())
                    gap = next_year - current_year
                    
                    if gap > 1:
                        career_gaps.append({
                            "period": f"{current_end} to {next_start}",
                            "duration_months": gap * 12
                        })
                except:
                    pass
        
        if career_gaps:
            return {
                "gaps_found": True,
                "gap_details": career_gaps,
                "summary": f"Found {len(career_gaps)} career gap(s)"
            }
        
        return {"gaps_found": False}
    
    @staticmethod
    def extract_certifications(text: str) -> List[Dict[str, Optional[str]]]:
        """
        Extract certifications and credentials.
        Handles various section headers and formats.
        """
        certifications = []
        
        if not text or not isinstance(text, str):
            return certifications
        
        # Find certifications section - handle various headers
        cert_patterns = [
            r'(?:Certifications?|Credentials?|Licenses?|Professional\s+Qualifications?|Certifications?\s+&\s+Technical\s+Skills)\s*:?\s*(?:\n|$)',
        ]
        
        cert_match = None
        for pattern in cert_patterns:
            cert_match = re.search(pattern, text, re.IGNORECASE)
            if cert_match:
                break
        
        if not cert_match:
            return certifications
        
        # Find where the section starts (after the header line)
        cert_start = cert_match.start()
        header_line_end = text.find('\n', cert_start)
        if header_line_end == -1:
            return certifications
        
        # Certifications section starts after the header
        cert_section = text[header_line_end+1:]
        
        # Find where this section ends (at next major section or end of text)
        next_section = re.search(
            r'\n(?:Education|Projects|Skills|Experience|Languages|Awards|Volunteering|Personal|Interests|Languages|Key\s+Achievements)',
            cert_section,
            re.IGNORECASE
        )
        if next_section:
            cert_section = cert_section[:next_section.start()]
        
        lines = cert_section.split('\n')
        
        for line in lines:
            line = line.strip()
            if not line or len(line) < 3:
                continue
            
            # Remove bullet points, numbers, dashes
            original_line = line
            line = re.sub(r'^[•\-\*\d\.\s]+', '', line).strip()
            
            if not line or len(line) < 3:
                continue
            
            # Skip section headers and technical skills lines
            if ':' in line and len(line) < 50 and line.isupper():
                continue
            
            # Skip lines that look like section transitions
            if any(x in line.lower() for x in ['technical', 'languages', 'tools', 'software']):
                continue
            
            cert_entry = {
                "name": None,
                "issuer": None,
                "year": None
            }
            
            # Try multiple separation patterns
            # Pattern 1: "Cert Name – Issuer" or "Cert Name – Issuer (Year)"
            if '–' in line or '—' in line:
                dash_char = '–' if '–' in line else '—'
                parts = line.split(dash_char, 1)
                cert_entry["name"] = parts[0].strip()
                if len(parts) > 1:
                    remainder = parts[1].strip()
                    # Extract year if in parentheses
                    year_match = re.search(r'\((\d{4})\)', remainder)
                    if year_match:
                        cert_entry["year"] = int(year_match.group(1))
                        remainder = remainder[:year_match.start()].strip()
                    cert_entry["issuer"] = remainder if remainder else None
            
            # Pattern 2: "Cert Name | Issuer | Year" (pipe-separated)
            elif '|' in line:
                parts = [p.strip() for p in line.split('|')]
                cert_entry["name"] = parts[0] if parts else None
                if len(parts) > 1:
                    issuer_candidate = parts[1]
                    if re.match(r'^20\d{2}$', issuer_candidate):
                        cert_entry["year"] = int(issuer_candidate)
                    else:
                        cert_entry["issuer"] = issuer_candidate
                if len(parts) > 2 and re.match(r'^\d{4}$', parts[2]):
                    cert_entry["year"] = int(parts[2])
            
            # Pattern 3: "Cert Name - Issuer (Year)" (dash with parentheses)
            elif ' - ' in line:
                parts = line.split(' - ', 1)
                cert_entry["name"] = parts[0].strip()
                if len(parts) > 1:
                    remainder = parts[1].strip()
                    year_match = re.search(r'\((\d{4})\)', remainder)
                    if year_match:
                        cert_entry["year"] = int(year_match.group(1))
                        remainder = remainder[:year_match.start()].strip()
                    cert_entry["issuer"] = remainder if remainder else None
            
            # Pattern 4: Just the certification name
            else:
                cert_entry["name"] = line
            
            # Extract year from anywhere in line if not already found
            if not cert_entry["year"]:
                year_match = re.search(r'(20\d{2}|19\d{2})', original_line)
                if year_match:
                    cert_entry["year"] = int(year_match.group(1))
            
            # Only add if we have a name
            if cert_entry["name"] and len(cert_entry["name"]) > 2:
                # Clean up the name (remove extra spaces, parentheses content if no issuer)
                cert_entry["name"] = cert_entry["name"].strip()
        return certifications
    
    @staticmethod
    def infer_experience_band(years: Optional[int], text: str) -> str:
        """Infer experience band (fresher/mid/senior/leadership) from years and keywords."""
        if not years:
            # Try keyword matching
            text_lower = text.lower()
            if any(kw in text_lower for kw in ['lead', 'director', 'vp', 'head', 'chief']):
                return "leadership"
            elif any(kw in text_lower for kw in ['senior', 'principal', 'architect']):
                return "senior"
            else:
                return "mid"
        
        if years < 2:
            return "fresher"
        elif years < 5:
            return "mid"
        elif years < 10:
            return "senior"
        else:
            return "leadership"
    
    @staticmethod
    def _clean_text_spacing(text: str) -> str:
        """
        Fix common PDF extraction issues with excessive spacing.
        Handles cases where spaces are inserted between every character.
        """
        if not text:
            return text
        
        # Strategy: Target specific patterns that are clearly broken
        
        # Pattern 1: Fix spaced email addresses
        # Match: (char space)+ char @ (char space)+ char . (char space)* char+
        # E.g.: "l k o t i a n 5 2 @ g m a i l . c o m"
        pattern = r'((?:[a-zA-Z0-9]\s+)*[a-zA-Z0-9])\s*@\s*((?:[a-zA-Z0-9]\s+)*[a-zA-Z0-9])\s*\.\s*([a-zA-Z\s]+)'
        
        def fix_email(m):
            local = m.group(1).replace(' ', '')
            domain = m.group(2).replace(' ', '')
            tld = m.group(3).replace(' ', '')
            return f"{local}@{domain}.{tld}"
        
        text = re.sub(pattern, fix_email, text, flags=re.IGNORECASE)
        
        # Pattern 2: Fix spaced phone numbers  
        # Match exactly 10 or 12 digits separated by spaces
        text = re.sub(r'(\d)\s+(\d)\s+(\d)\s+(\d)\s+(\d)\s+(\d)\s+(\d)\s+(\d)\s+(\d)\s+(\d)(?:\s+(\d)\s+(\d))?',
                      lambda m: ''.join([g for g in m.groups() if g]), text)
        
        # Clean up excessive multi-spaces
        text = re.sub(r' {2,}', ' ', text)
        
        return text

    @staticmethod
    def extract_all(text: str) -> Dict:
        """Master extraction method - returns all fields properly mapped."""
        
        # Clean up text formatting issues (e.g., spaces between characters from PDF extraction)
        text = ComprehensiveResumeExtractor._clean_text_spacing(text)
        
        # Extract basic info
        name = ComprehensiveResumeExtractor.extract_name(text)
        contact = ComprehensiveResumeExtractor.extract_contact(text)
        location = ComprehensiveResumeExtractor.extract_location(text)
        years_exp = ComprehensiveResumeExtractor.extract_experience_years(text)
        experience_band = ComprehensiveResumeExtractor.infer_experience_band(years_exp, text)
        
        # Extract structured data
        education_list = ComprehensiveResumeExtractor.extract_education(text)
        experience_list, current_role, previous_role = ComprehensiveResumeExtractor.extract_experience(text)
        certifications = ComprehensiveResumeExtractor.extract_certifications(text)
        skills = ComprehensiveResumeExtractor.extract_skills(text, experience_band)
        career_gaps = ComprehensiveResumeExtractor.extract_career_gaps(text, experience_list)
        
        return {
            # Candidate Profile fields
            "full_name": name,
            "phone_number": contact["phone"],
            "location": location,
            "bio": None,  # Cannot reliably extract without AI
            "current_role": current_role,
            "years_of_experience": years_exp,
            "experience_band": experience_band,
            "skills": skills,
            "major_achievements": None,  # Requires AI analysis
            "education_history": education_list,
            "experience_history": experience_list,
            "certifications": certifications,
            "projects": None,
            "career_gap_report": career_gaps,
            
            # Links
            "links": {
                "linkedin": contact.get("linkedin"),
                "portfolio": contact.get("portfolio"),
                "email": contact.get("email")
            },
            
            # Resume Data specific
            "raw_text": text,  # Include raw text
            "timeline": experience_list,
            "education": education_list,
            "raw_education": json.dumps(education_list),
            "raw_experience": json.dumps(experience_list),
            "raw_skills": skills
        }
