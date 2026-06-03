# 16 — Electron 桌面应用打包与 GitHub Release 发版

## 前置知识

### 0.1 为什么需要"打包"

你写的 `electron-vite dev` 能跑起来，是因为：
- 你的机器上安装了 Node.js（提供 `node` 运行时）
- 你的项目目录下有 `node_modules/`（所有依赖）
- 你通过 `npx electron-vite` 启动了开发服务器

用户的机器上**没有这些**。打包的目的就是把 Node.js 运行时 + 你的代码 + 所有依赖打包成一个独立的 `.exe` 文件，用户可以双击安装，无需安装任何开发工具。

### 0.2 Electron 应用的三层结构

```
一个 Electron 应用本质上由三层组成：

   ┌──────────────────────────────────┐
   │         NSIS 安装器              │  ← 用户看到的 .exe 安装向导
   │  ┌────────────────────────────┐  │
   │  │     Electron 运行时         │  │  ← Chromium + Node.js 内核 (~150MB)
   │  │  ┌──────────────────────┐  │  │
   │  │  │   你的应用代码        │  │  │  ← out/ 目录下的 JS/CSS/HTML
   │  │  │   (main + renderer)  │  │  │
   │  │  └──────────────────────┘  │  │
   │  └────────────────────────────┘  │
   └──────────────────────────────────┘
```

- **应用代码层**：你的 TypeScript/React 代码，由 `electron-vite` 编译成纯 JS
- **Electron 运行时层**：包含 Chromium（渲染 HTML/CSS/JS）+ Node.js（执行主进程逻辑）
- **安装器层**：将上述内容打包成 Windows 能理解的安装包格式

---

## 一、构建流程详解

### 1.1 第一步：electron-vite build — 编译应用代码

```bash
npx electron-vite build
```

这一步做了什么：

```
源文件                              输出文件
──────────────────────────────────────────────────
electron/main/  (TypeScript)  →  out/main/index.js    (主进程，SSR 模式)
electron/preload/(TypeScript)  →  out/preload/index.js (预加载脚本，SSR 模式)
src/           (React/TSX)    →  out/renderer/        (渲染进程，浏览器模式)
                                  ├── index.html
                                  └── assets/
                                      ├── index-XXXXXXXX.css
                                      └── index-XXXXXXXX.js
```

三个关键概念：

**a) SSR 模式（main + preload）**
- `electron-vite` 对主进程和 preload 脚本使用 Vite 的 SSR 构建模式
- 输出 CommonJS 模块（因为 Electron 的 Node.js 环境使用 `require()`）
- 不做代码分割、不做 CSS 提取（这些是浏览器才需要的）

**b) 浏览器模式（renderer）**
- 渲染进程就是普通的 Vite SPA 构建
- 输出 ES 模块、代码分割、CSS 提取
- 文件名中的 hash（如 `index-Cy_RdgZr.js`）用于浏览器缓存破坏

**c) 构建产物 = 纯静态文件**
- `out/` 目录就是你的完整应用
- 不包含 `node_modules/` — Vite 已经把所有依赖打包进 bundle
- 但 Electron 运行时本身不在这里

### 1.2 第二步：electron-builder — 打包成安装器

```bash
npx electron-builder --win
```

这一步做了什么：

```
输入：                                 输出：
──────────────────────────────────────────────────────────
out/ (你的代码)                   →   dist/MoeFocus Setup 1.0.0.exe
package.json (版本号 1.0.0)       →   dist/MoeFocus Setup 1.0.0.exe.blockmap
electron-builder.yml (打包配置)    →   dist/win-unpacked/
node_modules/electron/ (运行时)
```

electron-builder 读取 `electron-builder.yml` 来决定：
- 安装包的**格式**（NSIS / MSI / portable）
- 安装包的**平台**和**架构**（Windows / macOS / Linux，x64 / arm64）
- 哪些文件需要**打入包内**
- 安装时的**行为**（是否允许自定义路径、是否创建桌面快捷方式等）

---

## 二、electron-builder.yml 配置详解

这是你项目的配置文件：

```yaml
appId: com.moefocus.app          # 应用的唯一标识符（反向域名格式）
productName: MoeFocus            # 安装后显示的名称
directories:
  output: dist                   # 打包产物输出到 dist/ 目录
  buildResources: resources      # 图标等资源文件存放位置
files:
  - out/**/*                     # 只打包 out/ 目录下的文件（你的代码）
win:
  target:
    - target: nsis               # 使用 NSIS 安装器格式
      arch: [x64]                # 仅 64 位 Windows
nsis:
  oneClick: false                # 非一键安装（显示安装向导）
  allowToChangeInstallationDirectory: true  # 允许用户选择安装路径
```

### 各字段深入解析

**appId**
- 反向域名格式，全球唯一
- Windows 注册表中会用到：`HKEY_CURRENT_USER\Software\com.moefocus.app`
- macOS 上就是 Bundle ID：`com.moefocus.app`
- 修改 appId 意味着系统认为这是**不同的应用**（数据目录不同）

**directories.output**
- electron-builder 的输出目录
- 生成的文件包括：
  - `*.exe` — 安装包本体
  - `*.blockmap` — 增量更新用的块映射文件
  - `win-unpacked/` — 解包后的完整应用（不需要安装，直接双击 .exe 运行）
  - `builder-debug.yml` — 调试信息

**files**
- 白名单模式：只有匹配 `out/**/*` 的文件会被打入包内
- `node_modules/` 不会被全部打包 — electron-builder 只打包 `dependencies` 中声明且**实际被 require 的**包
- `devDependencies`（如 vite、typescript）永远不会被打包

**win.target**
- `nsis`：Nullsoft Scriptable Install System — Windows 上最经典的安装器格式
- `msi`：Microsoft Installer — 适合企业批量部署（SCCM/GPO）
- `portable`：免安装版 — 单个 .exe，双击即用

**nsis.oneClick**
- `true`：一键安装，无界面，直接装到 `%LOCALAPPDATA%`
- `false`：显示安装向导（欢迎页 → 选择路径 → 确认 → 进度条 → 完成）
- 你的项目设为 `false` 是正确的 — 让用户有控制感

### 缺失的配置（建议补充）

```yaml
# 1. 图标（当前用的是默认 Electron 图标）
win:
  icon: resources/icon.ico

# 2. 作者信息
# 在 package.json 中补充：
# "author": "Your Name <email@example.com>"

# 3. 快捷方式名称
nsis:
  shortcutName: MoeFocus

# 4. 卸载时是否删除用户数据
nsis:
  deleteAppDataOnUninstall: false  # 保留用户数据
```

---

## 三、安装包产物说明

打包完成后，`dist/` 目录下的文件：

| 文件 | 大小 | 说明 |
|------|------|------|
| `MoeFocus Setup 1.0.0.exe` | ~101MB | NSIS 安装向导，发给用户的文件 |
| `MoeFocus Setup 1.0.0.exe.blockmap` | ~110KB | 块映射文件，用于自动更新（auto-updater） |
| `win-unpacked/` | ~300MB | 解包后的完整应用目录，用于调试 |

**为什么安装包有 101MB？**

```
Chromium 内核:      ~80MB
Node.js 运行时:     ~15MB
你的应用代码:       ~1.5MB
NSIS 安装器开销:    ~5MB
```

Electron 应用的体积主要由 Chromium 内核贡献。这是 Electron 的固有特征——你在打包一个完整的浏览器。

---

## 四、GitHub Release 发版流程

### 4.1 版本号管理

**语义化版本 (Semantic Versioning)：**

```
v1.0.0
│ │ │
│ │ └── PATCH：Bug 修复（不改功能、不破坏兼容性）
│ └──── MINOR：新增功能（向后兼容）
└────── MAJOR：破坏性变更（不向后兼容）
```

你的项目当前是 `1.0.0`。规则：
- 修了一个 bug → `v1.0.1`
- 加了一个新功能 → `v1.1.0`
- 重写了数据库结构 → `v2.0.0`

### 4.2 Git Tag 与 Release 的关系

```
GitHub Release = Git Tag + 发布说明 + 二进制附件

   git tag v1.0.0                    GitHub Release
   ──────────────                    ──────────────
   指向某个 commit 的快照      +     发布说明 (Markdown)
                                     + 附加文件 (.exe 安装包)
                                     + 源码归档 (.zip / .tar.gz)
```

- **Tag** 是 Git 层面的概念 — 一个指向特定 commit 的不可变引用
- **Release** 是 GitHub 层面的概念 — 基于 Tag，附加了说明和二进制文件
- 一个 Tag 可以有对应的 Release，也可以没有
- 删除 Tag 后，对应的 Release 不会自动删除

### 4.3 完整发版步骤

**第一步：确保代码已提交并推送**

```bash
git add .
git commit -m "chore: 准备 v1.0.0 发版"
git push origin main
```

**第二步：更新版本号（如果需要）**

修改 `moefocus/package.json` 中的 `version` 字段：
```json
"version": "1.0.1"
```

**第三步：构建 + 打包**

```bash
cd moefocus
npx electron-vite build
npx electron-builder --win
```

**第四步：打 Tag 并推送**

```bash
git tag -a v1.0.1 -m "Release v1.0.1"
git push origin v1.0.1
```

`-a` 创建附注标签（annotated tag），包含标签信息、创建者、创建时间。推荐使用附注标签而不是轻量标签（`git tag v1.0.1`）。

**第五步：创建 GitHub Release**

```bash
gh auth login                    # 首次使用需要登录
gh release create v1.0.1 \
  --title "MoeFocus v1.0.1" \
  --notes "## 更新内容

- 修复了 xxx bug
- 新增了 xxx 功能" \
  --draft \
  "./dist/MoeFocus Setup 1.0.1.exe"
```

关键参数：
- `--draft`：先创建草稿，检查无误后手动发布
- `--prerelease`：标记为预发布版本（beta/alpha）
- `--notes-file`：从文件读取发布说明
- 最后的文件路径会被作为附件上传

### 4.4 如果 Tag 打错了怎么办

```bash
# 查看当前 tag 指向哪个 commit
git rev-parse v1.0.0^{}

# 删除本地 tag
git tag -d v1.0.0

# 删除远程 tag
git push origin :refs/tags/v1.0.0

# 重新打 tag 到正确的位置
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

注意：删除已发布的 Release 对应的 Tag 会让 Release 变成 "Untagged" 状态。

---

## 五、常见问题排查

### 5.1 electron-builder 下载 Electron 很慢

electron-builder 需要从 GitHub Releases 下载对应版本的 Electron 二进制包。国内网络可能很慢。

**解决方案：使用镜像**

```bash
# 设置 Electron 镜像（淘宝镜像）
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/

# 或者在 package.json 中配置
"electronDownload": {
  "mirror": "https://npmmirror.com/mirrors/electron/"
}
```

### 5.2 打包报错 "cannot find module xxx"

这说明某个依赖没有被正确打进包内。检查：
1. 是不是放到了 `devDependencies` 而不是 `dependencies`？
2. 是不是使用了原生模块（`.node` 文件）需要特殊处理？

```json
// 需要运行时使用的 → dependencies
"dependencies": {
  "sql.js": "^1.10.0"
}

// 仅开发/构建时使用的 → devDependencies
"devDependencies": {
  "electron-builder": "^24.9.1"
}
```

### 5.3 安装包签名

Windows 上未签名的安装包会触发 SmartScreen 警告（蓝色/红色弹窗）：

- **测试/内部使用**：无需签名，用户点 "更多信息 → 仍要运行" 即可
- **公开发布**：需要购买代码签名证书（OV/EV Code Signing Certificate），年费 $200-$400
- **EV 证书**：立即可信，跳过 SmartScreen
- **OV 证书**：需要累积足够的下载量才能建立信誉

---

## 六、自动化发版（进阶）

当你熟悉手动流程后，可以用 GitHub Actions 实现自动化：

```yaml
# .github/workflows/release.yml
name: Build and Release

on:
  push:
    tags:
      - 'v*'  # 推送 v 开头的 tag 时触发

jobs:
  release:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: cd moefocus && npm ci
      - run: cd moefocus && npx electron-vite build
      - run: cd moefocus && npx electron-builder --win
      - uses: softprops/action-gh-release@v1
        with:
          files: moefocus/dist/*.exe
```

这样你只需要打 tag 并推送，CI 会自动完成构建、打包、创建 Release。

---

## 本教程涉及的 MoeFocus 实际文件

| 文件 | 作用 |
|------|------|
| `moefocus/package.json` | 定义版本号、依赖、构建脚本 |
| `moefocus/electron-builder.yml` | 打包配置（输出目录、安装器类型、平台） |
| `moefocus/out/` | electron-vite 构建产物（你的应用代码） |
| `moefocus/dist/` | electron-builder 打包产物（安装器） |

---

## 延伸学习

- **Pro Git 第二章**：Git 标签（轻量标签 vs 附注标签）
- **electron-builder 文档**：https://www.electron.build/
- **NSIS 文档**：安装器脚本语言参考
- **语义化版本规范**：https://semver.org/lang/zh-CN/

---

*创建于 2026-06-04 — MoeFocus v1.0.0 发版实操记录*
