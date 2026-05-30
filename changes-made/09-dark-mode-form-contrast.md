# 09 — 暗色模式下的表单控件与反馈区域对比度

## 问题现象

暗色模式下设置页面的字体"非常丑陋根本看不清"，特别是 GitHub 同步标签页的反馈区域。

具体表现：
- `<select>` 下拉框和 `<input type="time">` 控件内的文字几乎不可见
- 提示说明文字（"配置一个 GitHub 私有仓库..."）暗淡模糊
- Git 同步状态显示的 `<pre>` 块配色突兀

## 思维出发点

第一反应可能是"暗色模式配色没做好"，但细看代码后发现：前面一轮已经修过按钮和 tab 的暗色对比度（`dc74b02`），为什么还会有看不清的地方？

关键区别：**按钮用的是 CSS 变量，表单控件用的是硬编码值**。

## 根因分析

### 1. `select` 和 `time_input`：白底白字

```css
/* 修复前 */
.select {
  background: white;          /* ← 硬编码白色 */
  color: var(--moe-text);     /* 暗色下 = #E8E4F0 (近白) */
}
```

暗色模式下 `--moe-text` 是 `#E8E4F0`（浅紫白），渲染在 `white` 背景上，对比度接近于零。这是标准的"亮色模式专用 CSS 被暗色模式继承"问题。

### 2. `note`：辅助文字对比度不足

```css
.note {
  color: var(--moe-text-light);  /* 暗色下 = #A09BB0 */
}
```

`#A09BB0` 在 `#1A1A2E` 背景上的对比度约 4.5:1，在纯色背景上勉强通过 WCAG AA。但 MoeFocus 的卡片是毛玻璃效果（`backdrop-filter: blur(14px)`），实际背景颜色受壁纸穿透影响，有效对比度可能降到 3:1 以下。

**定理**：毛玻璃背景上的文字对比度不能用工整的纯色背景公式计算。由于底层壁纸的亮度/色相不可预测，需要使用比最低标准高一档的对比度作为安全边际。

### 3. `git_status`：暖色背景在冷色暗色主题中违和

```css
.git_status {
  background: rgba(255, 245, 238, 0.5);  /* 暖桃色 */
  color: var(--moe-text-light);           /* #A09BB0 */
}
```

`rgba(255, 245, 238, 0.5)` 是浅桃色（接近 `blanchedalmond`），设计意图可能是"柔和的提示框"。但在 `#1A1A2E` 暗色背景下：
- 暖色调与冷色暗色主题产生色相冲突，视觉上非常突兀
- 半透明桃色叠加暗色底 = 浑浊的棕灰色
- 加上 `--moe-text-light` 的暗淡文字，整体可读性极差

## 解决方案

### 策略：CSS 变量 + `[data-theme]` 选择器双轨制

```
暗色模式（默认 :root）
  → var(--moe-glass-hover) 背景
  → var(--moe-text) 文字
  → color-scheme: dark（原生下拉也变暗）

亮色模式（[data-theme]）
  → white 背景（保持原有体验）
  → color-scheme: light
```

### 具体修改

**select / time_input**：
```css
.select {
  background: var(--moe-glass-hover);  /* 暗: rgba(60,60,100,0.8), 亮: rgba(255,255,255,0.65) */
  color: var(--moe-text);
  color-scheme: dark;                  /* 浏览器原生下拉也走暗色 */
}
[data-theme] .select {
  color-scheme: light;
  background: white;                   /* 亮色模式恢复白底 */
}
```

**note**：
```css
.note {
  color: var(--moe-text);   /* 替代 --moe-text-light */
  opacity: 0.75;            /* 用透明度区分层级，而非换颜色 */
}
```

**git_status**：
```css
.git_status {
  background: var(--moe-glass-bg);  /* 与卡片背景统一 */
  color: var(--moe-text);           /* 高对比度主体文字 */
  font-size: 12px;                  /* 从 11px 提升 */
  line-height: 1.7;                 /* 多行信息更透气 */
}
```

## 关键原则

1. **CSS 中永远不要硬编码 `white` 或 `black` 作为背景色** — 用主题变量，否则暗色/亮色切换必然出问题
2. **毛玻璃背景需要比纯色背景高一档的文字对比度** — 底层壁纸的亮度穿透不可控
3. **区分信息层级用 `opacity` 而非不同颜色** — 同一色相 + 不同透明度 = 和谐的层级感；不同颜色 = 碎片化的视觉
4. **`color-scheme` 属性影响原生控件** — 不只是 CSS 的装饰，它告诉浏览器渲染引擎使用哪种原生 UI 主题
