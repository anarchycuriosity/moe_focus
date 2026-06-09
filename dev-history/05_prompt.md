# 05 — Release 打包续做与换 PC 环境修复记录

本轮目标：

1. 拉取最新仓库。
2. 根据 `dev-history/04_prompt.md` 接续之前未完成任务。
3. 完成桌面端 release 更新。
4. 完成移动端 release 打包。
5. 将打包 release 流程写入 `learn-in-pro`，方便后续学习。

## 执行结果

### 桌面端 release

已执行：

```powershell
cd moefocus
npm run build
npm run package
```

产物：

- `moefocus/dist/MoeFocus Setup 1.1.0.exe`
- `moefocus/dist/MoeFocus Setup 1.1.0.exe.blockmap`

验证：

- `npm run build` 通过。
- `npm run package` 通过。

### 移动端 release

已执行：

```powershell
cd moefocus-mobile
npm run typecheck
npm run export:android
cd android
.\gradlew.bat assembleRelease
```

产物：

- `moefocus-mobile/dist-mobile/metadata.json`
- `moefocus-mobile/android/app/build/outputs/apk/release/app-release.apk`

验证：

- `npm run typecheck` 通过。
- `npm run export:android` 通过。
- `gradlew assembleRelease` 在 JDK 17 下通过。

## 本轮遇到的问题与处理

### 问题 1：Expo export 在 Windows + 新 Node 下处理 `node:` externals 失败

现象：

```text
ENOENT: no such file or directory, mkdir ...\.expo\metro\externals\node:sea
```

原因：

项目已有 `scripts/patch_expo_node_externals.js`，但它匹配的是单行 `].includes(x)`。当前安装的 Expo CLI 文件中该片段跨行格式化，导致补丁没有生效。

处理：

- 扩展补丁脚本的匹配模式。
- 重新执行 `npm run postinstall`。

修改文件：

- `moefocus-mobile/scripts/patch_expo_node_externals.js`

### 问题 2：默认 Java 25 与 Gradle 8.3 不兼容

现象：

```text
Unsupported class file major version 69
```

原因：

Java 25 对 Gradle 8.3 来说太新，Gradle 无法解析对应 class file 版本。

处理：

- 安装完整 JDK 17。
- 使用 `$env:JAVA_HOME="C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot"` 执行 Android 构建。

### 问题 3：本机缺少 Android SDK

现象：

```text
SDK location not found. Define a valid SDK location with an ANDROID_HOME environment variable
```

处理：

- 安装 Android command-line tools 到 `C:\Users\curiosity\AppData\Local\Android\Sdk`。
- 安装 `platform-tools`、`platforms;android-34`、`build-tools;34.0.0`。
- 设置 `ANDROID_HOME` 和 `ANDROID_SDK_ROOT`。

### 问题 4：Expo SDK 50 与 `expo-sqlite@14.0.6` 不兼容

现象：

```text
Could not find method useDefaultAndroidSdkVersions()
```

确认命令：

```powershell
npx expo install --check
```

结果：

- `expo-sqlite@14.0.6` 应为 `~13.4.0`。
- `react-native@0.73.0` 应为 `0.73.6`。
- `react-native-safe-area-context@4.8.0` 应为 `4.8.2`。

处理：

```powershell
npx expo install expo-sqlite react-native react-native-safe-area-context
```

修改文件：

- `moefocus-mobile/package.json`
- `moefocus-mobile/package-lock.json`

### 问题 5：降级到 `expo-sqlite@13.4.0` 后 TypeScript API 不兼容

现象：

`openDatabaseAsync`、`runAsync`、`getAllAsync`、`getFirstAsync` 不存在。

原因：

这些 API 属于更新的 Expo SQLite API，SDK 50 对应的 `expo-sqlite@13.4.0` 使用 `openDatabase`、`transactionAsync`、`executeSqlAsync`。

处理：

- 保持上层 `DatabaseService.get_all/get_one/run/exec` API 不变。
- 将底层实现改成 SDK 50 兼容的 Promise 封装。

修改文件：

- `moefocus-mobile/src/services/DatabaseService.ts`

## 新增学习文档

- `learn-in-pro/17-desktop-mobile-release-packaging.md`
- `learn-in-pro/summary.md`

## 后续注意事项

1. 当前 Android `release` 构建仍使用 debug keystore，适合内部测试，不适合正式商店发布。
2. 后续如果要公开发布移动端，应生成独立 release keystore，并考虑输出 AAB。
3. 桌面端缺少应用图标和代码签名；公开分发时 Windows SmartScreen 可能警告。
4. 换 PC 后优先检查 JDK、Android SDK、Expo 依赖版本，而不是直接改源码。

