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
