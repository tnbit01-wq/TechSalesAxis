#!/usr/bin/env python3
"""
Comprehensive analysis of test_01 batch - 50 resumes
Compare extracted data vs created profiles
Identify what's working, what's not, and what's wrong
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.core.database import SessionLocal
from src.core.models import (
    BulkUploadFile, 
    BulkUpload, 
    User, 
    CandidateProfile
)
from datetime import datetime
import json

def analyze_batch():
    """Comprehensive batch analysis"""
    
    with SessionLocal() as db:
        # Get batch
        batch = db.query(BulkUpload).filter(
            BulkUpload.batch_name == 'test_01'
        ).first()
        
        if not batch:
            print("[FAIL] Batch 'test_01' not found!")
            return
        
        print(f"\n{'='*100}")
        print(f"BATCH ANALYSIS: test_01")
        print(f"{'='*100}")
        print(f"Batch ID: {batch.id}")
        print(f"Upload Status: {batch.upload_status}")
        print(f"Total Files: {batch.total_files_uploaded}")
        print(f"Successfully Parsed: {batch.successfully_parsed}")
        print(f"Parsing Failed: {batch.parsing_failed}")
        
        # Get all files in batch
        files = db.query(BulkUploadFile).filter(
            BulkUploadFile.bulk_upload_id == batch.id
        ).order_by(BulkUploadFile.created_at).all()
        
        print(f"\nTotal Files in Batch: {len(files)}")
        
        # Count by parsing status
        parsing_statuses = {}
        for f in files:
            status = f.parsing_status or 'unknown'
            parsing_statuses[status] = parsing_statuses.get(status, 0) + 1
        
        print(f"\nParsing Status Distribution:")
        for status, count in parsing_statuses.items():
            print(f"  - {status}: {count}")
        
        # Analysis data
        analysis = {
            'total_files': len(files),
            'successfully_parsed': 0,
            'parsing_failed': 0,
            'profiles_created': 0,
            'matched_existing': 0,
            'duplicates_detected': 0,
            'issues': [],
            'profile_details': []
        }
        
        print(f"\n{'='*100}")
        print(f"DETAILED ANALYSIS - FILE BY FILE")
        print(f"{'='*100}\n")
        
        for idx, file in enumerate(files, 1):
            parsed_data = file.parsed_data or {}
            
            # Get linked profile
            linked_profile = None
            linked_user = None
            if file.matched_candidate_id:
                linked_user = db.query(User).filter(
                    User.id == file.matched_candidate_id
                ).first()
                if linked_user:
                    linked_profile = db.query(CandidateProfile).filter(
                        CandidateProfile.user_id == linked_user.id
                    ).first()
            
            print(f"File #{idx}: {file.original_filename}")
            print(f"  Status: {file.parsing_status}")
            
            # Extract info
            extracted = {
                'name': parsed_data.get('name', 'N/A'),
                'email': parsed_data.get('email', 'N/A'),
                'phone': parsed_data.get('phone', 'N/A'),
                'current_role': parsed_data.get('current_role', 'N/A'),
                'years_exp': parsed_data.get('years_of_experience', 'N/A'),
                'location': parsed_data.get('location', 'N/A'),
                'skills_count': len(parsed_data.get('skills', [])),
                'companies_count': len(parsed_data.get('companies', [])),
                'education': parsed_data.get('highest_education', 'N/A'),
            }
            
            print(f"  EXTRACTED DATA:")
            print(f"    Name: {extracted['name']}")
            print(f"    Email: {extracted['email']}")
            print(f"    Phone: {extracted['phone']}")
            print(f"    Current Role: {extracted['current_role']}")
            print(f"    Experience: {extracted['years_exp']} years")
            print(f"    Location: {extracted['location']}")
            print(f"    Skills: {extracted['skills_count']} items")
            print(f"    Companies: {extracted['companies_count']} items")
            print(f"    Education: {extracted['education']}")
            
            if file.parsing_status == 'failed':
                print(f"  [WARN] PARSING FAILED: {file.parsing_error}")
                analysis['parsing_failed'] += 1
                analysis['issues'].append({
                    'file': file.original_filename,
                    'type': 'parsing_failed',
                    'error': file.parsing_error
                })
            
            elif file.parsing_status == 'parsed':
                analysis['successfully_parsed'] += 1
                
                if linked_profile:
                    # Compare extracted vs profile
                    print(f"\n  LINKED PROFILE:")
                    print(f"    User ID: {linked_user.id}")
                    print(f"    Email in User DB: {linked_user.email}")
                    print(f"    Full Name: {linked_profile.full_name}")
                    print(f"    Phone in Profile: {linked_profile.phone_number}")
                    print(f"    Role in Profile: {linked_profile.current_role}")
                    print(f"    Exp in Profile: {linked_profile.years_of_experience} years")
                    print(f"    Location in Profile: {linked_profile.location}")
                    print(f"    Skills in Profile: {len(linked_profile.skills or [])} items")
                    print(f"    Is Shadow: {linked_profile.is_shadow_profile}")
                    print(f"    Experience Tier: {linked_profile.experience}")
                    
                    # Check for mismatches
                    mismatches = []
                    
                    # Name mismatch check (allow some variation)
                    if extracted['name'].lower() not in linked_profile.full_name.lower():
                        mismatches.append(f"Name: Extracted='{extracted['name']}' vs Profile='{linked_profile.full_name}'")
                    
                    # Phone mismatch
                    extracted_phone = (extracted['phone'] or '').replace(' ', '').replace('-', '') if extracted['phone'] not in (None, 'N/A') else ''
                    profile_phone = (linked_profile.phone_number or '').replace(' ', '').replace('-', '')
                    if extracted_phone and profile_phone and extracted_phone != profile_phone:
                        mismatches.append(f"Phone: Extracted='{extracted['phone']}' vs Profile='{linked_profile.phone_number}'")
                    
                    # Current Role mismatch
                    if extracted['current_role'] != 'N/A' and extracted['current_role'] and (linked_profile.current_role or '').lower():
                        if extracted['current_role'].lower() != (linked_profile.current_role or '').lower():
                            mismatches.append(f"Role: Extracted='{extracted['current_role']}' vs Profile='{linked_profile.current_role}'")
                    
                    # Location mismatch
                    if extracted['location'] not in (None, 'N/A') and extracted['location'] and (linked_profile.location or '').lower():
                        if extracted['location'].lower() != (linked_profile.location or '').lower():
                            mismatches.append(f"Location: Extracted='{extracted['location']}' vs Profile='{linked_profile.location}'")
                    
                    # Experience mismatch
                    if str(extracted['years_exp']) != 'N/A' and str(extracted['years_exp']) != str(linked_profile.years_of_experience or 0):
                        mismatches.append(f"Experience: Extracted={extracted['years_exp']} vs Profile={linked_profile.years_of_experience}")
                    
                    # Education mismatch
                    if extracted['education'] != 'N/A' and extracted['education'] and extracted['education'] != (linked_profile.qualification_held or ''):
                        mismatches.append(f"Education: Extracted='{extracted['education']}' vs Profile='{linked_profile.qualification_held}'")
                    
                    if mismatches:
                        print(f"\n  [FAIL] MISMATCHES FOUND:")
                        for mismatch in mismatches:
                            print(f"    - {mismatch}")
                        analysis['issues'].append({
                            'file': file.original_filename,
                            'type': 'data_mismatch',
                            'mismatches': mismatches
                        })
                    else:
                        print(f"\n  [PASS] ALL DATA MATCHES CORRECTLY")
                    
                    analysis['profiles_created'] += 1
                    if linked_profile.is_shadow_profile:
                        analysis['matched_existing'] += 1 if not linked_profile.is_shadow_profile else 0
                    
                    # Store details
                    analysis['profile_details'].append({
                        'file': file.original_filename,
                        'status': 'matched',
                        'extracted': extracted,
                        'profile': {
                            'name': linked_profile.full_name,
                            'email': linked_user.email,
                            'phone': linked_profile.phone_number,
                            'role': linked_profile.current_role,
                            'exp': linked_profile.years_of_experience,
                            'location': linked_profile.location,
                            'skills': len(linked_profile.skills or []),
                            'is_shadow': linked_profile.is_shadow_profile
                        },
                        'mismatches': mismatches if mismatches else []
                    })
                else:
                    print(f"  [WARN] NO PROFILE LINKED - UNKNOWN STATE")
                    analysis['issues'].append({
                        'file': file.original_filename,
                        'type': 'no_profile_linked'
                    })
            
            print(f"  {'-'*95}")
        
        # Summary Report
        print(f"\n{'='*100}")
        print(f"SUMMARY REPORT")
        print(f"{'='*100}\n")
        
        print(f"Total Files Processed: {analysis['total_files']}")
        print(f"Successfully Parsed: {analysis['successfully_parsed']}")
        print(f"Parsing Failed: {analysis['parsing_failed']}")
        print(f"Profiles Created: {analysis['profiles_created']}")
        print(f"Total Issues Found: {len(analysis['issues'])}")
        
        # What's working
        print(f"\n[PASS] WHAT'S WORKING:")
        if analysis['successfully_parsed'] > 0:
            print(f"  - Resume parsing is working ({analysis['successfully_parsed']}/{analysis['total_files']} successful)")
        if analysis['profiles_created'] > 0:
            print(f"  - Profile creation is working ({analysis['profiles_created']} profiles created)")
        
        # What's not working
        print(f"\n[FAIL] WHAT'S NOT WORKING:")
        if analysis['parsing_failed'] > 0:
            print(f"  - Resume parsing failed for {analysis['parsing_failed']} files")
            failed_files = [issue for issue in analysis['issues'] if issue['type'] == 'parsing_failed']
            for issue in failed_files[:5]:  # Show first 5
                print(f"    - {issue['file']}: {issue['error']}")
            if len(failed_files) > 5:
                print(f"    ... and {len(failed_files)-5} more")
        
        missing_profiles = [issue for issue in analysis['issues'] if issue['type'] == 'no_profile_linked']
        if missing_profiles:
            print(f"  - {len(missing_profiles)} parsed files are not linked to profiles")
        
        # What's working wrong
        print(f"\n[WARN] WHAT'S WORKING WRONG (Data Mismatches):")
        mismatch_issues = [issue for issue in analysis['issues'] if issue['type'] == 'data_mismatch']
        if mismatch_issues:
            print(f"  Found {len(mismatch_issues)} files with extracted data not matching profile:")
            for issue in mismatch_issues:
                print(f"\n  {issue['file']}:")
                for mismatch in issue['mismatches']:
                    print(f"    - {mismatch}")
        else:
            print(f"  - NO DATA MISMATCHES! All profiles match extracted data correctly [PASS]")
        
        # Detailed issue breakdown
        print(f"\n{'='*100}")
        print(f"ISSUE BREAKDOWN BY TYPE")
        print(f"{'='*100}\n")
        
        issue_types = {}
        for issue in analysis['issues']:
            issue_type = issue['type']
            issue_types[issue_type] = issue_types.get(issue_type, 0) + 1
        
        for issue_type, count in issue_types.items():
            print(f"  {issue_type}: {count}")
        
        # Extraction quality check
        print(f"\n{'='*100}")
        print(f"EXTRACTION QUALITY CHECK")
        print(f"{'='*100}\n")
        
        extraction_quality = {
            'name_extracted': 0,
            'email_extracted': 0,
            'phone_extracted': 0,
            'role_extracted': 0,
            'experience_extracted': 0,
            'location_extracted': 0,
            'skills_extracted': 0,
            'education_extracted': 0,
        }
        
        for profile in analysis['profile_details']:
            if profile['extracted']['name'] != 'N/A':
                extraction_quality['name_extracted'] += 1
            if profile['extracted']['email'] != 'N/A':
                extraction_quality['email_extracted'] += 1
            if profile['extracted']['phone'] and profile['extracted']['phone'] != 'N/A':
                extraction_quality['phone_extracted'] += 1
            if profile['extracted']['current_role'] != 'N/A':
                extraction_quality['role_extracted'] += 1
            if profile['extracted']['years_exp'] != 'N/A':
                extraction_quality['experience_extracted'] += 1
            if profile['extracted']['location'] != 'N/A':
                extraction_quality['location_extracted'] += 1
            if profile['extracted']['skills_count'] > 0:
                extraction_quality['skills_extracted'] += 1
            if profile['extracted']['education'] != 'N/A':
                extraction_quality['education_extracted'] += 1
        
        total_parsed = analysis['successfully_parsed']
        if total_parsed > 0:
            print(f"Extraction Success Rates (out of {total_parsed} parsed files):")
            print(f"  Name: {extraction_quality['name_extracted']}/{total_parsed} ({extraction_quality['name_extracted']*100//total_parsed}%)")
            print(f"  Email: {extraction_quality['email_extracted']}/{total_parsed} ({extraction_quality['email_extracted']*100//total_parsed}%)")
            print(f"  Phone: {extraction_quality['phone_extracted']}/{total_parsed} ({extraction_quality['phone_extracted']*100//total_parsed}%)")
            print(f"  Current Role: {extraction_quality['role_extracted']}/{total_parsed} ({extraction_quality['role_extracted']*100//total_parsed}%)")
            print(f"  Experience: {extraction_quality['experience_extracted']}/{total_parsed} ({extraction_quality['experience_extracted']*100//total_parsed}%)")
            print(f"  Location: {extraction_quality['location_extracted']}/{total_parsed} ({extraction_quality['location_extracted']*100//total_parsed}%)")
            print(f"  Skills: {extraction_quality['skills_extracted']}/{total_parsed} ({extraction_quality['skills_extracted']*100//total_parsed}%)")
            print(f"  Education: {extraction_quality['education_extracted']}/{total_parsed} ({extraction_quality['education_extracted']*100//total_parsed}%)")
        
        print(f"\n{'='*100}\n")

if __name__ == '__main__':
    analyze_batch()
