# 02 暂停后继续导致进度条重置

## 问题现象

例如设置 25 分钟专注，已经专注 10 分钟后点击暂停。此时统计条能正确累计 10 分钟。

但是再次点击继续后，倒计时进度环会像一个新计时器一样从满格开始跑，而不是保持“已经消耗了 10 分钟”的视觉进度。

## 前置知识

### 1. 状态变量不能混用职责

一个状态变量最好只表达一个含义。

原逻辑里 `total_seconds` 同时承担了两个职责：

1. UI 进度环的总时长。
2. 当前数据库会话计算实际专注秒数的基准。

暂停后继续时，程序会新建一个数据库会话来记录“继续后的剩余部分”。这对统计是合理的，因为暂停前的那 10 分钟已经写入数据库。

但 UI 进度环仍然应该以原始 25 分钟作为总长度。问题就出在这里：继续时把 `total_seconds` 改成了剩余时间，于是进度环重新变满。

### 2. 数据统计和界面显示是两套模型

统计模型关心“这次数据库会话实际发生了多少秒”。

显示模型关心“用户原本设置的这一轮专注已经推进到哪里”。

这两个模型有关联，但不能强行共用同一个变量。

## 修复思路

新增状态：

```ts
session_start_remaining_seconds
```

它表示当前数据库会话开始时，计时器还剩多少秒。

于是统计秒数可以这样计算：

```ts
actual = session_start_remaining_seconds - remaining_seconds
```

而 UI 进度环仍然使用：

```ts
progress = remaining_seconds / total_seconds
```

继续专注时，只更新当前数据库会话的起点，不重置 UI 的总时长：

```ts
session_start_remaining_seconds = remaining_seconds
```

## 修复后的效果

假设总时长 25 分钟：

1. 开始时：`total_seconds = 1500`，`remaining_seconds = 1500`。
2. 专注 10 分钟后暂停：`remaining_seconds = 900`，统计写入 `1500 - 900 = 600` 秒。
3. 继续时：`total_seconds` 仍然是 `1500`，所以进度环保持在已消耗 10 分钟的位置。
4. 新数据库会话的起点是 `session_start_remaining_seconds = 900`。
5. 如果之后又专注 5 分钟再暂停，统计写入 `900 - 600 = 300` 秒，不会重复计算前 10 分钟。

## 相关源码

- `moefocus/src/store/useFocusStore.ts`
- `moefocus/src/hooks/useFocusTimer.ts`

## 推荐学习

- MIT 6.031 Software Construction：重点看状态、抽象函数和表示不变量。
- React 官方文档：学习 state 的最小完备表示。
- Zustand 文档：理解 store 中状态和 action 的边界。

## 项目作业

写一个“分段学习计时器”：

1. 总任务 60 分钟。
2. 允许暂停多次。
3. 每次暂停都生成一条独立记录。
4. 页面上的总进度条必须始终按照 60 分钟显示。
5. 最终统计列表中，每一段的时长相加必须等于页面显示的累计学习时间。

