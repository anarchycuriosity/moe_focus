# 03 点击暂停后无法暂停

## 问题现象

用户点击“暂停”后，前端计时器仍然继续倒计时，看起来暂停按钮没有生效。

## 前置知识

### 1. React 组件实例

React 组件每渲染出一个实例，就会拥有自己独立的 hook 状态。

例如 `TodayPage` 和 `FocusPage` 都会渲染 `FocusTimer`：

```tsx
<FocusTimer />
<FocusTimer expanded />
```

它们调用同一个 `useFocusTimer`，但 hook 内部的 `useRef` 并不是同一个对象。

### 2. `setInterval` 句柄必须能被正确清理

`setInterval` 返回的句柄可以理解为“计时任务编号”。只有拿到这个编号，才能用 `clearInterval` 停掉对应任务。

如果在 A 页面开始计时，interval 句柄保存在 A 页面的 hook 实例里；然后切到 B 页面点击暂停，B 页面自己的 hook 实例并没有 A 的 interval 句柄，于是清理不到真正运行的计时器。

## 修复思路

把运行中的 interval 句柄从组件实例级别提升到模块级别：

```ts
let interval_ref: ReturnType<typeof setInterval> | null = null
let phase_end_time_ref: number | null = null
```

这样不论哪个页面调用 `useFocusTimer`，操作的都是同一个真实计时器。

同时在 `tick` 中增加状态保护：

```ts
if (s.phase !== 'focus' && s.phase !== 'rest')
{
  clear()
  return
}
```

即使有旧的 tick 迟到执行，只要 store 已经进入 `paused`，它也会自我清理，而不是继续减少剩余时间。

## 交互加固

暂停时先更新前端状态，再写入数据库：

```ts
s.pause_session()
await window.electronAPI.focus.complete(...)
```

这样用户点击暂停后，UI 会立即反馈。数据库写入如果失败，会打印错误，但不会让前端继续显示运行中。

## 相关源码

- `moefocus/src/hooks/useFocusTimer.ts`

## 推荐学习

- React 官方文档：重点学习 hook 状态和组件实例的关系。
- JavaScript 定时器：理解 `setInterval` 返回值和 `clearInterval` 的配对关系。
- 软件构造中的“单一事实来源”：运行中的计时器应该只有一个统一控制点。

## 项目作业

做一个有两个页面的计时器练习：

1. 页面 A 可以开始计时。
2. 页面 B 可以暂停计时。
3. 第一版把 interval 句柄放在组件内部，观察切页后暂停失败的问题。
4. 第二版把 interval 句柄放到模块级或全局 store 中，让两个页面都能控制同一个计时器。

