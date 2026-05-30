# 02 — 删除不必要的准备时间倒计时

## 问题现象

专注计时器存在一个"准备时间倒计时"功能，表现为：
- 专注阶段结束后自动切换到休息倒计时（用户视之为"准备时间"）
- 界面上有一个"跳过"按钮，但点击后无反应（`skip_to_rest` 函数未定义）

## 根因分析

两个子问题：

### 2a. skip_to_rest 未实现

`FocusTimer.tsx` 从 `useFocusTimer` hook 中解构了 `skip_to_rest`：

```tsx
const { start, pause, resume, stop, skip_to_rest } = useFocusTimer()
```

但 `useFocusTimer.ts` 的返回值中根本没有 `skip_to_rest`。TimerControls 将 `on_skip={skip_to_rest}` 传递给跳过按钮，实际调用时就是 `undefined()` —— 按钮形同虚设。

### 2b. finish_phase 自动切换到 rest

`useFocusTimer.ts` 中 `finish_phase` 的逻辑：

```
focus 完成 → 写入 DB (focus:complete)
            → if rest_duration_min > 0: switch_to_rest (自动开始休息倒计时)
            → else: end_session
rest 完成 → end_session + 通知
```

用户认为专注完成后的自动休息倒计时是不必要的"准备时间"。

### 2c. 附带 SQL 错误

`electron/ipc/index.ts` 中 `focus:complete` handler 的 SQL：

```sql
-- 错误：将 != (比较运算符) 误用作赋值
UPDATE focus_sessions SET status != 'running' AND status != 'paused', ...
-- 等价于: SET (status != 'running') AND (status != 'paused') — 布尔表达式！
```

这会导致 `status` 永远不会被更新为 `'completed'`。

## 修复方案

1. 从 `FocusTimer` 移除 `skip_to_rest` 的解构和传递
2. 从 `TimerControls` 移除 `on_skip` prop 和"跳过"按钮
3. 简化 `finish_phase`：专注完成 → 记录到 DB → 直接 `end_session()`
4. 修复 `focus:complete` SQL：`SET status = 'completed'`
5. 移除 `CircularProgress` 中 idle 状态的 "准备" 标签

## 涉及文件

- `moefocus/src/hooks/useFocusTimer.ts` — 简化 finish_phase，移除 rest 自动切换
- `moefocus/src/components/timer/FocusTimer.tsx` — 移除 skip_to_rest
- `moefocus/src/components/timer/TimerControls.tsx` — 移除跳过按钮
- `moefocus/src/components/timer/CircularProgress.tsx` — 移除"准备"标签
- `moefocus/electron/ipc/index.ts` — 修复 focus:complete SQL
