@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo  ====================================
echo   MoeFocus - Dev Server Launcher
echo  ====================================
echo.

:: 国内镜像 — 加速 Electron 二进制 & npm 包下载
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/

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

:: 验证 Electron 二进制是否已解压（下载/解压可能因网络失败）
if not exist "node_modules\electron\dist\electron.exe" (
    echo [!] Electron binary not found. Retrying download & extraction...
    echo.
    node node_modules\electron\install.js
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo [X] Electron installation failed. Try deleting node_modules\electron and re-running.
        pause
        exit /b 1
    )
    :: 二次确认
    if not exist "node_modules\electron\dist\electron.exe" (
        echo.
        echo [X] Electron binary still missing after retry. Possible causes:
        echo    1. Network issue — check your connection.
        echo    2. Corrupted cache — delete %%LOCALAPPDATA%%\electron\Cache and retry.
        pause
        exit /b 1
    )
    echo [OK] Electron binary installed.
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
