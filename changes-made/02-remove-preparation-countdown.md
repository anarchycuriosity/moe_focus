# 02 — 状态机与 SQL 赋值：计时器逻辑修复

## 问题现象

两个问题同时出现：
1. 专注阶段完成后，计时器自动切换到休息倒计时 — 用户视之为多余的"准备时间"
2. 界面上有一个"跳过"按钮，但点击后毫无反应

## 一、前置知识

### 1.1 状态机：计算机科学中最基础的设计工具

**状态机（State Machine / Finite State Machine, FSM）**描述这样一个系统：
- 系统在任意时刻只能处于一个确定的**状态（State）**
- 系统只能通过特定的**转换（Transition）**从一种状态进入另一种状态
- 每个转换由**事件（Event）**触发

**现实类比：自动门**

```
         ┌──────────┐
         │   关闭    │   ← 初始状态
         └────┬─────┘
              │ 事件：有人靠近（红外传感器触发）
              │ 转换：开始开门
         ┌────▼─────┐
         │  打开中   │   ← 中间状态（不可停留）
         └────┬─────┘
              │ 事件：完全打开（限位开关触发）
              │ 转换：停止电机
         ┌────▼─────┐
         │   打开    │   ← 稳定状态
         └────┬─────┘
              │ 事件：人通过后 N 秒（超时）
              │ 转换：开始关门
         ┌────▼─────┐
         │  关闭中   │
         └────┬─────┘
              │ 事件：完全关闭
              │ 转换：停止电机
         ┌────▼─────┐
         │   关闭    │   ← 回到初始状态
         └──────────┘
```

自动门不能同时处于"打开"和"关闭"状态（这是状态机的核心特性：**互斥性**），也不能在没有触发事件的情况下自行切换状态。

**为什么状态机重要？**

写代码时，如果你不用状态机思维，你的逻辑往往散落在各处：

```typescript
// ❌ 无状态机的代码：逻辑散落，难以预测行为
function handle_click() {
  if (is_running && !is_paused && time_left > 0) { ... }
  else if (!is_running && was_running && time_left === 0) { ... }
  else if (is_paused && was_running && ...) { ... }
  // 30 个布尔值排列组合 → 2^30 种情况，你永远测试不完
}
```

```typescript
// ✓ 状态机驱动的代码：每种状态的处理清晰独立
function handle_click() {
  switch (phase) {
    case 'idle':      return start_focus()
    case 'focus':     return pause_focus()
    case 'paused':    return resume_focus()
    case 'completed': return reset_to_idle()
  }
}
```

> **经典源码学习**：TCP 协议本身就是状态机的最佳范例。TCP 连接有 11 种状态（CLOSED, LISTEN, SYN_SENT, SYN_RECEIVED, ESTABLISHED, FIN_WAIT_1, FIN_WAIT_2, CLOSE_WAIT, CLOSING, LAST_ACK, TIME_WAIT）。Linux 内核中 TCP 状态机的实现见 `net/ipv4/tcp.c`，核心函数 `tcp_rcv_state_process()` 用 switch-case 处理每个状态下的数据包。这个函数只有 ~700 行却处理了 TCP 最核心的逻辑，正是因为状态机让复杂逻辑变得可控。

### 1.2 MoeFocus 计时器的状态机

让我们画出修复前和修复后的状态转换图：

**修复前（有问题）**：

```
     ┌──────┐  开始计时  ┌───────┐  时间到   ┌───────────┐
     │ idle │ ─────────→ │ focus │ ───────→ │ completed  │
     └──────┘            └──┬──┬─┘          └─────┬─────┘
                            │  │                  │
                      暂停  │  │ 继续             │ rest_duration > 0?
                            │  │                  │
                        ┌───▼──┴──┐          ┌───▼────┐
                        │  paused │          │  rest   │  ← 用户讨厌的"准备时间"
                        └─────────┘          └────────┘
```

问题：`focus → completed` 之后不应该自动进入 `rest`。用户想要的是「专注完成 → 结束」，而不是「专注完成 → 强制休息」。

**修复后（期望行为）**：

```
     ┌──────┐  开始计时  ┌───────┐  时间到    ┌───────────┐
     │ idle │ ─────────→ │ focus │ ────────→ │ completed │ → 显示 🎉 + 通知
     └──┬───┘            └──┬──┬─┘           └───────────┘
        ↑                   │  │
        │             暂停  │  │ 继续
        │                   │  │
        │               ┌───▼──┴──┐
        └───────────────│  paused │
            重置/废弃    └─────────┘
```

### 1.3 SQL 中 = 的双重身份

这是初学者最容易犯的 SQL 错误之一。在 SQL 中，`=` 有两种完全不同的含义——取决于它出现在哪里：

**在 `SET` 子句中：`=` 是赋值运算符**

```sql
-- "把 status 列的值改成 'completed'"
UPDATE focus_sessions
SET status = 'completed'          -- = 是赋值
WHERE id = 5
```

**在 `WHERE` / `ON` / `CASE WHEN` 中：`=` 是比较运算符**

```sql
-- "找出 status 列的值等于 'completed' 的那些行"
SELECT * FROM focus_sessions
WHERE status = 'completed'        -- = 是比较
```

**`!=` 永远是比较运算符**，它不能用于赋值：

```sql
-- ❌ 错：试图用比较运算符做赋值
SET status != 'running'   -- 这不会把 status 改成任何值！
                          -- 它只是计算 "status 不等于 'running'" 的布尔结果

-- ✓ 对：用 = 赋值
SET status = 'completed'  -- 把 status 列的值改成 'completed'
```

**为什么 SQLite 不报错？**

这是这个 bug 最隐蔽的地方。SQLite 会把 `SET status != 'running'` 理解为：

```
SET 第一个列名 = (status != 'running' AND status != 'paused')
                 └──────────────────────────────────────────┘
                 这是一个布尔表达式，计算结果为 0 或 1
```

SQLite 将 `false` 存为 `0`，`true` 存为 `1`。所以实际效果是：`status` 列被更新为数字 0 或 1（而不是文本 `'completed'`），而 `actual_duration_sec` 等列根本没被赋值（因为 SQL 里 `AND` 后面的部分被解析为另一个独立的列赋值）。

**教训**：SQL 不会告诉你"语义错误"——只有语法错误才会报错。`SET a != b` 在语法上合法，在语义上荒谬。

> **经典源码学习**：SQLite 的表达式解析器源码见 `sqlite3.c` 中的 `expr.c`（约 5000 行），其中 `LKwSet` 相关的解析逻辑展示了 SQLite 如何区分 `SET` 子句和 `WHERE` 子句中的 `=`。读这个文件你会理解：SQL 解析器在看到 `SET` 关键字之后，会切换到赋值模式；看到 `WHERE` 关键字之后，会切换到比较模式。两者内部的 token 处理逻辑不同。

### 1.4 JavaScript 中 undefined 的传播

```typescript
// useFocusTimer.ts 的返回值中根本没有 skip_to_rest 这个函数
// 但 FocusTimer.tsx 尝试解构它：
const { start, pause, resume, stop, skip_to_rest } = useFocusTimer()

// 解构一个不存在的属性 → skip_to_rest 的值是 undefined
console.log(skip_to_rest)   // undefined

// 然后在 JSX 中把它当作函数传给按钮：
<TimerControls on_skip={skip_to_rest} />

// 按钮内部调用：
on_skip()   // 实际执行的是 undefined()
            // JavaScript: TypeError: undefined is not a function
            // 但在 React 事件处理器中，这类错误常常被静默吞掉
```

**为什么 React 会静默吞错？**

React 的事件处理系统（SyntheticEvent）会捕获事件处理器中抛出的异常，防止一个按钮的错误导致整个应用崩溃。副作用是：开发者看不到错误，用户看到"按钮没反应"——bug 更难排查。

---

## 二、根因分析

### 问题 1：skip_to_rest 按钮无效

`FocusTimer.tsx` 解构了一个 Hook 从未返回的函数 → `undefined` → 调用 `undefined()` → 错误被 React 吞掉 → 按钮"没反应"。

### 问题 2：自动切换到休息倒计时

`finish_phase()` 中有一行逻辑：

```typescript
if (rest_duration_min > 0) {
  switch_to_rest()    // ← 多余的自动切换
}
```

这个自动切换不符合用户的预期：用户完成专注后想看到"完成"提示，而不是被强制进入另一个计时。

### 问题 3：SQL 中的 `!=` 误用

```sql
-- 错误：!= 是比较运算符，不能用于赋值
UPDATE focus_sessions
SET status != 'running' AND status != 'paused',
    actual_duration_sec = 1500
WHERE id = 5
-- status 列被设为 0 或 1（布尔表达式的计算结果），永远不会变成 'completed'
```

修复：

```sql
-- 正确
UPDATE focus_sessions
SET status = 'completed',
    actual_duration_sec = 1500,
    ended_at = datetime('now')
WHERE id = 5
```

---

## 三、修复方案

### 1. 删除不需要的功能

- 从 `FocusTimer.tsx` 移除 `skip_to_rest` 的解构
- 从 `TimerControls.tsx` 移除"跳过"按钮的渲染代码和 `on_skip` prop

### 2. 简化状态机

- 移除 `switch_to_rest` 函数
- `focus` 完成 → 写入 DB（status = 'completed'）→ `end_session()` → 直接到 completed

### 3. 修复 SQL

将所有 `SET status != 'xxx'` 改为 `SET status = 'completed'`。

---

## 四、知识点总结

| 知识点 | 一句话总结 |
|--------|-----------|
| 状态机 | 先画出状态和转换图，再写代码。状态机让行为可预测 |
| SQL 赋值 vs 比较 | `SET` 子句中 `=` 是赋值，`WHERE` 中 `=` 是比较。`!=` 永远是比较 |
| SQLite 不报语义错误 | 语法合法的 SQL 可能完全不是你想要的语义，这就是 bug |
| undefined 传播 | 解构不存在的属性 = undefined。React 事件处理器可能静默吞错 |
| Hook 最小暴露原则 | 只导出 UI 组件真正需要的方法。暴露多余的 API = 给自己埋坑 |

---

## 五、项目作业：设计一个自动售货机状态机

### 作业目标

用状态机模式实现一个自动售货机的核心逻辑，练习状态建模能力。

### 状态描述

一台简化版自动售货机的规则：
- 商品价格 5 元
- 只接受 1 元、5 元硬币
- 可以取消交易并退币
- 投币金额不足时不出货，超过时找零

### 核心要求

```
1. 画出状态转换图（用 ASCII art 或 mermaid）

2. 用 TypeScript 实现状态机，包含：
   - 状态定义（enum 或 union type）
   - 事件定义（投币1元、投币5元、取消、选择商品）
   - 状态转换函数（接收当前状态 + 事件 → 新状态 + 输出动作）

3. 状态转��必须完整覆盖所有 (状态 × 事件) 组合

4. 处理边界情况：
   - 已投 4 元时再投 5 元 → 找零 4 元 + 出货
   - 未投币时按取消 → 无事发生
   - 已出货/已退币后投币 → 无效操作
```

### 关键代码骨架

```typescript
// 状态定义
enum State {
  IDLE = 'IDLE',           // 等待投币，余额 0
  ACCEPTING = 'ACCEPTING', // 已投币，等待更多投币或选择商品
  DISPENSING = 'DISPENSING', // 出货中
  REFUNDING = 'REFUNDING',   // 退币中
}

// 事件定义
type Event =
  | { type: 'INSERT_COIN'; amount: 1 | 5 }
  | { type: 'SELECT_ITEM' }
  | { type: 'CANCEL' }

// 状态转换结果
interface Transition {
  next_state: State
  balance: number
  action: 'WAIT' | 'DISPENSE_ITEM' | 'REFUND_COINS' | 'DISPENSE_AND_REFUND'
  refund_amount: number
}

// 转换表 —— 状态机的核心
const transitions: Record<State, (event: Event, balance: number) => Transition> = {
  [State.IDLE]: (event, balance) => {
    if (event.type === 'INSERT_COIN') {
      return {
        next_state: State.ACCEPTING,
        balance: event.amount,
        action: 'WAIT',
        refund_amount: 0,
      }
    }
    // 其他事件在 IDLE 状态下无效
    return { next_state: State.IDLE, balance: 0, action: 'WAIT', refund_amount: 0 }
  },

  [State.ACCEPTING]: (event, balance) => {
    switch (event.type) {
      case 'INSERT_COIN': {
        const new_balance = balance + event.amount
        // 钱够了 → 自动出货
        if (new_balance >= 5) {
          return {
            next_state: State.DISPENSING,
            balance: 0,
            action: new_balance > 5 ? 'DISPENSE_AND_REFUND' : 'DISPENSE_ITEM',
            refund_amount: new_balance - 5,
          }
        }
        // 钱不够 → 继续接受投币
        return { next_state: State.ACCEPTING, balance: new_balance, action: 'WAIT', refund_amount: 0 }
      }
      case 'SELECT_ITEM': {
        if (balance >= 5) {
          return {
            next_state: State.DISPENSING,
            balance: 0,
            action: balance > 5 ? 'DISPENSE_AND_REFUND' : 'DISPENSE_ITEM',
            refund_amount: balance - 5,
          }
        }
        return { next_state: State.ACCEPTING, balance, action: 'WAIT', refund_amount: 0 }
      }
      case 'CANCEL':
        return { next_state: State.REFUNDING, balance: 0, action: 'REFUND_COINS', refund_amount: balance }
    }
  },

  [State.DISPENSING]: () => ({
    next_state: State.IDLE, balance: 0, action: 'WAIT', refund_amount: 0
  }),

  [State.REFUNDING]: () => ({
    next_state: State.IDLE, balance: 0, action: 'WAIT', refund_amount: 0
  }),
}
```

### 验收标准

- [ ] 连续投 5 枚 1 元硬币后自动出货（钱够了就出货）
- [ ] 投 5 元硬币后自动出货，找零 0 元
- [ ] 投 1 元后按取消，退还 1 元
- [ ] 在 DISPENSING 状态下投币，状态不变（出货中不接受投币）
- [ ] 添加一个新的事件类型后，编译器会告诉你哪些状态缺少处理

### 思考题

1. 如果售货机支持银行卡支付（异步操作，需要等待银行返回授权），状态机需要怎么修改？什么新的状态会出现？
2. 状态机和"事件溯源"（Event Sourcing）模式有什么关系？
3. 上面的转换表实现中，DISPENSING 状态忽略了所有事件类型（不管投币还是取消都直接回 IDLE）。这符合真实售货机的行为吗？

---

## 涉及文件

| 文件 | 变更 |
|------|------|
| `moefocus/src/hooks/useFocusTimer.ts` | 简化 finish_phase，移除 rest 自动切换 |
| `moefocus/src/components/timer/FocusTimer.tsx` | 移除 skip_to_rest 解构 |
| `moefocus/src/components/timer/TimerControls.tsx` | 移除跳过按钮 |
| `moefocus/src/components/timer/CircularProgress.tsx` | 移除"准备"标签 |
| `moefocus/electron/ipc/index.ts` | 修复 focus:complete 的 SQL |
