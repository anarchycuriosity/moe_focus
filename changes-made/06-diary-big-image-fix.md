# 06 — 日记页大图显示修复

## 问题现象

日记页右侧主区域的本该显示壁纸大图的位置，始终显示占位符 "在设置中选择壁纸图片"。

## 根因分析

`DiaryPage` 的 `load_wallpapers` 函数只从 `settings` 表读取 `ui.active_wallpaper` 键：

```tsx
const load_wallpapers = async () =>
{
  const path = await window.electronAPI.settings.get('ui.active_wallpaper')
  if (path) set_wallpapers([path])
}
```

两个问题：
1. 与 AnimeBackground 一样，只有 settings 表的单一读取路径
2. 没有提供壁纸用途和自定义方式的说明

## 修复方案

1. 使用新增的 `file.get_active_wallpaper()` API 作为首选读取路径，settings 表作为降级
2. 优化占位符文案，明确告知用户在「设置 → 通用 → 自定义壁纸」中配置

## 涉及文件

- `moefocus/src/pages/DiaryPage.tsx` — 更新壁纸加载逻辑和占位提示
