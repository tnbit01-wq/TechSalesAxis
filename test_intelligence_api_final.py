import requests
import json
from datetime import datetime

BASE_URL = "http://127.0.0.1:8005"

# Create a dummy JWT token (this will likely still fail but with better error messages)
DUMMY_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0X3VzZXIiLCJpYXQiOjE2ODA2NDAwMDB9.test"

def test_endpoints_with_auth():
    """Test intelligence endpoints with JWT authentication"""
    
    endpoints = [
        {
            "name": "Health Check (No Auth Required)",
            "method": "GET",
            "endpoint": "/api/v1/intelligence/health",
            "data": None,
            "authenticated": False
        },
        {
            "name": "Skill Extraction (With Auth)",
            "method": "POST",
            "endpoint": "/api/v1/intelligence/skills/extract-from-bio",
            "data": {
                "bio_text": "I have 5 years of experience in Python, JavaScript, and cloud architecture with AWS, Docker, and Kubernetes.",
                "experience_band": "senior"
            },
            "authenticated": True
        },
        {
            "name": "Adaptive Question (With Auth)",
            "method": "POST",
            "endpoint": "/api/v1/intelligence/career-readiness/adaptive-question",
            "data": {
                "user_id": "test_user_123",
                "context": {"experience_level": "intermediate"}
            },
            "authenticated": True
        },
        {
            "name": "Career Fit (With Auth)",
            "method": "POST",
            "endpoint": "/api/v1/intelligence/career-fit/calculate",
            "data": {
                "user_skills": ["Python", "JavaScript", "AWS"],
                "job_requirements": ["Python", "JavaScript", "Docker"]
            },
            "authenticated": True
        },
        {
            "name": "Recommendations (With Auth)",
            "method": "POST",
            "endpoint": "/api/v1/intelligence/recommendations/personalized",
            "data": {
                "user_id": "test_user_123",
                "current_skills": ["Python", "JavaScript"],
                "career_stage": "mid-level"
            },
            "authenticated": True
        }
    ]
    
    print(f"Intelligence Endpoints Test Report - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Base URL: {BASE_URL}")
    print(f"Test Format: Endpoint Testing with/without Authentication")
    print("=" * 100)
    
    success_count = 0
    error_count = 0
    unauthorized_count = 0
    
    for endpoint_config in endpoints:
        print(f"\n📡 {endpoint_config['name']}")
        print(f"   └─ {endpoint_config['method']} {endpoint_config['endpoint']}")
        
        try:
            url = BASE_URL + endpoint_config['endpoint']
            headers = {'Content-Type': 'application/json'}
            
            if endpoint_config['authenticated']:
                headers['Authorization'] = f'Bearer {DUMMY_JWT}'
            
            if endpoint_config['method'] == "GET":
                response = requests.get(url, headers=headers, timeout=5)
            else:
                response = requests.post(url, json=endpoint_config['data'], headers=headers, timeout=5)
            
            status_code = response.status_code
            
            # Determine status
            if 200 <= status_code < 300:
                icon = "✅"
                status = "SUCCESS"
                success_count += 1
                print(f"   {icon} Status: {status_code} - Response received successfully")
                try:
                    resp_data = response.json()
                    print(f"      Data: {json.dumps(resp_data, indent=8)[:400]}")
                except:
                    print(f"      Data: {response.text[:200]}")
            elif status_code == 401:
                icon = "🔐"
                status = "UNAUTHORIZED"
                unauthorized_count += 1
                print(f"   {icon} Status: {status_code} - {status}")
                print(f"      Message: JWT authentication required (expected for protected endpoints)")
            elif status_code == 404:
                icon = "❌"
                status = "NOT_FOUND"
                error_count += 1
                print(f"   {icon} Status: {status_code} - Endpoint not found")
            elif status_code == 422:
                icon = "⚠️"
                status = "VALIDATION_ERROR"
                error_count += 1
                print(f"   {icon} Status: {status_code} - Invalid parameters")
                try:
                    err_data = response.json()
                    if 'detail' in err_data and isinstance(err_data['detail'], list):
                        for err in err_data['detail'][:2]:
                            print(f"         - Missing: {err.get('loc', [])}")
                except:
                    pass
            else:
                icon = "⚠️"
                status = f"HTTP_{status_code}"
                error_count += 1
                print(f"   {icon} Status: {status_code} - {response.text[:100]}")
                
        except requests.exceptions.ConnectionError:
            error_count += 1
            print(f"   ❌ CONNECTION FAILED - Server not running on {BASE_URL}")
        except requests.exceptions.Timeout:
            error_count += 1
            print(f"   ❌ TIMEOUT - Server not responding")
        except Exception as e:
            error_count += 1
            print(f"   ❌ ERROR - {type(e).__name__}: {str(e)[:80]}")
    
    # Summary statistics
    print("\n" + "=" * 100)
    print(f"TEST SUMMARY")
    print("=" * 100)
    print(f"✅ Successful:    {success_count}")
    print(f"🔐 Unauthorized:  {unauthorized_count} (Protected endpoints requiring JWT)")
    print(f"❌ Errors:        {error_count}")
    print(f"📊 Total Tests:   {len(endpoints)}")
    print("\nNOTE: Protected endpoints return 401 Unauthorized because they require valid JWT tokens.")
    print("      The /api/v1/intelligence/health endpoint is public and returns 200 OK.")

if __name__ == "__main__":
    print("Starting Intelligence API Test Suite...\n")
    test_endpoints_with_auth()
    print("\n✅ Test suite completed!")
