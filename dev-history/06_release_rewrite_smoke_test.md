# 06 release 打包链路重写与真机冒烟测试记录

## 问题背景

用户在新电脑和手机上安装 release 后发现桌面端无法正常启动，移动端功能缺失且同步、壁纸相框等桌面端关键能力没有完整保留。为了避免污染日常开发目录，本轮验证使用独立 worktree：

`C:\Users\curiosity\claude_pros\moe_focus_pro_release_lab`

## 排查过程

1. 桌面端基础构建 `npm run build` 可以通过，但 release 包首次启动存在高风险。
2. 检查 `electron-builder.yml` 后发现只打包了 `out/**/*`、`wallpapers/**/*` 和 `diary-pictures/**/*`，没有包含 `electron/database/schema.sql`。
3. `DatabaseService` 在运行迁移时读取 `../../electron/database/schema.sql`。全新安装环境没有旧数据库时，缺少 schema 会导致核心表无法创建，后续 IPC 查询会连锁异常。
4. 移动端 release 构建前发现同步服务使用 `btoa/atob`。React Native Hermes release 环境不应假设这两个浏览器 API 一定存在，所以改成纯 TypeScript UTF-8/Base64 编解码。
5. 移动端设置页已有 GitHub 配置入口，但没有完整暴露壁纸和日记相框配置。新增共享 `ScreenBackground`，让今日、专注、统计、长期任务、日记、设置页面都能读取页面级壁纸配置。

## 修改要点

1. 桌面端将 `electron/database/schema.sql` 纳入 Electron release 包。
2. 桌面端 `DatabaseService` 运行迁移时优先从 `app.getAppPath()` 读取打包后的 schema，再回退到开发目录路径。
3. 修复桌面端文件 IPC 中 `file:getActiveWallpaper` 对 `db()` 的作用域引用问题。
4. 移动端新增 `src/components/screen_background.tsx`，统一处理页面壁纸。
5. 移动端设置页新增默认壁纸、各页面壁纸、日记相框 URL 配置项。
6. 移动端同步服务移除对 `btoa/atob` 的依赖。

## 验证记录

### 移动端

执行：

```powershell
npm run typecheck
.\gradlew.bat assembleRelease
adb install -r app-release.apk
adb shell am start -n com.moefocus.app/.MainActivity
```

结果：

1. TypeScript 类型检查通过。
2. Android release APK 构建成功。
3. 真机设备 `V2425A` 安装成功。
4. release 应用启动后进程存活，未出现 `FATAL EXCEPTION`。
5. `uiautomator` 确认首屏出现 `MoeFocus`、今日、专注、统计、长期、日记、设置等 tab。
6. 切换核心 tab 后进程 PID 保持存活。
7. 设置页确认出现 GitHub 数据同步配置、Token、分支、壁纸与相框、默认壁纸 URL、页面壁纸 URL、日记相框图片 URL。

### 移动端第二轮排查：触摸、输入和默认壁纸

用户进一步确认：手机端手动输入仍无法正常提交，倒计时也不跑，壁纸自定义应接入本地相册，并且项目已有默认壁纸，移动端也应该使用。

本轮继续在隔离 worktree `C:\Users\curiosity\claude_pros\moe_focus_pro_release_lab` 中处理，真机设备为：

```text
10CF981X3700577 device product:PD2425 model:V2425A device:PD2425
```

已完成的修复：

1. 新增默认壁纸资产目录 `moefocus-mobile/assets/wallpapers/`，复制桌面端已有默认壁纸到移动端 release bundle。
2. 新增 `ScreenBackground` 组件，并让今日、专注、统计、长期、日记、设置页面都使用页面级背景。
3. 背景图层和遮罩层设置 `pointerEvents="none"`，避免壁纸层拦截触摸。
4. 设置页接入 `expo-image-picker` 和 `expo-file-system`，支持从本地相册选择壁纸或日记相框，并复制到应用文档目录。
5. `app.json` 增加 Android 图片读取权限和 `expo-image-picker` 插件配置。
6. 移动端数据库初始化补齐壁纸、相框相关默认 setting。
7. 修复 `DatabaseService.run()` 在 `INSERT` 场景下 `insertId` 可能为 `0` 的问题，使用 `last_insert_rowid()` 兜底。
8. 修复任务、今日计划、专注 session 创建后依赖错误插入 ID 的问题，改为插入后重新加载数据或按 uuid 回查。
9. 修复专注倒计时 interval 生命周期，把开始按钮和计时循环拆开，由 `phase` 状态驱动 interval。
10. 移动端 release 保持 Hermes。曾尝试切换到 JSC，但 release 运行时出现 `JSException: Unexpected token '?'`，因此已恢复 Hermes。
11. 将移动端页面内不稳定的 `Pressable` 操作替换为 `TouchableOpacity`；Today 的添加按钮临时改为原生 `Button`，用于排除 React Native release 触摸事件兼容问题。
12. 修复 Today 输入提交中的崩溃：`onBlur` / `onEndEditing` 的 `event.nativeEvent.text` 在真机 release 下可能是 `undefined`，原实现直接 `.trim()` 会弹出 `添加任务失败: Cannot read property 'trim' of undefined`。现在提交函数会从参数、最后一次输入缓存和 React state 中兜底取值。

关键验证结果：

1. `npm run typecheck` 通过。
2. `.\gradlew.bat assembleRelease` 通过。
3. `adb install -r -g app-release.apk` 安装成功。
4. `adb shell am start -W -n com.moefocus.app/.MainActivity` 启动成功。
5. `uiautomator` 确认默认壁纸层存在，UI 树中出现 `android.widget.ImageView`。
6. 原生 `Button` 探针和 `TouchableOpacity` 探针均曾验证可以触发状态变化；`Pressable` 在 release 下表现不稳定，已从主要 screen 中移除。
7. 最新一次 Today 测试中，ADB 输入 `mobile_task_fixed` 后文本能显示在输入框中，说明输入框本身已经能接收文本。

当前未完成点：

1. Today 最新验证停在“输入框中能显示 `mobile_task_fixed`，点击加号后文本仍留在输入框，任务库未出现该任务”。这说明前一个 `.trim()` 崩溃已修，但提交写库路径还需要继续查。
2. Focus 倒计时的代码已修，但还没有在最新 release 上完成“点击开始后秒数递减”的最终确认。
3. Stats、长期目标、日记、设置相册入口还没有在最新 release 上逐项完成最终验收。
4. 相册选择会拉起系统图片选择器，自动化验证可能受手机权限弹窗和系统相册 UI 影响；下一轮如果卡住，需要用户在手机上手动点一次授权。

下一轮建议从这里继续：

1. 继续看 `TodayScreen.tsx` 的 `handle_add_task()` 和 `commit_task_text()`，重点确认原生 `Button` 点击后是否真的调用 `add_task()`。
2. 如果 UI 事件链仍然不稳定，可临时在 Today 页面加只在开发排查分支存在的可见计数/错误文本，避免完全依赖 logcat。
3. 用 `adb logcat -c` 清空日志后重测 Today，再用下面命令捕获 React Native 和 SQLite 错误：

```powershell
adb logcat -d -t 500 | Select-String -Pattern 'ReactNativeJS|SQLite|Exception|FATAL|Error|AndroidRuntime'
```

4. Today 通过后，按顺序验收：专注倒计时、统计切换、长期目标增删改、日记生成/编辑、设置同步字段、本地相册选择。
5. 全部通过后再重新打最终 release 包。

### 桌面端

执行：

```powershell
npm run build
npm run package -- --win dir
npx asar list dist\win-unpacked\resources\app.asar
```

结果：

1. Electron 构建通过。
2. Windows unpacked release 打包通过。
3. `app.asar` 中确认存在 `electron/database/schema.sql`。
4. 启动 `dist\win-unpacked\MoeFocus.exe` 后 8 秒内进程保持存活，未复现启动即退出。

## 仍需人工确认

1. 手机端使用真实 GitHub 私有仓库地址和 Token 执行一次同步。
2. 手机端手动输入任务、添加今日计划、开始/结束一次专注，确认触屏输入法路径没有厂商兼容性问题。
3. 用真实 HTTPS 图片 URL 配置壁纸和日记相框，确认加载体验符合预期。
4. 手机端相册选择第一次打开时可能需要用户点击系统权限授权。

## 结论

本轮修复解决了 release 包缺少数据库 schema 的桌面端启动风险，也补齐了移动端 release 中 GitHub 同步配置、默认壁纸、本地相册壁纸选择和日记相框配置入口。移动端已在真机上完成 release 构建、安装、启动、页面切换、默认壁纸显示和输入框接收文本验证；但 Today 提交写库、Focus 倒计时和其他模块的最终手机验收仍未完成。下一轮应继续从 Today 提交链路开始，不要从头重写。
