# MoeFocus 国内网络环境一键安装脚本
# 在项目目录下右键 → "使用 PowerShell 运行"，或：
# PowerShell: cd 到项目目录，输入 .\setup.ps1

Write-Host " MoeFocus 安装脚本" -ForegroundColor Magenta
Write-Host "====================" -ForegroundColor Magenta

# 设置国内镜像
$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
$env:ELECTRON_BUILDER_BINARIES_MIRROR = "https://npmmirror.com/mirrors/electron-builder-binaries/"

Write-Host "[1/2] 安装依赖 (使用淘宝镜像)..." -ForegroundColor Cyan
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "安装失败！请检查网络连接" -ForegroundColor Red
    Read-Host "按回车退出"
    exit 1
}

Write-Host "[2/2] 安装完成！启动开发服务器..." -ForegroundColor Cyan
Write-Host ""
Write-Host "运行 npm run dev 启动应用" -ForegroundColor Yellow
Write-Host ""
Read-Host "按回车退出"
