import os
import subprocess

# Check if key is set
api_key = os.environ.get('OPENAI_API_KEY', '').strip()
if not api_key:
    print("❌ OPENAI_API_KEY is NOT set in environment variables")
    exit(1)

print(f"✓ OPENAI_API_KEY is set (length: {len(api_key)})")

# Test API connection
import requests
try:
    response = requests.get(
        'https://api.openai.com/v1/models',
        headers={'Authorization': f'Bearer {api_key}'},
        timeout=5
    )
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        print("✅ OpenAI API is WORKING - Authentication successful!")
        models = response.json().get('data', [])
        print(f"✓ Available models: {len(models)}")
    elif response.status_code == 401:
        print("❌ OpenAI API - AUTHENTICATION FAILED")
        print("Reason: Invalid API key or credentials expired")
        print(f"Error: {response.json().get('error', {}).get('message', 'Unknown')}")
    elif response.status_code == 429:
        print("⚠️ OpenAI API - RATE LIMIT EXCEEDED")
        print("Your account has exceeded rate limits temporarily")
    else:
        print(f"⚠️ OpenAI API - Response Code {response.status_code}")
        print(f"Error: {response.json()}")
except requests.exceptions.Timeout:
    print("❌ OpenAI API - TIMEOUT (Connection too slow)")
except requests.exceptions.ConnectionError:
    print("❌ OpenAI API - CONNECTION FAILED (Check internet)")
except Exception as e:
    print(f"❌ OpenAI API - ERROR: {str(e)}")
