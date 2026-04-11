import requests
import json
from datetime import datetime

BASE_URL = "http://127.0.0.1:8005"

def test_endpoints():
    """Test the main intelligence endpoints with corrected parameters"""
    
    endpoints = [
        {
            "name": "Health Check",
            "method": "GET",
            "endpoint": "/api/v1/intelligence/health",
            "data": None
        },
        {
            "name": "Adaptive Question",
            "method": "POST",
            "endpoint": "/api/v1/intelligence/career-readiness/adaptive-question",
            "data": {
                "user_id": "test_user_123",
                "context": {"experience_level": "intermediate"}
            }
        },
        {
            "name": "Skill Extraction",
            "method": "POST",
            "endpoint": "/api/v1/intelligence/skills/extract-from-bio",
            "data": {
                "bio_text": "I have 5 years of experience in Python, JavaScript, and cloud architecture. I'm proficient in AWS, Docker, and Kubernetes.",
                "experience_band": "senior"
            }
        },
        {
            "name": "Career Fit Calculation",
            "method": "POST",
            "endpoint": "/api/v1/intelligence/career-fit/calculate",
            "data": {
                "user_skills": ["Python", "JavaScript", "AWS"],
                "job_requirements": ["Python", "JavaScript", "Docker"]
            }
        },
        {
            "name": "Personalized Recommendations",
            "method": "POST",
            "endpoint": "/api/v1/intelligence/recommendations/personalized",
            "data": {
                "user_id": "test_user_123",
                "current_skills": ["Python", "JavaScript"],
                "career_stage": "mid-level",
                "experience_level": "intermediate"
            }
        }
    ]
    
    results_summary = []
    
    print(f"Testing Intelligence Endpoints - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Base URL: {BASE_URL}")
    print("=" * 80)
    
    for endpoint_config in endpoints:
        print(f"\n📌 Testing: {endpoint_config['name']}")
        print(f"   Method: {endpoint_config['method']}")
        print(f"   Endpoint: {endpoint_config['endpoint']}")
        
        result = {
            "name": endpoint_config['name'],
            "status": "Unknown",
            "status_code": None,
            "details": ""
        }
        
        try:
            url = BASE_URL + endpoint_config['endpoint']
            
            if endpoint_config['method'] == "GET":
                response = requests.get(url, timeout=5)
            else:
                headers = {'Content-Type': 'application/json'}
                response = requests.post(url, json=endpoint_config['data'], headers=headers, timeout=5)
            
            print(f"   Status Code: {response.status_code}")
            result['status_code'] = response.status_code
            
            if response.status_code == 401:
                result['status'] = "UNAUTHORIZED"
                print("   Result: ⚠️  Unauthorized (401) - JWT token required")
            elif response.status_code == 404:
                result['status'] = "NOT_FOUND"
                print("   Result: ❌ Not Found (404) - Endpoint does not exist")
            elif response.status_code == 422:
                result['status'] = "VALIDATION_ERROR"
                print("   Result: ⚠️  Unprocessable Entity (422) - Invalid request parameters")
                try:
                    details = response.json()
                    print(f"   Error Details: {json.dumps(details, indent=2)[:300]}")
                    result['details'] = str(details)
                except:
                    print(f"   Response: {response.text[:200]}")
                    result['details'] = response.text[:200]
            elif 200 <= response.status_code < 300:
                result['status'] = "SUCCESS"
                print("   Result: ✅ Success")
                try:
                    resp_json = response.json()
                    print(f"   Response: {json.dumps(resp_json, indent=2)[:800]}")
                    result['details'] = str(resp_json)
                except:
                    print(f"   Response: {response.text[:500]}")
                    result['details'] = response.text[:200]
            else:
                result['status'] = f"HTTP_{response.status_code}"
                print(f"   Result: ⚠️  HTTP {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                result['details'] = response.text[:200]
                
        except requests.exceptions.ConnectionError:
            result['status'] = "CONNECTION_ERROR"
            print("   Result: ❌ Connection Error - Server may not be running")
        except requests.exceptions.Timeout:
            result['status'] = "TIMEOUT"
            print("   Result: ❌ Timeout - Server not responding")
        except Exception as e:
            result['status'] = "ERROR"
            print(f"   Result: ❌ Error - {type(e).__name__}: {str(e)}")
            result['details'] = f"{type(e).__name__}: {str(e)}"
        
        results_summary.append(result)
        print("   " + "-" * 76)
    
    # Print Summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    for result in results_summary:
        status_icon = {
            "SUCCESS": "✅",
            "UNAUTHORIZED": "⚠️",
            "VALIDATION_ERROR": "⚠️",
            "NOT_FOUND": "❌",
            "CONNECTION_ERROR": "❌",
            "TIMEOUT": "❌",
            "ERROR": "❌"
        }.get(result['status'], "❓")
        print(f"{status_icon} {result['name']:40} | {result['status']:20} | {result['status_code']}")

if __name__ == "__main__":
    print("Starting API endpoint tests...\n")
    test_endpoints()
    print("\nTest completed!")
