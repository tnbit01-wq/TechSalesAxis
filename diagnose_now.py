#!/usr/bin/env python3
"""
LIVE DATABASE DIAGNOSTIC - Shows exact state and fixes issues
"""
import os
import sys
from pathlib import Path
from datetime import datetime, timedelta

sys.path.insert(0, str(Path(__file__).parent / "apps" / "api"))
from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from src.core.models import (
    ConversationalOnboardingSession, 
    CareerReadinessHistory, 
    CandidateProfile, 
    User
)

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
db = Session()

print("\n" + "="*140)
print("LIVE DATABASE DIAGNOSTIC - MITHUNMK CANDIDATE DATA")
print("="*140)

try:
    # Find Mithunmk's user record
    user = db.query(User).filter(User.email == "mithunmk374@gmail.com").first()
    
    if not user:
        print("\n❌ CRITICAL: User mithunmk374@gmail.com NOT FOUND in users table")
        print("   Checking all recent users...")
        recent_users = db.query(User).order_by(User.created_at.desc()).limit(5).all()
        for u in recent_users:
            print(f"   - {u.email} (ID: {u.id})")
        sys.exit(1)
    
    user_id = str(user.id)
    print(f"\n✅ Found user: {user.email}")
    print(f"   User ID: {user_id}")
    print(f"   Created: {user.created_at}")
    print()
    
    # ========================================================================
    # 1. CHECK CANDIDATE_PROFILES TABLE
    # ========================================================================
    print("\n" + "-"*140)
    print("TABLE 1: CANDIDATE_PROFILES")
    print("-"*140)
    
    profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
    
    if not profile:
        print("❌ NO CANDIDATE PROFILE FOUND - Creating one...")
        profile = CandidateProfile(user_id=user_id)
        db.add(profile)
        db.commit()
        print("✅ Created empty candidate profile")
    
    print(f"\n✅ Candidate Profile exists (ID: {user_id})")
    print(f"\nCore Data:")
    print(f"  Full Name: {profile.full_name}")
    print(f"  Current Role: {profile.current_role}")
    print(f"  Years Experience: {profile.years_of_experience}")
    print(f"  Location: {profile.location}")
    
    print(f"\nCareer Readiness Fields:")
    print(f"  Employment Status: {profile.current_employment_status}")
    print(f"  Job Search Mode: {profile.job_search_mode}")
    print(f"  Notice Period: {profile.notice_period_days} days")
    print(f"  Willing to Relocate: {profile.willing_to_relocate}")
    print(f"  Career Readiness Score: {profile.career_readiness_score}")
    print(f"  Last Updated: {profile.updated_at}")
    
    # ========================================================================
    # 2. CHECK CONVERSATIONAL_ONBOARDING_SESSIONS TABLE
    # ========================================================================
    print("\n" + "-"*140)
    print("TABLE 2: CONVERSATIONAL_ONBOARDING_SESSIONS")
    print("-"*140)
    
    session = db.query(ConversationalOnboardingSession).filter(
        ConversationalOnboardingSession.candidate_id == user_id
    ).first()
    
    if not session:
        print(f"❌ NO CONVERSATION SESSION FOUND")
        print(f"\n   Creating conversation session for {user.email}...")
        session = ConversationalOnboardingSession(
            candidate_id=user_id,
            conversation_messages=[],
            asked_questions=[],
            conversation_status='in_progress'
        )
        db.add(session)
        db.commit()
        print(f"✅ Created conversation session (ID: {session.id})")
    
    print(f"\n✅ Conversation Session exists")
    print(f"  Session ID: {session.id}")
    print(f"  Status: {session.conversation_status}")
    print(f"  Total Messages: {session.total_messages}")
    print(f"  Completeness: {session.completeness_score}%")
    print(f"  Confidence: {session.average_ai_confidence}%")
    print(f"  Started: {session.started_at}")
    
    print(f"\nExtracted Data:")
    print(f"  Employment Status: {session.extracted_employment_status or 'NOT SET'}")
    print(f"  Job Search Mode: {session.extracted_job_search_mode or 'NOT SET'}")
    print(f"  Notice Period: {session.extracted_notice_period_days} days" if session.extracted_notice_period_days else "  Notice Period: NOT SET")
    print(f"  Current Role: {session.extracted_current_role or 'NOT SET'}")
    print(f"  Years Experience: {session.extracted_years_experience}" if session.extracted_years_experience else "  Years Experience: NOT SET")
    print(f"  Willing to Relocate: {session.extracted_willing_to_relocate or 'NOT SET'}")
    
    print(f"\nQuestion Tracking:")
    print(f"  Asked Questions: {session.asked_questions}")
    print(f"  Missing Fields: {session.missing_critical_fields}")
    
    print(f"\nConversation Messages:")
    if isinstance(session.conversation_messages, list) and len(session.conversation_messages) > 0:
        print(f"  Total turns: {len(session.conversation_messages)}")
        for i, msg in enumerate(session.conversation_messages, 1):
            print(f"\n  Turn {i}:")
            print(f"    User: {msg.get('user', '')[:80]}...")
            print(f"    Assistant: {msg.get('assistant', '')[:80]}...")
            print(f"    Confidence: {msg.get('confidence', 0)}%")
    else:
        print(f"  ❌ NO MESSAGES STORED - This is the problem!")
    
    # ========================================================================
    # 3. CHECK CAREER_READINESS_HISTORY TABLE
    # ========================================================================
    print("\n" + "-"*140)
    print("TABLE 3: CAREER_READINESS_HISTORY")
    print("-"*140)
    
    history = db.query(CareerReadinessHistory).filter(
        CareerReadinessHistory.user_id == user_id
    ).order_by(CareerReadinessHistory.changed_at.desc()).limit(10).all()
    
    if len(history) == 0:
        print("⚠️  No career readiness history records (expected if data not saved yet)")
    else:
        print(f"✅ Found {len(history)} history records:")
        for i, record in enumerate(history, 1):
            print(f"\n  Record {i} ({record.changed_at}):")
            print(f"    Job Search Mode: {record.old_job_search_mode} → {record.new_job_search_mode}")
            print(f"    Notice Period: {record.old_notice_period_days} → {record.new_notice_period_days} days")
            print(f"    Reason: {record.reason}")
    
    # ========================================================================
    # SUMMARY & RECOMMENDATION
    # ========================================================================
    print("\n" + "="*140)
    print("DIAGNOSIS & RECOMMENDATIONS")
    print("="*140)
    
    has_conversation_session = session is not None
    has_messages = isinstance(session.conversation_messages, list) and len(session.conversation_messages) > 0 if session else False
    has_extracted_data = session and (session.extracted_employment_status or session.extracted_job_search_mode) if session else False
    
    print(f"\n📊 Current Status:")
    print(f"  ✅ User account exists")
    print(f"  ✅ Candidate profile exists")
    print(f"  {'✅' if has_conversation_session else '❌'} Conversation session exists")
    print(f"  {'✅' if has_messages else '❌'} Conversation messages stored")
    print(f"  {'✅' if has_extracted_data else '❌'} Data extracted from conversation")
    
    if not has_messages:
        print(f"\n🔴 PROBLEM: Conversation endpoint is NOT saving messages to database")
        print(f"\n🔧 SOLUTION: Endpoint needs to be called from frontend OR there's an auth issue")
        print(f"\nNext Actions:")
        print(f"  1. Verify backend is running: curl http://127.0.0.1:8005/health")
        print(f"  2. Check frontend is sending requests to correct endpoint")
        print(f"  3. Verify authentication token is valid")
        print(f"  4. Check backend logs for any errors")
    else:
        print(f"\n✅ SUCCESS: All conversation data is being saved correctly!")
    
    db.close()
    
except Exception as e:
    print(f"\n❌ Error: {str(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
