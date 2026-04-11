# Resume Upload Not Working - Root Cause & Fix

## 🔴 CRITICAL ISSUE IDENTIFIED

**Single resume parsing for candidates is failing because AWS S3 credentials are NOT configured.**

---

## Root Cause Analysis

### Why Resume Upload Fails:

1. **Candidate uploads resume** → API stores path (e.g., `resumes/user_id/resume.pdf`)
2. **Background task starts** → `ResumeService.parse_resume_sync()` called
3. **AWS S3 Download Attempted** → But `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are NOT SET
4. **S3 Fails** → Returns error `"Storage download failed"`
5. **Parsing Never Happens** → Candidate gets "processing" message, but nothing actually extracts

### Missing Environment Variables:
```
❌ AWS_ACCESS_KEY_ID = Not Set
❌ AWS_SECRET_ACCESS_KEY = Not Set
❌ AWS_REGION = Not Set (defaults to ap-south-1)
❌ S3_BUCKET_NAME = Not Set (defaults to talentflow-files)
```

### Error in Logs (if you check):
```
⚠️ AWS credentials not configured. AWS_ACCESS_KEY_ID=False, AWS_SECRET_ACCESS_KEY=False
❌ [RESUME PARSING] AWS download error (General): Unable to locate credentials
```

---

## Solution: Configure AWS Credentials

### Option A: Set Environment Variables (RECOMMENDED)

1. **Get AWS Credentials:**
   - AWS Access Key ID
   - AWS Secret Access Key
   - S3 Bucket Name
   - AWS Region (e.g., ap-south-1 for Mumbai)

2. **Set Environment Variables (Windows PowerShell):**
   ```powershell
   # In PowerShell (before running API):
   $env:AWS_ACCESS_KEY_ID = "your_access_key_id_here"
   $env:AWS_SECRET_ACCESS_KEY = "your_secret_access_key_here"
   $env:AWS_REGION = "ap-south-1"
   $env:S3_BUCKET_NAME = "talentflow-files"
   $env:OPENAI_API_KEY = "your_openai_key_here"  # Also needed for parsing
   
   # Then start the API server
   cd "C:\Users\Admin\Desktop\Projects\TALENTFLOW"
   $env:PYTHONPATH = "apps\api"
   & ".\.venv\Scripts\python.exe" -m uvicorn apps.api.src.main:app --host 127.0.0.1 --port 8005
   ```

3. **Or Create .env File:**
   - Navigate to: `C:\Users\Admin\Desktop\Projects\TALENTFLOW\apps\api`
   - Create file: `.env`
   - Add:
   ```env
   AWS_ACCESS_KEY_ID=your_access_key_id_here
   AWS_SECRET_ACCESS_KEY=your_secret_access_key_here
   AWS_REGION=ap-south-1
   S3_BUCKET_NAME=talentflow-files
   OPENAI_API_KEY=your_openai_key_here
   GOOGLE_API_KEY=your_google_key_here
   ```

### Option B: Use AWS Credentials File (Advanced)

If using the AWS CLI credentials file at `C:\Users\Admin\.aws\credentials`:
```
[default]
aws_access_key_id = your_access_key_id_here
aws_secret_access_key = your_secret_access_key_here
```

The boto3 client will automatically pick these up.

### Option C: Run with Minimal Setup (Development Only)

If you don't have AWS configured yet, you can:
1. Add a local file storage fallback (not yet implemented)
2. Use mock credentials for testing (unsafe for production)
3. Skip resume parsing until AWS is configured

---

## What I Fixed in the Code

### 1. **Better AWS Credential Validation** ✅
**File:** `src/services/resume_service.py` (Lines 377-420)

**Before:** Silently failed with generic "Storage download failed" error
**After:** Explicitly logs whether AWS credentials are configured
```python
if not AWS_ACCESS_KEY_ID or not AWS_SECRET_ACCESS_KEY:
    msg = f"⚠️ AWS credentials not configured. AWS_ACCESS_KEY_ID={bool(AWS_ACCESS_KEY_ID)}"
    print(msg)
    logger.warning(msg)
```

### 2. **Improved Error Handling** ✅
**File:** `src/services/resume_service.py` (Lines 940-960)

**Before:** Background task failures were silently swallowed
**After:** Errors logged explicitly with full traceback
```python
except Exception as e:
    print(f"[RESUME PARSING] ❌ Resume parsing error for user {user_id}")
    print(f"[RESUME PARSING] Error message: {str(e)}")
    traceback.print_exc()
    logger.error(f"Resume parsing failed: {str(e)}", exc_info=True)
```

### 3. **Better Result Handling** ✅
**File:** `src/services/resume_service.py`

**Before:** Returned `None` on error
**After:** Returns detailed error dict
```python
return {"error": f"Resume parsing failed: {str(e)}"}
```

---

## Verify the Fix Works

### Step 1: Start API Server with AWS Credentials
```powershell
# PowerShell - from project root
cd "C:\Users\Admin\Desktop\Projects\TALENTFLOW"
$env:AWS_ACCESS_KEY_ID = "your_key_here"
$env:AWS_SECRET_ACCESS_KEY = "your_secret_here"
$env:OPENAI_API_KEY = "your_openai_key_here"
$env:S3_BUCKET_NAME = "talentflow-files"
$env:PYTHONPATH = "apps\api"
& ".\.venv\Scripts\python.exe" -m uvicorn apps.api.src.main:app --host 127.0.0.1 --port 8005
```

Expected output:
```
INFO: Uvicorn running on http://127.0.0.1:8005
INFO: Application startup complete
```

### Step 2: Check Server Logs for Resume Upload

When candidate uploads resume, watch the API console for:

**Success Case:**
```
[RESUME PARSING] Starting background task for user: {user_id}
[PDF EXTRACTION] Starting PDF text extraction...
[PDF EXTRACTION] PDF file size: 45678 bytes
[PDF EXTRACTION] Total pages found: 3
✅ Resume parsing completed for user {user_id}
```

**If AWS Credentials Still Missing:**
```
⚠️ AWS credentials not configured. AWS_ACCESS_KEY_ID=False
❌ S3 download error (General): Unable to locate credentials
Resume download failed from S3
```

---

## Status of Fixes Applied

| Issue | Status | Fix |
|-------|--------|-----|
| AWS credential checking | ✅ Fixed | Now logs whether credentials exist |
| S3 download error handling | ✅ Fixed | Better error messages with details |
| Background task error reporting | ✅ Fixed | Errors logged to console & logger |
| Sync/async event loop handling | ✅ Fixed | Proper error handling in parse_resume_sync |

---

## Next Steps to Get Resume Upload Working

### 1. **Get AWS Credentials** (Required)
   - Contact your AWS administrator
   - Or create an AWS account and S3 bucket
   - Get: Access Key ID, Secret Access Key

### 2. **Set Environment Variables** (5 minutes)
   - Follow "Option A" above
   - Or create `.env` file

### 3. **Set OpenAI/Google API Key** (Required)
   - Get API key from [OpenAI](https://platform.openai.com/api-keys) or [Google](https://ai.google.dev/)
   - Set `OPENAI_API_KEY` environment variable

### 4. **Test Resume Upload**
   - Login as candidate
   - Try uploading resume
   - Check API console logs (as shown in Step 2 above)
   - Resume should be parsed and profile populated

### 5. **Verify Profile Auto-Population**
   - Check CandidateProfile fields:
     - `current_role`
     - `years_of_experience`
     - `skills`
     - `location`
     - etc.

---

## File Changes Summary

**Modified Files:**
1. `apps/api/src/services/resume_service.py`
   - Lines 377-420: Better AWS credential validation
   - Lines 940-960: Improved error handling

**No Database Schema Changes Required**
**No Frontend Changes Required**
**Only Configuration Required: AWS & OpenAI API Keys**

---

## Troubleshooting

### Problem: "Storage download failed (S3)"
**Solution:** Check AWS credentials are set
```powershell
Write-Host "AWS_ACCESS_KEY_ID: $env:AWS_ACCESS_KEY_ID"
Write-Host "AWS_SECRET_ACCESS_KEY: $($env:AWS_SECRET_ACCESS_KEY.Substring(0,3))***"
```

### Problem: "No module named 'src'"
**Solution:** Run from correct directory with correct PYTHONPATH
```powershell
cd "C:\Users\Admin\Desktop\Projects\TALENTFLOW"
$env:PYTHONPATH = "apps\api"
```

### Problem: "Port 8005 already in use"
**Solution:** Kill existing process
```powershell
taskkill /F /IM python.exe
```

### Problem: "Permission denied - S3 bucket"
**Solution:** Check AWS credentials have correct permissions:
- `s3:GetObject`
- `s3:PutObject`
- On the bucket `talentflow-files` (or your bucket name)

---

## Security Notes

⚠️ **Never commit AWS credentials to git!**
- Use `.env` file in `.gitignore`
- Or use AWS IAM roles (for production)
- Environment variables are more secure than hardcoding

✅ **For Production:**
- Use AWS IAM roles instead of access keys
- Store credentials in AWS Secrets Manager
- Restrict S3 bucket permissions to minimum required
- Enable S3 bucket encryption
- Monitor S3 access logs

---

## Testing Complete Flow

### Test API Endpoint Directly (curl/Postman):

```bash
POST http://127.0.0.1:8005/api/v1/candidate/resume
Authorization: Bearer {candidate_jwt_token}
Content-Type: application/json

{
  "resume_path": "resumes/user_id/my-resume.pdf",
  "resume_url": null
}
```

Expected Response:
```json
{
  "status": "processing",
  "message": "Resume linked successfully. AI extraction is running in the background.",
  "resume_path": "resumes/user_id/my-resume.pdf"
}
```

Then check API logs for:
```
[RESUME PARSING] Starting background task for user: {user_id}
✅ Resume parsing completed for user {user_id}
```

---

**Last Updated:** April 10, 2026  
**Fix Status:** ✅ READY FOR DEPLOYMENT  
**Requires:** AWS Credentials Configuration
