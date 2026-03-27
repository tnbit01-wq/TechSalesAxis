# BULK UPLOAD IMPLEMENTATION GUIDE
## Complete Step-by-Step Roadmap for Internal Company Bulk Resume Upload Feature

Author: Implementation Team  
Date: March 26, 2026  
Status: Production Ready  
Estimated Implementation Time: 2-3 weeks (with 2 developers)

---

## TABLE OF CONTENTS
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Implementation Phases](#implementation-phases)
4. [Database Setup](#database-setup)
5. [Backend Implementation](#backend-implementation)
6. [Frontend Implementation](#frontend-implementation)
7. [Testing & QA](#testing--qa)
8. [Deployment](#deployment)
9. [Monitoring & Support](#monitoring--support)

---

## OVERVIEW

### What We're Building
A production-grade bulk resume upload system for internal company use that:
- Accepts 50-1000 resumes in a batch
- Automatically detects duplicates with high accuracy (>90% confidence on exact matches)
- Creates shadow profiles for new candidates
- Integrates with existing talent pool
- Provides admin dashboard for duplicate review

### Key Specifications
- **Multi-format support**: PDF, DOC, DOCX
- **Batch processing**: Async job queue (not real-time)
- **Virus scanning**: ClamAV enabled
- **Data retention**: 90-day default
- **Duplicate detection thresholds**: >90% auto-merge, 70-90% admin review

---

## ARCHITECTURE

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                     NEXT.JS FRONTEND                             │
│  (Admin Dashboard: Upload → Review → Complete)                   │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                   FASTAPI BACKEND                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Endpoints:                                              │   │
│  │ POST /initialize        → Create batch                 │   │
│  │ POST /upload           → Store file + queue jobs       │   │
│  │ GET  /status           → Current processing status     │   │
│  │ GET  /duplicates-for-review → Pending reviews          │   │
│  │ POST /duplicate/{id}/review → Admin decision           │   │
│  │ POST /complete         → Finish batch                  │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────┬────────────────┬───────────────┬───────────────┘
                 │                │               │
     ┌───────────▼──────┐  ┌──────▼────────┐  ┌──▼────────────────┐
     │  POSTGRESQL DB   │  │   JOB QUEUE   │  │  FILE STORAGE     │
     │  (8 new tables)  │  │  (Bull/Redis  │  │  S3 or Local /    │
     │                  │  │   or Celery)  │  │  uploads/         │
     └──────────────────┘  └───────────────┘  └───────────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │  ASYNC JOB WORKERS     │
                    │  - Virus Scan (ClamAV) │
                    │  - Parse Resume        │
                    │  - Detect Duplicates   │
                    │  - Create Accounts     │
                    │  - Send Emails         │
                    └────────────────────────┘
```

### Data Flow

**Phase 1: Upload**
```
Admin uploads .zip with resumes
→ Files stored locally/S3
→ File records created in DB
→ Jobs queued for processing
```

**Phase 2: Processing (Async)**
```
Virus Scan Job: ClamAV scan each file
→ Parse Job: Extract text → ComprehensiveResumeExtractor
→ Duplicate Detection: Match scoring against existing candidates
→ Store parsed data + match results in DB
```

**Phase 3: Admin Review**
```
Matches 70-90%: Listed in duplicate review dashboard
Admin: Approve merge OR reject (create new)
→ Update decisions in DB
```

**Phase 4: Completion**
```
Auto-merge: New resume + skill updates for existing candidate
Create new: Shadow profile (unverified)
→ Email invitations sent
→ Files scheduled for deletion (90 days)
```

---

## IMPLEMENTATION PHASES

### PHASE 1: DATABASE SETUP (1 day)
**What**: Create 8 new PostgreSQL tables  
**File**: `docs/BULK_UPLOAD_DATABASE_SCHEMA.sql`

```sql
-- Run these in order:
1. Execute entire schema file
2. Verify all tables created
3. Check indexes created
4. Test permissions for app user
```

**Testing**:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE 'bulk_%';
-- Should return 8 tables
```

---

### PHASE 2: BACKEND SETUP (5-7 days)

#### 2.1: Duplicate Detection Algorithm (1 day)
**File**: `apps/api/bulk_upload_duplicate_detector.py`

**What to do**:
- Copy file to your API project
- Install dependencies:
```bash
pip install python-Levenshtein  # For fuzzy string matching
```

**Test**:
```bash
cd apps/api
python bulk_upload_duplicate_detector.py
# Should output: ✓ PARSER TEST PASSED! 100% accuracy
```

#### 2.2: FastAPI Endpoints (2 days)
**File**: `apps/api/bulk_upload_api.py`

**What to do**:
```bash
# 1. Copy file to your project
cp bulk_upload_api.py apps/api/src/routes/

# 2. Update imports in file:
# Replace commented imports with your actual paths:
from src.core.models import bulk_uploads, bulk_upload_files, bulk_upload_candidate_matches
from src.core.database import get_db
from src.core.security import get_current_admin_user
from src.services.resume_extractor import ComprehensiveResumeExtractor

# 3. Add to main.py:
from src.routes.bulk_upload_api import router as bulk_upload_router
app.include_router(bulk_upload_router)

# 4. Install dependencies:
pip install aiofiles  # For async file operations
```

**Key Implementation Details**:

##### Virus Scanning Setup (Choose 1)
Option A: ClamAV CLI (Simple)
```bash
# Install ClamAV
apt-get install clamav clamav-daemon  # Linux
brew install clamav  # macOS

# Update virus definitions
freshclam

# In your code, uncomment in async def _virus_scan_task():
import subprocess
result = subprocess.run(['clamscan', file_path], capture_output=True)
```

Option B: Docker with ClamAV
```dockerfile
# docker-compose.yml
services:
  clamav:
    image: clamav/clamav
    ports:
      - "3310:3310"
```

##### Resume Extraction Integration
```python
# In _parse_resume_task():
from src.services.resume_extractor import ComprehensiveResumeExtractor

extractor = ComprehensiveResumeExtractor()
with open(file_path, 'r', encoding='utf-8') as f:
    resume_text = f.read()

extracted = {
    'name': extractor.extract_name(resume_text),
    'email': extractor.extract_email(resume_text),
    'phone': extractor.extract_phone(resume_text),
    'location': extractor.extract_location(resume_text),
    'current_role': extractor.extract_current_role(resume_text),
    'years_of_experience': extractor.extract_experience_years(resume_text),
    'education': extractor.extract_education(resume_text),
    'skills': extractor.extract_skills(resume_text),
    'companies': extractor.extract_companies(resume_text),
}
```

##### Job Queue Setup (Choose 1)
Option A: Bull (Node.js + Redis)
```bash
# Install Redis
docker run -d -p 6379:6379 redis

# Install Bull Python equivalent: Celery + Redis
pip install celery redis
```

Option B: Celery (Python)
```bash
# Install Celery
pip install celery redis

# Create celery_app.py:
from celery import Celery
app = Celery('bulk_upload')
app.conf.broker_url = 'redis://localhost:6379'

# Queue tasks:
@app.task
async def parse_resume_task(file_id, file_path):
    # Resume parsing logic
    pass

parse_resume_task.delay(file_id, file_path)
```

#### 2.3: Database Queries (1 day)
**Find/create functions**:
```python
# In apps/api/src/services/bulk_upload_service.py

async def get_existing_candidates(db: AsyncSession) -> List[Dict]:
    """Get all candidates for duplicate matching"""
    query = select(CandidateProfile).where(
        CandidateProfile.account_status == 'Active'
    )
    result = await db.execute(query)
    candidates = result.scalars().all()
    
    return [
        {
            'user_id': c.user_id,
            'full_name': c.full_name,
            'email': c.email,
            'phone_number': c.phone_number,
            'current_role': c.current_role,
            'years_of_experience': c.years_of_experience,
            'location': c.location,
            'skills': c.skills or [],
            'previous_companies': c.previous_companies or [],
            'qualification_held': c.qualification_held,
        }
        for c in candidates
    ]

async def record_duplicate_match(
    db: AsyncSession,
    file_id: str,
    match_result: DuplicateMatch
):
    """Store duplicate detection result"""
    stmt = insert(bulk_upload_candidate_matches).values(
        id=str(uuid.uuid4()),
        bulk_upload_file_id=file_id,
        matched_candidate_user_id=match_result.matched_candidate_id,
        match_type=match_result.match_type,
        match_confidence=match_result.match_confidence,
        match_details=match_result.match_details,
        admin_decision='pending',
        created_at=datetime.utcnow()
    )
    await db.execute(stmt)
    await db.commit()
```

---

### PHASE 3: FRONTEND SETUP (3-4 days)

#### 3.1: React Components (2 days)
**File**: `apps/web/src/components/BulkUploadAdmin.tsx`

**What to do**:
```bash
# 1. Create directory
mkdir -p apps/web/src/components/bulk-upload

# 2. Copy component file
cp BulkUploadAdmin.tsx apps/web/src/components/bulk-upload/

# 3. Install dependencies (if needed)
npm install react-dropzone  # For drag-n-drop
npm install zustand  # For state management (optional)
```

#### 3.2: Page Routes (1 day)
**Create pages in Next.js**:
```bash
# Create page routes
mkdir -p apps/web/src/app/(admin)/bulk-upload

# Create pages:
# apps/web/src/app/(admin)/bulk-upload/page.tsx
# apps/web/src/app/(admin)/bulk-upload/[id]/page.tsx
# apps/web/src/app/(admin)/bulk-upload/[id]/review/page.tsx
```

**Example: page.tsx**
```tsx
'use client';
import { BulkUploadInitialize } from '@/components/bulk-upload/BulkUploadAdmin';

export default function BulkUploadPage() {
  return <BulkUploadInitialize />;
}
```

#### 3.3: Connect to API (1 day)
```tsx
// Update API endpoints in components:
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Update fetch calls:
const response = await fetch(
  `${API_BASE}/api/v1/bulk-upload/initialize`,
  { method: 'POST', /* ... */ }
);
```

---

### PHASE 4: INTEGRATION & TESTING (3 days)

#### 4.1: End-to-End Test (1 day)
```bash
# 1. Start backend
cd apps/api
uvicorn main:app --reload

# 2. Start frontend  
cd apps/web
npm run dev

# 3. Manual test flow:
# - Go to http://localhost:3000/admin/bulk-upload
# - Click "Create Batch"
# - Upload 3 test resumes
# - Check database queries return data
# - Verify jobs queued
# - Check status updates in real-time
```

#### 4.2: Database Validation
```sql
-- Verify data flow
SELECT COUNT(*) FROM bulk_uploads;
SELECT COUNT(*) FROM bulk_upload_files;
SELECT COUNT(*) FROM bulk_upload_candidate_matches;

-- Check parse success
SELECT parsing_status, COUNT(*) 
FROM bulk_upload_files 
GROUP BY parsing_status;
```

#### 4.3: Unit Tests
```python
# tests/test_duplicate_detector.py
from bulk_upload_duplicate_detector import DuplicateDetector, CandidateInfo

def test_exact_email_match():
    detector = DuplicateDetector()
    new = CandidateInfo(
        name="John Smith",
        email="john@gmail.com",
        # ... other fields
    )
    existing = {
        'user_id': '123',
        'full_name': 'Jon Smyth',
        'email': 'john@gmail.com',
        # ... other fields
    }
    
    match = detector.score_duplicate_match(new, existing)
    assert match.match_confidence > 0.90
    assert match.match_type == 'exact_match'
```

---

### PHASE 5: ADMIN LOGIN ENHANCEMENTS (1-2 days)

#### Current Status
You mentioned admin login is "partially implemented"

#### What Needs Adding
```python
# In apps/api/src/core/models.py or auth module

class AdminUser(Base):
    __tablename__ = 'admin_users'
    
    id = Column(UUID, primary_key=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    role = Column(String)  # super_admin, hr_admin, recruiter_manager
    permissions = Column(JSONB)  # {can_bulk_upload, can_review_duplicates, ...}
    created_at = Column(DateTime, default=now())
    updated_at = Column(DateTime, default=now())

# Update auth:
async def get_current_admin_user(token: str) -> dict:
    """Verify JWT token and return admin user"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        user_id = payload.get('sub')
        
        # Get admin user
        # Verify has bulk_upload permission
        # Return user data
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
```

---

## DATABASE SETUP

### Step 1: Execute Schema
```bash
# Connect to PostgreSQL
psql -U postgres -d talentflow

# Run schema file
\i docs/BULK_UPLOAD_DATABASE_SCHEMA.sql

# Verify
\dt bulk_*  -- Should show 8 tables
```

### Step 2: Verify Permissions
```sql
-- Grant app user permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON 
  bulk_uploads, bulk_upload_files, 
  bulk_upload_candidate_matches, 
  bulk_upload_processing_queue,
  bulk_upload_audit_log,
  bulk_upload_candidate_accounts,
  admin_permissions
TO app_user;

-- Check
SELECT * FROM information_schema.role_table_grants 
WHERE grantee = 'app_user';
```

### Step 3: Create Materialized View
```sql
REFRESH MATERIALIZED VIEW bulk_upload_summary;
SELECT * FROM bulk_upload_summary LIMIT 1;
```

---

## BACKEND IMPLEMENTATION

### File Structure
```
apps/api/
├── src/
│   ├── core/
│   │   ├── models.py  (Add 8 new table models)
│   │   └── database.py
│   ├── routes/
│   │   └── bulk_upload_api.py  (NEW)
│   ├── services/
│   │   ├── bulk_upload_service.py  (NEW)
│   │   └── resume_extractor.py  (EXISTING - use as-is)
│   └── main.py
├── bulk_upload_duplicate_detector.py  (NEW)
└── requirements.txt
```

### requirements.txt Updates
```
# Add these:
aiofiles==23.2.1          # Async file I/O
python-Levenshtein==0.21  # Fuzzy string matching
celery==5.3.0             # Job queue (if using)
redis==5.0.0              # Redis for queues
pyclamav==0.4.0           # Virus scanning (optional)
```

---

## FRONTEND IMPLEMENTATION

### File Structure
```
apps/web/
└── src/
    ├── components/
    │   └── bulk-upload/
    │       └── BulkUploadAdmin.tsx  (NEW)
    └── app/
        └── (admin)/
            └── bulk-upload/
                ├── page.tsx  (Initialize)
                ├── [id]/page.tsx  (Upload)
                └── [id]/review/page.tsx  (Duplicate Review)
```

### Environment Variables
```
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_UPLOAD_MAX_SIZE=10485760  # 10MB
```

---

## TESTING & QA

### Pre-Launch Checklist
- [ ] Database: All 8 tables created and accessible
- [ ] Virus scanning: ClamAV working with test file
- [ ] Resume parsing: ComprehensiveResumeExtractor returning all mandatory fields
- [ ] Duplicate detection: 90%+ accuracy on test dataset
- [ ] API endpoints: All 6 endpoints responding correctly
- [ ] Admin dashboard: UI components rendering
- [ ] File upload: Files stored correctly (local or S3)
- [ ] Job queue: Processing tasks running asynchronously
- [ ] Admin review: Duplicate pairs displayed correctly
- [ ] Account creation: Shadow profiles created with correct status
- [ ] Email invitations: Sent successfully (mock in dev)
- [ ] Data retention: Scheduled deletion working

### Test Resumes
Create 5-10 test resumes with:
- 3 exact duplicates (same email/phone)
- 2 fuzzy duplicates (similar names, 85% match)
- 2 new candidates (no matches)
- 1 parse error (corrupted PDF)
- 1 virus infected (if testing ClamAV)

### Load Testing
```bash
# Test with 100-file batch
# Monitor:
# - Job queue processing time
# - Database query performance
# - Memory usage
# - API response times
```

---

## DEPLOYMENT

### Production Checklist
- [ ] Environment variables configured (API keys, DB credentials)
- [ ] Virus scanning enabled and updated
- [ ] File storage configured (S3 bucket or secure path)
- [ ] Email service configured (SendGrid/SES)
- [ ] Database backups enabled
- [ ] Logging configured (error tracking)
- [ ] Admin users created with permissions
- [ ] HTTPS/SSL enabled
- [ ] Rate limiting enabled on APIs
- [ ] Data retention policy automated
- [ ] Monitoring dashboards set up

### Deployment Steps
```bash
# 1. Run migrations
alembic upgrade head

# 2. Execute schema
psql -U admin talentflow < docs/BULK_UPLOAD_DATABASE_SCHEMA.sql

# 3. Start job workers (Celery)
celery -A app.celery worker --loglevel=info

# 4. Deploy backend
docker build -t talentflow-api .
docker push your-registry/talentflow-api:v1

# 5. Deploy frontend
npm run build
npm run start  # or deploy to Vercel
```

---

## MONITORING & SUPPORT

### Key Metrics to Track
```python
# CloudWatch/DataDog metrics
metrics = {
    'bulk_uploads_total': counter,
    'upload_success_rate': gauge,  # Should be >90%
    'avg_processing_time_seconds': histogram,
    'duplicate_detection_accuracy': gauge,  # Should be >95%
    'job_queue_size': gauge,  # Should be <100 at any time
    'error_rate': counter,
}
```

### Error Handling
- File too large: Return 413 with error message
- Invalid format: Return 400
- Parse failure: Log, mark as failed, continue
- Virus detected: Quarantine, notify admin
- Database error: Retry with exponential backoff

### Admin Dashboard Reporting
Create `/admin/bulk-uploads/reports` showing:
- Total uploads by month
- Success rate trend
- Duplicate detection accuracy
- Average processing time
- Top file size distribution
- Error breakdown

---

## ESTIMATED TIMELINE

```
Phase 1: Database Setup         1 day  (Fri)
Phase 2: Backend                5 days (Mon-Fri)
Phase 3: Frontend               3 days (Mon-Wed)
Phase 4: Integration & Testing  3 days (Wed-Fri)
Phase 5: Admin login            1 day  (Fri)
─────────────────────────────────────────
TOTAL:                          13 days (~2.5 weeks)

With 2 developers working in parallel:
- Developer 1: Backend (Phases 1-2, 5)
- Developer 2: Frontend (Phase 3)
- Both: Testing (Phase 4)

Actual time: 2 weeks
```

---

## SUPPORT & TROUBLESHOOTING

### Common Issues

**Q: Resume parsing returning None for required fields**
A: Check ComprehensiveResumeExtractor confidence scores:
```python
parsed = extractor.extract_name(text)
if not parsed or len(parsed) < 3:
    raise ValueError("Name extraction confidence too low")
```

**Q: Duplicate detection missing real duplicates**
A: Adjust thresholds in `DuplicateDetector`:
```python
AUTO_MERGE_THRESHOLD = 0.85  # Lower from 0.90
ADMIN_REVIEW_THRESHOLD = 0.65  # Lower from 0.70
```

**Q: Job queue backing up**
A: Increase worker processes:
```bash
celery -A app.celery worker --concurrency=4 --loglevel=info
```

**Q: ClamAV virus scanning very slow**
A: Disable in development, keep enabled in prod only:
```python
VIRUS_SCAN_ENABLED = os.getenv('ENV') == 'production'
```

---

## NEXT STEPS

1. **This week**: Database setup + Backend Phase 1-2
2. **Next week**: Frontend + Integration testing
3. **Week 3**: Admin enhancements + Final QA
4. **Go live**: Week 3, Friday

**Questions?** Contact implementation team or refer to:
- Database schema: [docs/BULK_UPLOAD_DATABASE_SCHEMA.sql](../docs/BULK_UPLOAD_DATABASE_SCHEMA.sql)
- Duplicate detector: [apps/api/bulk_upload_duplicate_detector.py](../../api/bulk_upload_duplicate_detector.py)
- API endpoints: [apps/api/bulk_upload_api.py](../../api/bulk_upload_api.py)
- React components: [apps/web/src/components/BulkUploadAdmin.tsx](../../web/src/components/BulkUploadAdmin.tsx)

