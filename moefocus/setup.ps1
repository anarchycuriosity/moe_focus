# MoeFocus 国内网络环境一键安装脚本
# 在项目目录下右键 → "使用 PowerShell 运行"，或：
# PowerShell: cd 到项目目录，输入 .\setup.ps1

Write-Host " MoeFocus 安装脚本" -ForegroundColor Magenta
Write-Host "====================" -ForegroundColor Magenta

# 设置国内镜像（npm 包 + Electron 二进制）
$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
$env:ELECTRON_BUILDER_BINARIES_MIRROR = "https://npmmirror.com/mirrors/electron-builder-binaries/"

Write-Host "[1/2] 安装依赖 (使用淘宝镜像)..." -ForegroundColor Cyan
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "安装失败！请检查网络连接" -ForegroundColor Red
    Read-Host "按回车退出"
    exit 1
}

# 验证 Electron 二进制
$electron_exe = "node_modules\electron\dist\electron.exe"
if (-not (Test-Path $electron_exe)) {
    Write-Host "[*] Electron 二进制未解压，尝试重新安装..." -ForegroundColor Yellow
    node node_modules\electron\install.js
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Electron 安装失败！请删除 node_modules\electron 后重试" -ForegroundColor Red
        Read-Host "按回车退出"
        exit 1
    }
    if (-not (Test-Path $electron_exe)) {
        Write-Host "Electron 二进制仍然缺失！" -ForegroundColor Red
        Write-Host "  1. 检查网络连接" -ForegroundColor Yellow
        Write-Host "  2. 删除 %LOCALAPPDATA%\electron\Cache 后重试" -ForegroundColor Yellow
        Read-Host "按回车退出"
        exit 1
    }
}

Write-Host "[2/2] 安装完成！启动开发服务器..." -ForegroundColor Cyan
Write-Host ""
Write-Host "运行 npm run dev 启动应用" -ForegroundColor Yellow
Write-Host "或双击 start-dev.bat 一键启动" -ForegroundColor Yellow
Write-Host ""
Read-Host "按回车退出"
