import requests
import json
from datetime import datetime, timedelta
from jose import jwt
import uuid

# JWT Configuration
JWT_SECRET = "7c8e57bb9c29f040c2a83db8d27f4b1f8b22ca0096fa54333cae6bf28ad856a7"
ALGORITHM = "HS256"
API_URL = "http://127.0.0.1:8005/api/v1/intelligence"

# Generate a test user ID
test_user_id = str(uuid.uuid4())

# Create JWT Token
def create_test_token(user_id: str = test_user_id) -> str:
    """Generate a valid JWT token for testing"""
    payload = {
        "sub": user_id,
        "email": f"test_{user_id[:8]}@example.com",
        "exp": datetime.now() + timedelta(days=3)
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)
    return token, user_id

# Generate token
token, user_id = create_test_token()
headers = {"Authorization": f"Bearer {token}"}

print("=" * 80)
print("JWT TOKEN GENERATION & INTELLIGENCE ENDPOINT TESTING")
print("=" * 80)
print(f"\nGenerated JWT Token:")
print(f"  User ID: {user_id}")
print(f"  Token: {token[:50]}...{token[-20:]}")
print(f"  Expires: {datetime.now() + timedelta(days=3)}")
print(f"\nAPI Base URL: {API_URL}")
print(f"Authorization Header: Bearer {token[:30]}...")
print("\n" + "=" * 80)

# Track results
results = []

# 1. Health Check
print("\n[1] HEALTH CHECK ENDPOINT")
print("-" * 80)
try:
    response = requests.get(f"{API_URL}/health", headers=headers, timeout=5)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    results.append(("Health Check", response.status_code == 200))
except Exception as e:
    print(f"Error: {e}")
    results.append(("Health Check", False))

# 2. Career Readiness / Adaptive Question
print("\n[2] ADAPTIVE QUESTION ENDPOINT")
print("-" * 80)
try:
    payload = {
        "employment_status": "employed",
        "job_search_mode": "active",
        "timeline": "3-6 months",
        "salary_expectation": "70-90K",
        "preferences": ["remote", "growth"],
        "step": 1
    }
    response = requests.post(
        f"{API_URL}/career-readiness/adaptive-question",
        headers=headers,
        json=payload,
        timeout=5
    )
    print(f"Status Code: {response.status_code}")
    data = response.json()
    print(f"Response: {json.dumps(data, indent=2)}")
    results.append(("Adaptive Question", response.status_code in [200, 201]))
except Exception as e:
    print(f"Error: {e}")
    results.append(("Adaptive Question", False))

# 3. Skill Extraction Endpoint
print("\n[3] SKILL EXTRACTION ENDPOINT")
print("-" * 80)
try:
    payload = {
        "bio_text": "I have 5 years of Python development experience with FastAPI and Django, excellent with REST APIs and databases like PostgreSQL and MongoDB. Experienced in containerization with Docker and AWS cloud services.",
        "experience_band": "mid-level"
    }
    response = requests.post(
        f"{API_URL}/skills/extract-from-bio",
        headers=headers,
        json=payload,
        timeout=5
    )
    print(f"Status Code: {response.status_code}")
    data = response.json()
    print(f"Response: {json.dumps(data, indent=2)}")
    results.append(("Skill Extraction", response.status_code in [200, 201]))
except Exception as e:
    print(f"Error: {e}")
    results.append(("Skill Extraction", False))

# 4. Career Fit Endpoint
print("\n[4] CAREER FIT ENDPOINT")
print("-" * 80)
try:
    payload = {
        "target_role": "Senior Backend Developer",
        "include_full_analysis": True
    }
    response = requests.post(
        f"{API_URL}/career-fit/calculate",
        headers=headers,
        json=payload,
        timeout=5
    )
    print(f"Status Code: {response.status_code}")
    data = response.json()
    print(f"Response: {json.dumps(data, indent=2)}")
    results.append(("Career Fit", response.status_code in [200, 201]))
except Exception as e:
    print(f"Error: {e}")
    results.append(("Career Fit", False))

# 5. Personalized Recommendations Endpoint
print("\n[5] RECOMMENDATIONS ENDPOINT")
print("-" * 80)
try:
    payload = {
        "career_stage": "mid-level",
        "include_timeline": True
    }
    response = requests.post(
        f"{API_URL}/recommendations/personalized",
        headers=headers,
        json=payload,
        timeout=5
    )
    print(f"Status Code: {response.status_code}")
    data = response.json()
    print(f"Response: {json.dumps(data, indent=2)}")
    results.append(("Personalized Recommendations", response.status_code in [200, 201]))
except Exception as e:
    print(f"Error: {e}")
    results.append(("Personalized Recommendations", False))

# 6. Learning Path Endpoint
print("\n[6] LEARNING PATH ENDPOINT")
print("-" * 80)
try:
    payload = {
        "target_role": "Tech Lead",
        "current_skills": ["Python", "FastAPI", "PostgreSQL"]
    }
    response = requests.post(
        f"{API_URL}/skills/recommend-learning-path",
        headers=headers,
        json=payload,
        timeout=5
    )
    print(f"Status Code: {response.status_code}")
    data = response.json()
    print(f"Response: {json.dumps(data, indent=2)}")
    results.append(("Learning Path Recommendation", response.status_code in [200, 201]))
except Exception as e:
    print(f"Error: {e}")
    results.append(("Learning Path Recommendation", False))

# Summary
print("\n" + "=" * 80)
print("TEST SUMMARY")
print("=" * 80)
for endpoint, success in results:
    status = "? PASS" if success else "? FAIL"
    print(f"{status} - {endpoint}")

passed = sum(1 for _, success in results if success)
print(f"\nTotal: {passed}/{len(results)} endpoints passed")
print("=" * 80)
print("\nTest completed with JWT Token Authentication")
