# Test Recruiter Job Views Implementation
# This script verifies the complete job views notification system for recruiters

Write-Host "
╔════════════════════════════════════════════════════════════════╗
║  🎯 TEST: Recruiter Job Views Notification System             ║
║  Tests: API endpoint + Database + Frontend UI                 ║
╚════════════════════════════════════════════════════════════════╝
" -ForegroundColor Cyan

Write-Host "Prerequisites Check..." -ForegroundColor Yellow

# Check if Python venv exists
if (-not (Test-Path ".\.venv\Scripts\python.exe")) {
    Write-Host "❌ Python environment not found" -ForegroundColor Red
    exit 1
}

# Check if we can import required modules
$pythonCheck = & ".\.venv\Scripts\python.exe" -c "
import psycopg2
import os
from dotenv import load_dotenv
load_dotenv()
print('✓ Python modules available')
" 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Python modules missing" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Prerequisites OK" -ForegroundColor Green

Write-Host "`n" + ("="*60) -ForegroundColor Cyan
Write-Host "STEP 1: Check Database - Get Job and Candidate IDs" -ForegroundColor Cyan
Write-Host ("="*60) -ForegroundColor Cyan

$pythonScript = @"
import psycopg2
import os
from dotenv import load_dotenv
import json

load_dotenv()

# Get DB connection
db_host = os.getenv('DB_HOST')
db_user = os.getenv('DB_USER')
db_password = os.getenv('DB_PASSWORD')
db_name = os.getenv('DB_NAME')

try:
    conn = psycopg2.connect(
        host=db_host,
        user=db_user,
        password=db_password,
        database=db_name
    )
    cursor = conn.cursor()
    
    # Get a recruiter
    cursor.execute('''
        SELECT id, full_name FROM recruiter_profiles LIMIT 1;
    ''')
    recruiter = cursor.fetchone()
    if recruiter:
        print(f'\n✓ Recruiter: {recruiter[1]} ({recruiter[0]})')
    else:
        print('\n❌ No recruiter found')
        exit(1)
    
    # Get a job by this recruiter
    cursor.execute('''
        SELECT id, title FROM jobs WHERE recruiter_id = %s AND status = 'active' LIMIT 1;
    ''', (recruiter[0],))
    job = cursor.fetchone()
    if job:
        print(f'✓ Job: {job[1]} ({job[0]})')
    else:
        print('❌ No active jobs found for this recruiter')
        exit(1)
    
    # Get a candidate
    cursor.execute('''
        SELECT id, full_name FROM candidate_profiles LIMIT 1;
    ''')
    candidate = cursor.fetchone()
    if candidate:
        print(f'✓ Candidate: {candidate[1]} ({candidate[0]})')
    else:
        print('❌ No candidates found')
        exit(1)
    
    # Check current job_views count
    cursor.execute('SELECT COUNT(*) FROM job_views;')
    views_count = cursor.fetchone()[0]
    print(f'✓ Current job_views table: {views_count} rows')
    
    # Check recent views for this job
    cursor.execute('''
        SELECT COUNT(*) FROM job_views WHERE job_id = %s;
    ''', (job[0],))
    job_views_count = cursor.fetchone()[0]
    print(f'✓ Views for this job: {job_views_count}')
    
    # Output IDs for API testing
    print(f'\n📋 Use these IDs for API testing:')
    print(f'RECRUITER_ID={recruiter[0]}')
    print(f'JOB_ID={job[0]}')
    print(f'CANDIDATE_ID={candidate[0]}')
    
    cursor.close()
    conn.close()
    
except Exception as e:
    print(f'❌ Database error: {str(e)}')
    exit(1)
"@

$result = & ".\.venv\Scripts\python.exe" -c $pythonScript 2>&1
Write-Host $result

Write-Host "`n" + ("="*60) -ForegroundColor Cyan
Write-Host "STEP 2: Check API Endpoint - GET /analytics/recruiter/recent-job-views" -ForegroundColor Cyan
Write-Host ("="*60) -ForegroundColor Cyan

Write-Host "`n📝 Testing new API endpoint..." -ForegroundColor Yellow
Write-Host "Note: Make sure API is running on port 8000 before proceeding" -ForegroundColor Gray

Write-Host "`nTo test this endpoint:" -ForegroundColor Yellow
Write-Host "
1. Start the API:
   .\start_api.ps1

2. Get recruiter token (login as recruiter)

3. Test the endpoint:
   `$token = '<YOUR_TOKEN>'
   `$headers = @{
       'Authorization' = 'Bearer ' + `$token
       'Content-Type' = 'application/json'
   }
   `$response = Invoke-WebRequest -Uri 'http://localhost:8000/api/analytics/recruiter/recent-job-views' -Headers `$headers
   `$response.Content | ConvertFrom-Json | Format-Table

" -ForegroundColor Cyan

Write-Host "`n" + ("="*60) -ForegroundColor Cyan
Write-Host "STEP 3: Test Candidate Job View Tracking" -ForegroundColor Cyan
Write-Host ("="*60) -ForegroundColor Cyan

Write-Host "@
Simulate a candidate viewing a job:

1. Start frontend:
   cd apps\web
   npm run dev

2. Login as a candidate

3. Navigate to Jobs section

4. Click 'View Details' on a job

5. Check browser console for: ✓ Job view tracked 

6. Check job_views table:
   SELECT * FROM job_views ORDER BY created_at DESC LIMIT 5;

" -ForegroundColor Cyan

Write-Host "`n" + ("="*60) -ForegroundColor Cyan
Write-Host "STEP 4: Verify Recruiter Dashboard - Recent Job Views Card" -ForegroundColor Cyan
Write-Host ("="*60) -ForegroundColor Cyan

Write-Host "
When you have job views recorded, the recruiter dashboard should show:

✓ 'Recent Job Views' card with:
  - List of who viewed which jobs
  - Timestamp for each view
  - Candidate name + Job title
  - View count badges on job cards

📊 Expected behavior:
  - Card appears only if there are recent views
  - Shows up to 10 most recent views
  - Updates when new job views are recorded
  - Scrollable if more than 5 views

" -ForegroundColor Green

Write-Host "`n" + ("="*60) -ForegroundColor Cyan
Write-Host "VERIFICATION CHECKLIST" -ForegroundColor Cyan
Write-Host ("="*60) -ForegroundColor Cyan

Write-Host "
Database Level:
  [ ] job_views table has entries after candidates view jobs
  [ ] Each entry has: job_id, candidate_id, created_at

API Level:
  [ ] GET /api/analytics/recruiter/recent-job-views returns data
  [ ] Response includes: job views with candidate names and job titles
  [ ] Only returns jobs belonging to authenticated recruiter

Frontend - Candidate Side:
  [ ] When candidate views a job, console shows 'Job view tracked'
  [ ] No 404 errors in console

Frontend - Recruiter Side:
  [ ] Dashboard loads without errors
  [ ] Recent Job Views card appears if there are views
  [ ] View count badges show on job cards
  [ ] Clicking a recent view shows correct info
  [ ] Card scrolls if needed

TROUBLESHOOTING:
  - No Recent Views card: Check if job_views table has data
  - 404 on endpoint call: Restart API server (.\start_api.ps1)
  - Console errors: Check browser F12 -> Console tab
  - Database shows 0 rows: Candidate views not being triggered
" -ForegroundColor Yellow

Write-Host "`n✅ Test guide complete!" -ForegroundColor Green
