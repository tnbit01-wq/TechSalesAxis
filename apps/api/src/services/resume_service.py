import httpx
import boto3
from botocore.exceptions import ClientError
from pypdf import PdfReader
import io
from src.core.database import SessionLocal
from src.core.config import S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
from src.core.models import CandidateProfile, ResumeData
from sqlalchemy import func
import json
import os
import re
from src.core.config import OPENAI_API_KEY, OPENROUTER_API_KEY
from src.services.comprehensive_extractor import ComprehensiveResumeExtractor
from src.services.enhanced_resume_extractor import EnhancedResumeExtractor, CandidateProfileMapper
from typing import Optional
import logging
import asyncio
import concurrent.futures

logger = logging.getLogger(__name__)

# Optional OCR imports for scanned PDFs
try:
    from pdf2image import convert_from_bytes
    HAS_PDF2IMAGE = True
except ImportError:
    HAS_PDF2IMAGE = False

try:
    import pytesseract
    HAS_TESSERACT = True
except ImportError:
    HAS_TESSERACT = False

# ============================================================================
# HELPER FUNCTIONS FOR POSTPROCESSING PARSED RESUME DATA
# ============================================================================

def _extract_text_from_scanned_pdf(pdf_bytes: bytes) -> str:
    """
    Extract text from scanned/image-based PDFs using OCR.
    Falls back to Tesseract if pdf2image is available.
    
    Returns extracted text, or empty string if OCR not available.
    """
    import sys
    
    if not HAS_PDF2IMAGE or not HAS_TESSERACT:
        msg = f"[OCR] ⚠️  OCR libraries not available (pdf2image: {HAS_PDF2IMAGE}, tesseract: {HAS_TESSERACT})"
        print(msg)
        sys.stdout.flush()
        msg = f"[OCR]    Install with: pip install pdf2image pytesseract"
        print(msg)
        sys.stdout.flush()
        msg = f"[OCR]    Also requires: Tesseract-OCR system package"
        print(msg)
        sys.stdout.flush()
        return ""
    
    try:
        msg = f"[OCR] Starting Tesseract OCR extraction from scanned PDF..."
        print(msg)
        sys.stdout.flush()
        
        # Convert PDF to images
        msg = f"[OCR] Converting PDF pages to images..."
        print(msg)
        sys.stdout.flush()
        
        images = convert_from_bytes(pdf_bytes, dpi=200)
        msg = f"[OCR] Converted {len(images)} pages to images"
        print(msg)
        sys.stdout.flush()
        
        extracted_text = ""
        for i, image in enumerate(images, 1):
            try:
                msg = f"[OCR] Running OCR on page {i}..."
                print(msg)
                sys.stdout.flush()
                
                page_text = pytesseract.image_to_string(image)
                page_len = len(page_text)
                
                msg = f"[OCR] Page {i}: {page_len} chars extracted via OCR"
                print(msg)
                sys.stdout.flush()
                
                extracted_text += f"--- Page {i} (OCR) ---\n{page_text}\n"
            except Exception as e:
                msg = f"[OCR] Page {i} OCR failed: {str(e)}"
                print(msg)
                sys.stdout.flush()
        
        msg = f"[OCR] ✅ OCR extraction complete: {len(extracted_text)} total chars"
        print(msg)
        sys.stdout.flush()
        return extracted_text
        
    except Exception as e:
        msg = f"[OCR] ❌ OCR extraction failed: {str(e)}"
        print(msg)
        sys.stdout.flush()
        import traceback
        traceback.print_exc()
        return ""



    """
    Extract phone number with improved regex for multiple formats:
    - Indian: +91 XXXXX XXXXX, +91-XXXXX-XXXXX, 91XXXXXXXXXX
    - International: +1 (XXX) XXX-XXXX, +44 XXXX XXXXXX
    - Standard 10 digit: XXXXXXXXXX, (XXX) XXX-XXXX
    """
    if not text:
        return None
    
    # Improved regex patterns for various phone formats
    phone_patterns = [
        # International with +91
        r'\+91[\s\-\.]?(\d{5})[\s\-\.]?(\d{5})',  # +91 XXXXX XXXXX
        r'\+91[\s\-]?(\d{10})',                   # +91-XXXXXXXXXX
        r'\+91(\d{10})',                          # +91XXXXXXXXXX
        
        # International other country codes
        r'\+1[\s\-\.]?(\([0-9]{3}\))[\s\-\.]?([0-9]{3})[\s\-\.]?([0-9]{4})',  # +1 (XXX) XXX-XXXX
        r'\+\d{1,3}[\s\-]?(\d{7,12})',            # +{country} {number}
        
        # India without +91 prefix
        r'\b91(\d{10})\b',                        # 91XXXXXXXXXX
        r'\b(\d{10})\b',                          # 10 digit number
        r'\(([0-9]{3})\)[\s\-\.]?([0-9]{3})[\s\-\.]?([0-9]{4})',  # (XXX) XXX-XXXX
    ]
    
    text_lower = text.lower()
    # Look for phone indicators
    if any(keyword in text_lower for keyword in ['phone', 'mobile', 'contact', 'tel', 'whatsapp']):
        # Extract next 100 characters after these keywords
        for keyword in ['phone', 'mobile', 'contact number', 'tel', 'whatsapp']:
            idx = text_lower.find(keyword)
            if idx != -1:
                section = text[idx:idx+150]
                for pattern in phone_patterns:
                    match = re.search(pattern, section)
                    if match:
                        # Extract the number part
                        full_match = match.group(0)
                        # Clean to get just digits
                        digits_only = re.sub(r'\D', '', full_match)
                        if len(digits_only) >= 10:
                            # Return last 10 digits
                            return digits_only[-10:]
    
    # If not found near keywords, search entire text
    for pattern in phone_patterns:
        matches = re.finditer(pattern, text)
        for match in matches:
            full_match = match.group(0)
            digits_only = re.sub(r'\D', '', full_match)
            if len(digits_only) >= 10:
                return digits_only[-10:]  # Return last 10 digits
    
    return None


def _categorize_role(current_role: str, skills: list) -> tuple[str, bool]:
    """
    Categorize a role into: TECH_CORE, TECH_SALES, TECH_ADJACENT, AMBIGUOUS, or NON_TECH
    Returns: (category, should_count_experience)
    
    For a Tech Sales platform:
    - TECH_CORE: Software, Data, Cloud, DevOps roles → COUNT 100%
    - TECH_SALES: Sales Engineer, Account Exec, Pre-Sales, Solutions → COUNT 100%
    - TECH_ADJACENT: Product, Operations, Management in tech → COUNT 100%
    - AMBIGUOUS: Could be tech or non-tech → Check skills
    - NON_TECH: Teaching, HR, Accounting, Retail → COUNT 0%
    """
    role_lower = (current_role or '').lower().strip()
    skills_lower = ' '.join([s.lower() for s in (skills or [])]) if skills else ''
    
    # CATEGORY 1: PURE NON-TECH (definitively not relevant)
    NON_TECH_ROLES = {
        'teacher', 'professor', 'lecturer', 'instructor', 'academic', 'education',
        'hr', 'human resources', 'recruiter', 'recruitment',
        'accountant', 'accounting', 'bookkeeper', 'finance manager', 'cfo',
        'school', 'university', 'college student',
        'retail', 'store manager', 'cashier', 'merchandise',
        'secretary', 'receptionist', 'general admin',
        'call center', 'customer support representative'
    }
    
    # CATEGORY 2: TECH CORE (direct IT/Development/Data)
    TECH_CORE_ROLES = {
        'developer', 'engineer', 'programmer', 'software', 'senior developer',
        'frontend developer', 'backend developer', 'fullstack developer',
        'data scientist', 'data engineer', 'ml engineer', 'ai engineer',
        'devops', 'devops engineer', 'sre', 'systems engineer',
        'qa', 'quality assurance', 'test automation',
        'cloud engineer', 'cloud architect', 'infrastructure engineer',
        'database', 'dba', 'database admin', 'sql developer',
        'tech lead', 'engineering manager', 'cto'
    }
    
    # CATEGORY 3: TECH SALES (sales in tech context)
    TECH_SALES_ROLES = {
        'sales engineer', 'pre-sales', 'presales',
        'account executive', 'account manager', 'account director',
        'solutions architect', 'solutions engineer', 'solutions consultant',
        'business development', 'business development manager',
        'enterprise account', 'strategic account', 'key account',
        'sales manager', 'sales director', 'vp sales',
        'sales representative', 'account representative'  # in tech context
    }
    
    # CATEGORY 4: TECH ADJACENT (operations, product, management in tech)
    TECH_ADJACENT_ROLES = {
        'product manager', 'product lead', 'pm',
        'operations', 'ops manager', 'systems operations',
        'technical manager', 'tech manager', 'it manager',
        'program manager', 'project manager', 'scrum master',
        'analyst', 'systems analyst', 'business analyst',
        'consultant', 'technical consultant', 'consultancy'
    }
    
    # CATEGORY 5: AMBIGUOUS (could be tech or non-tech - need context from skills)
    AMBIGUOUS_ROLES = {
        'manager', 'director', 'executive',
        'associate', 'specialist', 'officer',
        'coordinator', 'supervisor',
        'advisor', 'strategy'
    }
    
    # Check which category the role falls into
    if any(keyword in role_lower for keyword in NON_TECH_ROLES):
        return ('NON_TECH', False)
    
    if any(keyword in role_lower for keyword in TECH_CORE_ROLES):
        return ('TECH_CORE', True)
    
    if any(keyword in role_lower for keyword in TECH_SALES_ROLES):
        return ('TECH_SALES', True)
    
    if any(keyword in role_lower for keyword in TECH_ADJACENT_ROLES):
        return ('TECH_ADJACENT', True)
    
    if any(keyword in role_lower for keyword in AMBIGUOUS_ROLES):
        # For ambiguous roles, check if they have IT skills
        IT_SKILLS = {'python', 'java', 'javascript', 'sql', 'aws', 'azure', 
                     'data', 'analytics', 'ai', 'machine learning', 'cloud', 'devops'}
        has_it_skill = any(skill in skills_lower for skill in IT_SKILLS)
        return ('AMBIGUOUS', has_it_skill)
    
    # Default: If role is empty or doesn't match any category, treat as AMBIGUOUS
    # Check skills to decide
    IT_SKILLS = {'python', 'java', 'javascript', 'sql', 'aws', 'azure', 
                 'data', 'analytics', 'ai', 'machine learning', 'cloud', 'devops'}
    has_it_skill = any(skill in skills_lower for skill in IT_SKILLS)
    return ('AMBIGUOUS', has_it_skill)


def _calculate_it_tech_experience(total_years: int, current_role: str, skills: list, education: list) -> int:
    """
    Calculate years of experience in IT/Tech/Sales domains.
    
    Smart categorization that considers:
    1. Role type (TECH_CORE, TECH_SALES, TECH_ADJACENT, AMBIGUOUS, NON_TECH)
    2. Skills match to determine if ambiguous roles are tech-related
    3. Experience length as context
    
    For a tech sales platform:
    - Keep experience from tech/sales roles
    - Filter only definitively non-tech roles (teaching, HR, finance, retail)
    - Use skills as secondary factor for ambiguous cases
    
    Returns:
    - Years of experience to be counted (0 for non-tech, > 0 for tech-relevant)
    """
    if not current_role:
        # No role provided - check skills
        skills_lower = ' '.join([s.lower() for s in (skills or [])])
        IT_SKILLS = {'python', 'java', 'javascript', 'sql', 'aws', 'azure', 
                     'data', 'analytics', 'ai', 'machine learning', 'cloud', 'devops'}
        has_it_skill = any(skill in skills_lower for skill in IT_SKILLS)
        
        if has_it_skill:
            logger.info(f"No role provided but has IT skills - Counting {total_years} years")
            return total_years
        else:
            logger.info(f"No role and no IT skills - Filtering to 0 years")
            return 0
    
    category, should_count = _categorize_role(current_role, skills)
    
    # Decision logic based on category
    if category == 'NON_TECH':
        logger.info(f"NON_TECH role: '{current_role}' - Experience filtered to 0")
        return 0
    
    if category == 'TECH_CORE':
        logger.info(f"TECH_CORE role: '{current_role}' - Counting full {total_years} years")
        return total_years
    
    if category == 'TECH_SALES':
        logger.info(f"TECH_SALES role: '{current_role}' - Counting full {total_years} years")
        return total_years
    
    if category == 'TECH_ADJACENT':
        logger.info(f"TECH_ADJACENT role: '{current_role}' - Counting full {total_years} years")
        return total_years
    
    if category == 'AMBIGUOUS':
        if should_count:
            # Has IT skills - it's likely tech-related
            logger.info(f"AMBIGUOUS role: '{current_role}' with IT skills - Counting {total_years} years")
            return total_years
        else:
            # No IT skills - probably non-tech but ambiguous role
            logger.info(f"AMBIGUOUS role: '{current_role}' without IT skills - Filtering to 0")
            return 0
    
    # Fallback (shouldn't reach here)
    logger.info(f"Unknown category for '{current_role}' - Counting {total_years} years")
    return total_years


def _extract_phone_number(text: str) -> Optional[str]:
    """
    Extract phone number with improved regex for multiple formats:
    - Indian: +91 XXXXX XXXXX, +91-XXXXX-XXXXX, 91XXXXXXXXXX
    - International: +1 (XXX) XXX-XXXX, +44 XXXX XXXXXX
    - Standard 10 digit: XXXXXXXXXX, (XXX) XXX-XXXX
    """
    if not text:
        return None
    
    # Improved regex patterns for various phone formats
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
                section = text[idx:idx+150]
                for pattern in phone_patterns:
                    match = re.search(pattern, section)
                    if match:
                        full_match = match.group(0)
                        digits_only = re.sub(r'\D', '', full_match)
                        if len(digits_only) >= 10:
                            return digits_only[-10:]
    
    for pattern in phone_patterns:
        matches = re.finditer(pattern, text)
        for match in matches:
            full_match = match.group(0)
            digits_only = re.sub(r'\D', '', full_match)
            if len(digits_only) >= 10:
                return digits_only[-10:]
    
    return None


def _postprocess_parsed_data(parsed_data: dict, raw_text: str) -> dict:
    """
    Apply all postprocessing fixes to parsed resume data.
    Fixes applied:
    1. Ensure years_of_experience is present
    2. Extract phone number with improved regex
    3. Filter experience by IT/Tech domain
    """
    # FIX 1: Ensure years_of_experience is in the parsed data
    if "years_of_experience" not in parsed_data or parsed_data["years_of_experience"] is None:
        # Try to calculate from relevant_years_experience or experience_band
        relevant_years = parsed_data.get("relevant_years_experience")
        if relevant_years and isinstance(relevant_years, (int, str)):
            try:
                parsed_data["years_of_experience"] = int(relevant_years) if isinstance(relevant_years, str) else relevant_years
            except:
                parsed_data["years_of_experience"] = 0
        else:
            parsed_data["years_of_experience"] = 0
    
    # FIX 2: Extract phone number with improved regex
    extracted_phone = _extract_phone_number(raw_text)
    if extracted_phone and (not parsed_data.get("phone") or len(str(parsed_data.get("phone") or "")) < 10):
        parsed_data["phone"] = extracted_phone
        logger.info(f"Phone extracted from raw text: {extracted_phone}")
    
    # FIX 3: Filter experience by IT/Tech domain
    total_years = parsed_data.get("years_of_experience", 0)
    current_role = parsed_data.get("current_role") or parsed_data.get("title") or ""
    skills = parsed_data.get("skills", [])
    if isinstance(skills, dict):
        skills = skills.get("technical", []) + skills.get("soft", []) + skills.get("tools", [])
    education = parsed_data.get("education", []) or []
    
    if total_years and isinstance(total_years, (int, str)):
        try:
            total_years = int(total_years)
            filtered_years = _calculate_it_tech_experience(total_years, current_role, skills, education)
            parsed_data["years_of_experience"] = filtered_years
            logger.info(f"Experience filtered: {total_years} years → {filtered_years} years")
        except:
            pass
    
    return parsed_data


class ResumeService:
    @staticmethod
    async def parse_resume(user_id: str, resume_path: str):
        import time
        overall_start = time.time()
        
        # 0. Check for OpenAI Key (Primary)
        openai_key = OPENAI_API_KEY

        # 0.5 VALIDATE AWS CREDENTIALS ARE CONFIGURED
        if not AWS_ACCESS_KEY_ID or not AWS_SECRET_ACCESS_KEY:
            msg = f"⚠️ [RESUME PARSING] AWS credentials not configured. AWS_ACCESS_KEY_ID={bool(AWS_ACCESS_KEY_ID)}, AWS_SECRET_ACCESS_KEY={bool(AWS_SECRET_ACCESS_KEY)}"
            print(msg)
            logger.warning(msg)
            # Continue anyway - S3 will fail gracefully below

        # 1. Download file from AWS S3
        file_res = None
        s3_error = None
        try:
            s3_client = boto3.client(
                's3',
                aws_access_key_id=AWS_ACCESS_KEY_ID,
                aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
                region_name=AWS_REGION
            )
            response = s3_client.get_object(Bucket=S3_BUCKET_NAME, Key=resume_path)
            file_res = response['Body'].read()
            logger.info(f"✅ Successfully downloaded resume from S3: {resume_path} ({len(file_res)} bytes)")
        except ClientError as e:
            s3_error = f"S3 download error (ClientError): {str(e)}"
            logger.error(s3_error)
            print(s3_error)
        except Exception as e:
            s3_error = f"S3 download error (General): {str(e)}"
            logger.error(s3_error)
            print(s3_error)
        
        # If S3 failed completely, return error with details
        if not file_res:
            error_msg = f"Resume download failed from S3. {s3_error}. Check AWS credentials and S3 bucket configuration."
            print(f"❌ [RESUME PARSING] {error_msg}")
            logger.error(error_msg)
            return {"error": "Storage download failed", "details": error_msg}
            
        # 2. Extract text
        import sys
        try:
            msg = f"\n[PDF EXTRACTION] Starting PDF text extraction..."
            print(msg)
            sys.stdout.flush()
            
            msg = f"[PDF EXTRACTION] PDF file size: {len(file_res)} bytes"
            print(msg)
            sys.stdout.flush()
            
            reader = PdfReader(io.BytesIO(file_res))
            msg = f"[PDF EXTRACTION] Total pages found: {len(reader.pages)}"
            print(msg)
            sys.stdout.flush()
            
            text = ""
            total_extracted = 0
            
            for i, page in enumerate(reader.pages):
                try:
                    page_text = page.extract_text(extraction_mode="layout") or ""
                except Exception as inner_e:
                    msg = f"[PDF EXTRACTION] Page {i+1}: extraction_mode='layout' failed, trying default mode: {str(inner_e)}"
                    print(msg)
                    sys.stdout.flush()
                    page_text = page.extract_text() or ""
                
                page_len = len(page_text)
                total_extracted += page_len
                msg = f"[PDF EXTRACTION] Page {i+1}: {page_len} chars extracted"
                print(msg)
                sys.stdout.flush()
                
                if page_len < 100:
                    preview = page_text[:100].replace('\n', '\\n')
                    msg = f"[PDF EXTRACTION]   Content preview: '{preview}'"
                    print(msg)
                    sys.stdout.flush()
                
                text += f"--- Page {i+1} ---\n{page_text}\n"
            
            # Before cleanup
            text_before = len(text)
            msg = f"[PDF EXTRACTION]   Before cleanup: {text_before} chars"
            print(msg)
            sys.stdout.flush()
            
            text = text.strip()
            import re
            text = re.sub(r'[ \t]+', ' ', text)
            text = re.sub(r'\n\s*\n', '\n\n', text)
            text_after = len(text)
            
            msg = f"[PDF EXTRACTION] ✅ Text extraction complete"
            print(msg)
            sys.stdout.flush()
            
            msg = f"[PDF EXTRACTION]   After cleanup: {text_after} chars"
            print(msg)
            sys.stdout.flush()
            
            # Check if PDF is scanned/image-based (0 chars extracted from all pages)
            if total_extracted == 0:
                msg = f"[PDF EXTRACTION] ⚠️  WARNING: No text extracted from any page - PDF appears to be scanned/image-based"
                print(msg)
                sys.stdout.flush()
                
                msg = f"[PDF EXTRACTION] Attempting OCR extraction as fallback..."
                print(msg)
                sys.stdout.flush()
                
                ocr_text = _extract_text_from_scanned_pdf(file_res)
                if ocr_text and len(ocr_text) > 50:
                    msg = f"[PDF EXTRACTION] ✅ OCR succeeded! Using OCR text instead ({len(ocr_text)} chars)"
                    print(msg)
                    sys.stdout.flush()
                    text = ocr_text
                else:
                    msg = f"[PDF EXTRACTION] ❌ OCR failed or returned insufficient text"
                    print(msg)
                    sys.stdout.flush()
                    msg = f"[PDF EXTRACTION]    This resume cannot be parsed automatically"
                    print(msg)
                    sys.stdout.flush()
                    text += "\n[Notice: This is a scanned PDF and cannot be parsed automatically. Please upload a digital resume.]"
            elif text_after < 50:
                msg = f"[PDF EXTRACTION] ⚠️  WARNING: Very short text extracted ({text_after} chars)"
                print(msg)
                sys.stdout.flush()
                msg = f"[PDF EXTRACTION]   This might be a scanned PDF or image-based resume"
                print(msg)
                sys.stdout.flush()
                text += "\n[Warning: Layout is highly graphical or scanned.]"
                
        except Exception as e:
            msg = f"[PDF EXTRACTION] ❌ PDF ERROR: {str(e)}"
            print(msg)
            sys.stdout.flush()
            import traceback
            traceback.print_exc()
            sys.stdout.flush()
            return {"error": f"PDF extraction failed: {str(e)}"}

        msg = f"[PDF EXTRACTION] Final text length being sent to AI: {len(text)} chars\n"
        print(msg)
        sys.stdout.flush()
        
        # CRITICAL CHECK: If extracted text is too short, the PDF is likely scanned/image-based
        if len(text) < 200:
            error_msg = (
                f"\n[PDF EXTRACTION] ⚠️  CRITICAL: Resume is image-based (scanned PDF)\n"
                f"- Extracted text: {len(text)} chars (minimum required: 200)\n"
                f"- Resume: {resume_path}\n"
                f"SOLUTION: Upload text-based PDF or Word document\n"
            )
            print(error_msg)
            logger.error(error_msg)
            return {
                "error": "Scanned PDF - cannot extract text",
                "details": "Resume is an image-based PDF. Please upload a text-based PDF or Word document.",
                "extracted_chars": len(text),
                "required_minimum": 200
            }
        
        await ResumeService._store_initial_text(user_id, text)

        # 3. High-Fidelity Path: OpenAI (New Primary) - WITH ENHANCED SCHEMA FOR 100% FIELD COVERAGE
        if openai_key:
            try:
                print(f"\n{'='*80}")
                print(f"[OPENAI PARSING] Starting OpenAI GPT-4o parsing...")
                print(f"[OPENAI PARSING] API Key configured: YES (length: {len(openai_key)})")
                print(f"[OPENAI PARSING] Resume text length: {len(text)} chars")
                print(f"{'='*80}\n")
                
                async with httpx.AsyncClient(timeout=45.0) as client:
                    # Use enhanced prompt with comprehensive schema (35+ fields)
                    prompt = EnhancedResumeExtractor.compile_ai_prompt(text)
                    
                    print(f"[OPENAI PARSING] Prompt length: {len(prompt)} chars")
                    print(f"[OPENAI PARSING] Sending request to OpenAI...\n")
                    
                    response = await client.post(
                        "https://api.openai.com/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {openai_key}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "model": "gpt-4o",
                            "messages": [
                                {"role": "system", "content": "You are a professional recruitment AI specializing in resume parsing. Return ONLY valid JSON with all fields. For missing data, use null."},
                                {"role": "user", "content": prompt}
                            ],
                            "response_format": { "type": "json_object" },
                            "temperature": 0.2
                        }
                    )
                    
                    print(f"[OPENAI PARSING] Response status: {response.status_code}")
                    
                    if response.status_code == 200:
                        print(f"[OPENAI PARSING] ✅ Got response code 200")
                        response_json = response.json()
                        
                        if 'choices' in response_json and response_json['choices']:
                            parsed_data_str = response_json['choices'][0]['message']['content']
                            print(f"[OPENAI PARSING] Raw response (first 800 chars):\n{parsed_data_str[:800]}\n")
                            
                            parsed_data = json.loads(parsed_data_str)
                            print(f"[OPENAI PARSING] Parsed JSON successfully")
                            print(f"[OPENAI PARSING] JSON keys: {list(parsed_data.keys())}")
                            print(f"[OPENAI PARSING] Sample extracted fields:")
                            for key in ['full_name', 'current_role', 'years_of_experience', 'skills', 'education_history', 'experience_history']:
                                val = parsed_data.get(key)
                                if val is None:
                                    print(f"  - {key}: NULL")
                                elif isinstance(val, list):
                                    print(f"  - {key}: [list with {len(val)} items] {str(val)[:60]}...")
                                elif isinstance(val, dict):
                                    print(f"  - {key}: [dict] {str(val)[:60]}...")
                                else:
                                    print(f"  - {key}: {str(val)[:80]}")
                            print(f"\n[OPENAI PARSING] ✅ Successfully parsed resume from OpenAI\n")
                            print(f"{'='*80}\n")
                            
                            parsed_data = _postprocess_parsed_data(parsed_data, text)
                            await ResumeService._store_data(user_id, text, parsed_data)
                            return parsed_data
                        else:
                            print(f"[OPENAI PARSING] ❌ No choices in response: {response_json}\n")
                    else:
                        error_detail = response.text if response.text else f"Status {response.status_code}"
                        print(f"[OPENAI PARSING] ❌ Failed: {error_detail}\n")
                        print(f"{'='*80}\n")
                        
            except Exception as oai_err:
                print(f"\n[OPENAI PARSING] ❌ Exception occurred:")
                print(f"[OPENAI PARSING] Error type: {type(oai_err).__name__}")
                print(f"[OPENAI PARSING] Error message: {str(oai_err)}")
                import traceback
                traceback.print_exc()
                print(f"[OPENAI PARSING] Falling back to next parser...\n")
                print(f"{'='*80}\n")

        # 4. Fallback Path: Groq/OpenRouter
        print(f"\n{'='*80}")
        print(f"[FALLBACK PARSING] Trying Groq/OpenRouter...")
        groq_key = os.getenv("GROQ_API_KEY")
        if (groq_key and len(groq_key) > 5) or (OPENROUTER_API_KEY and len(OPENROUTER_API_KEY) > 5):
            print(f"[FALLBACK PARSING] Groq key: {'YES' if groq_key else 'NO'}")
            print(f"[FALLBACK PARSING] OpenRouter key: {'YES' if OPENROUTER_API_KEY else 'NO'}")
            try:
                # Create a detailed fallback prompt similar to OpenAI's
                fallback_prompt = f"""Extract resume data as valid JSON. Return ONLY the JSON object with these fields:
{{
  "full_name": "string",
  "email": "string or null",
  "phone": "string or null",
  "location": "string or null",
  "location_tier": "metro|tier1|tier2|tier3|rural",
  "current_role": "string or null",
  "years_of_experience": "integer or null",
  "experience_band": "fresher|mid|senior|leadership",
  "primary_industry_focus": "string or null",
  "job_type": "remote|hybrid|onsite",
  "current_employment_status": "Employed|Unemployed|Student",
  "bio": "string (max 500 chars)",
  "major_achievements": "string or null",
  "key_responsibilities": "string or null",
  "target_role": "string or null",
  "long_term_goal": "string or null",
  "graduation_status": "graduated|pursuing",
  "graduation_year": "integer or null",
  "qualification_held": "string or null",
  "skills": ["string"],
  "career_interests": ["string"],
  "education_history": [{{"degree": "string", "institution": "string", "year": "integer or null"}}],
  "experience_history": [{{"position": "string", "company": "string", "duration": "string", "start_date": "string", "end_date": "string"}}],
  "certifications": ["string"],
  "projects": [{{"name": "string", "description": "string"}}],
  "career_gap_report": {{"gaps_found": boolean, "gap_details": [], "summary": "string or null"}}
}}

Resume text:
{text[:12000]}"""

                if groq_key:
                    # Use thread pool for synchronous Groq client in async function
                    from groq import Groq
                    loop = asyncio.get_event_loop()
                    
                    def groq_call():
                        client = Groq(api_key=groq_key)
                        return client.chat.completions.create(
                            model="llama-3.3-70b-versatile",
                            messages=[{"role": "user", "content": fallback_prompt}],
                            temperature=0.2
                        )
                    
                    completion = await loop.run_in_executor(None, groq_call)
                    parsed_data = json.loads(completion.choices[0].message.content)
                    print(f"[FALLBACK PARSING] ✅ Groq parsing succeeded")
                else:
                    # OpenRouter (async)
                    async with httpx.AsyncClient(timeout=45.0) as client:
                        response = await client.post(
                            "https://openrouter.ai/api/v1/chat/completions",
                            headers={
                                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                                "Content-Type": "application/json"
                            },
                            json={
                                "model": "meta-llama/llama-3.3-70b-instruct",
                                "messages": [{"role": "user", "content": fallback_prompt}],
                                "temperature": 0.2
                            }
                        )
                        
                        if response.status_code == 200:
                            content = response.json()['choices'][0]['message']['content']
                            parsed_data = json.loads(content.strip())
                            print(f"[FALLBACK PARSING] ✅ OpenRouter parsing succeeded")
                        else:
                            print(f"[FALLBACK PARSING] ❌ OpenRouter failed with status {response.status_code}")
                            raise Exception(f"OpenRouter status: {response.status_code}")
                
                parsed_data = _postprocess_parsed_data(parsed_data, text)
                await ResumeService._store_data(user_id, text, parsed_data)
                print(f"{'='*80}\n")
                return parsed_data
            except Exception as e:
                print(f"[FALLBACK PARSING] ❌ Groq/OpenRouter failed: {type(e).__name__}: {str(e)}")
                import traceback
                traceback.print_exc()
                print(f"{'='*80}\n")

        # 5. Final Fallback: Comprehensive NLP-based extraction when all AI APIs fail
        print(f"[FALLBACK PARSING] All AI APIs failed. Using NLP extraction...")
        print(f"{'='*80}\n")
        parsed_data = ComprehensiveResumeExtractor.extract_all(text)
        parsed_data = _postprocess_parsed_data(parsed_data, text)
        await ResumeService._store_data(user_id, text, parsed_data)
        return parsed_data

    @staticmethod
    async def _store_initial_text(user_id: str, text: str):
        db = SessionLocal()
        try:
            # PostgreSQL hack: remove NUL characters (0x00) which are not allowed in string literals
            if text and "\x00" in text:
                text = text.replace("\x00", "")
                
            resume = db.query(ResumeData).filter(ResumeData.user_id == user_id).first()
            if resume:
                resume.raw_text = text[:30000]
            else:
                resume = ResumeData(user_id=user_id, raw_text=text[:30000])
                db.add(resume)
            db.commit()
        except Exception as e:
            print(f"Error storing initial text: {e}")
            db.rollback()
        finally:
            db.close()

    @staticmethod
    async def _store_data(user_id: str, text: str, parsed_data: dict):
        """
        ENHANCED: Store resume data with 100% field coverage
        Uses CandidateProfileMapper to populate ALL candidate_profiles columns
        """
        db = SessionLocal()
        try:
            # PostgreSQL hack: remove NUL characters (0x00) which are not allowed in string literals
            if text and "\x00" in text:
                text = text.replace("\x00", "")
            
            # Recursively remove NUL characters from parsed_data dict/list
            def _clean_nul(obj):
                if isinstance(obj, str):
                    return obj.replace("\x00", "")
                elif isinstance(obj, dict):
                    return {k: _clean_nul(v) for k, v in obj.items()}
                elif isinstance(obj, list):
                    return [_clean_nul(i) for i in obj]
                return obj
            
            parsed_data = _clean_nul(parsed_data)
            
            # ===== ENHANCED: Use CandidateProfileMapper for ALL field mapping =====
            # This maps 35+ fields automatically instead of manual assignment
            profile_updates = CandidateProfileMapper.map_to_profile(parsed_data)
            
            print(f"\n[PROFILE UPDATE] Mapped {len(profile_updates)} fields:")
            for key, val in profile_updates.items():
                val_type = type(val).__name__
                # Show truncated value for debugging
                if isinstance(val, (list, dict)):
                    val_preview = str(val)[:80] + "..." if len(str(val)) > 80 else str(val)
                else:
                    val_preview = str(val)[:80]
                print(f"  - {key} ({val_type}): {val_preview}")
            print()
            
            
            # ===== Handle additional AI-extracted field enhancements =====
            extracted_skills = []
            skills_raw = parsed_data.get("skills") or []
            
            if isinstance(skills_raw, list):
                extracted_skills = [str(s) for s in skills_raw if s]
            elif isinstance(skills_raw, dict):
                # Handle nested skills structure {technical, soft, tools}  
                for k in ["technical", "soft", "tools"]:
                    val = skills_raw.get(k)
                    if isinstance(val, list):
                        extracted_skills.extend([str(v) for v in val if v])
            
            # Clean and deduplicate skills
            extracted_skills = list(set([str(s).strip().title() for s in extracted_skills if s]))
            profile_updates["skills"] = extracted_skills
            
            # ===== APPLY ALL UPDATES TO CANDIDATE PROFILE =====
            profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
            if profile:
                # Apply all mapped field updates
                for key, value in profile_updates.items():
                    if hasattr(profile, key) and value is not None:
                        setattr(profile, key, value)
                        print(f"✓ Updated profile.{key}")
                
                print(f"✅ Updated CandidateProfile with {len(profile_updates)} fields")
            
            # ===== STORE RAW RESUME DATA IN resume_data TABLE =====
            def _get_json_field(data, keys):
                """Safely extract JSON field handling both list and stringified formats"""
                for k in keys:
                    val = data.get(k)
                    if val:
                        if isinstance(val, str):
                            try:
                                return json.loads(val)
                            except:
                                continue
                        return val
                return []
            
            resume = db.query(ResumeData).filter(ResumeData.user_id == user_id).first()
            
            education_history = _get_json_field(parsed_data, ["education_history", "education"])
            experience_history = _get_json_field(parsed_data, ["experience_history", "timeline"])
            projects = _get_json_field(parsed_data, ["projects"])
            career_gaps = _get_json_field(parsed_data, ["career_gap_report"])
            
            if resume:
                resume.raw_text = text[:30000]
                resume.raw_education = education_history
                resume.raw_experience = experience_history
                resume.raw_projects = projects
                resume.timeline = experience_history
                resume.education = education_history
                resume.career_gaps = career_gaps
                resume.skills = extracted_skills
                resume.achievements = parsed_data.get("major_achievements")
                resume.parsed_at = func.now()
            else:
                resume = ResumeData(
                    user_id=user_id,
                    raw_text=text[:30000],
                    raw_education=education_history,
                    raw_experience=experience_history,
                    raw_projects=projects,
                    timeline=experience_history,
                    education=education_history,
                    career_gaps=career_gaps,
                    skills=extracted_skills,
                    achievements=parsed_data.get("major_achievements"),
                    parsed_at=func.now()
                )
                db.add(resume)
            
            print(f"✓ ResumeData stored for user {user_id}")
            
            db.commit()
            print(f"✅ All resume data committed successfully")
            
            # ===== SYNC SKILLS TO CATALOG =====
            if extracted_skills and profile:
                await ResumeService._sync_to_skill_catalog(extracted_skills, profile.experience)
                
        except Exception as e:
            print(f"❌ Error storing data: {e}")
            import traceback
            traceback.print_exc()
            db.rollback()
        finally:
            db.close()


    @staticmethod
    async def _sync_to_skill_catalog(skills: list, band: str = "mid"):
        """
        Sync extracted skills to skill_catalog (case-sensitive).
        Skills are stored with exact casing and experience band for discovery.
        """
        if not skills: 
            return
            
        # Standardize band
        valid_bands = ["fresher", "mid", "senior", "leadership"]
        band = str(band).lower() if str(band).lower() in valid_bands else "mid"
        
        db = SessionLocal()
        try:
            from src.core.models import SkillCatalog
            from sqlalchemy import func
            
            skill_count = 0
            for skill_name in skills:
                name = str(skill_name).strip()
                if not name or len(name) < 2 or len(name) > 100: 
                    continue
                
                # Check if exists for this band (case-sensitive)
                existing = db.query(SkillCatalog).filter(
                    SkillCatalog.name == name,
                    SkillCatalog.experience_band == band
                ).first()
                
                if existing:
                    existing.last_seen_at = func.now()
                else:
                    new_skill = SkillCatalog(
                        name=name,  # Preserves exact casing
                        experience_band=band,
                        last_seen_at=func.now()
                    )
                    db.add(new_skill)
                skill_count += 1
            
            db.commit()
            print(f"DEBUG: Synced {skill_count} skills to catalog for band: {band}")
        except Exception as e:
            print(f"CRITICAL: Skill catalog sync failed: {e}")
            db.rollback()
        finally:
            db.close()
    
    @staticmethod
    def parse_resume_sync(user_id: str, resume_path: str):
        """
        Synchronous wrapper for parse_resume() for use with BackgroundTasks
        Handles async execution safely in a thread pool context
        """
        print(f"\n{'='*60}")
        print(f"[RESUME PARSING] Starting background task for user: {user_id}")
        print(f"[RESUME PARSING] Resume path: {resume_path}")
        print(f"{'='*60}\n")
        
        try:
            # BackgroundTasks runs in thread pool, so we can safely create event loop
            try:
                # Try to get existing event loop (might exist in thread)
                loop = asyncio.get_event_loop()
                print(f"[RESUME PARSING] Found existing event loop: {loop}")
            except RuntimeError as e:
                # No event loop in this thread, create new one
                print(f"[RESUME PARSING] No event loop found, creating new one: {e}")
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                print(f"[RESUME PARSING] Created new event loop: {loop}")
            
            # Run parsing in the event loop
            if loop.is_running():
                print(f"[RESUME PARSING] Event loop is already running, using ThreadPoolExecutor")
                # If loop already running, schedule as task (shouldn't happen in BackgroundTasks)
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(asyncio.run, 
                        ResumeService.parse_resume(user_id, resume_path))
                    result = future.result()
            else:
                print(f"[RESUME PARSING] Event loop is not running, using run_until_complete")
                # Normal case: loop exists but not running, use run_until_complete
                result = loop.run_until_complete(
                    ResumeService.parse_resume(user_id, resume_path)
                )
            
            print(f"\n[RESUME PARSING] ✅ Resume parsing completed for user {user_id}")
            print(f"[RESUME PARSING] Result keys: {result.keys() if isinstance(result, dict) else 'Not a dict'}")
            print(f"{'='*60}\n")
            return result
            
        except Exception as e:
            print(f"\n[RESUME PARSING] ❌ Resume parsing error for user {user_id}")
            print(f"[RESUME PARSING] Error type: {type(e).__name__}")
            print(f"[RESUME PARSING] Error message: {str(e)}")
            import traceback
            traceback.print_exc()
            logger.error(f"Resume parsing failed for user {user_id}: {str(e)}", exc_info=True)
            print(f"{'='*60}\n")
            
            # Log error attempt (if profile field exists)
            try:
                db = SessionLocal()
                profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
                if profile and hasattr(profile, 'parsing_error_details'):
                    # If the model has an error field, use it
                    profile.parsing_error_details = {"error": str(e)}
                    db.commit()
                    print(f"[RESUME PARSING] Error logged to database")
            except Exception as db_err:
                print(f"[RESUME PARSING] Failed to log error to DB: {db_err}")
                logger.warning(f"Could not update profile error field: {db_err}")
            
            return {"error": f"Resume parsing failed: {str(e)}"}
