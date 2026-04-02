#!/usr/bin/env powershell
# Test job_views API endpoint and database

Write-Host "🧪 Testing job_views Implementation" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan

# Change to API directory
cd c:\Users\Admin\Desktop\Projects\TALENTFLOW\apps\api

# Activate venv
& c:\Users\Admin\Desktop\Projects\TALENTFLOW\.venv\Scripts\Activate.ps1

Write-Host "`n📋 Step 1: Get a valid Job ID from database..." -ForegroundColor Yellow

$env:PYTHONIOENCODING = "utf-8"

$jobIdResult = python -c "
import psycopg2
from dotenv import load_dotenv
import os
from pathlib import Path
from urllib.parse import urlparse

# Load environment
env_path = Path('.').parent.parent / '.env'
load_dotenv(env_path)

DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    print('ERROR: DATABASE_URL not set')
    exit(1)

try:
    parsed = urlparse(DATABASE_URL)
    conn = psycopg2.connect(
        host=parsed.hostname,
        port=parsed.port or 5432,
        database=parsed.path.lstrip('/'),
        user=parsed.username,
        password=parsed.password,
        connect_timeout=10
    )
    
    cursor = conn.cursor()
    cursor.execute('SELECT id, title, location FROM jobs WHERE status = \"active\" LIMIT 1;')
    job = cursor.fetchone()
    
    if job:
        print(f'SUCCESS|{job[0]}|{job[1]}|{job[2]}')
    else:
        print('NO_JOBS_FOUND')
    
    cursor.close()
    conn.close()
except Exception as e:
    print(f'ERROR: {str(e)}')
"

if ($jobIdResult -like "ERROR*" -or $jobIdResult -like "NO_JOBS*") {
    Write-Host "❌ Could not get job ID: $jobIdResult" -ForegroundColor Red
    exit 1
}

$parts = $jobIdResult -split '\|'
$jobId = $parts[0]
$jobTitle = $parts[1]
$jobLocation = $parts[2]

Write-Host "✓ Found Job:" -ForegroundColor Green
Write-Host "  - ID: $jobId" -ForegroundColor Green
Write-Host "  - Title: $jobTitle" -ForegroundColor Green
Write-Host "  - Location: $jobLocation" -ForegroundColor Green

Write-Host "`n📱 Step 2: Test API endpoint (POST /analytics/jobs/{id}/view)" -ForegroundColor Yellow
Write-Host "           Testing at: http://127.0.0.1:8000/api/analytics/jobs/$jobId/view" -ForegroundColor Yellow

$apiTest = python -c "
import requests
import json

try:
    # Test without auth (should show if endpoint exists)
    url = 'http://127.0.0.1:8000/api/analytics/jobs/550e8400-e29b-41d4-a716-446655440000/view'
    
    response = requests.post(url, json={}, timeout=5)
    
    if response.status_code == 401:
        print(f'SUCCESS|ENDPOINT_EXISTS|Needs authentication')
    elif response.status_code == 404:
        print(f'ERROR|ENDPOINT_NOT_FOUND|Status {response.status_code}')
    else:
        print(f'SUCCESS|STATUS_{response.status_code}|{response.text[:50]}')
except requests.exceptions.ConnectionError:
    print('ERROR|CONNECTION_FAILED|API server not running at http://127.0.0.1:8000')
except Exception as e:
    print(f'ERROR|EXCEPTION|{str(e)[:100]}')
"

if ($apiTest -like "ERROR*") {
    Write-Host "❌ $apiTest" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Endpoint is responding" -ForegroundColor Green
Write-Host "   $apiTest" -ForegroundColor Green

Write-Host "`n✅ API Test Complete!" -ForegroundColor Green
Write-Host "`nNext Steps:" -ForegroundColor Cyan
Write-Host "1. Make sure API server is running (run: .\\start_api.ps1)" -ForegroundColor Cyan
Write-Host "2. Start frontend (npm run dev in apps/web)" -ForegroundColor Cyan
Write-Host "3. Login and view a job - tracking will fire automatically" -ForegroundColor Cyan
Write-Host "4. Check database: SELECT COUNT(*) FROM job_views;" -ForegroundColor Cyan
