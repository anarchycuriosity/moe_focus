# 07 — 设计系统与 CSS 变量：毛玻璃卡片效果

## 问题现象

所有卡片、侧边栏、标题栏的白色背景不透明度太高（0.75-0.85），后面的壁纸几乎被完全遮住，失去了"透过 UI 看到壁纸"的视觉效果。

## 一、前置知识

### 1.1 什么是设计系统（Design System）？

设计系统是一组可复用的设计规则和组件。它的核心概念在后端开发中也有精确对应：**配置管理**。

```
前端：CSS 变量 = 后端的配置中心
  --moe-pink: #FFB7C5         ←→   数据库 settings 表中的 ui.theme
  --moe-glass-bg: rgba(...)   ←→   数据库 settings 表中的 focus.defaultDuration

前端：设计 Token = 后端的 Config Key
  所有组件引用同一组变量        ←→   所有服务读取同一个配置中心
  修改变量 → 全局生效           ←→   修改配置 → 所有实例生效
```

CSS 自定义属性（CSS Variables）的实现机制：

```css
/* :root 中定义全局变量 — 相当于配置中心的默认配置 */
:root {
  --moe-pink: #FFB7C5;
  --moe-glass-bg: rgba(30, 30, 50, 0.45);
  --moe-glass-blur: 14px;
  --moe-text: #E8E4F0;
}

/* 组件中引用变量 — 相当于服务读取配置 */
.moe-card {
  background: var(--moe-glass-bg);     /* 编译时不确定值，运行时从 :root 读取 */
  backdrop-filter: blur(var(--moe-glass-blur));
  color: var(--moe-text);
}

/* 切换主题 = 修改变量值 — 相当于切换配置环境 */
[data-theme="sakura"] {
  --moe-glass-bg: rgba(255, 255, 255, 0.55);  /* 亮色模式覆盖 */
  --moe-text: #3A2E36;                        /* 深色文字 */
}
```

**为什么这很重要？**

如果在每个组件中硬编码颜色值：

```css
/* ❌ 硬编码：修改主题要改 50 个文件 */
.moe-card   { background: rgba(30,30,50,0.45); }
.task-card  { color: #E8E4F0; }
.sidebar    { background: rgba(30,30,50,0.45); }  /* 和 moe-card 一样但各写各的 */
```

```css
/* ✓ 变量引用：修改变量定义 → 所有组件自动更新 */
.moe-card   { background: var(--moe-glass-bg); }
.task-card  { color: var(--moe-text); }
.sidebar    { background: var(--moe-glass-bg); }
```

这与后端开发的 **12-Factor App** 原则完全一致：配置与代码分离，通过环境变量注入。

> **经典源码学习**：浏览器的 CSS 变量解析在 Chromium 的 `//third_party/blink/renderer/core/css/` 中实现，入口是 `css_variable_data.h` 和 `css_variable_resolver.cc`。当浏览器遇到 `var(--xxx)` 时，它会沿着 CSS 级联（cascade）向上查找变量定义，在 `:root` 或最近的祖先中找到定义值后替换。这个过程和编程语言中"符号解析 → 值替换"的过程如出一辙。

### 1.2 Glassmorphism（毛玻璃效果）的技术原理

毛玻璃效果在浏览器中通过 `backdrop-filter` 属性实现。理解它需要先理解**层叠上下文**（Stacking Context）的概念。

```
┌────────────────────────────────────────────┐
│  Z 轴 (从屏幕向用户延伸)                     │
│                                            │
│  Layer 3: 卡片文字 (最上层，清晰)             │
│  Layer 2: 半透明背景 (中间层，透过它看到下层)   │
│  Layer 1: 壁纸图片 (最下层，被模糊处理)        │
│                                            │
│  backdrop-filter 作用于 Layer 2：            │
│    它不是模糊 Layer 2 自己的内容              │
│    而是模糊 Layer 2 **背后** (Layer 1) 的内容  │
│    这就是 "backdrop" (背景幕布) 的含义        │
└────────────────────────────────────────────┘
```

核心 CSS 公式：

```css
.glass-card {
  /* 核心三要素 */
  background: rgba(255, 255, 255, 0.50);       /* 半透明背景 — 让壁纸透过来 */
  backdrop-filter: blur(14px) saturate(160%);   /* 模糊 + 色彩增强 — 朦胧美感 */
  border: 1px solid rgba(255, 255, 255, 0.35);  /* 半透明边框 — 玻璃边缘的折射感 */

  /* 兼容性降级 */
  -webkit-backdrop-filter: blur(14px) saturate(160%);  /* Safari/旧版 Chrome */
}
```

**每个参数的含义**：

| 参数 | 作用 | 太低 | 太高 |
|------|------|------|------|
| `background opacity` | 透明度 | 文字看不清 | 壁纸看不透 |
| `blur()` | 模糊程度 | 壁纸太锐利，干扰文字 | 完全看不清壁纸 |
| `saturate()` | 色彩饱和度 | 颜色太灰 | 颜色过艳，不和谐 |
| `border opacity` | 边框可见度 | 玻璃边缘"消失" | 边框太明显，像塑料 |

MoeFocus 的最终参数（经过多轮调整）：

```
不透明度: 0.45-0.55  (侧边栏/标题栏更低，卡片稍高)
模糊度:   10-14px     (大面板用高值)
饱和度:   150-160%    (补偿 blur 导致的色彩丢失)
```

> **经典源码学习**：`backdrop-filter` 的浏览器实现非常复杂——它需要先渲染背后所有图层，然后对渲染结果应用滤镜，再在上面渲染前景内容。Chromium 的实现见 `//third_party/blink/renderer/core/paint/` 中的 backdrop-filter 相关代码。每次 `backdrop-filter` 变化都需要触发 GPU 合成层的重绘，这就是为什么毛玻璃效果可能影响性能——特别是在低端设备上。

### 1.3 saturate() 为什么是必需的？

`blur()` 模糊操作的本质是对像素颜色取加权平均。当你在一个有丰富色彩的区域上做模糊时，不同颜色的像素被混合 → 结果趋向于"中间灰色" → 整体看起来发灰。

`saturate(160%)` 的作用就是**补偿**这种色彩丢失——让模糊后的颜色重新变得鲜艳。这是一个设计技巧，同时也反映了信号处理中的基本概念：低通滤波（blur）会损失高频信息（色彩细节），需要一个"补偿增益"。

---

## 二、根因分析

旧 CSS 的不透明度值（0.75-0.85）过高，且缺少 `backdrop-filter`。

```
旧参数: background: rgba(255,255,255,0.85) 无 blur
       → 85% 不透明 + 无模糊 = 几乎纯白，壁纸被完全遮挡

新参数: background: rgba(255,255,255,0.50) + blur(14px) saturate(160%)
       → 50% 不透明 + 强模糊 + 色彩补偿 = 壁纸朦胧透出，文字仍然清晰
```

---

## 三、修复方案

调整整个应用的卡片、侧边栏、标题栏的 CSS 变量和组件样式：

| 组件 | 旧透明度 | 新透明度 | blur | saturate |
|------|---------|---------|------|----------|
| MoeCard | 0.85 | 0.55 | 14px | 160% |
| TaskCard | 0.85 | 0.50 | 10px | 150% |
| Sidebar | 0.75 | 0.45 | 14px | 160% |
| TitleBar | 0.85 | 0.45 | 14px | 160% |

核心改动：

```css
/* 每个组件的 .module.css 中 */
.component {
  background: rgba(255, 255, 255, var(--glass-opacity));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border: 1px solid rgba(255, 255, 255, 0.35);
}
```

---

## 四、知识点总结

| 知识点 | 一句话总结 |
|--------|-----------|
| CSS 变量 = 配置中心 | 定义一次，全局引用，修改即生效。与后端的 12-Factor App 原则一致 |
| backdrop-filter | 模糊的是"背后"的内容，不是自己的内容。理解层叠上下文很关键 |
| saturate 补偿 | blur 导致色彩变灰，saturate 补偿回来。本质是信号处理中的增益补偿 |
| 渐进增强 | 用 `-webkit-` 前缀兼容旧浏览器，保证降级可用 |

---

## 五、项目作业：构建你自己的设计系统（与 04/06 合并）

### 作业目标

用 CSS 变量构建一个主题可切换的设计系统，实践"配置与样式分离"的思想。

### 核心要求

```
1. 定义至少 20 个 CSS 自定义属性（颜色、间距、圆角、阴影、字体大小等）
   - 所有属性必须在 :root 中定义
   - 包含 3 个主题：dark / light / sakura

2. 构建 5 个以上的 UI 组件（卡片、按钮、输入框、导航栏、模态框）
   - 每个组件的所有颜色/间距必须使用 CSS 变量引用
   - 禁止在组件样式中硬编码任何颜色值

3. 实现主题切换功能
   - 通过切换 data-theme 属性来切换主题
   - 切换要平滑过渡（transition on background/color）

4. 全局背景支持自定义图片（类似 MoeFocus 的壁纸功能）
   - 组件使用毛玻璃效果（backdrop-filter）
   - 暗色/亮色模式下参数自适应（亮色模式下透明度更高）
```

### 项目结构建议

```
design-system/
├── index.html             # 展示所有组件 + 主题切换器
├── css/
│   ├── tokens.css         # CSS 变量定义（所有主题）
│   ├── reset.css          # CSS Reset
│   ├── components.css     # 组件样式（只引用变量！）
│   └── glassmorphism.css  # 毛玻璃效果
├── js/
│   └── theme-switcher.js  # 主题切换逻辑
```

### 关键代码骨架

```css
/* tokens.css — 所有设计变量集中定义 */

/* ===== 暗色主题（默认）===== */
:root {
  /* 颜色调色板 */
  --color-primary: #FFB7C5;
  --color-primary-dark: #D4909E;
  --color-bg-base: #1A1A2E;
  --color-bg-surface: rgba(30, 30, 50, 0.45);
  --color-text-primary: #E8E4F0;
  --color-text-secondary: rgba(232, 228, 240, 0.75);
  --color-border: rgba(255, 255, 255, 0.12);

  /* 玻璃效果参数 */
  --glass-opacity: 0.50;
  --glass-blur: 14px;
  --glass-saturate: 160%;

  /* 间距系统（4px 基准）*/
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;

  /* 圆角系统 */
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 20px;
  --radius-full: 9999px;

  /* 阴影系统 */
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.15);
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.25);
  --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.35);

  /* 字体 */
  --font-family: 'Segoe UI', system-ui, sans-serif;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.25rem;

  /* 过渡 */
  --transition-fast: 150ms ease;
  --transition-normal: 300ms ease;
}

/* ===== 亮色主题 ===== */
[data-theme="light"] {
  --color-bg-base: #F5F0F7;
  --color-bg-surface: rgba(255, 255, 255, 0.65);
  --color-text-primary: #3A2E36;
  --color-text-secondary: rgba(58, 46, 54, 0.75);
  --color-border: rgba(0, 0, 0, 0.1);

  --glass-opacity: 0.65;
  --glass-blur: 14px;
  --glass-saturate: 140%;
}

/* ===== Sakura 主题 ===== */
[data-theme="sakura"] {
  --color-primary: #E8A0BF;
  --color-bg-base: #FFF0F5;
  --color-bg-surface: rgba(255, 255, 255, 0.70);
  --color-text-primary: #4A3040;
  --color-border: rgba(200, 150, 170, 0.3);

  --glass-opacity: 0.60;
}
```

```css
/* components.css — 组件只引用变量，不硬编码任何值 */

.card {
  background: var(--color-bg-surface);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-lg);
  color: var(--color-text-primary);
  box-shadow: var(--shadow-md);
  transition: background var(--transition-normal);
}

.card:hover {
  --glass-opacity: 0.65;  /* 悬停时微调透明度 */
}

.btn-primary {
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  padding: var(--space-sm) var(--space-md);
  font-family: var(--font-family);
  font-size: var(--font-size-base);
  transition: all var(--transition-fast);
}

.btn-primary:hover {
  background: var(--color-primary-dark);
  box-shadow: var(--shadow-sm);
}
```

### 验收标准

- [ ] 切换主题时所有组件平滑过渡，无硬编码颜色残留
- [ ] 添加新的 CSS 变量不需要修改组件样式文件
- [ ] 毛玻璃效果在浅色/深色背景下都正常工作
- [ ] 组件在亮色模式下的对比度符合 WCAG AA 标准（可用 Chrome DevTools 检查）
- [ ] 如果去掉 `backdrop-filter`，壁纸完全不可见（证明透明度没有单独起作用）

### 思考题

1. 如果要在现有 3 个主题上再增加一个"高对比度"主题（无障碍访问），需要修改组件样式文件吗？
2. CSS 变量和 JS 变量在"运行时可变性"上有什么根本区别？
3. 毛玻璃效果在低端设备上可能导致滚动卡顿。怎么优化？（提示：`will-change`、`contain`、`transform: translateZ(0)`）

---

## 涉及文件

| 文件 | 变更 |
|------|------|
| `MoeCard.module.css` | 降低不透明度，增加 blur + saturate |
| `TaskCard.module.css` | 同上 |
| `TodayTaskItem.module.css` | 同上 |
| `Sidebar.module.css` | 同上 |
| `TitleBar.module.css` | 同上 |
| `DiaryPage.module.css` | 同上 |
