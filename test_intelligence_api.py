import requests
import json
from datetime import datetime

BASE_URL = "http://127.0.0.1:8005"

def test_endpoints():
    """Test the main intelligence endpoints"""
    
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
                "bio": "I have 5 years of experience in Python, JavaScript, and cloud architecture. I'm proficient in AWS, Docker, and Kubernetes."
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
                "experience_level": "intermediate"
            }
        }
    ]
    
    print(f"Testing Intelligence Endpoints - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Base URL: {BASE_URL}")
    print("=" * 80)
    
    for endpoint_config in endpoints:
        print(f"\nTesting: {endpoint_config['name']}")
        print(f"Method: {endpoint_config['method']}")
        print(f"Endpoint: {endpoint_config['endpoint']}")
        
        try:
            url = BASE_URL + endpoint_config['endpoint']
            
            if endpoint_config['method'] == "GET":
                response = requests.get(url, timeout=5)
            else:
                headers = {'Content-Type': 'application/json'}
                response = requests.post(url, json=endpoint_config['data'], headers=headers, timeout=5)
            
            print(f"Status Code: {response.status_code}")
            
            if response.status_code == 401:
                print("Result: ⚠️  Unauthorized (401) - JWT token required")
            elif response.status_code == 404:
                print("Result: ❌ Not Found (404) - Endpoint may not exist")
            elif response.status_code == 422:
                print("Result: ⚠️  Unprocessable Entity (422) - Invalid request parameters")
                try:
                    print(f"Details: {response.json()}")
                except:
                    print(f"Response: {response.text[:200]}")
            elif 200 <= response.status_code < 300:
                print("Result: ✅ Success")
                try:
                    print(f"Response: {json.dumps(response.json(), indent=2)[:500]}")
                except:
                    print(f"Response: {response.text[:500]}")
            else:
                print(f"Result: ⚠️  HTTP {response.status_code}")
                print(f"Response: {response.text[:200]}")
                
        except requests.exceptions.ConnectionError:
            print("Result: ❌ Connection Error - Server may not be running on port 8005")
        except requests.exceptions.Timeout:
            print("Result: ❌ Timeout - Server is not responding")
        except Exception as e:
            print(f"Result: ❌ Error - {type(e).__name__}: {str(e)}")
        
        print("-" * 80)

if __name__ == "__main__":
    print("Starting API endpoint tests...\n")
    test_endpoints()
    print("\nTest completed!")
