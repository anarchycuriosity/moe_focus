@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo  ====================================
echo   MoeFocus - Dev Server Launcher
echo  ====================================
echo.

if not exist "node_modules\" (
    echo [!] node_modules not found. Installing dependencies...
    echo.
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo [X] npm install failed. Please check the errors above.
        pause
        exit /b 1
    )
    echo.
    echo [OK] Dependencies installed.
    echo.
)

echo [*] Starting dev server...
echo     Press Ctrl+C to stop.
echo.

call npm run dev

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [X] Dev server exited with an error.
    pause
)
