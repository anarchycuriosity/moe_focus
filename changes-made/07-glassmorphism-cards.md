# 07 — GUI 卡片毛玻璃效果 (Glassmorphism)

## 问题现象

所有卡片、侧边栏、标题栏的白色背景不透明度太高（0.75-0.85），几乎看不清后面的壁纸。

## 设计目标

让壁纸透过 UI 面板可见，但又不影响文字可读性。需要找到透明度和模糊度的平衡点。

## 修复方案

采用 Glassmorphism（毛玻璃/玻璃形态）设计模式，核心公式：

```
background: rgba(255, 255, 255, 0.45-0.55)  ← 降低不透明度
backdrop-filter: blur(14px) saturate(160%)    ← 增强模糊 + 色彩饱和
border: 1px solid rgba(255, 255, 255, 0.35)  ← 浅色半透明边框
```

### 改动范围

| 组件 | 旧背景不透明度 | 新背景不透明度 | blur |
|------|--------------|--------------|------|
| MoeCard (通用卡片) | 0.85 | 0.55 | 14px |
| TaskCard (任务库卡片) | 0.85 | 0.50 | 10px |
| TodayTaskItem (今日任务) | 0.80 | 0.50 | 10px |
| Sidebar (侧边栏) | 0.75 | 0.45 | 14px |
| TitleBar (标题栏) | 0.85 | 0.45 | 14px |
| DiaryPage Sidebar | 0.60 | 0.40 | 10px |

### 设计考量

- **saturate(150-160%)**：毛玻璃效果通常会使颜色变灰，通过 saturate 滤镜补偿色彩饱和度，保持萌系粉色主题
- **-webkit-backdrop-filter**：兼容性降级，为不支持标准属性的浏览器提供前缀版本
- **hover 状态**：悬停时略微提升不透明度 (0.50 → 0.65)，提供交互反馈
- **MainLayout content 区域**：z-index: 1 确保内容在背景之上

## 涉及文件

- `moefocus/src/components/common/MoeCard.module.css`
- `moefocus/src/components/tasks/TaskCard.module.css`
- `moefocus/src/components/tasks/TodayTaskItem.module.css`
- `moefocus/src/components/layout/Sidebar.module.css`
- `moefocus/src/components/layout/TitleBar.module.css`
- `moefocus/src/pages/DiaryPage.module.css`
