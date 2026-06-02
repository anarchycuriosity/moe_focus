# 08 — npm 生态系统与包安装机制：Electron 为何安装失败

## 问题现象

克隆仓库后运行 `npm install` 成功，但启动应用时 electron-vite 报错：

```
Error: Electron uninstall
    at getElectronPath (...node_modules/electron-vite/...)
```

检查发现 `node_modules/electron/dist/` 目录下只有空的 `locales/` 文件夹，`electron.exe`（约 116MB）根本没有被下载。

## 一、前置知识

### 1.1 npm 包安装到底做了什么？

很多人以为 `npm install` 就是"下载代码"。实际上它是一个多步骤的流程：

```
npm install express
  │
  ├─ Step 1: 解析依赖树
  │   读取 package.json → 解析版本范围 (^4.18.0 → 4.x 最新版)
  │   → 递归解析 express 自己的依赖 → 展平为 node_modules 树
  │
  ├─ Step 2: 下载包 (从 registry)
  │   对每个包: GET https://registry.npmjs.org/<name>/<version>
  │   → 拿到 tgz 包的 URL → 下载 .tgz 文件 → 解压到 node_modules/<name>/
  │
  ├─ Step 3: 执行生命周期脚本
  │   按顺序运行 package.json 中的 scripts:
  │     preinstall  →  install  →  postinstall
  │   
  │   electron 包的 postinstall 脚本:
  │     "postinstall": "node install.js"
  │     这个 install.js 会额外下载 Electron 的二进制文件 (electron.exe)
  │
  └─ Step 4: 写入 lock 文件
       把解析后的确切版本写入 package-lock.json（锁定依赖版本）
```

**关键认知**：npm 包（`.tgz` 文件）和 Electron 二进制文件（`electron.exe`）是两回事。

```
npm 包 = JavaScript 代码 + TypeScript 类型定义 + package.json + install.js
        ↓ 从 npm registry 下载（国内有镜像，快）
        大小：~2MB

二进制文件 = electron.exe + DLL + 资源文件
        ↓ 从 GitHub Releases 下载（或镜像站）
        大小：~116MB
```

> **经典源码学习**：npm CLI 的安装流程源码在 `npm/cli` 仓库的 `lib/commands/install.js` 和 `lib/utils/reify/` 目录中。`@npmcli/arborist` 是 npm 的依赖树管理核心，`lib/arborist/reify.js` 中的 `diffTrees` 函数（约 500 行）决定了哪些包需要安装、更新、删除。

### 1.2 Electron 包的 postinstall 做了什么？

`electron` npm 包的 `package.json` 中有：

```json
{
  "scripts": {
    "postinstall": "node install.js"
  }
}
```

这个 `install.js`（约 200 行）使用 `@electron/get` 库来下载二进制文件：

```javascript
// electron/install.js 的简化逻辑
const { download } = require('@electron/get')

async function main() {
  // 1. 确定要下载的版本
  const version = require('./package.json').version  // 如 "28.1.0"

  // 2. 检查本地缓存是否已有
  //    (缓存目录: %LOCALAPPDATA%/electron/Cache/)
  const cached = await checkCache(version)
  if (cached) {
    console.log('Using cached electron binary')
    return extract(cached)  // 从缓存解压
  }

  // 3. 从远程下载 zip 包
  const zipPath = await download(version, {
    mirror: process.env.ELECTRON_MIRROR  // 环境变量指定镜像
  })

  // 4. 解压到 node_modules/electron/dist/
  await extract(zipPath, { dir: 'dist/' })

  // 5. 写入 path.txt（告知下游工具二进制文件名）
  await fs.writeFile('path.txt', 'electron.exe')
}

main().catch(err => {
  // ⚠ 注意：错误被 catch 但不阻断 npm install 返回 0
  console.error('Failed to install electron:', err.message)
})
```

**关键设计缺陷**：postinstall 失败不影响 `npm install` 的退出码。npm 的设计哲学是"postinstall 失败不应阻止安装"（因为有时确实不需要二进制文件），但对 Electron 来说，没有二进制文件应用根本无法运行。

### 1.3 @electron/get 的下载链路

```
@electron/get 查找二进制的顺序:
  │
  ├─ 1. 检查本地缓存目录
  │    %LOCALAPPDATA%/electron/Cache/<version>/electron-v<version>-win32-x64.zip
  │    (之前成功下载过的版本会被缓存，下次直接解压)
  │
  ├─ 2. 检查环境变量 ELECTRON_MIRROR
  │    如果设置了，从这个 URL 下载
  │    例如: https://npmmirror.com/mirrors/electron/v28.1.0/electron-v28.1.0-win32-x64.zip
  │
  ├─ 3. 检查 npm_config_electron_mirror
  │    npm 会把 .npmrc 中的配置转为 npm_config_* 环境变量
  │    但 electron_mirror 不是 npm 的内置 key → 会触发 warning
  │
  └─ 4. 回退到 GitHub Releases
       https://github.com/electron/electron/releases/download/v28.1.0/...
       (国内网络直连 = 大概率超时/失败)
```

### 1.4 npm registry 镜像 ≠ Electron 二进制镜像

这是最容易混淆的概念。

```
.npmrc 中设置:
  registry=https://registry.npmmirror.com/

这告诉 npm:
  "下载 npm 包（.tgz 文件）时从 npmmirror 下载"

这不告诉 @electron/get:
  "下载 Electron 二进制文件（.zip）时从 npmmirror 下载"

两者的 URL 模式完全不同:
  npm 包:       https://registry.npmmirror.com/electron/-/electron-28.1.0.tgz
  二进制文件:    https://npmmirror.com/mirrors/electron/v28.1.0/electron-v28.1.0-win32-x64.zip
```

**类比：** 你在淘宝买了本书（npm 包），但书里附赠了一张 CD（Electron 二进制文件）。淘宝（npm registry 镜像）把书寄给你了，但 CD 要从另一家店（GitHub Releases / 二进制镜像）单独下单。你在淘宝上设了默认收货地址（.npmrc registry），但 CD 店不知道这个地址。

> **经典源码学习**：`@electron/get` 的下载逻辑在 `@electron/get/src/index.ts` 中（约 300 行），其 `downloadArtifact` 函数展示了如何构建一个健壮的下载器：检查缓存 → 选择镜像源 → HTTP 下载 → SHA256 校验 → 回退到备用源。这个模式在你需要分发大型二进制文件时可以直接复用。

### 1.5 为什么开发环境没问题但克隆后失败？

这是"在我机器上能运行"问题的经典原因：

```
开发环境:
  之前某次网络好时 @electron/get 下载成功
  → 二进制缓存到 %LOCALAPPDATA%/electron/Cache/
  → 后续 npm install → postinstall 命中缓存 → 秒装

克隆环境 (新用户):
  没有缓存
  → postinstall → @electron/get → 直连 GitHub Releases → 超时
  → 下载失败 → node_modules/electron/dist/ 为空
  → npm install 返回 0（成功！）但应用无法运行
```

---

## 二、修复方案

### 策略：环境变量 + 安装后验证 + 失败重试

```
Step 1: 设置 ELECTRON_MIRROR 环境变量
  → npm install (postinstall 从镜像下载)
  
Step 2: 验证 electron.exe 是否存在？
  ├─ 是 → 启动 dev server ✓
  └─ 否 → node install.js 重试
    → 再验证？
      ├─ 是 → 启动 ✓
      └─ 否 → 报错 + 给出排查建议
```

**start-dev.bat 关键代码**：

```batch
@echo off
:: 在 npm install 之前设置环境变量
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/

:: 安装依赖
call npm install

:: 验证二进制文件
if not exist "node_modules\electron\dist\electron.exe" (
    echo [!] Electron binary not found. Retrying download...
    node node_modules\electron\install.js
)

:: 二次确认
if not exist "node_modules\electron\dist\electron.exe" (
    echo [ERROR] Electron installation failed.
    echo Please check:
    echo   1. Network connection
    echo   2. Clear npm cache: npm cache clean --force
    echo   3. Delete node_modules and retry
    pause
    exit /b 1
)

:: 启动
call npm run dev
```

**关键设计决策**：

- 不在 `.npmrc` 中添加 `electron_mirror`：npm 不认识这个 key，会产生 `npm warn Unknown project config` 警告
- 环境变量是 `@electron/get` 的一级读取源，最可靠
- 两层验证确保绝对不会带着"半成品"状态启动

---

## 三、知识点总结

| 知识点 | 一句话总结 |
|--------|-----------|
| npm install 多步骤 | 解析依赖 → 下载 tgz → 运行 postinstall → 写入 lock 文件 |
| npm 包 ≠ 二进制文件 | 包走 npm registry（可镜像），二进制走 GitHub Releases（需单独设置镜像） |
| 缓存导致"我机器上能跑" | 开发环境有缓存 → 不触发下载 → 发现不了安装问题 |
| postinstall 失败不阻断 | npm 的设计哲学：postinstall 失败不影响 exit code |
| 环境变量 vs .npmrc | 环境变量是 @electron/get 的标准读取方式，.npmrc 只能设 npm 内置 key |
| 安装后验证 | `npm install` 返回 0 不代表一切就绪，必须检查关键文件是否存在 |

---

## 涉及文件

| 文件 | 变更 |
|------|------|
| `moefocus/start-dev.bat` | 增加 ELECTRON_MIRROR 环境变量 + 安装后验证 |
| `moefocus/setup.ps1` | 增加环境变量 + 验证 + 重试 |
