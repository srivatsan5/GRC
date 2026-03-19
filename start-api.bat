@echo off
REM Risk Management API - Quick Start for Windows

setlocal enabledelayedexpansion

echo.
echo ============================================================
echo     Risk Management API - Quick Start (Windows)
echo ============================================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found
    echo Install from: https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js version:
node --version

REM Check if npm dependencies are installed
if not exist "node_modules" (
    echo.
    echo Installing npm dependencies...
    call npm install
    if errorlevel 1 (
        echo ERROR: npm install failed
        pause
        exit /b 1
    )
)

REM Check if .env exists
if not exist ".env" (
    echo.
    echo WARNING: .env file not found!
    echo Creating .env file...
    (
        echo NODE_ENV=development
        echo PORT=5000
        echo LOG_LEVEL=info
        echo ORDS_BASE_URL=https://your-oracle-instance.com/ords/pericope_ai
        echo ORDS_TOKEN_URL=https://your-oracle-instance.com/oauth2/token
        echo CLIENT_ID=your_client_id
        echo CLIENT_SECRET=your_client_secret
        echo JWT_SECRET=your_jwt_secret_here
        echo ENABLE_METRICS=true
        echo RATE_LIMIT=1000
    ) > .env
    echo .env created - please update with your settings
)

REM Check if port 5000 is in use
echo.
echo Checking if port 5000 is available...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000"') do (
    echo WARNING: Port 5000 is already in use by process %%a
    echo.
    echo Kill the process? (y/n)
    set /p response=
    if "!response!"=="y" (
        taskkill /pid %%a /f
        echo Process killed
    ) else (
        echo Cannot start server. Port is in use.
        pause
        exit /b 1
    )
)

REM Start the server
echo.
echo ============================================================
echo Starting API server on port 5000...
echo ============================================================
echo.
echo Once started, test with:
echo   GET http://localhost:5000/api/health
echo   GET http://localhost:5000/api/status
echo   GET http://localhost:5000/api/metrics
echo.
echo Open Postman and create these requests
echo.
echo Press Ctrl+C to stop the server
echo.

node server.js

pause
