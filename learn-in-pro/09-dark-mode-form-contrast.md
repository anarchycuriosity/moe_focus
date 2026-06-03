# 09 — 主题系统与 CSS 架构：暗色模式下的表单对比度

## 问题现象

暗色模式下设置页面的 `<select>` 下拉框和 `<input type="time">` 控件内的文字几乎不可见（白底白字），GitHub 同步状态的提示区域配色突兀。

## 一、前置知识

### 1.1 主题系统的两种架构模式

在软件中（前端和后端同理），主题系统有两种根本不同的设计思路：

**模式 A：硬编码覆盖（不推荐）**

```css
/* 先写暗色主题，再为每个组件手动覆盖亮色 */
.moe-card    { background: #1A1A2E; }
[data-theme] .moe-card { background: white; }  /* 每个组件都要写覆盖 */

.select       { background: #1A1A2E; }
[data-theme] .select  { background: white; }   /* 又一个覆盖 */

/* 问题：N 个组件 × M 个主题 = N×M 处需要写样式，不可扩展 */
```

**模式 B：CSS 变量集中定义（推荐）**

```css
/* 在 :root 中定义变量，所有组件引用变量 */
:root {
  --bg-surface: var(--moe-glass-bg);       /* 暗色默认值 */
  --text-primary: #E8E4F0;
}

[data-theme] {
  --bg-surface: white;                     /* 亮色覆盖 */
  --text-primary: #3A2E36;
}

/* 组件只管引用变量，不关心是哪个主题 */
.select {
  background: var(--bg-surface);            /* 主题无关！ */
  color: var(--text-primary);
}
```

这与后端开发的 **12-Factor App 的第三因子"配置与代码分离"** 是一致的：

```
前端： CSS 变量在 :root 中 = 配置文件
       组件中的 var(--xxx) = 代码

后端： 环境变量 / 配置中心 = 配置文件
       代码中 process.env.xxx = 代码

共同原则：配置变更不需要重新编译代码
```

> **经典源码学习**：VS Code 的主题系统是模式 B 的最佳实践。VS Code 定义了 300+ 个颜色 token（`editor.background`、`activityBar.foreground` 等），所有 UI 组件只引用这些 token。创建新主题只需提供这 300+ 个 token 的颜色值，不需要写任何 CSS。核心类型定义见 `vscode/src/vs/platform/theme/common/themeService.ts` 中的 `ITheme` 接口。

### 1.2 永远不硬编码背景色和文字色

为什么这是铁律？

```css
/* ❌ 假设你写了这个 */
.select {
  background: white;         /* 硬编码 */
  color: var(--moe-text);    /* 引用变量 — 暗色下是 #E8E4F0 (浅紫白) */
}

/* 暗色模式下实际渲染效果：
   浅色文字 (#E8E4F0) + 白色背景 (white) = 对比度 ≈ 1.2:1
   WCAG AA 要求正文对比度 ≥ 4.5:1
   用户看到的是近乎白色的文字在白色背景上 — 完全不可读 */
```

**正确的做法**：背景色也引用变量。

```css
/* ✓ 背景色和文字色都引用变量 */
.select {
  background: var(--moe-glass-hover);  /* 暗色：深色 / 亮色：浅色 */
  color: var(--moe-text);              /* 暗色：浅色 / 亮色：深色 */
}

/* 无论哪个主题，对比度都足够 */
```

### 1.3 color-scheme 属性：不只是 CSS 装饰

`color-scheme` 是一个容易被忽视但功能强大的 CSS 属性：

```css
.select {
  color-scheme: dark;
  /* 效果：告诉浏览器 "这个元素的内容应该用暗色主题渲染"
     浏览器会：
     1. 将 <select> 的下拉面板渲染为暗色背景
     2. 将 <input type="date"> 的日历选择器渲染为暗色
     3. 将滚动条渲染为暗色主题
     
     这些是浏览器原生控件，无法用普通 CSS 样式化
     只有 color-scheme 能影响它们 */
}
```

在主题系统中，应该在根元素或主题容器上设置：

```css
:root { color-scheme: dark; }           /* 暗色是默认 */
[data-theme] { color-scheme: light; }    /* 亮色模式覆盖 */
```

### 1.4 毛玻璃背景上的对比度不能用纯色公式计算

标准的 WCAG 对比度公式假设背景是纯色。但毛玻璃卡片（`backdrop-filter: blur(14px)`）的实际背景受到穿透的壁纸影响：

```
纯色背景：文字 #E8E4F0 在背景 #1A1A2E 上 = ≈10:1   ✓ 高对比度
毛玻璃背景：文字 #E8E4F0 在"被壁纸穿透的毛玻璃"上 = ?
           ↓
           壁纸如果是浅色樱花 → 有效背景变亮 → 对比度降低
           壁纸如果是深色夜景 → 有效背景变暗 → 对比度升高
```

**处理策略**：毛玻璃上的文字对比度要比纯色背景高一档，用明确的亮/暗色彩（而非中间灰色），留出安全边际。

### 1.5 信息层级：opacity 优于不同颜色

```css
/* ❌ 用不同颜色区分层级 — 视觉碎片化 */
.primary-text   { color: #E8E4F0; }
.secondary-text { color: #A09BB0; }  /* 换了颜色 — 看起来像不同类别的信息 */
.tertiary-text  { color: #7B7390; }

/* ✓ 用同一色相 + 不同透明度 — 和谐的层级 */
.primary-text   { color: var(--moe-text); opacity: 1.0; }    /* 主要信息 */
.secondary-text { color: var(--moe-text); opacity: 0.75; }   /* 辅助信息 */
.tertiary-text  { color: var(--moe-text); opacity: 0.50; }   /* 次要信息 */
```

这与设计中的"色彩一致性"原则对应——信息层级不应该用色相变化来表达（色相变化暗示"不同类型的实体"），而应该用亮度/透明度变化来表达（暗示"同一实体但重要性不同"）。

---

## 二、根因分析

### 问题 1：select 和 time_input — 白底白字

```css
/* 修复前 */
.select {
  background: white;               /* ← 硬编码！ */
  color: var(--moe-text);          /* 暗色: #E8E4F0 */
}
/* 结果：浅色字 + 白底 = 不可见 */
```

### 问题 2：note 提示文字对比度不足

```css
/* 修复前 */
.note {
  color: var(--moe-text-light);    /* #A09BB0 — 在毛玻璃上对比度不足 */
}
```

### 问题 3：git_status — 暖色在冷色主题中违和

```css
/* 修复前 */
.git_status {
  background: rgba(255, 245, 238, 0.5);  /* 暖桃色 */
  color: var(--moe-text-light);           /* #A09BB0 */
}
/* 暖色 + 冷色背景 = 浑浊的棕灰色 + 暗淡文字 = 不可读 */
```

---

## 三、修复方案

### select / time_input：用主题变量替代硬编码

```css
/* 暗色（默认 :root）*/
.select, .time_input {
  background: var(--moe-glass-hover);   /* 主题自适应 */
  color: var(--moe-text);
  color-scheme: dark;                   /* 原生控件也走暗色 */
}

/* 亮色覆盖 */
[data-theme] .select,
[data-theme] .time_input {
  color-scheme: light;
  background: white;                    /* 亮色模式恢复白底 */
}
```

### note：opacity 替代换颜色

```css
.note {
  color: var(--moe-text);
  opacity: 0.75;    /* 用透明度区分层级 */
}
```

### git_status：统一使用主题变量

```css
.git_status {
  background: var(--moe-glass-bg);    /* 与卡片背景统一 */
  color: var(--moe-text);
  font-size: 12px;
  line-height: 1.7;
}
```

---

## 四、知识点总结

| 知识点 | 一句话总结 |
|--------|-----------|
| CSS 变量集中定义 | 类似 12-Factor App 的配置与代码分离，主题变更不改组件代码 |
| 永不硬编码背景色 | 硬编码 `white`/`black` 在另一个主题下必出问题 |
| color-scheme | 影响浏览器原生控件的渲染主题，无法用普通 CSS 替代 |
| 毛玻璃对比度 | 壁纸穿透让对比度不可预测，需要高一档的安全边际 |
| opacity 区分层级 | 同色相 + 不同透明度 > 不同色相（更和谐、更专业） |

---

## 涉及文件

| 文件 | 变更 |
|------|------|
| `moefocus/src/pages/SettingsPage.module.css` | select/time_input/note/git_status 暗色适配 |
