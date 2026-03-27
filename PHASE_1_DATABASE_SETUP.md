"""
PHASE 1: DATABASE IMPLEMENTATION - START THIS WEEK
Complete step-by-step guide to deploy bulk upload database schema

Timeline: ~2-3 hours total

Prerequisites:
- PostgreSQL installed and running
- psql CLI available
- Database credentials ready
- Your current project structure intact
"""

# ============================================================================
# STEP-BY-STEP EXECUTION GUIDE
# ============================================================================

"""
PHASE 1: DATABASE SETUP
======================
Execution time: 30-45 minutes

STEP 1: Connect to PostgreSQL
────────────────────────────────────────────────────────────────────────────

Windows (PowerShell):
    psql -U postgres -h localhost -p 5432

Mac/Linux:
    psql -U postgres

When prompted, enter your PostgreSQL password.

Expected output:
    psql (13.x, server 13.x)
    Type "help" for help.
    postgres=#


STEP 2: List existing databases
────────────────────────────────────────────────────────────────────────────

Command:
    \\l

Expected output:
    List of databases
     Name     | Owner    | ...
    ──────────┼──────────┼────
     postgres | postgres | ...
     talentflow | postgres | ...
     ...

Note your database name (assuming: "talentflow")


STEP 3: Connect to your TalentFlow database
────────────────────────────────────────────────────────────────────────────

Command:
    \\c talentflow

Expected output:
    You are now connected to database "talentflow" as user "postgres".
    talentflow=#


STEP 4: Execute the bulk upload schema file
────────────────────────────────────────────────────────────────────────────

File location:
    docs/BULK_UPLOAD_DATABASE_SCHEMA.sql

Command in psql:
    \\i docs/BULK_UPLOAD_DATABASE_SCHEMA.sql

Or alternatively, from command line (exit psql first with \\q):
    psql -U postgres -d talentflow -f docs/BULK_UPLOAD_DATABASE_SCHEMA.sql

Expected output (takes 2-3 minutes):
    CREATE TABLE
    CREATE INDEX
    CREATE TABLE
    ... (repeat for all 8 tables)
    CREATE MATERIALIZED VIEW
    ... success messages


STEP 5: Verify all 8 tables were created
────────────────────────────────────────────────────────────────────────────

Command:
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name LIKE 'bulk_%'
    ORDER BY table_name;

Expected output:
     table_name
    ────────────────────────────────────────
     bulk_upload_audit_log
     bulk_upload_candidate_accounts
     bulk_upload_candidate_matches
     bulk_upload_files
     bulk_upload_processing_queue
     bulk_uploads
     (6 rows)

STEP 6: Verify materialized view
────────────────────────────────────────────────────────────────────────────

Command:
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    AND table_name LIKE 'admin_%';

Expected output:
     table_name
    ────────────────────────
     admin_permissions
    (1 row)


STEP 7: Verify indexes were created
────────────────────────────────────────────────────────────────────────────

Command:
    SELECT indexname FROM pg_indexes 
    WHERE tablename LIKE 'bulk_%'
    ORDER BY tablename;

Expected output:
           indexname
    ─────────────────────────────────────────
     idx_bulk_upload_files_bulk_id
     idx_bulk_upload_files_email
     idx_bulk_upload_files_hash
     idx_bulk_upload_files_phone
     idx_bulk_upload_files_status
     idx_bulk_uploads_admin_id
     idx_bulk_uploads_created
     idx_bulk_uploads_status
     idx_queue_bulk_id
     ... (more indexes)

STEP 8: Check table row counts (should all be 0)
────────────────────────────────────────────────────────────────────────────

Command:
    SELECT table_name, 
           (xpath('//text()', query_to_xml(format('SELECT count(*) FROM %I', table_name), false, true, '')))[1]::TEXT::INT as row_count
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name LIKE 'bulk_%'
    ORDER BY table_name;

Or simpler approach:
    SELECT COUNT(*) FROM bulk_uploads;
    SELECT COUNT(*) FROM bulk_upload_files;
    SELECT COUNT(*) FROM bulk_upload_candidate_matches;

Expected output for all:
     count
    ───────
         0
    (1 row)


STEP 9: Grant permissions to your app user
────────────────────────────────────────────────────────────────────────────

First, check what app user you're using:

Command to see users:
    \\du

Then grant permissions. If your app user is "app_user":

Commands:
    GRANT SELECT, INSERT, UPDATE, DELETE ON 
      bulk_uploads,
      bulk_upload_files,
      bulk_upload_candidate_matches,
      bulk_upload_processing_queue,
      bulk_upload_audit_log,
      bulk_upload_candidate_accounts,
      admin_permissions
    TO app_user;

    GRANT USAGE ON SCHEMA public TO app_user;

Expected output:
    GRANT


STEP 10: Verify permissions
────────────────────────────────────────────────────────────────────────────

Command:
    SELECT grantee, privilege_type 
    FROM role_table_grants 
    WHERE table_name = 'bulk_uploads' 
    AND grantee = 'app_user';

Expected output:
     grantee  | privilege_type
    ──────────┼────────────────
     app_user | INSERT
     app_user | SELECT
     app_user | UPDATE
     app_user | DELETE


STEP 11: Test a sample insert
────────────────────────────────────────────────────────────────────────────

Command (replace <admin-user-id> with actual UUID from recruiter_profiles table):
    INSERT INTO bulk_uploads (
      id,
      admin_id,
      batch_name,
      batch_description,
      source_system,
      upload_status
    ) VALUES (
      gen_random_uuid(),
      '<admin-user-id>',
      'Test Batch',
      'Test batch for verification',
      'internal_hr',
      'uploaded'
    );

Expected output:
    INSERT 0 1

Then verify:
    SELECT id, batch_name, upload_status, created_at 
    FROM bulk_uploads 
    WHERE batch_name = 'Test Batch';

Expected output:
     id                                   | batch_name  | upload_status | created_at
    ──────────────────────────────────────┼─────────────┼───────────────┼──────────────────
     <uuid>                               | Test Batch  | uploaded      | 2026-03-26 14:...

STEP 12: Clean up test data
────────────────────────────────────────────────────────────────────────────

Command:
    DELETE FROM bulk_uploads WHERE batch_name = 'Test Batch';

Expected output:
    DELETE 1


EXIT psql
────────────────────────────────────────────────────────────────────────────

Command:
    \\q


🎉 DATABASE SETUP COMPLETE!

All 8 tables created with:
  ✓ Proper foreign key relationships
  ✓ Indexes for performance
  ✓ Permissions configured
  ✓ Ready for application use
"""

# ============================================================================
# PHASE 2: ENVIRONMENT CONFIGURATION
# ============================================================================

"""
Time: 15-20 minutes

STEP 1: Update .env file
────────────────────────────────────────────────────────────────────────────

Add these lines to your apps/api/.env file:

# Bulk Upload - File Storage
BULK_UPLOAD_DIR=/uploads/bulk_uploads
MAX_FILE_SIZE_MB=10
ALLOWED_UPLOAD_EXTENSIONS=pdf,doc,docx,txt

# Bulk Upload - Redis/Celery (Job Queue)
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/1

# Email - AWS SES
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<get-from-aws>
AWS_SECRET_ACCESS_KEY=<get-from-aws>
AWS_SES_SENDER_EMAIL=noreply@techsalesaxis.ai

# Email - Admin
ADMIN_EMAIL=admin@talentflow.com
TALENT_TEAM_EMAIL=talent@techsalesaxis.ai

# Email - Zoho (fallback, optional)
ZOHO_SMTP_HOST=smtp.zoho.in
ZOHO_SMTP_PORT=465
ZOHO_EMAIL=admin@techsalesaxis.ai
ZOHO_PASSWORD=<get-from-zoho>

# Admin Authentication
JWT_SECRET_KEY=<your-existing-secret>
JWT_ALGORITHM=HS256

# Database
DATABASE_URL=postgresql://app_user:password@localhost:5432/talentflow


STEP 2: Create /uploads directory
────────────────────────────────────────────────────────────────────────────

Windows (PowerShell as Admin):
    New-Item -ItemType Directory -Path "C:\\uploads\\bulk_uploads" -Force
    # Verify:
    Get-Item C:\\uploads\\bulk_uploads

Linux/Mac:
    mkdir -p /uploads/bulk_uploads
    chmod 755 /uploads/bulk_uploads
    # Verify:
    ls -la /uploads/

Expected:
    Directory size 0 KB, fully accessible


STEP 3: Install Redis (for Celery job queue)
────────────────────────────────────────────────────────────────────────────

Option A: Docker (Recommended)
    docker run -d -p 6379:6379 --name redis redis:latest
    # Verify:
    docker ps | grep redis

Option B: Local installation
    Windows: Download from https://github.com/microsoftarchive/redis
    Mac: brew install redis
    Linux: apt-get install redis-server
    
    # Verify (from command line):
    redis-cli ping
    # Expected output: PONG


STEP 4: Install Python dependencies
────────────────────────────────────────────────────────────────────────────

In apps/api directory:

    pip install celery[redis]==5.3.1
    pip install aiofiles==23.2.1
    pip install python-Levenshtein==0.21.1
    pip install boto3==1.26.0  # AWS SDK

Verify installation:
    pip list | grep -E "celery|aiofiles|python-Levenshtein|boto3"


STEP 5: Configure AWS SES (Get credentials)
────────────────────────────────────────────────────────────────────────────

In AWS Console:

1. Go to: https://console.aws.amazon.com/iam/
2. Click: Users → Create user → "talentflow-ses"
3. Permissions: Search "SES" → Check "AmazonSESFullAccess"
4. Create access key:
   - Security credentials tab
   - Create access key
   - Download CSV or copy:
     * Access Key ID
     * Secret Access Key
5. Add to .env:
   AWS_ACCESS_KEY_ID=<paste-access-key>
   AWS_SECRET_ACCESS_KEY=<paste-secret>

6. Verify AWS SES sending limit:
   - Go to: AWS Console → SES → Account dashboard
   - Check: "Sending quota" (usually 200/day for new accounts)


STEP 6: Verify AWS SES sender email
────────────────────────────────────────────────────────────────────────────

In AWS Console:

1. Go to: SES → Verified identities
2. Status should show: "noreply@techsalesaxis.ai" → Verified ✓

If not verified yet, click "Verify a New Email Identity":
  - Enter: noreply@techsalesaxis.ai
  - Check email for verification link
  - Click link to verify

Expected in .env:
    AWS_SES_SENDER_EMAIL=noreply@techsalesaxis.ai


STEP 7: Test AWS SES connection (Optional)
────────────────────────────────────────────────────────────────────────────

Create file: test_ses_connection.py

    import boto3
    import os
    from dotenv import load_dotenv
    
    load_dotenv()
    
    client = boto3.client(
        'ses',
        region_name=os.getenv('AWS_REGION', 'us-east-1'),
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
    )
    
    try:
        response = client.send_email(
            Source='noreply@techsalesaxis.ai',
            Destination={'ToAddresses': ['admin@talentflow.com']},
            Message={
                'Subject': {'Data': 'Test Email'},
                'Body': {'Html': {'Data': '<h1>AWS SES Test</h1>'}}
            }
        )
        print(f"✓ Email sent! Message ID: {response['MessageId']}")
    except Exception as e:
        print(f"✗ Error: {e}")

Run:
    python test_ses_connection.py

Expected:
    ✓ Email sent! Message ID: <message-id-uuid>
"""

# ============================================================================
# PHASE 3: CODE INTEGRATION (Python backend)
# ============================================================================

"""
Time: 20-30 minutes

STEP 1: Create required Python files
────────────────────────────────────────────────────────────────────────────

Files already created:
  ✓ apps/api/src/core/admin_auth.py
  ✓ apps/api/src/core/file_storage.py
  ✓ apps/api/src/core/email_config.py
  ✓ apps/api/CELERY_SETUP.py (contains 3 files)

To integrate:

1. Create: apps/api/src/celery_app.py
   Copy content from CELERY_SETUP.py (FILE 1)

2. Create: apps/api/src/tasks/__init__.py
   Copy content from CELERY_SETUP.py (FILE 2)

3. Create: apps/api/src/tasks/bulk_upload_tasks.py
   Copy content from CELERY_SETUP.py (FILE 3)


STEP 2: Update main FastAPI app
────────────────────────────────────────────────────────────────────────────

File: apps/api/src/main.py (or apps/api/main.py)

Add at top:
    from src.core.admin_auth import *
    from src.core.file_storage import LocalFileStorage
    from src.core.email_config import init_email_service
    from src.routes.bulk_upload_api import router as bulk_upload_router

In app initialization section, add:
    # Initialize email service
    init_email_service()
    
    # Include bulk upload routes
    app.include_router(bulk_upload_router)

Example:

    from fastapi import FastAPI
    from src.core.admin_auth import *
    from src.core.email_config import init_email_service
    from src.routes.bulk_upload_api import router as bulk_upload_router
    
    app = FastAPI()
    
    @app.on_event("startup")
    async def startup():
        init_email_service()
    
    app.include_router(bulk_upload_router)


STEP 3: Create Flask-like dependency injection
────────────────────────────────────────────────────────────────────────────

In apps/api/src/core/dependencies.py (NEW FILE):

    from fastapi import Depends
    from .admin_auth import get_current_admin_user
    from .file_storage import LocalFileStorage
    from .email_config import get_email_service
    
    async def get_file_storage() -> LocalFileStorage:
        return LocalFileStorage()
    
    async def get_email() -> object:
        return get_email_service()
    
    # Use in endpoints:
    # @router.post("/upload")
    # async def upload(
    #     admin = Depends(get_current_admin_user),
    #     storage = Depends(get_file_storage)
    # ):


STEP 4: Update requirements.txt
────────────────────────────────────────────────────────────────────────────

File: apps/api/requirements.txt

Add:
    fastapi==0.104.1
    uvicorn==0.24.0
    sqlalchemy==2.0.0
    psycopg[asyncio]==3.1.0
    
    # Celery & Redis
    celery[redis]==5.3.1
    redis==5.0.0
    
    # File handling
    aiofiles==23.2.1
    
    # String matching
    python-Levenshtein==0.21.1
    
    # AWS
    boto3==1.26.0
    
    # Environment
    python-dotenv==1.0.0

Then install:
    pip install -r requirements.txt


STEP 5: Test module imports
────────────────────────────────────────────────────────────────────────────

Command:
    cd apps/api
    python -c "from src.core.admin_auth import get_current_admin_user; print('✓ admin_auth OK')"
    python -c "from src.core.file_storage import LocalFileStorage; print('✓ file_storage OK')"
    python -c "from src.core.email_config import get_email_service; print('✓ email_config OK')"
    python -c "from src.celery_app import celery_app; print('✓ celery_app OK')"

Expected:
    ✓ admin_auth OK
    ✓ file_storage OK
    ✓ email_config OK
    ✓ celery_app OK
"""

# ============================================================================
# PHASE 4: START SERVICES
# ============================================================================

"""
Time: 5-10 minutes

STEP 1: Start Celery Worker
────────────────────────────────────────────────────────────────────────────

In a new terminal, from apps/api directory:

    celery -A src.celery_app worker --loglevel=info

Expected output:
    
     -------------- celery@COMPUTER_NAME v5.3.1 (emerald-rush)
    --- ***** -----
    -- ******* ----
    - *** --- * ---
    - ** ---------- [config]
      - app:         src.celery_app:app
      - transport:   redis://localhost:6379/0
      - results:     redis://localhost:6379/1
      - concurrency: 4 (prefork)
      - pool:        solo
      -- [queues]
      --- celery

    [tasks]
    . src.tasks.bulk_upload_tasks.cleanup_old_uploads
    . src.tasks.bulk_upload_tasks.debug_task
    . src.tasks.bulk_upload_tasks.detect_duplicates
    . src.tasks.bulk_upload_tasks.monitor_queue_size
    . src.tasks.bulk_upload_tasks.parse_resume_file
    . src.tasks.bulk_upload_tasks.send_invitation_email
    . src.tasks.bulk_upload_tasks.virus_scan_file

    [2026-03-26 14:30:00,000: INFO/MainProcess] Connected to redis://localhost:6379/0
    [2026-03-26 14:30:00,000: INFO/MainProcess] mingle enabled
    [2026-03-26 14:30:00,000: INFO/MainProcess] pidbox enabled


STEP 2: Start FastAPI backend (new terminal)
────────────────────────────────────────────────────────────────────────────

From apps/api directory:

    uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

Expected:
    
    INFO:     Uvicorn running on http://0.0.0.0:8000
    INFO:     Application startup complete


STEP 3: Test API endpoints
────────────────────────────────────────────────────────────────────────────

In a new terminal, test a simple endpoint:

    curl -X GET http://localhost:8000/api/v1/bulk-upload/health

Expected response:
    
    {
      "status": "healthy",
      "timestamp": "2026-03-26T14:30:00",
      "upload_dir_exists": true,
      "virus_scan_enabled": true
    }


STEP 4: Start Next.js frontend (new terminal)
────────────────────────────────────────────────────────────────────────────

From apps/web directory:

    npm run dev

Expected:
    > TALENTFLOW@1.0.0 dev
    > next dev
    
      ▲ Next.js 14.x.x
      - Local:        http://localhost:3000
      - Environments: .env.local
    
    ✓ Ready in xxx ms


✓ All services running!

Services Started:
  ✓ PostgreSQL:  localhost:5432
  ✓ Redis:       localhost:6379
  ✓ Celery:      listening on redis
  ✓ FastAPI:     http://localhost:8000
  ✓ Next.js:     http://localhost:3000
"""

# ============================================================================
# VERIFICATION CHECKLIST
# ============================================================================

"""
After completing all phases, verify:

Database:
  ☐ 8 new tables created (bulk_uploads, bulk_upload_files, etc.)
  ☐ All indexes created
  ☐ Materialized view created
  ☐ Permissions granted to app_user
  ☐ Test insert/read working

Environment:
  ☐ .env file configured with all required variables
  ☐ /uploads/bulk_uploads directory created
  ☐ Redis running (redis-cli ping → PONG)
  ☐ AWS credentials configured

Backend:
  ☐ admin_auth.py imported without errors
  ☐ file_storage.py imported without errors
  ☐ email_config.py imported without errors
  ☐ celery_app.py imported without errors
  ☐ All Celery tasks registered

Frontend:
  ☐ /admin/bulk-upload pages loading
  ☐ BulkUploadAdmin components accessible
  ☐ API calls routing to /api/v1/bulk-upload

Services:
  ☐ PostgreSQL responding to queries
  ☐ Redis connected
  ☐ Celery worker running
  ☐ FastAPI server running
  ☐ Next.js dev server running


If all checkboxes pass: ✓ PHASE 1 COMPLETE - Ready for Phase 2 (Implementation)
"""
