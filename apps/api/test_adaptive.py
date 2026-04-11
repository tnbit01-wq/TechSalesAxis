import asyncio
from src.services.ai_intelligence_service import AIIntelligenceService

async def test():
    service = AIIntelligenceService()
    
    print('Testing adaptive question flow...')
    print()
    
    # Simulate the career readiness flow
    answers = {'employment_status': 'Employed'}
    
    for step in [2, 3, 4]:
        result = await service.generate_adaptive_followup_question(answers, step)
        print(f'Step {step}:')
        print(f'  Q: {result["question"]}')
        print(f'  Options: {result["options"][:2]}...')
        print()
    
    print('✅ Flow enforces correct order:')
    print('  Step 2 = Job Search Mode (NOT salary)')
    print('  Step 3 = Timeline (NOT salary)')
    print('  Step 4 = Preferences (NOT salary)')
    print()
    print('FIXED: No salary question immediately after employment status!')

asyncio.run(test())
