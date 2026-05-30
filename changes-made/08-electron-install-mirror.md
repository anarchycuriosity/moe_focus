# 08 — Electron 安装失败：镜像源与安装脚本健壮性

## 问题现象

用户克隆仓库后运行 `start-dev.bat`，`npm install` 成功但 `electron-vite dev` 报错：

```
Error: Electron uninstall
    at getElectronPath (...node_modules/electron-vite/...)
```

`node_modules/electron/dist/` 下只有空的 `locales/` 目录，`electron.exe` 未下载。

## 思维出发点

问自己三个问题：
1. npm 包既然装上了，为什么 Electron 二进制没下载？
2. 同样的环境，原项目为什么正常（`electron.exe` 存在）？
3. `.npmrc` 已经配了 `registry=https://registry.npmmirror.com/`，还不够吗？

## 根因分析

### npm 包 vs 二进制文件是两回事

npm registry 镜像只加速 **npm 包的下载**（`package.json` + `*.js`），但 `electron` 这个 npm 包的 `postinstall` 脚本会额外下载 **Electron 二进制文件**（~116MB 的 `electron.exe` + DLL 等）。

下载链路：
```
npm install electron@28.1.0
  → 从 npmmirror 下载 npm 包（快，走 registry）✅
  → postinstall: node install.js
    → @electron/get 从 GitHub Releases 下载二进制（慢/失败）❌
```

`@electron/get` 的查找顺序：
1. `process.env.ELECTRON_MIRROR` — 环境变量（优先）
2. `process.env.npm_config_electron_mirror` — npm 配置透传
3. 默认：`https://github.com/electron/electron/releases/download/`

没有设 `ELECTRON_MIRROR` 时，第三步直连 GitHub，国内大概率超时。

### 为什么 `.npmrc` 的 registry 设置不覆盖二进制下载

`registry` 是 npm 的内置配置项，只影响包元数据和 tgz 包的下载源。Electron 的二进制文件不在 npm registry 上，在 GitHub Releases（或镜像站）上，需要单独的镜像 URL。

### 为什么原项目正常

原项目的 `electron.exe` 可能在某次网络状况好的时候下载成功并缓存到了 `%LOCALAPPDATA%\electron\Cache\`。后续即使 `npm install` 重装，`@electron/get` 命中缓存，直接解压即可，不再下载。

克隆后的项目没有这个缓存，需要重新下载，裸连 GitHub 就失败了。

### 额外发现：extract-zip 在跨文件系统场景下的性能问题

在 WSL2 访问 NTFS 文件系统时测试发现，`extract-zip`（Node.js 流式解压库）解压 116MB 的 zip 文件极慢（>2分钟），而系统 `unzip` 命令秒级完成。这是因为 WSL2 通过 9P 协议访问 NTFS，每个 `read()`/`write()` 系统调用都有跨 OS 开销，流式处理的放大效应明显。

原生 Windows 下不存在此问题。

## 解决方案

### 策略：环境变量 + 验证 + 重试

只设环境变量不够——如果下载成功但解压失败（缓存损坏、磁盘满等），依然会缺 `electron.exe`。

```
设 ELECTRON_MIRROR 环境变量
  → npm install（postinstall 尝试下载+解压）
  → 验证 electron.exe 存在？
    ├─ 是 → 启动 dev server
    └─ 否 → node install.js 重试
      → 再验证？
        ├─ 是 → 启动
        └─ 否 → 报错 + 排查建议
```

### 具体修改

**`start-dev.bat`**：
```batch
:: 在 npm install 之前
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/

:: 在 npm install 之后
if not exist "node_modules\electron\dist\electron.exe" (
    node node_modules\electron\install.js
    :: 二次确认 + 排查建议
)
```

**`setup.ps1`**：同样逻辑，PowerShell 语法实现。

**`.npmrc`** 不做修改——`electron_mirror` 不是合法的 npm config key，会产生 `npm warn Unknown project config` 警告。环境变量是 `@electron/get` 的标准读取方式，更可靠。

## 关键原则

1. **不要把 npm 包安装成功等同于应用能运行** — postinstall 脚本可能静默失败
2. **国内环境的镜像需要覆盖两个层面**：npm 包（registry）和二进制文件（env var）
3. **安装脚本要做验证而非盲信** — `npm install` 返回 0 不代表一切就绪
4. **模拟用户环境测试** — 清缓存、删 node_modules、从零开始，才能发现新用户的真实问题
