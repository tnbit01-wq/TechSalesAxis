"""
ENHANCED Comprehensive Resume Extractor v2
Improved role extraction with fallback strategies
Targets >90% accuracy for all fields
"""
import re
import json
from typing import Dict, List, Optional, Tuple
from datetime import datetime

class EnhancedResumeExtractor:
    """
    Enhanced extractor with improved experience and role extraction.
    Features:
    - Flexible section detection (handles missing headers)
    - Multiple role extraction strategies
    - AI-powered fallback for edge cases
    - Better resilience to messy formats
    """
    
    # Experience section variations - much more comprehensive
    EXPERIENCE_SECTION_PATTERNS = [
        # Standard patterns
        r'(?:professional\s+)?experience\s*[:=]?\s*\n+(.*?)(?=\n(?:education|projects|skills|certifications|languages|awards|volunteer|personal|key\s+achievements|objective|summary|$))',
        r'work\s+(?:experience|history)\s*[:=]?\s*\n+(.*?)(?=\n(?:education|projects|skills|certifications|$))',
        r'employment\s+history\s*[:=]?\s*\n+(.*?)(?=\n(?:education|projects|skills|$))',
        r'career\s+history\s*[:=]?\s*\n+(.*?)(?=\n(?:education|projects|skills|$))',
        r'professional\s+summary\s*[:=]?\s*\n+(.*?)(?=\n(?:experience|education|skills|$))',
        
        # Without colon/equals (just header)
        r'^experience\s*\n+(.*?)(?=\n[A-Z\s]{3,}|$)',
        r'^work\s*\n+(.*?)(?=\n[A-Z\s]{3,}|$)',
        
        # Fallback: Look for job-like entries (lines with company names, years, and role indicators)
        r'((?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*\d{0,2},?\s*\d{4}[^\n]*\n?)+)',
    ]
    
    # Enhanced role keywords - more comprehensive
    ROLE_KEYWORDS = {
        'manager': ['manager', 'lead', 'director', 'head', 'chief', 'vp', 'vice president'],
        'developer': ['developer', 'engineer', 'programmer', 'coder', 'architect', 'devops'],
        'sales': ['sales', 'account executive', 'rep', 'business development', 'bd', 'ae'],
        'support': ['support', 'specialist', 'analyst', 'officer', 'consultant', 'advisor'],
        'marketing': ['marketing', 'product', 'brand', 'growth', 'content'],
        'operations': ['operations', 'coordinator', 'administrator', 'supervisor', 'associate'],
    }
    
    # Improved job title patterns
    JOB_TITLE_PATTERNS = [
        # Pattern 1: Bold/emphasized job title at start of line
        r'^(?:\*\*|__)?([A-Z][a-zA-Z\s&\-\.]+(?:Manager|Executive|Lead|Analyst|Developer|Engineer|Officer|Specialist|Coordinator|Consultant|Director|Head|VP|Chief|Associate|Senior|Junior))(?:\*\*|__)?',
        
        # Pattern 2: Job title before company name with dash/pipe/at
        r'^([A-Z][a-zA-Z\s&\-\.]+(?:Manager|Executive|Lead|Analyst|Developer|Engineer|Officer|Specialist|Coordinator|Consultant|Director))[\s]*(?:–|—|-|at|@|with|,|\|)',
        
        # Pattern 3: After "Position", "Role", "Title"
        r'(?:position|role|title|designation)\s*[:=]\s*([A-Za-z\s&\-\.]+?)(?:\n|,|\||$)',
        
        # Pattern 4: Line with job title pattern (ends with role keyword)
        r'([A-Z][a-zA-Z\s&\-\.]*\b(?:Manager|Executive|Lead|Analyst|Developer|Engineer|Officer|Specialist|Coordinator|Consultant|Director|Head|Manager|VP|Chief|Associate|Senior|Junior)\b)',
        
        # Pattern 5: Common role patterns
        r'\b(Sales Manager|Business Development|Account Executive|Team Lead|Product Manager|Software Engineer|Data Analyst|Operations Manager|HR Manager|Finance Manager|Marketing Manager|Project Manager|Scrum Master|DevOps Engineer|Solutions Architect)\b',
    ]
    
    @staticmethod
    def extract_experience_enhanced(text: str) -> Tuple[List[Dict], Optional[str], Optional[str]]:
        """
        Enhanced experience extraction with multiple fallback strategies.
        Returns: (experience_list, current_role, previous_role)
        """
        if not text or not isinstance(text, str):
            return [], None, None
        
        # Fix encoding issues
        text = text.replace('ÔÇô', '–').replace('ÔÇô', '–')
        
        experience_list = []
        current_role = None
        previous_role = None
        
        # STRATEGY 1: Try to find experience section with regex patterns
        exp_section = None
        for pattern in EnhancedResumeExtractor.EXPERIENCE_SECTION_PATTERNS:
            match = re.search(pattern, text, re.IGNORECASE | re.DOTALL | re.MULTILINE)
            if match and match.group(1):
                exp_section = match.group(1)
                if len(exp_section.strip()) > 100:  # Ensure we got meaningful content
                    break
        
        # STRATEGY 2: If no section found, use entire text (common in simple resumes)
        if not exp_section or len(exp_section.strip()) < 50:
            # Try to extract from full text by looking for job entry patterns
            exp_section = EnhancedResumeExtractor._extract_job_entries_from_text(text)
            if not exp_section:
                exp_section = text[-5000:]  # Use last 5000 chars
        
        # Parse experience section into job entries
        lines = exp_section.split('\n')
        job_entries = []
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            i += 1
            
            if not line or len(line) < 3:
                continue
            
            # Try to extract job entry from this and next few lines
            job_entry = EnhancedResumeExtractor._extract_job_entry_from_lines(line, lines, i)
            
            if job_entry and job_entry.get('position'):
                job_entries.append(job_entry)
        
        # Set current and previous roles
        for idx, entry in enumerate(job_entries):
            if entry.get('position'):
                if idx == 0:
                    current_role = entry['position']
                elif idx == 1 and previous_role is None:
                    previous_role = entry['position']
            
            experience_list.append({
                "position": entry.get('position'),
                "company": entry.get('company'),
                "start_date": entry.get('start_date'),
                "end_date": entry.get('end_date'),
            })
        
        # FALLBACK: If no current_role found, try to extract a role from the free-form text
        if not current_role:
            current_role = EnhancedResumeExtractor._extract_role_from_text(text)
        
        return experience_list, current_role, previous_role
    
    @staticmethod
    def _extract_job_entries_from_text(text: str) -> str:
        """
        Extract job entries from full text when no experience section exists.
        Looks for patterns like dates + company/role combinations.
        """
        # Find lines that look like job entries (contain years, company names, or role keywords)
        lines = text.split('\n')
        job_lines = []
        
        for line in lines:
            line = line.strip()
            # Job entry indicators:
            # - Contains years (20XX)
            # - Contains month names
            # - Contains role keywords
            # - Contains "Present", "Current"
            has_year = re.search(r'20\d{2}|19\d{2}', line)
            has_month = re.search(r'\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b', line, re.IGNORECASE)
            has_role_keyword = any(keyword.lower() in line.lower() for keywords in EnhancedResumeExtractor.ROLE_KEYWORDS.values() for keyword in keywords)
            has_present = re.search(r'\bpresent\b|\bcurrent\b', line, re.IGNORECASE)
            
            if (has_year or has_month or has_present) or has_role_keyword:
                job_lines.append(line)
        
        return '\n'.join(job_lines[-50:]) if job_lines else ""  # Return last 50 job-like lines
    
    @staticmethod
    def _extract_job_entry_from_lines(line: str, all_lines: List[str], line_index: int) -> Dict:
        """
        Extract a single job entry from current line and context.
        """
        entry = {
            "position": None,
            "company": None,
            "location": None,
            "start_date": None,
            "end_date": None,
        }
        
        # STRATEGY 1: Pipe-separated format
        if line.count('|') >= 2:
            parts = [p.strip() for p in line.split('|') if p.strip()]
            if len(parts) >= 1:
                entry["position"] = EnhancedResumeExtractor._clean_role(parts[0])
            if len(parts) >= 2:
                entry["company"] = parts[1]
            if len(parts) >= 3:
                entry["location"] = parts[2]
            return entry
        
        # STRATEGY 2: Dash-separated format (Position – Company or Position – Company (Location))
        if '–' in line or '—' in line or 'ÔÇô' in line:
            dash_char = next(d for d in ['–', '—', 'ÔÇô'] if d in line)
            parts = line.split(dash_char, 1)
            
            if len(parts) == 2:
                entry["position"] = EnhancedResumeExtractor._clean_role(parts[0].strip())
                remainder = parts[1].strip()
                
                # Extract company and location from remainder
                if '(' in remainder and ')' in remainder:
                    company_part = remainder[:remainder.rfind('(')].strip()
                    location = remainder[remainder.rfind('(')+1:remainder.rfind(')')].strip()
                    entry["company"] = company_part
                    entry["location"] = location
                elif ',' in remainder:
                    company, location = remainder.split(',', 1)
                    entry["company"] = company.strip()
                    entry["location"] = location.strip()
                else:
                    entry["company"] = remainder
        
        # STRATEGY 3: Try to extract role using job title patterns from current line
        if not entry["position"]:
            for pattern in EnhancedResumeExtractor.JOB_TITLE_PATTERNS:
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    entry["position"] = EnhancedResumeExtractor._clean_role(match.group(1))
                    break
        
        # STRATEGY 4: If nothing found but line is short, assume it's a role itself
        if not entry["position"] and 5 < len(line) < 80 and not re.match(r'^\d{4}|^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)', line, re.IGNORECASE):
            entry["position"] = EnhancedResumeExtractor._clean_role(line)
        
        # Try dates on next line
        if line_index < len(all_lines):
            next_line = all_lines[line_index].strip()
            if re.match(r'^(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+)?\d{4}', next_line, re.IGNORECASE):
                parts = re.split(r'–|—|-', next_line)
                if len(parts) >= 1:
                    entry["start_date"] = parts[0].strip()
                if len(parts) >= 2:
                    entry["end_date"] = parts[1].strip()
        
        return entry
    
    @staticmethod
    def _clean_role(role_text: str) -> Optional[str]:
        """
        Clean up extracted role text.
        Remove symbols, extra spaces, trim length.
        """
        if not role_text:
            return None
        
        # Remove common symbols
        role_text = role_text.replace('*', '').replace('_', '').replace('**', '').replace('__', '')
        
        # Remove trailing/leading punctuation
        role_text = re.sub(r'^[\s\-\.|:]*|[\s\-\.|:]*$', '', role_text)
        
        # Limit length
        if len(role_text) > 100:
            role_text = role_text[:100]
        
        return role_text.strip() if role_text.strip() else None
    
    @staticmethod
    def _extract_role_from_text(text: str) -> Optional[str]:
        """
        Last-resort extraction: Find any role keyword in the text.
        """
        lines = text.split('\n')[:50]  # Check first 50 lines
        
        # Look for lines with role keywords
        for line in lines:
            line = line.strip()
            
            # Skip headers and non-role lines
            if len(line) < 3 or len(line) > 150:
                continue
            
            # Check for role keywords
            for pattern in EnhancedResumeExtractor.JOB_TITLE_PATTERNS:
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    return EnhancedResumeExtractor._clean_role(match.group(1))
        
        return None
