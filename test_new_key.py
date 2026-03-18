
import asyncio
import os
import sys
import httpx
from dotenv import load_dotenv

# Add apps/api to path
sys.path.append(os.path.join(os.getcwd(), 'apps', 'api'))
load_dotenv(dotenv_path='apps/api/.env')

async def test_openai_key():
    new_key = os.getenv("OPENAI_API_KEY", "")
    if not new_key:
        print("OPENAI_API_KEY is not set. Export it before running this script.")
        return
    
    print("--- TESTING OPENAI API KEY FROM ENV ---")
    print(f"Key starts with: {new_key[:10]}...")

    # 1. Test Key Validity & Model Access
    print("\n--- Testing OpenAI Models Access ---")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://api.openai.com/v1/models",
                headers={"Authorization": f"Bearer {new_key}"}
            )
            if response.status_code == 200:
                models = response.json().get('data', [])
                model_ids = [m['id'] for m in models]
                print(f"Key is VALID. Found {len(model_ids)} models.")
                
                # Check for critical models
                targets = ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"]
                available_targets = [m for m in targets if m in model_ids]
                print(f"Relevant Available Models: {available_targets}")
            else:
                print(f"Key check failed with status {response.status_code}: {response.text}")
    except Exception as e:
        print(f"Request Error: {str(e)}")

    # 2. Test Quota/Completion
    print("\n--- Testing Completion (Quota Check) ---")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {new_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-4o-mini",
                    "messages": [{"role": "user", "content": "hi"}],
                    "max_tokens": 5
                }
            )
            if response.status_code == 200:
                print("Completion Success: Quota is available.")
                # Check headers for rate limits if available
                rl_limit = response.headers.get('x-ratelimit-limit-requests')
                rl_remaining = response.headers.get('x-ratelimit-remaining-requests')
                print(f"Rate Limit (Requests): {rl_limit}, Remaining: {rl_remaining}")
            else:
                print(f"Completion failed: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"Request Error: {str(e)}")

if __name__ == "__main__":
    asyncio.run(test_openai_key())
