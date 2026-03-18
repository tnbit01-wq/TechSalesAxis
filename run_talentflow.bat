@echo off
setlocal

:: --- TALENTFLOW UNIFIED RUNNER (AWS NATIVE) ---

echo [1/3] Setting Environment Variables...
:: Set your RDS URL here if not in .env
set DATABASE_URL=postgresql://postgres.snzqqjrmthqdezozgvsp:Bvdf2lB7QpL767K5@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres
set PYTHONPATH=%CD%\apps\api

echo [2/3] Starting FastAPI Backend on port 8000...
start /B cmd /c "cd apps\api && python -m uvicorn src.main:app --host 127.0.0.1 --port 8000"

echo [3/3] Starting Next.js Frontend on port 3000...
start /B cmd /c "cd apps\web && npm run dev"

echo.
echo ==========================================
echo TalentFlow is running (100%% AWS Native)
echo Backend: http://127.0.0.1:8000
echo Frontend: http://localhost:3000
echo ==========================================
echo Press Ctrl+C in this terminal to stop the servers.
pause
