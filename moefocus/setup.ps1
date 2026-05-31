# MoeFocus 一键安装脚本
# 用法: 在项目目录下右键 → "使用 PowerShell 运行"，或
#       PowerShell: cd 到项目目录，输入 .\setup.ps1

Write-Host " MoeFocus 安装脚本" -ForegroundColor Magenta
Write-Host "====================" -ForegroundColor Magenta

# 镜像加速：npm 包走淘宝，Electron 二进制走 npmmirror
$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
$env:ELECTRON_BUILDER_BINARIES_MIRROR = "https://npmmirror.com/mirrors/electron-builder-binaries/"

Write-Host "[1/3] 安装 npm 依赖..." -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "[X] npm install 失败，请检查网络连接" -ForegroundColor Red
    Read-Host "按回车退出"
    exit 1
}
Write-Host "[OK] npm 依赖安装完成" -ForegroundColor Green

# ── 验证 Electron 二进制 ──────────────────────────────────────────
$electron_exe = "node_modules\electron\dist\electron.exe"
if (Test-Path $electron_exe) {
    Write-Host "[OK] Electron 二进制已就绪" -ForegroundColor Green
} else {
    Write-Host "" -ForegroundColor Yellow
    Write-Host "[!] Electron 二进制缺失，从镜像直接下载..." -ForegroundColor Yellow
    Write-Host "    (绕过 postinstall，直接拉取官方 zip)" -ForegroundColor Gray

    # 读取已安装的 electron npm 包版本
    $pkg = Get-Content "node_modules\electron\package.json" -Raw | ConvertFrom-Json
    $ver = $pkg.version
    Write-Host "[*] 目标版本: v$ver" -ForegroundColor Cyan

    # 构造下载地址（npmmirror 主 + GitHub 备用）
    $urls = @(
        "https://npmmirror.com/mirrors/electron/v$ver/electron-v$ver-win32-x64.zip",
        "https://github.com/electron/electron/releases/download/v$ver/electron-v$ver-win32-x64.zip"
    )

    $zip = "$env:TEMP\electron-v$ver.zip"
    $downloaded = $false

    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12

    foreach ($url in $urls) {
        try {
            Write-Host "[*] 尝试: $url" -ForegroundColor Gray
            Invoke-WebRequest -Uri $url -OutFile $zip -ErrorAction Stop
            $downloaded = $true
            break
        } catch {
            Write-Host "    失败 ($($_.Exception.Message))，尝试备用地址..." -ForegroundColor DarkYellow
        }
    }

    if (-not $downloaded) {
        Write-Host "" -ForegroundColor Red
        Write-Host "[X] 所有下载地址均失败" -ForegroundColor Red
        Write-Host "    请检查网络连接后重新运行本脚本" -ForegroundColor Yellow
        Write-Host "    或手动下载 Electron v$ver 并解压到 node_modules\electron\dist\" -ForegroundColor Yellow
        Read-Host "按回车退出"
        exit 1
    }

    # 解压
    Write-Host "[*] 解压到 node_modules\electron\dist\..." -ForegroundColor Cyan
    Expand-Archive -Path $zip -DestinationPath "node_modules\electron\dist" -Force
    Remove-Item $zip

    if (-not (Test-Path $electron_exe)) {
        Write-Host "[X] 解压后仍未找到 electron.exe，请手动处理" -ForegroundColor Red
        Read-Host "按回车退出"
        exit 1
    }

    # 写入 path.txt，electron-vite 通过此文件定位二进制
    "electron.exe" | Out-File -FilePath "node_modules\electron\path.txt" -Encoding ascii -NoNewline
    Write-Host "[OK] Electron v$ver 安装完成" -ForegroundColor Green
}

Write-Host ""
Write-Host "[3/3] 安装完成！" -ForegroundColor Green
Write-Host ""
Write-Host "  启动方式:" -ForegroundColor Yellow
Write-Host "    npm run dev      命令行启动" -ForegroundColor White
Write-Host "    start-dev.bat    双击一键启动" -ForegroundColor White
Write-Host ""
Read-Host "按回车退出"
