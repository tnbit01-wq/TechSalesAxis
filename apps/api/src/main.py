from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from src.api.health import router as health_router
from src.api.protected import router as protected_router
from src.api.auth import router as auth_router
from src.api.candidate import router as candidate_router
from src.api.assessment import router as assessment_router
from src.api.recruiter import router as recruiter_router
from src.api.posts import router as posts_router
from src.api.notifications import router as notifications_router
from src.api.chat import router as chat_router
from src.api.interviews import router as interviews_router
from src.api.career_gps import router as career_gps_router
from src.api.ai_intent import router as ai_intent_router
from src.api.storage import router as storage_router
from src.api.analytics import router as analytics_router
from bulk_upload_api import router as bulk_upload_router
import time

app = FastAPI(title="TechSales Axis API")
print(">>> V3 BACKEND ACTIVE - LOCK 403 BYPASS ENABLED <<<")

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"UNHANDLED GLOBAL ERROR: {str(exc)}")
    import traceback
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal Server Error: {str(exc)}", "type": "GlobalException"},
        headers={"Access-Control-Allow-Origin": "*"}
    )

# Logging middleware for debugging connection issues
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    try:
        response = await call_next(request)
        duration = time.time() - start_time
        print(f"DEBUG: {request.method} {request.url.path} - Status: {response.status_code} - Time: {duration:.2f}s")
        return response
    except Exception as e:
        print(f"CRITICAL MIDDLEWARE ERROR: {str(e)}")
        raise

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/health")
app.include_router(protected_router, prefix="/protected")
app.include_router(auth_router, prefix="/auth")
app.include_router(candidate_router)
app.include_router(assessment_router, prefix="/assessment")
app.include_router(recruiter_router)
app.include_router(posts_router, prefix="/posts")
app.include_router(notifications_router)
app.include_router(chat_router)
app.include_router(interviews_router)
app.include_router(career_gps_router)
app.include_router(storage_router)
app.include_router(analytics_router, prefix="/analytics")
app.include_router(ai_intent_router) # AI Intelligence Core
app.include_router(bulk_upload_router, prefix="/api/v1/bulk-upload", tags=["bulk-upload"])

@app.get("/")
async def root():
    return {"status": "ok", "service": "TechSales Axis API", "version": "1.0.0"}
 
