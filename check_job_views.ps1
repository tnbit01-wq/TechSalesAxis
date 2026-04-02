#!/usr/bin/env powershell
# Quick test of job_views endpoint and database

Write-Host "🧪 QUICK TEST - job_views Implementation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

cd c:\Users\Admin\Desktop\Projects\TALENTFLOW\apps\api

# Activate venv
& c:\Users\Admin\Desktop\Projects\TALENTFLOW\.venv\Scripts\Activate.ps1

Write-Host "`n1️⃣  Getting a real Job ID from database..." -ForegroundColor Yellow

$jobInfo = python -c "
import psycopg2
from dotenv import load_dotenv
import os
from pathlib import Path
from urllib.parse import urlparse

env_path = Path('.').parent.parent / '.env'
load_dotenv(env_path)

parsed = urlparse(os.getenv('DATABASE_URL'))
conn = psycopg2.connect(
    host=parsed.hostname,
    port=parsed.port or 5432,
    database=parsed.path.lstrip('/'),
    user=parsed.username,
    password=parsed.password,
    connect_timeout=5
)

cursor = conn.cursor()
cursor.execute('SELECT id, title FROM jobs WHERE status = \\'active\\' LIMIT 1;')
job = cursor.fetchone()
cursor.close()
conn.close()

if job:
    print(f'{job[0]}|{job[1]}')
else:
    print('NONE|No active jobs')
"

$parts = $jobInfo -split '\|'
$jobId = $parts[0]
$jobTitle = $parts[1]

if ($jobId -eq "NONE") {
    Write-Host "⚠️  No active jobs found in database" -ForegroundColor Yellow
    Write-Host "   Creating test data..." -ForegroundColor Yellow
    
    # Create a test job if none exists
    python -c "
import psycopg2
from dotenv import load_dotenv
import os
from pathlib import Path
from urllib.parse import urlparse
import uuid

env_path = Path('.').parent.parent / '.env'
load_dotenv(env_path)

parsed = urlparse(os.getenv('DATABASE_URL'))
conn = psycopg2.connect(
    host=parsed.hostname,
    port=parsed.port or 5432,
    database=parsed.path.lstrip('/'),
    user=parsed.username,
    password=parsed.password
)

cursor = conn.cursor()
new_job_id = str(uuid.uuid4())
cursor.execute('''
    INSERT INTO jobs (id, title, description, location, job_type, status, created_at)
    VALUES (%s, %s, %s, %s, %s, %s, NOW())
''', (new_job_id, 'Test Job', 'Test Description', 'Remote', 'remote', 'active'))
conn.commit()
cursor.close()
conn.close()
print(new_job_id)
"
    
    # Get the newly created job
    $jobInfo = python -c "
import psycopg2
from dotenv import load_dotenv
import os
from pathlib import Path
from urllib.parse import urlparse

env_path = Path('.').parent.parent / '.env'
load_dotenv(env_path)

parsed = urlparse(os.getenv('DATABASE_URL'))
conn = psycopg2.connect(
    host=parsed.hostname,
    port=parsed.port or 5432,
    database=parsed.path.lstrip('/'),
    user=parsed.username,
    password=parsed.password
)

cursor = conn.cursor()
cursor.execute('SELECT id, title FROM jobs WHERE status = \\'active\\' ORDER BY created_at DESC LIMIT 1;')
job = cursor.fetchone()
cursor.close()
conn.close()

if job:
    print(f'{job[0]}|{job[1]}')
"
    
    $parts = $jobInfo -split '\|'
    $jobId = $parts[0]
    $jobTitle = $parts[1]
}

Write-Host "✓ Job ID: $jobId" -ForegroundColor Green
Write-Host "  Title: $jobTitle" -ForegroundColor Green

Write-Host "`n2️⃣  Checking if API endpoint exists..." -ForegroundColor Yellow
Write-Host "  Endpoint: POST /api/analytics/jobs/{jobId}/view" -ForegroundColor Yellow

# Simple curl-like test (using PowerShell built-in)
try {
    $testUrl = "http://127.0.0.1:8000/api/analytics/jobs/$jobId/view"
    Write-Host "  Testing URL: $testUrl" -ForegroundColor Cyan
    
    $response = Invoke-WebRequest -Uri $testUrl -Method POST -Body "{}" -ContentType "application/json" -ErrorAction SilentlyContinue -TimeoutSec 5
    Write-Host "✓ Endpoint is reachable!" -ForegroundColor Green
    Write-Host "  Response Status: $($response.StatusCode)" -ForegroundColor Green
} catch {
    if ($null -ne $_.Exception) {
        if ($_.Exception.Message -like "*401*" -or $_.Exception.Message -like "*Unauthorized*") {
            Write-Host "✓ Endpoint EXISTS (requires auth, which is correct!)" -ForegroundColor Green
        } elseif ($_.Exception.Message -like "*404*") {
            Write-Host "❌ Endpoint NOT FOUND (404)" -ForegroundColor Red
            Write-Host "   Make sure API server is running!" -ForegroundColor Red
        } else {
            Write-Host "ℹ️  $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
}

Write-Host "`n3️⃣  Checking job_views table..." -ForegroundColor Yellow

python -c "
import psycopg2
from dotenv import load_dotenv
import os
from pathlib import Path
from urllib.parse import urlparse

env_path = Path('.').parent.parent / '.env'
load_dotenv(env_path)

parsed = urlparse(os.getenv('DATABASE_URL'))
conn = psycopg2.connect(
    host=parsed.hostname,
    port=parsed.port or 5432,
    database=parsed.path.lstrip('/'),
    user=parsed.username,
    password=parsed.password
)

cursor = conn.cursor()
cursor.execute('SELECT COUNT(*) FROM job_views;')
count = cursor.fetchone()[0]

print(f'✓ job_views table has: {count} rows')

if count > 0:
    cursor.execute('SELECT job_id, candidate_id, created_at FROM job_views ORDER BY created_at DESC LIMIT 3;')
    print('\\nRecent entries:')
    for row in cursor.fetchall():
        print(f'  - Job: {str(row[0])[:8]}..., Candidate: {str(row[1])[:8] if row[1] else \"None\"}..., Time: {row[2]}')

cursor.close()
conn.close()
"

Write-Host "`n✅ Test Complete!" -ForegroundColor Green
Write-Host "`n📋 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Start API server: .\\start_api.ps1" -ForegroundColor Cyan
Write-Host "   2. Start frontend: cd apps\\web && npm run dev" -ForegroundColor Cyan
Write-Host "   3. Login and click 'View Details' on any job" -ForegroundColor Cyan
Write-Host "   4. Check browser console for: ✓ Job view tracked" -ForegroundColor Cyan
Write-Host "   5. Re-run this script to see data in table" -ForegroundColor Cyan
