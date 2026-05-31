# 10 — Electron 二进制直接下载方案（取代镜像 postinstall）

## 问题背景

第四轮修复（`e8bcae7`）通过设置 `ELECTRON_MIRROR` 环境变量引导 `@electron/get` 走 npmmirror 镜像下载二进制。但用户克隆测试后仍然失败：

```
[!] Electron binary not found. Retrying download
'extraction...' is not recognized as an internal or external command
```

存在两个独立缺陷：

### 缺陷 1：`start-dev.bat` 语法错误

```bat
echo [!] Electron binary not found. Retrying download & extraction...
```

cmd 将 `&` 解析为**命令分隔符**，导致 `extraction...` 被当作独立命令执行，因此输出：

```
'extraction...' is not recognized as an internal or external command,
operable program or batch file.
```

### 缺陷 2：`@electron/get` 镜像下载不可靠

即使 `ELECTRON_MIRROR` 已正确设置，`@electron/get` 内部有多层回退逻辑（cache → mirror → official），镜像响应格式或网络波动均可导致下载失败。且 `electron` 包的 postinstall 失败不阻断 `npm install`，导致 `node_modules` 装好但二进制缺失的半成品状态。

## 根因分析

```
npm install electron
  └─ postinstall: node install.js
       └─ @electron/get
            ├─ 检查本地缓存 (%LOCALAPPDATA%\electron\Cache)
            ├─ 检查 ELECTRON_MIRROR 指向的镜像
            └─ 回退到 GitHub Releases
```

问题链条：
1. 国内网络到 GitHub 直连成功率低
2. npmmirror 镜像的 `@electron/get` 兼容性不完全（URL 格式、SHA256 校验、重定向处理等）
3. 任何一层失败后，`@electron/get` 抛出异常但 npm 不报错
4. 最终 `node_modules/electron/dist/` 为空目录

## 修复思路

**绕过 `@electron/get` 的自动下载机制**，改为直接 HTTP 下载 Electron 官方 zip 包并解压。这是用户最初成功安装的方式——直接访问 URL 下载，不依赖中间库的网络处理逻辑。

核心差异：
```
旧：npm postinstall → @electron/get → mirror/GitHub
新：npm install → 检测缺失 → Invoke-WebRequest → zip 解压
```

## 实现细节

### `setup.ps1` 新增逻辑

```powershell
# npm install 之后，检测 electron.exe
if (-not (Test-Path $electron_exe)) {
    # 读取确切版本号（从已安装的 npm 包，非 package.json）
    $pkg = Get-Content "node_modules\electron\package.json" | ConvertFrom-Json
    $ver = $pkg.version

    # 双 URL 兜底
    $urls = @(
        "https://npmmirror.com/mirrors/electron/v$ver/..."
        "https://github.com/electron/electron/releases/download/v$ver/..."
    )

    # 依次尝试下载 → 解压 → 验证
    foreach ($url in $urls) {
        Invoke-WebRequest -Uri $url -OutFile $zip
        Expand-Archive -Path $zip -DestinationPath "node_modules\electron\dist" -Force
    }
}
```

关键设计决策：
1. **版本读取**：从 `node_modules/electron/package.json` 读取确切版本（28.1.0），而非解析 `package.json` 中的语义版本范围（`^28.1.0`）
2. **双 URL 兜底**：npmmirror 主 URL + GitHub Release 备用，任一成功即终止
3. **TLS 1.2**：显式设置 `[Net.ServicePointManager]::SecurityProtocol`，避免旧 PowerShell 的 SSL/TLS 问题

### `start-dev.bat` 修复

1. **语法修复**：`download & extraction` → `directly from mirror...`（去除 `&`）
2. **下载逻辑**：`node node_modules\electron\install.js` → 嵌入式 PowerShell 直接下载
3. **cmd 转义**：PowerShell 管道符 `|` 在 cmd 双引号内需用 `^|` 转义

```bat
powershell -NoProfile -ExecutionPolicy Bypass -Command "$pkg = Get-Content ... ^| ConvertFrom-Json; ..."
```

## 模拟克隆测试

### 测试步骤
1. 复制项目到 `cli_test/moe_focus/`（排除 `node_modules`）
2. 运行 `setup.ps1`
3. 验证 `node_modules/electron/dist/electron.exe` 存在
4. 删除 `electron.exe` 模拟二进制缺失
5. 运行嵌入在 `start-dev.bat` 中的 PowerShell 下载命令
6. 验证二进制恢复

### 测试结果
```
[1/3] 安装 npm 依赖...
[OK] npm 依赖安装完成
[!] Electron 二进制缺失，从镜像直接下载...
[*] 目标版本: v28.1.0
[*] 尝试: https://npmmirror.com/mirrors/electron/v28.1.0/...
[*] 解压到 node_modules\electron\dist\...
[OK] Electron v28.1.0 安装完成
EXIT_CODE: 0
```

两轮测试均通过，`electron.exe` 正确就位。

## 为什么比上次的方案更好

| 维度 | 旧方案 (e8bcae7) | 新方案 |
|------|-----------------|--------|
| 下载方式 | `@electron/get` 自动 | `Invoke-WebRequest` 直接 |
| 失败处理 | 重试同一路径 | 双 URL 兜底 |
| 可控性 | 依赖库的黑盒逻辑 | 完全可控的 HTTP 请求 |
| 错误信息 | `@electron/get` 内部异常 | 明确的 HTTP 状态码和异常信息 |
| 镜像兼容性 | 依赖 `@electron/get` 对镜像格式的支持 | 不依赖任何中间库 |

## 关键文件

| 文件 | 变更 |
|------|------|
| `moefocus/setup.ps1` | 新增直接下载+解压逻辑，双 URL 兜底 |
| `moefocus/start-dev.bat` | 修复 `&` 语法错误，`install.js` 重试改为 PowerShell 直接下载 |
