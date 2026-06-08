# 05 - 桌面端与移动端 release 打包接续记录

## 本轮用户目标

用户要求：

1. 桌面端和移动端都要打包 release。
2. 剩余上下文不足时，先把变动总结写入 `dev-history`。
3. 提交并 push，方便下次继续。

## 已经完成的桌面端 release

桌面端已完成：

1. `moefocus/package.json` 版本升级到 `1.1.0`。
2. 修复并提交桌面端暗色模式新增模块对比度问题。
3. `npm run build` 通过。
4. `npm run package` 通过。
5. 产物已生成：
   - `moefocus/dist/MoeFocus Setup 1.1.0.exe`
   - `moefocus/dist/MoeFocus Setup 1.1.0.exe.blockmap`
6. 已提交并推送：
   - `cc9898f Codex: release desktop v1.1.0`
7. 已推送 tag：
   - `v1.1.0`

注意：GitHub Release 页面没有自动创建，因为本机没有 `gh` CLI，也没有可用的 `GITHUB_TOKEN` / `GH_TOKEN`。

## 已经完成的移动端重构与验证

移动端已完成：

1. `moefocus-mobile` 版本升级到 `1.1.0`。
2. 重做移动端主要功能：
   - 今日任务。
   - 专注计时。
   - 统计。
   - 长期任务。
   - 日记生成与反思保存。
   - GitHub Contents API 同步。
3. 同步文件格式对齐桌面端已有约定：
   - `data/focus_sessions.json`
   - `data/long_term_goals.json`
   - `sums/YYYY-MM-DD.md`
4. `npm run typecheck` 通过。
5. `npm run export:android` 通过，Expo 静态导出产物在：
   - `moefocus-mobile/dist-mobile/`
6. 已提交并推送：
   - `1a49447 Codex: rebuild mobile app v1.1.0`
7. 已推送 tag：
   - `mobile-v1.1.0`

## 本轮继续尝试移动端 APK release

为了真正打移动端 APK，本轮做了这些工作：

1. 检查本机环境：
   - 有 Java 25。
   - 没有 `ANDROID_HOME` / `ANDROID_SDK_ROOT`。
   - 常见 Android SDK 路径未发现 SDK。
   - 没有全局 `eas` CLI。
   - 没有 `EXPO_TOKEN` / `EAS_TOKEN`。
2. 执行：

```powershell
npx expo prebuild --platform android --no-install
```

结果：

1. 成功生成 `moefocus-mobile/android/` 原生 Android 工程。
2. `moefocus-mobile/package.json` 中脚本被 Expo 改为：
   - `android`: `expo run:android`
   - `ios`: `expo run:ios`

然后尝试：

```powershell
.\gradlew.bat assembleRelease
```

第一次失败原因：

```text
Unsupported class file major version 69
```

判断：

1. Java 25 太新。
2. React Native / Gradle 当前链路更适合 JDK 17。

随后已下载便携版 JDK 17 到：

```text
C:\Users\curiosity\.cache\codex-runtimes\temurin-17
```

并验证：

```text
openjdk version "17.0.19"
```

之后使用 JDK 17 重跑：

```powershell
$env:JAVA_HOME='C:\Users\curiosity\.cache\codex-runtimes\temurin-17'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat assembleRelease
```

该命令运行超过 5 分钟后超时，后台留下 Java / Gradle 进程。收到用户中断后，已停止相关后台进程。

## 当前仓库未提交变动

本次接续提交会包含：

1. `moefocus-mobile/android/` 原生 Android 工程。
2. `moefocus-mobile/package.json` 中由 Expo prebuild 修改的脚本。
3. 本文件：`dev-history/05_prompt.md`。

## 下次继续建议

下次目标应该集中在“移动端 APK release 产物”：

1. 先确认 Android SDK 是否可用。
2. 如果没有 SDK，安装 Android command line tools，并设置：

```powershell
$env:ANDROID_HOME='...'
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
```

3. 接受 licenses：

```powershell
sdkmanager --licenses
```

4. 安装需要的构建组件，通常包括：

```powershell
sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"
```

5. 使用 JDK 17 打包：

```powershell
$env:JAVA_HOME='C:\Users\curiosity\.cache\codex-runtimes\temurin-17'
$env:Path="$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
cd moefocus-mobile\android
.\gradlew.bat assembleRelease
```

6. 如果成功，APK 位置大概率是：

```text
moefocus-mobile/android/app/build/outputs/apk/release/app-release.apk
```

7. 如果需要“真正可安装且不显示未签名风险”的 release，还要创建 release keystore，并配置 `android/gradle.properties` 与 `android/app/build.gradle` 的 release signing。

## 风险点

1. 当前 Android 工程由 Expo prebuild 生成，之后如果改 `app.json` 后重新 prebuild，原生工程可能被覆盖。
2. 当前移动端同步使用 GitHub Token 存在 SQLite settings 中，适合 MVP，但不是最终安全存储方案。
3. 当前 GitHub Release 页面仍需 `gh` 或 GitHub Token 才能自动创建并上传安装包。
