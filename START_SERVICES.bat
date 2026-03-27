@echo off
REM Start Phase 1 Development Services
REM Author: TalentFlow Implementation Team
REM Date: March 26, 2026
REM
REM This script starts all necessary services:
REM 1. Redis (via Docker) - Celery broker
REM 2. Celery Worker - Async task processor
REM 3. FastAPI - REST API server
REM 4. (Optional) Next.js - Frontend dev server

setlocal enabledelayedexpansion

echo ============================================================================
echo  TALENTFLOW PHASE 1 - SERVICE STARTUP SCRIPT
echo ============================================================================
echo.
echo This script will start the following services:
echo  1. Redis (Docker)     - Celery message broker
echo  2. Celery Worker      - Async task processor
echo  3. FastAPI            - WebAPI server (port 8000)
echo  4. Next.js (optional) - Frontend dev server (port 3000)
echo.
echo REQUIREMENTS:
echo  - Docker installed and running (for Redis)
echo  - Python venv activated (from apps\api)
echo  - Redis and Celery Python packages installed
echo.
echo Press Ctrl+C to stop any service
echo ============================================================================
echo.

REM Start Redis in Docker
echo [1/3] Starting Redis in Docker...
docker run -d -p 6379:6379 --name talentflow-redis redis:latest >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo   [OK] Redis started on port 6379
) else (
    REM Check if container already running
    docker ps | find "talentflow-redis" >nul
    if %ERRORLEVEL% EQU 0 (
        echo   [OK] Redis already running
    ) else (
        echo   [WARNING] Could not start Redis via Docker
        echo   [INFO] Ensure Docker is running before proceeding
    )
)
echo.

REM Navigate to API directory
cd /d apps\api
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Could not change to apps\api directory
    exit /b 1
)

REM Start Celery Worker in new window
echo [2/3] Starting Celery Worker...
start "Celery Worker" cmd /k "C:\Users\mithu\OneDrive\Desktop\Projects\TALENTFLOW\.venv\Scripts\celery.exe -A src.celery_app worker --loglevel=info"
echo   [OK] Celery Worker starting in new window
echo.

REM Wait a moment for Celery to start
timeout /t 3 /nobreak

REM Start FastAPI in new window
echo [3/3] Starting FastAPI Server...
start "FastAPI Server" cmd /k "C:\Users\mithu\OneDrive\Desktop\Projects\TALENTFLOW\.venv\Scripts\uvicorn.exe src.main:app --reload --port 8000 --host 0.0.0.0"
echo   [OK] FastAPI Server starting in new window
echo.

REM Optional: Start Next.js
echo [4/4] Optional: Start Next.js frontend...
echo Would you like to start Next.js dev server? (Y/N)
set /p choice=
if /i "%choice%"=="Y" (
    cd /d ..\web
    start "Next.js Frontend" cmd /k "npm run dev"
    echo   [OK] Next.js starting in new window
) else (
    echo   [SKIPPED] Next.js not started
)

echo.
echo ============================================================================
echo  SERVICE STARTUP COMPLETE
echo ============================================================================
echo.
echo Services Status:
echo   - Redis:        http://localhost:6379
echo   - Celery:       Listening for tasks
echo   - FastAPI:      http://localhost:8000
echo   - FastAPI Docs: http://localhost:8000/docs
echo   - Next.js:      http://localhost:3000 (if started)
echo.
echo Testing Services:
echo   - Test Celery:  celery -A src.celery_app inspect active
echo   - Test FastAPI: curl http://localhost:8000/api/v1/health
echo.
echo ============================================================================
