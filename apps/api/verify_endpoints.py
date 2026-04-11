from src.main import app
from fastapi.openapi.utils import get_openapi

try:
    schema = get_openapi(
        title=app.title,
        version='1.0.0',
        routes=app.routes,
    )
    
    paths = schema.get('paths', {})
    
    print('=' * 80)
    print('ONBOARDING API ENDPOINTS VERIFICATION')
    print('=' * 80)
    
    # Critical endpoints for onboarding
    critical_endpoints = {
        'Career Readiness': [
            '/api/v1/candidate/career-readiness/save',
            '/api/v1/intelligence/career-readiness/adaptive-question',
        ],
        'Conversational Onboarding': [
            '/api/v1/intelligence/onboarding/conversational',
        ],
        'Skills & Roles': [
            '/api/v1/intelligence/skills/extract-from-bio',
            '/api/v1/intelligence/resume/suggest-roles',
            '/api/v1/intelligence/skills/rank-for-role',
        ],
    }
    
    all_found = True
    
    for category, endpoints in critical_endpoints.items():
        print(f'\n{category}:')
        for endpoint in endpoints:
            found = endpoint in paths
            status = '✅' if found else '❌'
            print(f'  {status} {endpoint}')
            if not found:
                all_found = False
    
    # Show all intelligence endpoints
    print(f'\nTotal Intelligence Endpoints: {len([p for p in paths if "intelligence" in p])}')
    
    print('\n' + '=' * 80)
    if all_found:
        print('✅ ALL CRITICAL ENDPOINTS REGISTERED AND READY')
    else:
        print('❌ SOME ENDPOINTS MISSING - See above')
    print('=' * 80)
    
except Exception as e:
    print(f'Error: {str(e)}')
    import traceback
    traceback.print_exc()
