# 10 — HTTP 直接下载与安装脚本健壮性：绕过 @electron/get

## 问题现象

上一轮（08 号）设置了 `ELECTRON_MIRROR` 环境变量指向 npmmirror，但用户的克隆测试仍然失败：

```
[!] Electron binary not found. Retrying download
'extraction...' is not recognized as an internal or external command
```

存在两个独立问题：`start-dev.bat` 语法错误 和 `@electron/get` 镜像兼容性问题。

## 一、前置知识

### 1.1 Windows Shell 的语法陷阱

Windows 有两种主要的命令行环境：

| Shell | 可执行文件 | 脚本扩展名 | 语法特点 |
|-------|-----------|-----------|---------|
| Command Prompt (cmd) | `cmd.exe` | `.bat`, `.cmd` | `&` 是命令分隔符 |
| PowerShell | `powershell.exe` | `.ps1` | `&` 不是特殊字符 |

在 cmd 中：

```batch
:: ❌ 错误：& 被解析为命令分隔符
echo [!] Electron binary not found. Retrying download & extraction...

:: cmd 把这个命令理解为两条独立命令：
::   命令1: echo [!] Electron binary not found. Retrying download
::   命令2: extraction...
:: extraction... 不是有效命令 → 报错
```

```batch
:: ✓ 正确：避免在 echo 文本中使用 &，或用引号包裹
echo [!] Electron binary not found. Retrying download and extraction...
```

在 cmd 中嵌入 PowerShell 时还有管道符的问题：

```batch
:: cmd 双引号内的 | 仍被解析为管道符
powershell -Command "echo hello | findstr h"

:: 需要用 ^ 转义
powershell -Command "echo hello ^| findstr h"
```

> **经典源码学习**：Windows cmd 的命令解析器源码在 Windows 开源项目中不可用（闭源），但 ReactOS（Windows 的开源替代）的 cmd 实现 `base/shell/cmd/` 展示了 cmd 如何逐字符解析命令行、如何处理特殊字符。阅读 `parser.c` 可以理解为什么 `&`、`|`、`>` 等字符在不同上下文中表现不同。

### 1.2 HTTP 文件下载：从 URL 到本地文件

直接下载 Electron 二进制文件的核心流程：

```
1. 构造下载 URL
   https://npmmirror.com/mirrors/electron/v28.1.0/electron-v28.1.0-win32-x64.zip
   
2. 发起 HTTP GET 请求
   HTTP/1.1 GET /mirrors/electron/v28.1.0/... HTTP/1.1
   Host: npmmirror.com
   
3. 服务器响应
   HTTP/1.1 200 OK
   Content-Type: application/zip
   Content-Length: 121634816        ← 约 116MB
   
4. 流式写入本地文件
   每收到一个 TCP 数据块 → 追加写入本地 .zip 文件
   （流式处理的好处：不需要 116MB 内存，边收边写）
   
5. 校验（可选）
   对比下载后的文件的 SHA256 与官方公布的校验值
   
6. 解压
   解压 .zip → 提取所有文件到 node_modules/electron/dist/
```

PowerShell 中的实现：

```powershell
# 设置 TLS 1.2（旧版 PowerShell 默认 TLS 1.0，很多 HTTPS 站点拒绝连接）
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# HTTP 下载
Invoke-WebRequest -Uri $download_url -OutFile $zip_path

# 解压
Expand-Archive -Path $zip_path -DestinationPath $target_dir -Force
```

### 1.3 为什��绕过中间库？

`@electron/get` 是一个中间库，增加了一层不确定性：

```
旧方案：npm postinstall → @electron/get → 镜像站/GitHub
        问题：@electron/get 内置的重试逻辑、SHA256 校验、URL 格式转换
              都可能与 npmmirror 镜像的格式不完全兼容

新方案：npm install → 检测缺失 → Invoke-WebRequest → zip 解压
        优势：完全可控 — 只有一个 HTTP 请求 + 一个解压操作
              没有中间层的黑盒逻辑
```

| 维度 | @electron/get 方案 | 直接下载方案 |
|------|-------------------|-------------|
| 可观测性 | 内部异常信息不透明 | HTTP 状态码清晰 |
| 可控性 | 库决定的下载/重试逻辑 | 我们决定的每一步 |
| 复杂度 | 高（缓存/SHA256/镜像/fallback） | 低（HTTP GET → 解压） |
| 镜像兼容性 | 依赖库对镜像格式的支持 | 不依赖任何库 |

**原则**：当你只需要"下载一个文件并解压"时，引入一个完整的下载管理库是过度工程。一个 HTTP 客户端 + 一个解压函数就够了。

### 1.4 版本号读取策略

版本号不能硬编码。正确的方式是从已安装的 npm 包中读取：

```powershell
# 从 electron 包的 package.json 中读取确切版本
$pkg = Get-Content "node_modules\electron\package.json" | ConvertFrom-Json
$ver = $pkg.version   # 例如 "28.1.0" — 确切版本，不是 "^28.1.0"
```

为什么不能从我们的 `package.json` 中读？

```json
// moefocus/package.json
{
  "devDependencies": {
    "electron": "^28.1.0"   // ← 这是语义版本范围，不是确切版本
  }
}
```

`^28.1.0` 的意思是"28.x 中最新的兼容版本"，实际安装的可能是 `28.3.2`。下载二进制时必须用确切版本 `28.3.2`，否则 URL 中的版本号不匹配。

### 1.5 双 URL 兜底策略

```powershell
$urls = @(
    "https://npmmirror.com/mirrors/electron/v$ver/...",    # 主 URL (国内快)
    "https://github.com/electron/electron/releases/download/v$ver/..."  # 备用 (稳定但慢)
)

foreach ($url in $urls) {
    try {
        Invoke-WebRequest -Uri $url -OutFile $zip
        break  # 下载成功 → 跳出循环
    } catch {
        continue  # 下载失败 → 尝试下一个 URL
    }
}
```

这种模式称为"Failover Chain"（故障转移链）— 依次尝试每个备选方案，第一个成功就停止。

> **经典源码学习**：Failover Chain 在分布式系统中是非常基础的模式。DNS 的 A 记录（一个域名可以有多个 IP 地址）、Nginx 的 upstream 配置（`server xxx backup;`）、数据库的主从切换（primary down → promote standby）都是这个模式的不同实现。它们共享同一个核心逻辑：`for (source of sources) { try { return await fetch(source) } catch { continue } }`。

---

## 二、修复方案

### 核心改动

**setup.ps1 新增逻辑**：

```powershell
# npm install 之后
$electron_exe = "node_modules\electron\dist\electron.exe"

if (-not (Test-Path $electron_exe)) {
    Write-Host "[!] Electron binary missing, downloading directly..." -ForegroundColor Yellow

    # 读取确切版本
    $pkg = Get-Content "node_modules\electron\package.json" | ConvertFrom-Json
    $ver = $pkg.version

    # 构造 zip 文件名
    $zip_name = "electron-v$ver-win32-x64.zip"

    # 双 URL 兜底
    $urls = @(
        "https://npmmirror.com/mirrors/electron/v$ver/$zip_name",
        "https://github.com/electron/electron/releases/download/v$ver/$zip_name"
    )

    foreach ($url in $urls) {
        try {
            Write-Host "[*] Downloading: $url"
            Invoke-WebRequest -Uri $url -OutFile $zip_name
            Write-Host "[*] Extracting to node_modules\electron\dist\..."
            Expand-Archive -Path $zip_name -DestinationPath "node_modules\electron\dist" -Force
            Remove-Item $zip_name
            break
        } catch {
            Write-Host "[!] Failed, trying next URL..." -ForegroundColor DarkYellow
        }
    }
}
```

---

## 三、知识点总结

| 知识点 | 一句话总结 |
|--------|-----------|
| cmd 特殊字符 | `&` 是命令分隔符，`|` 是管道符。嵌入 PowerShell 时 `|` 需 `^|` 转义 |
| HTTP 下载 | `Invoke-WebRequest` + `Expand-Archive` 两个操作替代整个 @electron/get |
| 中间库的代价 | 当需求很简单时，中间库增加的是风险而非便利 |
| 版本号读取 | 从已安装包的 package.json 读取确切版本，而非语义版本范围 |
| Failover Chain | `for (url of urls) { try { download } catch { continue } }` — 依次尝试直到成功 |

---

## 涉及文件

| 文件 | 变更 |
|------|------|
| `moefocus/setup.ps1` | 新增直接下载+解压逻辑，双 URL 兜底 |
| `moefocus/start-dev.bat` | 修复 `&` 语法错误，install.js 重试改为 PowerShell 直接下载 |
