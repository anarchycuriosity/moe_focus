# 06 — 数据加载策略与 DRY 原则的边界：日记页壁纸修复

## 问题现象

日记页右侧主区域始终显示灰色占位提示"在设置中选择壁纸图片"，即便已经在设置中正确配置了壁纸。

## 一、前置知识

### 1.1 数据加载策略全景

在软件工程中，"组件如何获取它需要的数据"是一个看似简单但影响深远的设计决策。常见的数据加载策略有：

| 策略 | 触发时机 | 适用场景 | MoeFocus 中的例子 |
|------|---------|---------|------------------|
| **Mount-time**（挂载时加载） | 组件首次出现在屏幕上 | 大多数页面的核心数据 | 日记页加载壁纸和日记内容 |
| **Lazy**（惰性加载） | 用户触发某个操作时 | 不紧急的数据 | 统计图表只在切换到统计页时才查询 |
| **Preload**（预加载） | 在当前页提前拉取下一页数据 | 用户体验优化 | 应用启动时同步远程数据 |
| **Polling**（轮询） | 每隔 N 秒自动刷新 | 需要实时性的数据 | SchedulerService 定时生成日记 |
| **Event-driven**（事件驱动） | 数据变更通知到达时 | 跨组件状态同步 | settings:changed 事件推送 |

### 1.2 DRY 原则的真正含义

DRY — Don't Repeat Yourself（不要重复你自己）— 是软件开发中最常被误用的原则。

**正确的理解**：每个知识点在系统中应该有单一、明确、权威的表示。

**错误的理解**：任何看起来相似的代码都应该合并成一个。

这两种理解的差异是巨大的。来看一个例子：

```typescript
// AnimeBackground.tsx — 全局背景组件
async function load_wallpaper_bg() {
  const path = await get_active_wallpaper()   // 首选路径
    || await settings.get('ui.active_wallpaper') // 降级
  set_background(path)
}

// DiaryPage.tsx — 日记页组件
async function load_wallpaper_diary() {
  // 看似做了"同样的事"，但有细微差别：
  const path = await get_active_wallpaper()   // 同样的首选路径
    || await settings.get('ui.active_wallpaper') // 同样的降级
  // 但 DiaryPage 可能还需要额外的处理：
  // - 占位符提示文案
  // - 大图 vs 背景的不同渲染方式
  // - 可能不同的 fallback 行为
  set_wallpaper(path)
}
```

如果把这两个函数强行合并成一个 `loadWallpaper()`：

```typescript
// 强行 DRY 的后果
async function load_wallpaper(component: 'background' | 'diary') {
  const path = await get_active_wallpaper()
    || await settings.get('ui.active_wallpaper')

  if (component === 'background') {
    // 全局背景的特殊处理
  } else if (component === 'diary') {
    // 日记页的特殊处理
  }
  // 每加一种新用法就要加一个 if 分支 → 违反开闭原则
}
```

这个强行合并的函数变成了一个 "God Function"（上帝函数）——它知道太多东西，每加一个新场景就要修改它，违反**开闭原则**（对扩展开放，对修改关闭）。

**判断 DRY 边界的实用标准**：

> 如果两个函数做的是同一件事（same reason to change），合并它们。
> 如果它们恰巧用了类似的代码但服务于不同场景（different reasons to change），让它们独立。

AnimeBackground 和 DiaryPage 的壁纸加载服务于不同的 UI 场景。将来日记页可能增加"AI 生成的每日回顾图"作为专属图源，而全局背景不需要。到时如果它们被耦合在一起，修改起来就会很痛苦。

> **经典源码学习**：React 团队在 Hooks 的设计中充分体现了"组合优于继承"和"不强行 DRY"的思想。`useState` 和 `useReducer` 有功能重叠但服务于不同场景。如果强行 DRY，它们应该合并成一个 Hook。但 React 团队选择提供两个独立的 API，因为"简单状态"和"复杂状态"的 change reason 不同。

### 1.3 占位符（Placeholder）的用户体验设计

占位符不是"功能没做完的提示"，而是**引导用户完成配置的路标**。

```
差的占位符：
  "没有图片"                     ← 没告诉用户怎么解决

一般的占位符：
  "在设置中选择壁纸图片"           ← 告诉了"去哪"，但不够具体

好的占位符：
  "在「设置 → 通用 → 自定义壁纸」中选择图片"  ← 精确路径，新用户直接照着操作
```

---

## 二、根因分析

和 04 号文档（全局背景修复）有相同的根因：

1. 壁纸加载只有 `settings` 表单一来源，缺少 fallback 到 `wallpapers` 表
2. 全局背景的壁纸加载逻辑已经修复（04 号文档），但日记页没有同步更新

---

## 三、修复方案

1. 使用 `file:getActiveWallpaper` API（查询 wallpapers 表）作为首选路径
2. settings 表作为降级路径
3. 占位符文案升级：告知具体在哪操作

---

## 四、知识点总结

| 知识点 | 一句话总结 |
|--------|-----------|
| 数据加载策略 | Mount-time / Lazy / Preload / Polling / Event-driven |
| DRY 的边界 | 同一 change reason → 合并；不同 change reason → 独立 |
| God Function | 知道太多、分支太多的函数，违反开闭原则 |
| 占位符体验 | 不只说"有问题"，要说"怎么解决" |

---

## 涉及文件

| 文件 | 变更 |
|------|------|
| `moefocus/src/pages/DiaryPage.tsx` | 更新壁纸加载逻辑和占位提示 |
