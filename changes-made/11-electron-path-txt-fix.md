# 11 — 模块契约与副作用：path.txt 缺失导致 Electron 启动失败

## 问题现象

安装脚本执行成功（npm install + 直接下载解压 electron.zip），`electron.exe` 已确认存在，但启动 dev server 时仍然报错：

```
Error: Electron uninstall
    at getElectronPath (electron-vite/dist/chunks/lib-BmEkZIgk.mjs:129:19)
```

明明 `electron.exe` 就在 `node_modules/electron/dist/` 里，为什么还报 "Electron uninstall"？

## 一、前置知识

### 1.1 什么是模块契约（Module Contract）？

在软件工程中，两个模块之间除了公开的 API 之外，往往还存在**隐性约定**。这些约定没有写在类型签名里，但是如果不遵守，另一个模块就会出问题。

**现实类比**：你去酒店入住。前台给你房卡（公开 API：`enterRoom(card)`），但有一个隐性契约：酒店预计你会在第二天中午 12 点前退房。如果你不遵守（中午 12:30 还在房间里），酒店系统不会阻止你，但清洁工会按时来敲门。

在 Electron 生态中：

```
electron npm 包的隐性契约：
  "解压完 zip 之后，我会在包的根目录写一个 path.txt，
   内容是当前平台的可执行文件名（Windows: electron.exe）
   下游工具（electron-vite, electron-builder...）都依赖这个文件来定位二进制"

我们绕过 install.js 直接下载解压：
  ✓ 解压 zip → electron.exe 就位
  ✗ 写入 path.txt → 我们没有做这一步
  
后果：
  electron-vite 读 path.txt → 文件不存在 → 报 'Electron uninstall'
```

### 1.2 electron-vite 如何找到 Electron 二进制？

`electron-vite` 的 `getElectronPath()` 函数（约 20 行）：

```javascript
// node_modules/electron-vite/dist/chunks/lib-BmEkZIgk.mjs

function getElectronPath() {
    // Step 1: 定位 electron npm 包的目录
    const electronModulePath = path.dirname(
        require.resolve('electron')      // → node_modules/electron/index.js
    )                                    // → node_modules/electron/

    // Step 2: 读取 path.txt 获取可执行文件名
    const pathFile = path.join(electronModulePath, 'path.txt')
    let executablePath;
    if (fs.existsSync(pathFile)) {
        executablePath = fs.readFileSync(pathFile, 'utf-8')
        // 在 Windows 上: path.txt 内容是 "electron.exe"
        // 在 macOS 上:   path.txt 内容是 "Electron.app/Contents/MacOS/Electron"
        // 在 Linux 上:   path.txt 内容是 "electron"
    }

    // Step 3: 拼接完整路径
    if (executablePath) {
        electronExecPath = path.join(
            electronModulePath, 'dist', executablePath
        )
        // → node_modules/electron/dist/electron.exe
    } else {
        // Step 4: 如果 path.txt 不存在，抛出错误
        throw new Error('Electron uninstall')
    }

    return electronExecPath
}
```

**关键发现**：electron-vite 不检查 `electron.exe` 是否存在，它只检查 `path.txt` 是否存在！

### 1.3 官方 install.js 到底做了哪些事？

要安全地绕过一个模块的脚本，必须先完整理解它的所有操作。官方 `electron/install.js` 做的事：

```
1. 从 GitHub/镜像 下载 electron-v<ver>-<platform>-<arch>.zip
2. SHA256 校验 zip 文件完整性
3. 解压到 node_modules/electron/dist/
4. 移动 electron.d.ts 到包根目录（TypeScript 类型定义）
5. 写入 path.txt — 内容为当前平台的可执行文件名
6. 写入版本缓存到 %LOCALAPPDATA%/electron/Cache/
```

我们的直接下载方案覆盖了步骤 1 和 3，遗漏了步骤 5。

### 1.4 path.txt 的尾部换行符陷阱

这是整个项目中最隐蔽的细节之一：

```powershell
# ❌ 危险：默认会在末尾加换行符 \r\n (Windows) 或 \n (Unix)
"electron.exe" | Out-File -FilePath "node_modules\electron\path.txt"
# path.txt 内容: "electron.exe\r\n"

# 然后 electron-vite 拼接路径:
path.join('node_modules/electron', 'dist', 'electron.exe\n')
#                                         └──────────────┘
#                                         /!\ 路径中包含换行符！
#                                         在文件系统中 'electron.exe\n' ≠ 'electron.exe'
```

```powershell
# ✓ 正确：-NoNewline 参数确保不添加尾部换行符
"electron.exe" | Out-File -FilePath "node_modules\electron\path.txt" -Encoding ascii -NoNewline
# path.txt 内容: "electron.exe" (恰好 12 字节，无换行符)
```

**为什么尾部换行符这么容易出错？**

在大多数场景下，文本文件末尾的换行符是无害的（甚至有些工具要求末尾有换行符）。但 `path.txt` 是一个**机器读取的元数据文件**，不是人类阅读的文本文件——它的内容会被直接拼接到文件路径中。多一个换行符 → 路径无效 → 文件找不到。

> **经典源码学习**：POSIX 标准规定文本文件应该以换行符结尾（IEEE Std 1003.1-2017, 3.206 Line）。但许多 Windows 工具不遵循这个约定。Git 在 `git diff` 中会警告 "No newline at end of file"。理解"人类可读"和"机器可读"文件的不同要求，是系统编程的基本素养。

---

## 二、修复方案

在 `setup.ps1` 和 `start-dev.bat` 的解压步骤之后增加写入 `path.txt`：

**setup.ps1**：

```powershell
# 写入 path.txt — electron-vite 通过此文件定位二进制
"electron.exe" | Out-File -FilePath "node_modules\electron\path.txt" -Encoding ascii -NoNewline
```

**start-dev.bat**（嵌入的 PowerShell 中，管道符需转义）：

```batch
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "... Expand-Archive ...; ^
   'electron.exe' ^| Out-File -FilePath 'node_modules\electron\path.txt' -Encoding ascii -NoNewline"
```

---

## 三、知识点总结

| 知识点 | 一句话总结 |
|--------|-----------|
| 模块契约 | 模块之间除了公开 API 外，还有文件、配置、元数据等隐性约定 |
| 绕过脚本前的逆向分析 | 理清原始脚本的所有操作（下载、解压、校验、元数据写入），确保替换方案覆盖全部 |
| 元数据文件 | `path.txt` 是机器读取的文件，非人类阅读。换行符对路径拼接是致命的 |
| -NoNewline | Unix 文本约定 ≠ 机器元数据文件的要求。写配置/元数据文件时用 -NoNewline |

---

## 四、项目作业：构建一个跨平台安装脚本（覆盖 08/10/11）

### 作业目标

为你的 config-manager（01 号文档的作业项目）构建一套跨平台安装脚本，覆盖以下知识点：
- npm 包安装与二进制文件下载的区别
- postinstall 脚本的副作用管理
- 安装后的验证步骤
- 多操作系统的兼容处理

### 核心要求

```
1. 创建一个 setup 脚本（Windows .ps1 + Unix .sh）
   - 检测 Node.js 是否安装（最低版本要求）
   - npm install 依赖
   - 安装后验证关键文件是否存在
   - 如果验证失败，提供清晰的排查步骤

2. 模拟"二进制文件单独下载"场景
   - 创建一个假的"二进制"依赖（一个大文件，比如一个 ffmpeg 可执行文件）
   - package.json postinstall 脚本负责"下载"这个文件
   - 安装脚本需要验证 postinstall 是否成功

3. 实现安装失败时的优雅降级
   - 区分"npm install 失败"和"二进制下载失败"
   - 每种失败给出不同的排查指南
   - 错误信息要面向非技术用户（不是满屏 stack trace）
```

### 关键代码骨架

```bash
#!/bin/bash
# setup.sh — Unix 安装脚本

set -e  # 任何命令失败则退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: 检测 Node.js
check_node() {
    if ! command -v node &> /dev/null; then
        echo -e "${RED}[ERROR] Node.js is not installed.${NC}"
        echo "Please install Node.js 20 LTS from: https://nodejs.org/"
        exit 1
    fi

    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        echo -e "${RED}[ERROR] Node.js 18+ required, found: $(node -v)${NC}"
        exit 1
    fi

    echo -e "${GREEN}[OK] Node.js $(node -v)${NC}"
}

# Step 2: 安装依赖
install_deps() {
    echo "[*] Installing npm dependencies..."
    npm install --legacy-peer-deps

    if [ $? -ne 0 ]; then
        echo -e "${RED}[ERROR] npm install failed.${NC}"
        echo "Try: npm cache clean --force && rm -rf node_modules && npm install"
        exit 1
    fi
    echo -e "${GREEN}[OK] npm dependencies installed${NC}"
}

# Step 3: 验证关键文件
verify_installation() {
    local BINARY="node_modules/.bin/your-tool"

    if [ ! -f "$BINARY" ]; then
        echo -e "${YELLOW}[!] Binary not found. Retrying download...${NC}"
        node node_modules/your-package/install.js

        if [ ! -f "$BINARY" ]; then
            echo -e "${RED}[ERROR] Binary download failed.${NC}"
            echo "Possible solutions:"
            echo "  1. Check your network connection"
            echo "  2. Set MIRROR_URL environment variable for alternative download"
            echo "  3. Download manually from: https://example.com/releases"
            exit 1
        fi
    fi
    echo -e "${GREEN}[OK] Binary verified${NC}"
}

# 主流程
echo "=== Your App Setup ==="
check_node
install_deps
verify_installation
echo -e "${GREEN}[DONE] Installation complete! Run 'npm start' to begin.${NC}"
```

### 验收标准

- [ ] 在干净的克隆环境（无 node_modules）中运行 setup 脚本，全流程通过
- [ ] 故意删除二进制文件后运行 setup 脚本，检测到缺失并自动修复
- [ ] 模拟网络断开时安装失败，错误信息清晰可操作
- [ ] Unix 和 Windows 脚本都能正常工作

### 思考题

1. 如果二进制文件有 500MB（而不是 116MB），`Invoke-WebRequest` 直接下载有什么潜在问题？怎么改进？
2. postinstall 中如果包含编译步骤（如 `node-gyp rebuild`），安装脚本需要额外安装什么依赖？
3. Docker 化部署时，安装脚本的逻辑应该怎么调整？（提示：Docker 不需要检测系统依赖）

---

## 涉及文件

| 文件 | 变更 |
|------|------|
| `moefocus/setup.ps1` | 解压后新增写入 path.txt（-NoNewline） |
| `moefocus/start-dev.bat` | 嵌入的 PowerShell 命令中增加 path.txt 写入 |
