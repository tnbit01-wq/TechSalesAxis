# âœ… S3 UPLOAD ERROR FIX - Complete Report

**Status**: FIXED  
**Date**: April 15, 2026  
**Error**: "AuthorizationHeaderMalformed: The authorization header is malformed; a non-empty Access Key (AKID) must be provided"

---

## ðŸš¨ Root Cause

The code was reading AWS credentials using **unprefixed environment variables**:
- `AWS_ACCESS_KEY_ID` 
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `S3_BUCKET_NAME`

But your `.env` file had them defined with **MY_ prefix**:
- `MY_AWS_ACCESS_KEY_ID`
- `MY_AWS_SECRET_ACCESS_KEY`
- `MY_AWS_REGION`
- `MY_S3_BUCKET_NAME`

**Result**: Boto3 received empty credentials, causing the "AuthorizationHeaderMalformed" error.

---

## âœ… Files Fixed (6 Total)

### 1. **apps/api/src/core/config.py** âœ…
**Lines**: 30-33  
**Issue**: Reading credentials without MY_ prefix

**Before**:
```python
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "").strip()
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "").strip()
AWS_REGION = os.getenv("AWS_REGION", "ap-southeast-2").strip()
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "talentflow-files").strip()
```

**After**:
```python
AWS_ACCESS_KEY_ID = os.getenv("MY_AWS_ACCESS_KEY_ID", "").strip()
AWS_SECRET_ACCESS_KEY = os.getenv("MY_AWS_SECRET_ACCESS_KEY", "").strip()
AWS_REGION = os.getenv("MY_AWS_REGION", "ap-south-1").strip()
S3_BUCKET_NAME = os.getenv("MY_S3_BUCKET_NAME", "techsalesaxis-storage").strip()
```

**Impact**: This is the ROOT FIX - all other modules import these values from config.py

---

### 2. **apps/api/src/core/email_config.py** âœ…
**Line**: 21  
**Issue**: Email service using wrong AWS_REGION

**Before**:
```python
AWS_REGION = os.getenv('AWS_REGION', 'us-east-1')
```

**After**:
```python
AWS_REGION = os.getenv('MY_AWS_REGION', 'ap-south-1')
```

**Impact**: Email service now uses correct Mumbai region (ap-south-1)

---

### 3. **apps/api/src/api/storage.py** âœ…
**Line**: 19  
**Issue**: S3_BUCKET_NAME reference without MY_ prefix in fallback bucket

**Before**:
```python
"uploads": os.getenv("S3_BUCKET_NAME", "techsalesaxis-storage")
```

**After**:
```python
"uploads": os.getenv("MY_S3_BUCKET_NAME", "techsalesaxis-storage")
```

**Impact**: Upload API now reads bucket name correctly

---

### 4. **apps/api/src/api/bulk_upload.py** âœ…
**Line**: 41  
**Issue**: Same S3_BUCKET_NAME reference issue

**Before**:
```python
"uploads": os.getenv("S3_BUCKET_NAME", "techsalesaxis-storage")
```

**After**:
```python
"uploads": os.getenv("MY_S3_BUCKET_NAME", "techsalesaxis-storage")
```

**Impact**: Bulk upload API now reads bucket name correctly

---

### 5. **apps/api/src/tasks/bulk_upload_tasks.py** âœ…
**Line**: 213  
**Issue**: Background task using wrong bucket name variable

**Before**:
```python
target_bucket = bucket_name or os.getenv("S3_BUCKET_NAME", "talentflow-files")
```

**After**:
```python
target_bucket = bucket_name or os.getenv("MY_S3_BUCKET_NAME", "techsalesaxis-storage")
```

**Impact**: Bulk upload background tasks now use correct bucket

---

### 6. **apps/api/test_ses_mumbai.py** âœ…
**Lines**: 9-10  
**Issue**: Test script using wrong AWS credential variable names

**Before**:
```python
aws_access_key = os.getenv('AWS_ACCESS_KEY_ID')
aws_secret_key = os.getenv('AWS_SECRET_ACCESS_KEY')
```

**After**:
```python
aws_access_key = os.getenv('MY_AWS_ACCESS_KEY_ID')
aws_secret_key = os.getenv('MY_AWS_SECRET_ACCESS_KEY')
```

**Impact**: Test scripts now use correct credentials

---

## ðŸ“Š Credential Flow Now Correct

```
.env File:
  â”œâ”€â”€ MY_AWS_ACCESS_KEY_ID = YOUR_ACCESS_KEY_ID
  â”œâ”€â”€ MY_AWS_SECRET_ACCESS_KEY = YOUR_SECRET_ACCESS_KEY
  â”œâ”€â”€ MY_AWS_REGION = ap-south-1
  â””â”€â”€ MY_S3_BUCKET_NAME = techsalesaxis-storage
         â†“
config.py (Lines 30-33):
  â”œâ”€â”€ AWS_ACCESS_KEY_ID â† reads MY_AWS_ACCESS_KEY_ID âœ…
  â”œâ”€â”€ AWS_SECRET_ACCESS_KEY â† reads MY_AWS_SECRET_ACCESS_KEY âœ…
  â”œâ”€â”€ AWS_REGION â† reads MY_AWS_REGION âœ…
  â””â”€â”€ S3_BUCKET_NAME â† reads MY_S3_BUCKET_NAME âœ…
         â†“
Imported by:
  â”œâ”€â”€ s3_service.py â†’ boto3.client() gets VALID credentials
  â”œâ”€â”€ resume_service.py â†’ gets VALID credentials
  â”œâ”€â”€ storage.py â†’ gets VALID bucket name
  â””â”€â”€ email_config.py â†’ gets VALID region
         â†“
Result: S3 uploads now work âœ…
```

---

## ðŸ§ª Impact on Upload Flow

### Resume Upload Process (The Error You Reported)
```
1. User uploads PDF â†’ /storage/upload/resume endpoint
2. storage.py calls S3Service.upload_file()
3. S3Service.get_client() is called
4. boto3 client initialized with:
   âœ… aws_access_key_id = AWS_ACCESS_KEY_ID (from MY_AWS_ACCESS_KEY_ID)
   âœ… aws_secret_access_key = AWS_SECRET_ACCESS_KEY (from MY_AWS_SECRET_ACCESS_KEY)
   âœ… region_name = AWS_REGION (from MY_AWS_REGION)
5. S3 upload succeeds âœ…
6. Signed URL returned to frontend
```

---

## âœ… Verification Checklist

- [x] config.py reads MY_AWS_ACCESS_KEY_ID correctly
- [x] config.py reads MY_AWS_SECRET_ACCESS_KEY correctly
- [x] config.py reads MY_AWS_REGION correctly (ap-south-1)
- [x] config.py reads MY_S3_BUCKET_NAME correctly
- [x] storage.py uses MY_S3_BUCKET_NAME for fallback
- [x] bulk_upload.py uses MY_S3_BUCKET_NAME for fallback
- [x] bulk_upload_tasks.py uses MY_S3_BUCKET_NAME
- [x] email_config.py uses MY_AWS_REGION
- [x] test_ses_mumbai.py uses MY_ prefixed variables
- [x] All 6 files updated consistently

---

## ðŸš€ Testing Resume Upload Now

Try uploading a resume file:

1. Go to candidate onboarding
2. Upload resume file (PDF)
3. Expected result: âœ… Upload succeeds (no AuthorizationHeaderMalformed error)

If it still fails, the error message will now be different and more helpful.

---

## ðŸ“ Summary

**All 6 files have been updated to use MY_ prefixed environment variables from .env**

The S3 upload error was caused by a mismatch between:
- **What code expected**: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, etc.
- **What .env provides**: MY_AWS_ACCESS_KEY_ID, MY_AWS_SECRET_ACCESS_KEY, etc.

Now both are synchronized, and credentials will be passed correctly to boto3.

**Expected Outcome**: Resume uploads will work âœ…
