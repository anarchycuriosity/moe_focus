# 01 — 侧边栏设置默认专注时间不生效

## 问题现象

在「设置 → 计时」标签页中修改默认专注时长和休息时长后，回到专注页面，SessionConfig 组件显示的仍然是硬编码的 25 分钟 / 5 分钟。

## 根因分析

问题出在数据流的断裂：

1. **SettingsPage** 通过 `window.electronAPI.settings.set(key, value)` 将 `focus.defaultDuration` 和 `focus.defaultRestDuration` 写入 SQLite 的 `settings` 表
2. **useFocusStore** 的 `initial_state` 硬编码了 `focus_duration_min: 25` 和 `rest_duration_min: 5`
3. **SessionConfig** 从 `useFocusStore` 读取状态，但从未从 settings 加载默认值

换句话说：设置被正确持久化了，但没有任何代码去**读取**它来初始化计时器状态。

```
SettingsPage → settings.set() → SQLite settings 表 ✓
                                    ↓
                              (数据流断裂)
                                    ↓
SessionConfig → useFocusStore → hardcoded 25/5 ✗
```

## 修复方案

在 `SessionConfig` 组件挂载时，通过 `useEffect` 异步加载设置项，并调用 `set_config` 应用默认值：

```tsx
useEffect(() =>
{
  async function load_defaults()
  {
    const focus_str = await window.electronAPI.settings.get('focus.defaultDuration')
    const rest_str = await window.electronAPI.settings.get('focus.defaultRestDuration')
    const focus_val = focus_str ? parseInt(focus_str, 10) : 25
    const rest_val = rest_str ? parseInt(rest_str, 10) : 5
    if (focus_val > 0 && rest_val >= 0)
    {
      set_config(focus_val, rest_val)
    }
  }
  load_defaults()
}, [])
```

## 涉及文件

- `moefocus/src/components/timer/SessionConfig.tsx` — 添加 useEffect 加载默认设置
