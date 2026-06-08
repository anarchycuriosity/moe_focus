# 01 后台专注计时异常

## 问题现象

专注钟放到后台后，前端倒计时会变慢或停顿。用户看到的结果是：现实中已经过去了很多时间，但应用里的剩余时间没有同步减少。

## 前置知识

### 1. 事件循环

JavaScript 的 `setInterval` 不是“硬件秒表”。它只是告诉运行时：大约每隔一段时间，把某个回调函数放进事件队列。

如果主线程繁忙、窗口进入后台、系统为了省电降低调度频率，回调就可能延迟执行。

### 2. 倒计时的两种模型

第一种是“增量模型”：

```ts
remaining_seconds = remaining_seconds - 1
```

这种写法简单，但它假设回调一定每秒执行一次。一旦后台节流，假设就不成立。

第二种是“绝对时间模型”：

```ts
phase_end_time = start_time + total_seconds * 1000
remaining_seconds = phase_end_time - Date.now()
```

这种写法把系统时间当作真相。即使回调延迟了，只要下次执行时重新读取当前时间，就能校准剩余时间。

## 修复思路

本次修复把倒计时从“每秒减 1”改为“根据阶段结束时间反推剩余秒数”。

核心变量是 `phase_end_time_ref`，它保存当前专注阶段的预计结束时间：

```ts
phase_end_time_ref.current = Date.now() + remaining_seconds * 1000
```

每次 tick 时重新计算：

```ts
remaining = Math.max(0, Math.ceil((phase_end_time - Date.now()) / 1000))
```

这样窗口在后台停留期间，即使 `setInterval` 没有稳定触发，回到前台后也会立即显示正确的剩余时间。

## 为什么使用 `Math.ceil`

倒计时 UI 通常希望“还有 0.2 秒”时仍显示 `00:01`，而不是提前显示 `00:00`。所以剩余秒数使用向上取整。

## 相关源码

- `moefocus/src/hooks/useFocusTimer.ts`

## 推荐学习

- UC Berkeley CS61A：理解程序执行模型、函数和状态。
- JavaScript 事件循环专题：建议搜索 Jake Archibald 的 event loop 讲解。
- MDN Web Docs：阅读 `setTimeout`、`setInterval`、`Date.now()`。

## 项目作业

实现一个 10 秒倒计时页面，页面有“开始、暂停、继续”三个按钮。

要求：

1. 第一个版本用 `setInterval` 每秒减 1。
2. 第二个版本用 `Date.now()` 和结束时间计算剩余时间。
3. 手动让浏览器标签页进入后台一段时间，再比较两个版本的误差。

