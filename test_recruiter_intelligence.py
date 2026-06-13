#!/usr/bin/env python3
"""
Integration test script to verify:
1. Strict Skills-first matching score and sorting in search_talent_pool.
2. Database action logging in recruiter_chat_actions.
3. Transition probability learning for dynamic next steps.
"""

import os
import sys
import json
import asyncio
from pathlib import Path
from datetime import datetime

# Add parent directory and apps/api to path
sys.path.insert(0, str(Path(__file__).parent / "apps" / "api"))
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Import from backend
from src.core.database import SessionLocal
from src.services.recruiter_service import recruiter_service
from src.api.assistant_chat import _log_recruiter_action, _get_learned_next_steps

async def run_tests_async():
    db = SessionLocal()
    try:
        print("====== STARTING RECRUITER INTELLIGENCE VERIFICATION ======\n")

        # ----------------------------------------------------
        # 1. FIND OR CREATE A TEST RECRUITER USER
        # ----------------------------------------------------
        print("Step 1: Finding recruiter user context...")
        recruiter = db.execute(text("""
            SELECT u.id, u.email, rp.full_name 
            FROM users u
            JOIN recruiter_profiles rp ON u.id = rp.user_id
            LIMIT 1
        """)).fetchone()
        
        if recruiter:
            user_id = str(recruiter[0])
            email = recruiter[1]
            full_name = recruiter[2]
            print(f"Found Recruiter: {full_name} ({email}) [ID: {user_id}]")
        else:
            print("No recruiter found in database. Cannot run tests.")
            return

        # ----------------------------------------------------
        # 2. VERIFY SKILLS MATCH FORMULA AND SORTING
        # ----------------------------------------------------
        print("\nStep 2: Testing search_talent_pool matching and sorting...")
        
        # We will search for a set of skills: "Salesforce" and "Negotiation"
        search_skills = ["Salesforce", "Negotiation"]
        params = {
            "skills": search_skills,
            "experience_band": "all"
        }
        
        results = db.execute(text("SELECT COUNT(*) FROM candidate_profiles")).fetchone()
        print(f"Talent pool total candidate profiles in DB: {results[0] if results else 0}")

        results_data = await recruiter_service.search_talent_pool(params)
        
        print(f"Returned {len(results_data)} candidates matching filter criteria.")
        
        if len(results_data) > 0:
            print("\nCandidate results validation:")
            last_tier = 0 # 0=Active-Verified, 1=Active-Unverified, 2=Passive (shadow)
            last_score = 100
            
            for idx, cand in enumerate(results_data[:10]):
                name = cand["full_name"]
                skills = cand["skills"]
                score = cand["culture_match_score"]
                is_shadow = cand["is_shadow"]
                verified = cand["assessment_completed"]
                
                # Verify match score calculation
                c_skills_canonical = recruiter_service._canonicalize_skill_terms(skills)
                search_skills_canonical = recruiter_service._canonicalize_skill_terms(search_skills)
                overlap = c_skills_canonical.intersection(search_skills_canonical)
                expected_score = min(100, int(round((len(overlap) / len(search_skills_canonical)) * 100)))
                
                print(f"[{idx+1}] {name} | Score: {score} (Exp: {expected_score}) | Verified: {verified} | Shadow/Passive: {is_shadow} | Skills: {skills}")
                
                assert score == expected_score, f"MATCH SCORE MISMATCH for {name}: got {score}, expected {expected_score}"
                
                # Determine current candidate tier
                if not is_shadow and verified:
                    current_tier = 0
                    tier_name = "Active - Verified"
                elif not is_shadow and not verified:
                    current_tier = 1
                    tier_name = "Active - Unverified"
                else:
                    current_tier = 2
                    tier_name = "Passive Talent Pool"
                
                # Verify sorting rules
                assert current_tier >= last_tier, f"SORTING TIER VIOLATION: {name} ({tier_name}) sorted after a lower priority tier."
                
                if current_tier == last_tier:
                    assert score <= last_score, f"SORTING MATCH SCORE VIOLATION: {name} (score {score}) sorted after lower score {last_score} within same tier."
                
                last_tier = current_tier
                last_score = score
                
            print("Candidate match score formula and tier sorting rules verified successfully!")
        else:
            print("No candidates returned in search. Skipping detailed matching assertions (talent pool empty).")

        # ----------------------------------------------------
        # 3. VERIFY DATABASE ACTION LOGGING
        # ----------------------------------------------------
        print("\nStep 3: Testing database action logging helper...")
        
        # Clear previous logs for this user to make results predictable
        db.execute(text("DELETE FROM recruiter_chat_actions WHERE user_id = :uid"), {"uid": user_id})
        db.commit()
        
        # Log a test action
        test_session_id = "00000000-0000-0000-0000-000000000000"
        test_action_type = "searched_candidates"
        test_target_id = "test-target-id"
        test_meta = {"test_key": "test_val"}
        
        _log_recruiter_action(db, user_id, test_session_id, test_action_type, test_target_id, test_meta)
        
        # Verify it exists in database
        logged_row = db.execute(
            text("SELECT * FROM recruiter_chat_actions WHERE user_id = :uid AND action_type = :atype"),
            {"uid": user_id, "atype": test_action_type}
        ).fetchone()
        
        assert logged_row is not None, "LOGGED ACTION NOT FOUND IN DATABASE"
        print(f"Logged row verified: Action='{logged_row.action_type}', Target='{logged_row.target_id}', Metadata={logged_row.metadata}")
        
        # ----------------------------------------------------
        # 4. VERIFY SELF-LEARNING DYNAMIC NEXT STEPS
        # ----------------------------------------------------
        print("\nStep 4: Testing transition probability next-steps suggestions...")
        
        # Log a sequence of actions simulating user workflow:
        # We want candidate_search to be frequently followed by viewed_profile.
        # Log: searched_candidates -> viewed_profile -> viewed_resume -> invited_candidate
        # Let's write logs (reverse chronological order of creation timestamps)
        
        # We'll log actions sequentially
        actions_sequence = [
            "searched_candidates",
            "viewed_profile",
            "viewed_resume",
            "invited_candidate",
            "searched_candidates",
            "viewed_profile",
            "viewed_resume",
            "searched_candidates",
            "viewed_profile"
        ]
        
        # Clear previous logs again
        db.execute(text("DELETE FROM recruiter_chat_actions WHERE user_id = :uid"), {"uid": user_id})
        db.commit()
        
        import time
        for action in actions_sequence:
            _log_recruiter_action(db, user_id, test_session_id, action)
            time.sleep(0.01) # ensure correct timestamp ordering
            
        # If current intent is "candidate_search" (translates to "searched_candidates" action)
        # Let's see what action followed it:
        # In sequence:
        # Index 0 (searched_candidates) -> followed by Index 1 (viewed_profile)
        # Index 4 (searched_candidates) -> followed by Index 5 (viewed_profile)
        # Index 7 (searched_candidates) -> followed by Index 8 (viewed_profile)
        # Therefore, transition "searched_candidates" -> "viewed_profile" occurs 3 times.
        # It should predict "viewed_profile" as the most likely next action.
        
        learned_chips = await _get_learned_next_steps(
            db=db,
            user_id=user_id,
            role="recruiter",
            intent="candidate_search",
            data_results=[],
            next_steps=[]
        )
        
        print(f"Generated Next Step Chips: {learned_chips}")
        
        # "Would you like to view candidate profiles?" corresponds to "viewed_profile" action.
        # Verify that this chip is prioritized first in the list
        assert len(learned_chips) > 0, "NO CHIPS GENERATED"
        assert learned_chips[0] == "Would you like to view candidate profiles?", f"PREDICTION MISMATCH: expected 'Would you like to view candidate profiles?' first, got '{learned_chips[0]}'"
        
        print("Self-learning transition prediction chip sorting verified successfully!")
        
        # Clean up test logs
        db.execute(text("DELETE FROM recruiter_chat_actions WHERE user_id = :uid"), {"uid": user_id})
        db.commit()
        print("\nCleaned up test database records.")
        print("\n====== ALL INTELLIGENCE SYSTEM TESTS PASSED SUCCESSFULLY! ======")
        
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(run_tests_async())
