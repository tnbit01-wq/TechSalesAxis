# Developer Reference Guide

**Version:** 1.0  
**Last Updated:** April 2, 2026  
**Audience:** Backend Developers, Frontend Developers, DevOps Engineers

---

## 📋 Table of Contents

1. [Quick Reference](#quick-reference)
2. [Backend Architecture](#backend-architecture)
3. [Frontend Architecture](#frontend-architecture)
4. [API Endpoints Reference](#api-endpoints-reference)
5. [Database Operations](#database-operations)
6. [Common Development Patterns](#common-development-patterns)
7. [Testing Guide](#testing-guide)
8. [Deployment Procedures](#deployment-procedures)
9. [Debugging Tips](#debugging-tips)
10. [Performance Optimization](#performance-optimization)

---

## ⚡ Quick Reference

### Project Directories
```
TALENTFLOW/
├── apps/api/src/              # Python FastAPI backend
│   ├── main.py                # Entry point
│   ├── api/                   # Route handlers (routers)
│   ├── services/              # Business logic
│   ├── models/                # Database models (SQLAlchemy)
│   ├── schemas/               # Data validation (Pydantic)
│   ├── core/                  # Core utilities (DB, config)
│   └── utils/                 # Helper functions
│
├── apps/web/src/              # Next.js React frontend
│   ├── app/                   # Page routes (Next.js App Router)
│   ├── components/            # React components
│   ├── hooks/                 # Custom React hooks
│   ├── lib/                   # Utility functions
│   └── utils/                 # Helper utilities
│
├── packages/shared/           # Shared types and constants
├── infra/scripts/             # Database migrations (SQL)
└── docs/                      # Reference documentation
```

### Key Commands

```bash
# Backend
cd apps/api
python -m uvicorn src.main:app --reload  # Start dev server
pytest                                     # Run tests
python -c "code"                          # Execute Python snippet

# Frontend
cd apps/web
npm run dev                    # Start Next.js dev server
npm run build                  # Build for production
npm run lint                   # Lint TypeScript/JSX
npm run type-check             # Type checking

# Database
psql -h endpoint -U user -d talentflow  # Connect to DB
python -c "from src.core.database import init_db; init_db()"  # Init DB
```

---

## 🏗️ Backend Architecture

### Layered Architecture

```
┌─────────────────────────────────────────────────┐
│         PRESENTATION LAYER (API Routes)         │
│  /auth  /candidate  /recruiter  /assessment      │
│  /chat  /interviews  /jobs  /admin  /notifications
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│         SERVICE LAYER (Business Logic)          │
│  CandidateService  RecruiterService              │
│  AssessmentService  RecommendationService        │
│  ChatService  InterviewService                   │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│         DATA ACCESS LAYER (Models/ORM)          │
│              SQLAlchemy Models                  │
│  User  Candidate  Recruiter  Job  Assessment    │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│            DATABASE LAYER                       │
│         PostgreSQL (AWS RDS)                    │
└─────────────────────────────────────────────────┘
```

### Adding a New API Endpoint

**Step 1: Create model** (apps/api/src/models/example.py)
```python
from sqlalchemy import Column, String, ForeignKey
from src.core.database import Base

class Example(Base):
    __tablename__ = "examples"
    id = Column(String, primary_key=True)
    name = Column(String, required=True)
    user_id = Column(String, ForeignKey("users.id"))
```

**Step 2: Create schema** (apps/api/src/schemas/example.py)
```python
from pydantic import BaseModel

class ExampleCreate(BaseModel):
    name: str

class ExampleResponse(BaseModel):
    id: str
    name: str
    class Config:
        from_attributes = True
```

**Step 3: Create service** (apps/api/src/services/example_service.py)
```python
from sqlalchemy.orm import Session
from src.models.example import Example

class ExampleService:
    def create(self, db: Session, data: dict):
        db_example = Example(**data)
        db.add(db_example)
        db.commit()
        return db_example
```

**Step 4: Create route** (apps/api/src/api/example.py)
```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from src.schemas.example import ExampleCreate, ExampleResponse
from src.services.example_service import ExampleService
from src.core.database import get_db

router = APIRouter(prefix="/examples", tags=["examples"])
service = ExampleService()

@router.post("/", response_model=ExampleResponse)
def create_example(data: ExampleCreate, db: Session = Depends(get_db)):
    return service.create(db, data.dict())
```

**Step 5: Register route** (apps/api/src/main.py)
```python
from src.api.example import router as example_router
app.include_router(example_router)
```

---

## 🎨 Frontend Architecture

### Component Structure

```
Component (React)
  ├── useState (state)
  ├── useEffect (lifecycle)
  ├── Custom hooks (useAuth, useApi)
  ├── API calls (via lib/api.ts)
  ├── JSX rendering
  └── Exports
```

### Adding a New Page

**Step 1: Create page** (apps/web/src/app/example/page.tsx)
```typescript
import { useEffect, useState } from 'react';

export default function ExamplePage() {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    // Fetch data
  }, []);
  
  return (
    <div className="container">
      {/* JSX */}
    </div>
  );
}
```

**Step 2: Create component** (apps/web/src/components/ExampleCard.tsx)
```typescript
interface ExampleCardProps {
  title: string;
  description: string;
}

export function ExampleCard({ title, description }: ExampleCardProps) {
  return (
    <div className="card">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
```

**Step 3: Use API client**
```typescript
import { apiClient } from '@/lib/api';

const response = await apiClient.get('/examples');
```

---

## 📡 API Endpoints Reference

### Authentication Endpoints

```
POST /auth/signup              # Create account
POST /auth/login               # Login
POST /auth/verify-otp          # Verify OTP
POST /auth/forgot-password     # Request password reset
POST /auth/reset-password      # Reset password
GET  /protected/me             # Get current user info
POST /auth/logout              # Logout
```

### Candidate Endpoints

```
GET  /candidate/profile                    # Get profile
PUT  /candidate/profile                    # Update profile
POST /candidate/experience                 # Add experience
GET  /candidate/jobs                       # Get jobs with recommendations
POST /candidate/apply                      # Apply to job
GET  /candidate/applications               # Get applications
POST /candidate/saved-jobs                 # Save job
GET  /candidate/recommendations            # Get recommendations
GET  /candidate/interviews                 # Get scheduled interviews
```

### Recruiter Endpoints

```
GET  /recruiter/company-details           # Get company info
PUT  /recruiter/company-details           # Update company
POST /recruiter/jobs                      # Post new job
GET  /recruiter/jobs                      # Get recruiter's jobs
GET  /recruiter/applications              # Get applications
GET  /recruiter/recommendations           # Get candidate recommendations
POST /recruiter/interviews/propose        # Propose interview
GET  /recruiter/interviews                # Get interviews
```

### Assessment Endpoints

```
POST /assessment/start                    # Start assessment
POST /assessment/answer/{question_id}     # Submit answer
POST /assessment/submit                   # Complete assessment
GET  /assessment/results/{assessment_id}  # Get results
GET  /assessment/status                   # Check current status
```

### Chat Endpoints

```
GET  /chat/threads                        # Get conversations
POST /chat/send                           # Send message
GET  /chat/threads/{id}/messages          # Get message history
POST /chat/threads/{id}/archive           # Archive conversation
```

### Admin Endpoints

```
GET  /admin/dashboard                     # Admin dashboard stats
GET  /admin/users                         # List all users
PUT  /admin/users/{id}                    # Update user
POST /api/v1/bulk-upload/initialize       # Start bulk upload
POST /api/v1/bulk-upload/import           # Import candidates
GET  /api/v1/bulk-upload/status           # Check upload progress
GET  /analytics/profile-views             # View analytics
```

---

## 🗄️ Database Operations

### Using SQLAlchemy ORM

#### Create
```python
from sqlalchemy.orm import Session
from src.models.candidate import Candidate

def create_candidate(db: Session, email: str, name: str):
    candidate = Candidate(email=email, name=name)
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    return candidate
```

#### Read
```python
def get_candidate(db: Session, candidate_id: str):
    return db.query(Candidate).filter(Candidate.id == candidate_id).first()

def get_all_candidates(db: Session):
    return db.query(Candidate).all()
```

#### Update
```python
def update_candidate(db: Session, candidate_id: str, **kwargs):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    for key, value in kwargs.items():
        setattr(candidate, key, value)
    db.commit()
    return candidate
```

#### Delete
```python
def delete_candidate(db: Session, candidate_id: str):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    db.delete(candidate)
    db.commit()
```

### Relationships

```python
# One-to-Many
class Job(Base):
    __tablename__ = "jobs"
    applications = relationship("JobApplication", back_populates="job")

class JobApplication(Base):
    __tablename__ = "job_applications"
    job_id = Column(String, ForeignKey("jobs.id"))
    job = relationship("Job", back_populates="applications")

# Usage
job = db.query(Job).first()
applications = job.applications  # Get all applications for job
```

---

## 🔧 Common Development Patterns

### Authentication Middleware

```python
from fastapi import Depends, HTTPException
from jose import JWTError, jwt

def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user_id
```

### Error Handling

```python
from fastapi import HTTPException

# Standard responses
@app.post("/example")
def handle_error():
    try:
        # Code
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        return {"error": str(e), "status": 500}
```

### Pagination

```python
def get_paginated_items(db: Session, skip: int = 0, limit: int = 10):
    return db.query(Model).offset(skip).limit(limit).all()

# Usage: ?skip=0&limit=10
@app.get("/items")
def list_items(skip: int = 0, limit: int = 10, db: Session = Depends(get_db)):
    return get_paginated_items(db, skip, limit)
```

### Async Operations (Background Tasks)

```python
from fastapi.background import BackgroundTasks

@app.post("/send-email")
def send_email(bg_tasks: BackgroundTasks):
    bg_tasks.add_task(send_email_task, email="test@example.com")
    return {"message": "Email queued"}

async def send_email_task(email: str):
    # Send email asynchronously
    pass
```

---

## 🧪 Testing Guide

### Backend Testing

```python
# apps/api/tests/test_candidate.py
import pytest
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)

def test_create_candidate():
    response = client.post("/auth/signup", json={
        "email": "test@example.com",
        "password": "TestPass123",
        "role": "candidate"
    })
    assert response.status_code == 200
    assert response.json()["email"] == "test@example.com"

# Run tests
# pytest apps/api/tests/
```

### Frontend Testing

```typescript
// apps/web/tests/example.test.tsx
import { render, screen } from '@testing-library/react';
import { ExampleCard } from '@/components/ExampleCard';

describe('ExampleCard', () => {
  it('renders title', () => {
    render(<ExampleCard title="Test" description="Test desc" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});

// Run tests
// npm test
```

---

## 🚀 Deployment Procedures

### Deploying Backend

```bash
# 1. Build Docker image
docker build -t talentflow-api:latest apps/api/

# 2. Push to ECR/Docker Hub
docker push your-registry/talentflow-api:latest

# 3. Update ECS task definition
# 4. Deploy to ECS
aws ecs update-service --cluster prod --service talentflow-api --force-new-deployment

# 5. Monitor deployment
aws ecs describe-services --cluster prod --services talentflow-api
```

### Deploying Frontend

```bash
# 1. Build Next.js
cd apps/web
npm run build

# 2. Export static site (if applicable)
npm run export

# 3. Upload to S3/CloudFront
aws s3 sync .next/out s3://talentflow-site/

# 4. Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id DIST_ID --paths "/*"
```

---

## 🐛 Debugging Tips

### Backend Debugging

```python
# Print debugging
print(f"DEBUG: value={value}, type={type(value)}")

# Using pdb
import pdb; pdb.set_trace()

# Logging
import logging
logger = logging.getLogger(__name__)
logger.error(f"Error occurred: {e}")

# Check API response
curl -X GET http://localhost:8005/endpoint -H "Authorization: Bearer TOKEN"
```

### Frontend Debugging

```typescript
// Console logging
console.log('DEBUG:', variable);
console.error('ERROR:', error);

// Browser DevTools
// F12 → Sources → Set breakpoint → Step through

// Network tab
// F12 → Network → Check API calls and responses

// React DevTools
// Install React DevTools Chrome extension
```

### Common Issues

```
Issue: API not responding
Solution:
1. Check if backend is running (port 8005)
2. Check API logs for errors
3. Verify DATABASE_URL in .env
4. Run: curl http://localhost:8005/health

Issue: Database connection failed
Solution:
1. Verify DATABASE_URL format
2. Check AWS RDS security group
3. Test connectivity: psql -h endpoint -U user -d talentflow

Issue: Frontend not connecting to API
Solution:
1. Check NEXT_PUBLIC_API_URL in .env
2. Verify CORS headers in backend
3. Check browser console for errors
```

---

## ⚡ Performance Optimization

### Database Query Optimization

```python
# ❌ Bad: N+1 queries
for candidate in candidates:
    print(candidate.user.email)  # Multiple queries

# ✅ Good: Single query with relationship
candidates = db.query(Candidate).options(
    joinedload(Candidate.user)
).all()

# Use select() for large chunks
limit = 1000
query = db.query(Candidate).limit(limit)
```

### Caching

```python
# Redis caching
from functools import lru_cache

@lru_cache(maxsize=128)
def get_expensive_data(key: str):
    return db.query(Model).filter(...).all()
```

### Frontend Optimization

```typescript
// Code splitting
const Component = dynamic(() => import('./Component'), { 
  loading: () => <div>Loading...</div> 
});

// Memoization
import { memo } from 'react';
const MemoizedComponent = memo(Component);

// useCallback for expensive functions
const memoizedCallback = useCallback(expensiveFunction, [dependency]);
```

---

## 📊 Useful Resources

- **FastAPI Docs:** https://fastapi.tiangolo.com/
- **SQLAlchemy:** https://docs.sqlalchemy.org/
- **Next.js Docs:** https://nextjs.org/docs
- **React Hooks:** https://react.dev/reference/react/hooks
- **Tailwind CSS:** https://tailwindcss.com/docs
- **PostgreSQL:** https://www.postgresql.org/docs/

---

## ✅ Conclusion

This guide covers:
- ✅ Architecture and design patterns
- ✅ API endpoint reference
- ✅ Database operations
- ✅ Testing and deployment
- ✅ Debugging and optimization

Use this as your daily reference while developing TalentFlow.
