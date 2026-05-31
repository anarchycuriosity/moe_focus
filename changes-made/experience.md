# MoeFocus 问题修复经验总结

## 本次修复概览 (2026-05-31)

修复了 MoeFocus 桌面端 7 个问题，涉及前端状态管理、IPC 通信、SQL 查询、CSS 样式、图表组件重写等多个层面。

## 关键技术要点

### 1. 数据流完整性检查

设置功能的经典陷阱：写入端正常工作，但读取端没有消费数据。

- **教训**：每添加一个设置项，必须同时确认 (a) 写入到了哪里 (b) 谁在什么时候读取它 (c) 是否有默认值 fallback
- **模式**：`SettingsPage(写) → DB → SessionConfig(读) → Store(应用)` 的完整链路
- **调试技巧**：在关键节点打 `console.log` 追踪数据流

### 2. SQL 语法警觉

在 `focus:complete` 中发现了 `SET status != 'running'` 的 bug：
- `!=` 是比较运算符，`=` 才是赋值
- `SET a != b AND c != d` 会被解析为布尔表达式而非赋值
- 这类 bug 的隐蔽性在于 SQLite 不会报语法错误，只是静默地不更新数据

### 3. CSS 简写属性的覆盖陷阱

`background: gradient(...)` 与 `background-image: url(...)` 的冲突：
- `background` 简写会重置所有 `background-*` 长写属性
- 即使内联样式设置了 `backgroundImage`，如果 CSS 规则中使用 `background` 简写可能在特定时机覆盖
- **规则**：设置默认背景图时使用 `background-image` 而非 `background`

### 4. 过时 API 的渐进迁移

Electron 从 `protocol.registerFileProtocol` 迁移到 `protocol.handle`：
- `registerFileProtocol(callback)` → `protocol.handle(() => net.fetch())`
- 新 API 使用标准的 Response 对象，与 Web 标准对齐
- 迁移时注意路径格式：`file:///C:/path` (Windows) vs `file:///path` (Unix)

### 5. Recharts 堆叠柱状图的数据准备

堆叠柱状图的关键约束：
- 每条 Bar 需要 `stackId` 相同才能堆叠
- 数据结构需要展平：每个 category（事项）作为独立的 dataKey
- 颜色一致性：同一 subject 在所有柱子上必须使用相同颜色 → 需要预建 subject→color 映射表
- 月统计的合并逻辑：同名 subject → 累加秒数 → 在图表层合并而非 SQL 层

### 6. Glassmorphism 设计原则

毛玻璃效果不是简单降低透明度：
- `backdrop-filter: blur()` + `saturate()` 是关键
- 不透明度 0.45-0.55 是文字可读性与壁纸可见性的平衡点
- blur 值 10-14px 提供足够的模糊度
- `saturate(150-180%)` 补偿 blur 导致的色彩变灰
- 半透明白色边框 `rgba(255,255,255,0.35)` 提供微妙的边界感

## 项目架构认知

- **状态管理**：Zustand store 是单一真相来源，设置默认值的加载应在组件 mount 时完成
- **IPC 模式**：preload.ts 暴露类型安全的 API → ipc/index.ts 注册 handler → Service 层处理业务逻辑
- **Recharts**：适合中等复杂度的图表需求，堆叠柱状图需要前端数据转换
- **CSS Modules**：每个组件的样式隔离良好，全局主题变量在 `global.css` 中定义

---

## 第四轮修复 (2026-05-31)

### 7. npm 包安装成功 ≠ 应用可运行

Electron 的 npm 包和 Electron 二进制文件是分离的：
- npm 包通过 registry 下载（npm mirror 已覆盖）
- 二进制文件通过 `@electron/get` 从 GitHub Releases 下载（需要单独的 `ELECTRON_MIRROR` 环境变量）
- postinstall 脚本失败可能不阻断 `npm install` 返回 0

**教训**：
- `.npmrc` 的 `registry` 镜像 ≠ Electron 二进制镜像，国内环境需要两层镜像
- `npm_config_*` 透传机制：`.npmrc` 的 key 会被转为 `npm_config_<key>` 环境变量，但 `electron_mirror` 不是 npm 的内置 key，会产生 warning
- 环境变量 `ELECTRON_MIRROR` 是 `@electron/get` 的一级读取源，比 npm config 透传更可靠
- **安装脚本必须做验证而非盲信**：`npm install` 返回 0 后应检查关键文件是否存在

**调试技巧**：
- `DEBUG=* node node_modules/electron/install.js` 可以观察 `@electron/get` 的完整下载/缓存/解压流程
- `extract-zip` 在跨文件系统（WSL2→NTFS）场景性能极差，模拟测试时要注意环境差异

### 8. 暗色模式 CSS 的铁律：永不硬编码背景色

`select` 和 `time_input` 硬编码 `background: white`，暗色模式下浅色文字（`#E8E4F0`）在白底上对比度接近零。

**核心原则**：
- 所有背景色用主题 CSS 变量（`var(--moe-glass-*)`），让暗/亮模式自动切换
- 亮色特殊需求通过 `[data-theme]` 选择器覆盖，而非反过来
- `color-scheme: dark/light` 不仅影响 CSS，还控制浏览器原生控件（下拉菜单、日历选择器等）的渲染主题
- 毛玻璃背景上文字对比度需要比纯色背景高一档——底层壁纸的亮度和色相不可预测，需要安全边际
- 区分信息层级用 `opacity` 而非不同颜色变量：同一色相 + 不同透明度 = 和谐层级；不同色相 = 视觉碎片化

---

## 第五轮修复 (2026-05-31)

### 9. 绕过中间库，直接下载二进制

`@electron/get` 作为中间库增加了一层不确定性：镜像 URL 格式、SHA256 校验、网络超时重试均由库控制。当镜像下载失败时，无法判断是镜像源问题还是库的兼容性问题。

**教训**：
- Electron 的 npm 包和二进制完全解耦——npm 包走 registry，二进制走 GitHub Releases。设置 `ELECTRON_MIRROR` 只影响后者
- `@electron/get` 的 postinstall 失败不阻断 `npm install`，导致 `node_modules` 装好但 `electron.exe` 缺失的半成品状态
- **直接 HTTP 下载 zip 比依赖 postinstall 更可控**：一个 `Invoke-WebRequest` + `Expand-Archive` 解决问题
- 双 URL 兜底是网络不可靠环境的标配：npmmirror（国内快） → GitHub（稳定备用）
- 版本号必须从 `node_modules/electron/package.json` 读取确切版本，而非解析语义版本范围

**cmd 语法陷阱**：
- `&` 在 cmd 中是命令分隔符，`echo ... download & extraction` 会被拆成两条命令
- 嵌入 PowerShell 命令到 bat 文件时，管道符 `|` 在 cmd 双引号内仍保持特殊含义，必须用 `^|` 转义

---

## 第六轮修复 (2026-05-31)

### 10. 绕过 postinstall 不只是跳过下载，还需要复现其副作用

electron 包的 `install.js`（postinstall）做了三件事：**下载 zip → 解压到 dist/ → 写入 path.txt**。我们绕过它直接下载解压，遗漏了最关键的一步——`path.txt`。

**根因**：`electron-vite` 不依赖 `electron.exe` 是否存在，而是读取 `node_modules/electron/path.txt` 来定位可执行文件。这个隐蔽的间接层导致"二进制文件明明存在，但 electron-vite 报 Electron uninstall"。

**教训**：
- 绕过一个模块的安装脚本时，必须逆向理解该脚本的**全部副作用**，不仅仅是主要操作
- `path.txt` 是一个元数据文件，内容只有一行（如 `electron.exe`），但它是一个隐式契约——electron-vite、electron-builder 等工具链都依赖它
- **`Out-File -NoNewline` 至关重要**：`path.txt` 末尾的 `\n` 会被拼入路径，导致 `electron.exe\n` 找不到文件
- 验证方法：`xxd` 或 `Format-Hex` 检查尾部字节，确保无 `0d 0a` 或 `0a`

**调试技巧**：
- electron-vite 源码在 `node_modules/electron-vite/dist/chunks/lib-BmEkZIgk.mjs`，`getElectronPath()` 函数只有 ~20 行，直接阅读即可定位问题
- 模拟克隆环境是发现这类问题的唯一手段——当前开发环境的 postinstall 曾经成功过（残留了 path.txt），不会触发 bug
- 每次修改安装脚本后，必须在干净的克隆环境（无 node_modules、无缓存）中完整测试一次
