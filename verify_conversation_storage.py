#!/usr/bin/env python3
"""
Verify that ConversationalOnboardingSession data is being stored in database

Run this to check:
1. If conversational_onboarding_sessions table exists
2. How many sessions are stored
3. What data is in each session
4. If asked_questions are being tracked
"""

import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent / "apps" / "api"))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from src.core.models import ConversationalOnboardingSession

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

if not DATABASE_URL:
    print("❌ ERROR: DATABASE_URL not set in .env")
    sys.exit(1)

print(f"\n🔍 Verifying ConversationalOnboardingSession storage...")
print(f"📊 Database: {DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else 'PostgreSQL'}")

try:
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    db = Session()
    
    # 1. Check if table exists
    inspector_result = db.execute(text("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'conversational_onboarding_sessions'
    """)).fetchone()
    
    if inspector_result:
        print("✅ Table 'conversational_onboarding_sessions' EXISTS in database")
    else:
        print("❌ Table 'conversational_onboarding_sessions' NOT FOUND")
        print("   → Run migrations or create table manually")
        sys.exit(1)
    
    # 2. Count sessions
    count_result = db.execute(text("""
        SELECT COUNT(*) as total FROM conversational_onboarding_sessions
    """)).fetchone()
    
    total_sessions = count_result[0] if count_result else 0
    print(f"\n📈 Total sessions in database: {total_sessions}")
    
    if total_sessions == 0:
        print("   ⚠️  No sessions found. This is expected on first run.")
        print("   💡 Start a conversation in the app to create the first session\n")
    else:
        # 3. Show session details
        print("\n📋 Session Details:")
        print("-" * 100)
        
        sessions = db.query(ConversationalOnboardingSession).all()
        
        for session in sessions:
            print(f"\n🎯 Session ID: {session.id}")
            print(f"   Candidate: {session.candidate_id}")
            print(f"   Total Messages: {session.total_messages}")
            print(f"   Asked Questions: {session.asked_questions}")
            print(f"   Completeness Score: {session.completeness_score}%")
            print(f"   Confidence: {session.average_ai_confidence}")
            print(f"   Status: {session.conversation_status}")
            
            print(f"\n   📊 Extracted Data:")
            print(f"      - Employment Status: {session.extracted_employment_status}")
            print(f"      - Job Search Mode: {session.extracted_job_search_mode}")
            print(f"      - Notice Period: {session.extracted_notice_period_days} days")
            print(f"      - Current Role: {session.extracted_current_role}")
            print(f"      - Years Experience: {session.extracted_years_experience}")
            print(f"      - Willing to Relocate: {session.extracted_willing_to_relocate}")
            print(f"      - Visa Needed: {session.extracted_visa_sponsorship_needed}")
            
            msg_count = len(session.conversation_messages) if isinstance(session.conversation_messages, list) else 0
            print(f"\n   💬 Conversation Messages: {msg_count}")
            if isinstance(session.conversation_messages, list) and msg_count > 0:
                for i, msg in enumerate(session.conversation_messages[-2:], 1):  # Show last 2
                    print(f"      Message {i}:")
                    print(f"        User: {msg.get('user', '')[:60]}...")
                    print(f"        Assistant: {msg.get('assistant', '')[:60]}...")
                    print(f"        Confidence: {msg.get('confidence', 0)}")
        
        print("\n" + "-" * 100)
        print("\n✅ Database storage is working correctly!")
        print(f"✅ {total_sessions} session(s) found with conversation data\n")
        
except ImportError as e:
    print(f"❌ Import Error: {str(e)}")
    print("   Make sure you have all dependencies installed")
    sys.exit(1)
except Exception as e:
    print(f"❌ Error: {str(e)}")
    print("   Check your DATABASE_URL and database connection")
    sys.exit(1)
finally:
    db.close()
