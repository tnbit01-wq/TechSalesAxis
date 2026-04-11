#!/usr/bin/env powershell
# Start TALENTFLOW API Server

Write-Host "🚀 Starting TALENTFLOW API Server..." -ForegroundColor Green

# Kill any existing Python processes on port 8000/8005
Write-Host "⏹️  Killing any existing Python processes..." -ForegroundColor Yellow
taskkill /F /IM python.exe 2>&1 | Out-Null
Start-Sleep -Seconds 2

# Navigate to API folder
cd c:\Users\Admin\Desktop\Projects\TALENTFLOW\apps\api

# Activate virtual environment
Write-Host "📦 Activating virtual environment..." -ForegroundColor Yellow
& c:\Users\Admin\Desktop\Projects\TALENTFLOW\.venv\Scripts\Activate.ps1

# Start API
Write-Host "[*] Starting API on port 8005..." -ForegroundColor Green
python -m uvicorn src.main:app --reload --host 127.0.0.1 --port 8005

Write-Host "✓ API Server Started!" -ForegroundColor Green
Write-Host "📍 API URL: http://localhost:8000" -ForegroundColor Cyan
Write-Host "📚 Docs: http://localhost:8000/docs" -ForegroundColor Cyan
