@echo off
REM Quick setup script for TALENTFLOW frontend development
REM Run this after cloning the repository

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║  TALENTFLOW Frontend - Quick Setup                         ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM Check Node.js
echo [1/4] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ✗ Node.js not found! Please install Node.js 18+ from https://nodejs.org
    exit /b 1
)
echo ✓ Node.js found: %NODE_VERSION%

REM Install dependencies
echo.
echo [2/4] Installing frontend dependencies...
cd apps\web
call npm install
if errorlevel 1 (
    echo ✗ npm install failed!
    exit /b 1
)
echo ✓ Dependencies installed

REM Create .env.local
echo.
echo [3/4] Creating .env.local file...
if not exist .env.local (
    (
        echo NEXT_PUBLIC_API_URL=http://localhost:8000
        echo NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
        echo NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
    ) > .env.local
    echo ✓ .env.local created (edit with your environment variables)
) else (
    echo → .env.local already exists
)

REM Lint check
echo.
echo [4/4] Running lint check...
call npm run lint
if errorlevel 1 (
    echo ⚠ Lint warnings found (this is OK for setup, fix before committing)
)

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║  ✓ Setup Complete!                                        ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo Next steps:
echo   1. Edit .env.local with your environment variables
echo   2. Run: npm run dev
echo   3. Open http://localhost:3000
echo   4. Start building!
echo.
echo For questions, see REMOTE_COLLABORATION_GUIDE.md
echo.
pause
