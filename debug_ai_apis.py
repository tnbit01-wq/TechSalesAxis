
import asyncio
import os
import sys
from dotenv import load_dotenv

# Add apps/api to path
sys.path.append(os.path.join(os.getcwd(), 'apps', 'api'))
load_dotenv(dotenv_path='apps/api/.env')

from src.core.config import GOOGLE_API_KEY, OPENROUTER_API_KEY

async def test_ai():
    print(f"--- TESTING AI INTEGRATIONS ---")
    print(f"GOOGLE_API_KEY: {GOOGLE_API_KEY[:5]}...{GOOGLE_API_KEY[-5:] if GOOGLE_API_KEY else 'None'}")
    print(f"OPENROUTER_API_KEY: {OPENROUTER_API_KEY[:5]}...{OPENROUTER_API_KEY[-5:] if OPENROUTER_API_KEY else 'None'}")

    # Test Gemini
    print("\n--- Testing Gemini (Primary) ---")
    try:
        from google import genai
        client = genai.Client(api_key=GOOGLE_API_KEY)
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents="Say 'Gemini is working' if you can read this."
        )
        if response and response.text:
            print(f"Gemini Response: {response.text.strip()}")
        else:
            print("Gemini returned empty response.")
    except Exception as e:
        print(f"Gemini Failed: {str(e)}")

    # Test OpenRouter
    print("\n--- Testing OpenRouter (Secondary) ---")
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "openai/gpt-4o-mini",
                    "messages": [{"role": "user", "content": "Say 'OpenRouter is working' if you can read this."}],
                }
            )
            if response.status_code == 200:
                data = response.json()
                print(f"OpenRouter Response: {data['choices'][0]['message']['content'].strip()}")
            else:
                print(f"OpenRouter Failed with status {response.status_code}: {response.text}")
    except Exception as e:
        print(f"OpenRouter Failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(test_ai())
