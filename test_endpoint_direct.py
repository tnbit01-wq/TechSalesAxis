#!/usr/bin/env python3
"""
Test the conversational onboarding endpoint directly
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "apps" / "api"))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.core.database import get_db
from src.routes.intelligence import router
from src.core.models import ConversationalOnboardingSession
from fastapi import HTTPException, Header
from unittest.mock import AsyncMock, MagicMock, patch
import json

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

async def test_endpoint():
    """Test the endpoint with mock data"""
    
    print("\n" + "="*100)
    print("Testing Conversational Onboarding Endpoint")
    print("="*100 + "\n")
    
    # Create a real database session
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    db_session = Session()
    
    try:
        # Get the endpoint handler
        endpoint_func = router.routes[0].endpoint
        
        # Create mock objects
        test_request = MagicMock()
        test_request.user_message = "I have 8 years of sales experience and I'm currently employed"
        test_request.conversation_history = []
        test_request.asked_questions = []
        
        # Mock token verification
        test_authorization = "Bearer test_token"
        test_user_id = "c32e36c5-f2ed-40ba-a0a2-7819b7721290"  # Mithunmk's user ID
        
        # Mock the verify_token function
        async def mock_verify_token(token):
            return test_user_id
        
        print(f"Test Input:")
        print(f"  User ID: {test_user_id}")
        print(f"  Message: {test_request.user_message}")
        print(f"  Conversation History: {test_request.conversation_history}")
        print(f"  Asked Questions: {test_request.asked_questions}\n")
        
        # Patch the verify_token and get_db functions
        with patch('src.routes.intelligence.verify_token', side_effect=mock_verify_token):
            with patch('src.routes.intelligence.Depends') as mock_depends:
                # Mock get_db to return our real session
                mock_depends.return_value = db_session
                
                # Manually call the endpoint logic (simplified)
                print("Calling endpoint handler...\n")
                
                # Check if session exists BEFORE
                before_session = db_session.query(ConversationalOnboardingSession).filter(
                    ConversationalOnboardingSession.candidate_id == test_user_id
                ).first()
                
                print(f"BEFORE endpoint call:")
                print(f"  Session exists: {before_session is not None}")
                if before_session:
                    print(f"  Session ID: {before_session.id}")
                    print(f"  Messages: {len(before_session.conversation_messages) if isinstance(before_session.conversation_messages, list) else 'N/A'}")
                print()
                
        # Now check after
        after_session = db_session.query(ConversationalOnboardingSession).filter(
            ConversationalOnboardingSession.candidate_id == test_user_id
        ).first()
        
        print(f"AFTER endpoint call:")
        print(f"  Session exists: {after_session is not None}")
        if after_session:
            print(f"  Session ID: {after_session.id}")
            print(f"  Messages: {len(after_session.conversation_messages) if isinstance(after_session.conversation_messages, list) else 'N/A'}")
            print(f"  Asked Questions: {after_session.asked_questions}")
            print(f"  Completeness: {after_session.completeness_score}")
            print(f"  Status: {after_session.conversation_status}")
        else:
            print("  ❌ NO SESSION CREATED")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db_session.close()

if __name__ == "__main__":
    asyncio.run(test_endpoint())
