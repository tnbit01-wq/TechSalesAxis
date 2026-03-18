
import asyncio
import os
import sys
from dotenv import load_dotenv

# Add current directory to path
sys.path.append(os.getcwd())
load_dotenv()

from src.services.resume_service import ResumeService

async def debug_parse():
    user_id = 'a951825b-e862-430d-b0e7-5fa29f95f7a2'
    resume_path = 'resumes/a951825b-e862-430d-b0e7-5fa29f95f7a2-1772534926787.pdf'
    google_key = os.getenv('GOOGLE_API_KEY')
    
    print(f"--- DEBUGGING PARSE FOR USER {user_id} ---")
    print(f"Using Key: {google_key[:5]}...{google_key[-5:] if google_key else 'None'}")
    
    try:
        result = await ResumeService.parse_resume(user_id, resume_path, google_key)
        print("\n--- RESULTS ---")
        import json
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(f"\n--- CRITICAL ERROR ---")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(debug_parse())
