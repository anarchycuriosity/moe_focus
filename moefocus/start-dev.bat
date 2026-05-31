@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo  ====================================
echo   MoeFocus - Dev Server Launcher
echo  ====================================
echo.

:: 国内镜像 — 加速 npm 包 & Electron 二进制下载
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/

if not exist "node_modules\" (
    echo [!] node_modules not found. Installing dependencies...
    echo.
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo [X] npm install failed. Check the errors above.
        pause
        exit /b 1
    )
    echo.
    echo [OK] Dependencies installed.
    echo.
)

:: 验证 Electron 二进制 — 缺失时直接从镜像下载 zip 解压
if not exist "node_modules\electron\dist\electron.exe" (
    echo [!] Electron binary missing. Downloading directly from mirror...
    echo.
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$pkg = Get-Content 'node_modules\electron\package.json' -Raw ^| ConvertFrom-Json; $ver = $pkg.version; Write-Host ('[*] Target: Electron v' + $ver) -ForegroundColor Cyan; $url1 = 'https://npmmirror.com/mirrors/electron/v' + $ver + '/electron-v' + $ver + '-win32-x64.zip'; $url2 = 'https://github.com/electron/electron/releases/download/v' + $ver + '/electron-v' + $ver + '-win32-x64.zip'; $zip = $env:TEMP + '\electron-v' + $ver + '.zip'; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $ok = $false; foreach ($u in @($url1,$url2)) { try { Write-Host ('[*] Trying: ' + $u) -ForegroundColor Gray; Invoke-WebRequest -Uri $u -OutFile $zip -ErrorAction Stop; $ok = $true; break } catch { Write-Host '    Failed, trying fallback...' -ForegroundColor DarkYellow } }; if (-not $ok) { Write-Host '[X] All download URLs failed' -ForegroundColor Red; exit 1 }; Write-Host '[*] Extracting...' -ForegroundColor Cyan; Expand-Archive -Path $zip -DestinationPath 'node_modules\electron\dist' -Force; Remove-Item $zip; if (-not (Test-Path 'node_modules\electron\dist\electron.exe')) { Write-Host '[X] Extraction failed' -ForegroundColor Red; exit 1 }; Write-Host '[OK] Electron installed' -ForegroundColor Green"
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo [X] Electron download failed. Troubleshooting:
        echo    1. Check your network connection
        echo    2. Delete node_modules\electron and re-run this script
        echo    3. Delete %%LOCALAPPDATA%%\electron\Cache and re-run
        pause
        exit /b 1
    )
    echo.
    echo [OK] Electron binary ready.
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
