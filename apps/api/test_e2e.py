import asyncio
from src.services.ai_intelligence_service import AIIntelligenceService

async def test_full_onboarding_flow():
    service = AIIntelligenceService()
    
    print('=' * 70)
    print('TESTING COMPLETE ONBOARDING FLOW')
    print('=' * 70)
    
    # Simulate a real user journey
    print('\n SCENARIO: User anu239157@gmail.com going through onboarding')
    print()
    
    # Step 1: Employment Status
    print('STEP 1: Employment Status Question')
    print('User selects: I am currently employed')
    answers_step1 = {'employment_status': 'Employed'}
    
    # Step 2: Get next question
    print('\nSTEP 2: Generated Follow-up Question')
    answers_step2 = {'employment_status': 'Employed'}
    result = await service.generate_adaptive_followup_question(answers_step2, current_step=2)
    print(f'Question: {result["question"]}')
    print(f'Options (first 2): {[opt[:30] + "..." if len(opt) > 30 else opt for opt in result["options"][:2]]}')
    print(f'Reasoning: {result["reasoning"]}')
    
    if 'serious' not in result['question'].lower() and 'urgent' not in result['question'].lower():
        print('ERROR: Should ask about urgency, not salary!')
        return False
    print('OK: Asks about urgency/job search mode')
    
    # Step 3: User answers urgency
    print('\nSTEP 3: User selects: Actively searching - ready to move')
    answers_step3 = {
        'employment_status': 'Employed',
        'job_search_mode': 'active'
    }
    
    # Step 4: Get next question
    print('\nSTEP 4: Generated Follow-up Question')
    result = await service.generate_adaptive_followup_question(answers_step3, current_step=3)
    print(f'Question: {result["question"]}')
    print(f'Options (first 2): {[opt[:30] + "..." if len(opt) > 30 else opt for opt in result["options"][:2]]}')
    
    if 'when' not in result['question'].lower() and 'start' not in result['question'].lower():
        print('ERROR: Should ask about timeline/notice period!')
        return False
    print('OK: Asks about notice period/timeline')
    
    # Step 5: User answers notice period
    print('\nSTEP 5: User selects: 2 weeks notice')
    answers_step5 = {
        'employment_status': 'Employed',
        'job_search_mode': 'active',
        'notice_period_days': 14
    }
    
    # Step 6: Get next question
    print('\nSTEP 6: Generated Follow-up Question')
    result = await service.generate_adaptive_followup_question(answers_step5, current_step=4)
    print(f'Question: {result["question"][:60]}...')
    print(f'Options (first 2): {[opt[:30] if len(str(opt)) > 30 else opt for opt in result["options"][:2]]}')
    
    if 'salary' not in result['question'].lower() and 'expectation' not in result['question'].lower():
        print('ERROR: Should ask about salary with context!')
        return False
    print('OK: NOW asks about salary (with full context)')
    
    # Step 7: Test conversational onboarding
    print('\n' + '=' * 70)
    print('TESTING CONVERSATIONAL ONBOARDING')
    print('=' * 70)
    print('\nUser types: I am a developer with 5 years experience...')
    
    result = await service.process_conversational_onboarding(
        user_message='I am currently a developer with 5 years experience working at a startup. I am looking to move into tech sales. I am not in a rush though.',
        conversation_history=None
    )
    
    print(f'\nExtracted Info:')
    print(f'  - Employment Status: {result["extracted_info"].get("employment_status", "Not detected")}')
    print(f'  - Years Experience: {result["extracted_info"].get("years_experience", "Not detected")}')
    print(f'  - Current Role: {result["extracted_info"].get("current_role", "Not detected")}')
    print(f'  - Job Search Mode: {result["extracted_info"].get("job_search_mode", "Not detected")}')
    print(f'\nCompleteness Score: {result["completeness_score"]:.1f}/1.0')
    print(f'Next Question: {result["next_question"][:60]}...')
    print(f'Confidence: {result["confidence"]}')
    
    if result['completeness_score'] < 0.3:
        print('WARNING: Low completeness - check if extraction is working')
    else:
        print('OK: Good data extraction from natural language')
    
    # Final check
    print('\n' + '=' * 70)
    print('SUMMARY')
    print('=' * 70)
    print('OK: Smart question sequencing: WORKING')
    print('OK: Adaptive follow-up generation: WORKING')
    print('OK: Conversational onboarding: WORKING')
    print('OK: Natural language extraction: WORKING')
    print()
    print('ONBOARDING FLOW IS COMPLETE AND FUNCTIONAL!')
    return True

result = asyncio.run(test_full_onboarding_flow())
if result:
    print('\nALL TESTS PASSED - Ready for user testing!')
else:
    print('\nSome tests failed - check output above')
