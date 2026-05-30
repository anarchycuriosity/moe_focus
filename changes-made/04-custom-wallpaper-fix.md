# 04 — 自定义壁纸异常修复

## 问题现象

在设置中选择自定义壁纸图片后，全局背景和日记页大图都无法显示壁纸。

## 根因分析

发现了三个层面的问题：

### 4a. CSS 简写属性覆盖

`AnimeBackground.module.css` 中使用了 `background` 简写属性设置默认渐变：

```css
.background {
  background-size: cover;       /* 被下面的 background 简写覆盖 */
  background-position: center;   /* 被覆盖 */
  background-repeat: no-repeat;  /* 被覆盖 */
  background: linear-gradient(...);  /* ← 简写属性重置所有 background-* */
}
```

当组件通过内联 `style={{ backgroundImage: url(...) }}` 设置壁纸时，CSS 的 `background` 简写已在样式表中重置了整个 background 属性栈。虽然内联样式优先级更高，但在某些渲染时机下 `background` 简写会覆盖已设置的 `background-image`。

**修复**：将 `background: linear-gradient(...)` 改为 `background-image: linear-gradient(...)`

### 4b. 过时的 protocol API

`main.ts` 使用 `protocol.registerFileProtocol`，此 API 在 Electron 28 中已弃用。改用 `protocol.handle` + `net.fetch`：

```ts
protocol.handle('local', (request) =>
{
  const raw = decodeURIComponent(request.url.replace('local://', '').replace(/^\/+/, ''))
  return net.fetch(`file:///${raw}`)
})
```

### 4c. 壁纸加载缺少降级路径

原 `AnimeBackground` 只从 `settings` 表的 `ui.active_wallpaper` 键读取壁纸路径，但 `wallpapers` 表中也有 `is_active` 标记。增加从 wallpapers 表直接读取的 fallback 路径。

新增 `file:getActiveWallpaper` IPC handler：
```sql
SELECT file_path FROM wallpapers WHERE is_active = 1 ORDER BY added_at DESC LIMIT 1
```

## 涉及文件

- `moefocus/src/components/layout/AnimeBackground.module.css` — 修复 CSS 简写
- `moefocus/src/components/layout/AnimeBackground.tsx` — 重构加载逻辑，添加降级
- `moefocus/electron/main.ts` — protocol.handle 替代 registerFileProtocol
- `moefocus/electron/ipc/index.ts` — 新增 file:getActiveWallpaper handler
- `moefocus/electron/preload.ts` — 暴露新 API
