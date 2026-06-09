# 17 — 桌面端与移动端 Release 打包：从源码到可安装产物

## 本章学习目标

读完本章后，你应该能完成以下可验证任务：

- 能说清楚“开发运行”“构建”“打包”“发布”四个词的区别。
- 能独立打出 Electron 桌面端 Windows NSIS 安装包。
- 能独立打出 Expo / React Native Android release APK。
- 能解释为什么 React Native 0.73 / Expo SDK 50 推荐使用 JDK 17，而不是越新的 JDK 越好。
- 能解释为什么 Expo SDK、`expo-sqlite`、`react-native` 版本必须对齐。
- 能用 `gh release create` 把安装包上传到 GitHub Release。
- 能在换一台 PC 后，从零检查 Node、JDK、Android SDK、Gradle、Expo 依赖是否具备。

本章的目标不是背命令，而是理解打包链路。打包失败时，你要能判断失败发生在“源码类型检查”“JS bundle”“原生 Android 编译”“签名”“GitHub 发布”中的哪一层。否则只会对着红字发呆，哼，那可不算真正掌握。

## 前置知识

### 1. 构建

构建是把人类编写的源码转换成机器更容易执行的产物。

在 MoeFocus 桌面端中，构建由 `electron-vite build` 完成。它把 TypeScript、React、CSS 模块转成 `out/` 目录中的 JavaScript、HTML、CSS 文件。

如果没有构建，用户机器上就必须安装 Node.js、TypeScript、Vite、React 开发服务器，应用才能启动。这显然不适合分发。

在当前项目中：

- `moefocus/src/` 是桌面端 React 渲染进程源码。
- `moefocus/electron/` 是 Electron 主进程和 preload 源码。
- `moefocus/out/` 是构建后的桌面端应用代码。
- `moefocus-mobile/src/` 是移动端 React Native 业务源码。
- `moefocus-mobile/android/app/build/generated/` 是 Gradle 构建中生成的 Android bundle 相关产物。

### 2. 打包

打包是把构建产物、运行时、资源、配置合成用户可以安装或运行的文件。

桌面端打包由 `electron-builder` 完成，输出 `MoeFocus Setup 1.1.0.exe`。这个 exe 不是简单地压缩源码，而是包含 Electron 运行时、应用代码、安装器逻辑。

移动端打包由 Android Gradle Plugin 完成，输出 `app-release.apk`。APK 本质上是 Android 能识别的安装包，里面包含 Java/Kotlin 编译产物、native so、Hermes JS bundle、资源、Manifest 和签名信息。

如果没有打包，用户无法像普通应用一样安装。

### 3. 发布

发布是把打包产物放到用户能下载的位置，并给它绑定版本号、说明和变更记录。

GitHub Release = Git Tag + 发布说明 + 二进制附件。

当前项目中：

- Git Tag 表示某个版本对应的源码快照。
- GitHub Release 页面承载 `MoeFocus Setup 1.1.0.exe`、`.blockmap`、`app-release.apk`。
- `README.md` 中的 Releases 链接引导用户下载最新版。

如果只有 tag 没有 release，开发者知道版本存在，但普通用户找不到安装包。

### 4. JDK、Android SDK、Gradle 的分工

JDK 提供 Java 编译器和工具链，例如 `javac`、`jlink`。

Android SDK 提供 Android 平台 API、build-tools、platform-tools，例如：

- `platforms;android-34`：编译时使用的 Android 34 API。
- `build-tools;34.0.0`：`aapt2`、`zipalign`、`apksigner` 等打包工具。
- `platform-tools`：`adb` 等设备调试工具。

Gradle 是构建系统，它读取 `android/build.gradle` 和 `android/app/build.gradle`，调度 Java/Kotlin 编译、资源合并、JS bundle、APK 打包。

没有 JDK，Gradle 无法运行 Java 编译任务。

没有 Android SDK，Gradle 找不到 Android API 和打包工具。

JDK 版本太新也会出问题。例如本轮默认 Java 是 25，Gradle 8.3 无法理解 class file major version 69；JRE 21 又缺少 `jlink.exe`；最后切到完整 JDK 17 才成功。

## 阶段一：打破抽象 —— 探寻设计者动机

### 1. 为什么需要 release 打包

开发环境是给程序员用的，release 产物是给用户用的。

程序员可以接受：

- 安装 Node.js。
- 执行 `npm install`。
- 配置镜像源。
- 修复环境变量。
- 看终端日志。

用户不应该承担这些成本。用户应该只需要下载、安装、启动。

所以打包系统的设计动机是：把复杂开发环境压缩成一个稳定、可复制、可安装的交付物。

### 2. 如果没有打包会发生什么

假设你把源码压缩包发给一个同学，让他运行桌面端。

他需要：

1. 安装 Node.js。
2. 进入 `moefocus`。
3. 执行 `npm install`。
4. 等 Electron 二进制下载。
5. 执行 `npm run dev`。

只要其中一步失败，他就会觉得“软件坏了”。实际坏的可能不是软件，而是环境。

移动端更明显。Android 手机不能直接运行 TypeScript 源码。它需要 APK。APK 里必须包含 AndroidManifest、签名、Dex 字节码、资源索引、native 库、JS bundle。

如果没有 APK，就不存在“安装到手机”这件事。

### 3. 在系统中对应哪些机制

桌面端：

- `electron-vite build` 对应前端构建系统。
- `electron-builder` 对应安装器生成系统。
- `NSIS` 对应 Windows 安装向导。
- `appId` 对应操作系统识别应用身份的唯一标识。
- `.blockmap` 对应后续增量更新的数据块索引。

移动端：

- `expo export` 对应 Metro/Hermes JS bundle 生成。
- `gradlew assembleRelease` 对应 Android 原生 release 变体构建。
- `AndroidManifest.xml` 对应系统安装和权限元数据。
- `versionCode` 对应 Android 内部升级判断。
- `versionName` 对应用户可见版本号。
- `keystore` 对应 APK 签名身份。

## 项目源码映射

### 桌面端

| 文件 | 位置 | 作用 | 评价 |
|------|------|------|------|
| `moefocus/package.json` | 打包入口 | `build` 调用 `electron-vite build`，`package` 调用 `electron-builder` | 较合理实现 |
| `moefocus/electron-builder.yml` | 打包配置 | 定义 `appId`、`productName`、`dist` 输出目录、NSIS 安装器 | 较合理实现，但缺应用图标 |
| `moefocus/out/` | 构建产物 | 主进程、preload、渲染进程的编译结果 | 自动生成，不应手写 |
| `moefocus/dist/` | release 产物 | 输出 `MoeFocus Setup 1.1.0.exe` 和 `.blockmap` | 自动生成，不应提交 |

桌面端数据流：

```text
TypeScript/React 源码
  -> npm run build
  -> out/main + out/preload + out/renderer
  -> npm run package
  -> dist/MoeFocus Setup 1.1.0.exe
  -> GitHub Release 附件
```

### 移动端

| 文件 | 位置 | 作用 | 评价 |
|------|------|------|------|
| `moefocus-mobile/package.json` | 依赖与脚本 | 定义 Expo SDK 50 兼容依赖和 `export:android` | 本轮修复了不兼容依赖 |
| `moefocus-mobile/app.json` | Expo 配置 | 定义应用名、slug、版本、Android package | 较合理实现 |
| `moefocus-mobile/src/services/DatabaseService.ts` | SQLite 访问层 | 统一封装 `get_all/get_one/run/exec` | 本轮改为 SDK 50 兼容实现 |
| `moefocus-mobile/scripts/patch_expo_node_externals.js` | 安装后补丁 | 修复 Windows + 新 Node 下 Expo externals 处理 `node:` 模块的问题 | 工程兜底，后续升级 Expo 后可复查 |
| `moefocus-mobile/android/app/build.gradle` | Android 应用构建配置 | 定义 `applicationId`、`versionCode`、`versionName`、release 签名 | 当前 release 使用 debug keystore，仅适合内部测试 |

移动端数据流：

```text
React Native/Expo 源码
  -> npm run typecheck
  -> npm run export:android
  -> Metro + Hermes 生成 JS bundle
  -> gradlew assembleRelease
  -> android/app/build/outputs/apk/release/app-release.apk
  -> GitHub Release 附件
```

## 阶段二：理论落地 —— 最小可行性项目拆解

### 项目目标

设计一个 200 到 500 行左右的 C++ MVP 练习项目：`mini_releaser`。

它不真正编译 Electron 或 Android，而是模拟 release 流水线：

1. 读取 `version.txt`。
2. 检查 `build/` 目录是否存在。
3. 把构建产物复制到 `dist/mini_app_<version>/`。
4. 计算 SHA256。
5. 生成 `release_notes.md`。
6. 输出一个 `release_manifest.json`。

这个练习的目的不是写压缩软件，而是理解“构建产物、版本、发布说明、校验和”之间的关系。

### 推荐目录结构

```text
mini_releaser/
  CMakeLists.txt
  version.txt
  build/
    app.exe
    app.pdb
  src/
    main.cpp
    file_utils.cpp
    file_utils.hpp
    manifest.cpp
    manifest.hpp
  dist/
```

### 模块划分

| 模块 | 职责 |
|------|------|
| `file_utils` | 检查目录、复制文件、遍历文件 |
| `manifest` | 生成 JSON 风格发布清单 |
| `main` | 编排整个 release 流程 |

### 自底向上的开发步骤

1. 先实现 `read_text_file`，验证能读取 `version.txt`。
2. 再实现 `copy_directory`，验证 `build/` 能复制到 `dist/`。
3. 再实现 `calculate_fake_hash`，先用文件大小模拟 hash。
4. 再实现 `write_manifest`，生成 manifest。
5. 最后加入错误处理：缺少版本、缺少 build 目录、dist 已存在。

### 每一步如何验证

| 步骤 | 验证方式 |
|------|----------|
| 读取版本 | 终端输出 `version = 1.0.0` |
| 复制文件 | `dir dist` 能看到复制后的文件 |
| 生成 manifest | JSON 中包含 version、file_count、artifact_path |
| 错误处理 | 删除 `build/` 后运行，程序给出明确错误 |

### 新手容易踩坑

1. 把源码目录当成发布目录。
2. 版本号只写在文件名，不写在 manifest。
3. 打包前不清理旧产物，导致误上传旧 exe。
4. 没有校验产物是否真的存在。
5. 构建失败后仍继续发布。

### 如何迁移回 MoeFocus

你写完 `mini_releaser` 后，再看 MoeFocus：

- `version.txt` 对应 `package.json` 中的 `version`。
- `build/` 对应 `out/` 或 Android Gradle 的中间产物。
- `dist/` 对应 `moefocus/dist/` 和 `android/app/build/outputs/apk/release/`。
- `manifest.json` 对应 GitHub Release notes、APK metadata、`.blockmap`。

## 阶段三：硬核通关 —— 数据流追踪与验证

### 1. 状态机

```text
未准备
  -> 安装依赖
  -> 类型检查
  -> 构建 JS bundle
  -> 原生打包
  -> 验证产物
  -> 创建 Release
  -> 上传附件
  -> 发布完成
```

任何一步失败，都不应该进入下一步。

### 2. 正常情况时序图

```text
开发者
  | npm run build
  v
electron-vite
  | 输出 out/
  v
electron-builder
  | 输出 MoeFocus Setup 1.1.0.exe
  v
GitHub Release
  | 上传 exe/blockmap/apk
  v
用户下载
```

移动端：

```text
开发者
  | npm run typecheck
  v
TypeScript
  | 通过
  v
expo export --platform android
  | 输出 Hermes bundle
  v
gradlew assembleRelease
  | 输出 app-release.apk
  v
GitHub Release
```

### 3. 异常情况时序图

Java 版本过新：

```text
gradlew assembleRelease
  -> 读取 settings.gradle
  -> Gradle 解析 class file
  -> 遇到 Java 25 class file major version 69
  -> 构建失败
  -> 切换 JDK 17
```

Expo 依赖不匹配：

```text
npx expo install --check
  -> 发现 expo-sqlite 14.0.6
  -> Expo SDK 50 期望 expo-sqlite ~13.4.0
  -> Gradle 方法 useDefaultAndroidSdkVersions 不存在
  -> 对齐依赖
  -> 重新构建
```

JRE 不是 JDK：

```text
gradlew assembleRelease
  -> Android JdkImageTransform
  -> 调用 jlink.exe
  -> JRE 目录没有 jlink.exe
  -> 构建失败
  -> 安装完整 JDK
```

### 4. 关键变量变化表

| 变量 | 错误值 | 正确值 | 影响 |
|------|--------|--------|------|
| `JAVA_HOME` | JDK 25 或 JRE 21 | JDK 17 | Gradle 8.3 / RN 0.73 稳定构建 |
| `ANDROID_HOME` | 空 | `C:\Users\curiosity\AppData\Local\Android\Sdk` | Gradle 能找到 Android SDK |
| `expo-sqlite` | `14.0.6` | `13.4.0` | 与 Expo SDK 50 原生 Gradle 插件兼容 |
| `react-native` | `0.73.0` | `0.73.6` | 与 Expo SDK 50 推荐版本对齐 |
| `versionName` | `1.1.0` | `1.1.0` | APK 用户可见版本 |
| `versionCode` | `1` | `1` | Android 内部升级序号，后续发布必须递增 |

### 5. 日志观测方案

桌面端：

```powershell
cd moefocus
npm run build
npm run package
Get-ChildItem dist
```

重点观察：

- 是否出现 `out/main/index.js`。
- 是否出现 `MoeFocus Setup 1.1.0.exe`。
- 是否出现 `.blockmap`。

移动端：

```powershell
cd moefocus-mobile
npm run typecheck
npm run export:android
cd android
.\gradlew.bat assembleRelease
```

重点观察：

- TypeScript 是否零错误。
- `dist-mobile/metadata.json` 是否生成。
- `android/app/build/outputs/apk/release/app-release.apk` 是否生成。

### 6. 命令行验证方案

```powershell
java -version
sdkmanager.bat --version
npx expo install --check
Get-ChildItem moefocus\dist
Get-ChildItem moefocus-mobile\android\app\build\outputs\apk\release
```

本轮通过的关键验证：

```text
moefocus/dist/MoeFocus Setup 1.1.0.exe
moefocus/dist/MoeFocus Setup 1.1.0.exe.blockmap
moefocus-mobile/dist-mobile/metadata.json
moefocus-mobile/android/app/build/outputs/apk/release/app-release.apk
```

### 7. 伪代码

```text
function release_project():
    pull_latest_code()
    check_git_status()

    build_desktop()
    assert desktop_installer_exists()

    check_mobile_dependency_versions()
    install_android_sdk_if_missing()
    set_java_home_to_jdk_17()
    typecheck_mobile()
    export_mobile_bundle()
    build_android_release_apk()
    assert apk_exists()

    create_or_update_release_notes()
    create_github_release_draft()
    upload_desktop_installer()
    upload_mobile_apk()
```

### 8. 本轮实操命令

```powershell
git pull --ff-only

cd moefocus
npm run build
npm run package

cd ..\moefocus-mobile
npx expo install --check
npx expo install expo-sqlite react-native react-native-safe-area-context
npm run typecheck
npm run export:android

$env:JAVA_HOME="C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot"
$env:ANDROID_HOME="C:\Users\curiosity\AppData\Local\Android\Sdk"
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
$env:Path="$env:JAVA_HOME\bin;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:ANDROID_HOME\platform-tools;$env:Path"

cd android
.\gradlew.bat assembleRelease
```

## 常见误区

### 误区 1：能 `npm start` 就等于能 release

错误理解：开发服务器能跑，说明应用可以发布。

为什么错：开发服务器依赖本机 Node、Metro/Vite、未压缩源码和热更新机制；release 需要静态产物、运行时、安装器或 APK。

正确理解：开发运行只是第一层验证，release 至少还要经过类型检查、构建、打包、安装验证。

实验验证：删除 `node_modules` 后双击源码不会启动，但安装包仍能启动。

### 误区 2：Java 越新越好

错误理解：JDK 25 比 JDK 17 新，所以更适合构建 Android。

为什么错：Gradle、Android Gradle Plugin、React Native 对 JDK 有兼容矩阵。太新的 class file 版本可能无法被旧 Gradle 解析。

正确理解：按项目栈选择 JDK。React Native 0.73 / Gradle 8.3 使用 JDK 17 更稳。

实验验证：用 Java 25 运行 `gradlew assembleRelease`，观察 `Unsupported class file major version 69`。

### 误区 3：JRE 和 JDK 一样

错误理解：只要 `java -version` 能输出，Android 就能构建。

为什么错：JRE 只提供运行环境，JDK 才包含 `javac`、`jlink` 等构建工具。

正确理解：Android Gradle 需要完整 JDK。

实验验证：用 VS Code 自带 JRE 21 构建，会遇到 `jlink.exe does not exist`。

### 误区 4：Expo 包可以随便升级

错误理解：`expo-sqlite@14` 比 `13` 新，所以应该用新的。

为什么错：Expo SDK 是一组经过测试的版本组合。单独升级原生模块可能导致 Gradle 插件 API 不匹配。

正确理解：使用 `npx expo install --check` 和 `npx expo install 包名` 对齐版本。

实验验证：安装 `expo-sqlite@14.0.6` 后构建，观察 `useDefaultAndroidSdkVersions()` 不存在。

### 误区 5：APK 叫 release 就一定适合公开发布

错误理解：`assembleRelease` 输出的 APK 就能直接上架。

为什么错：当前 `android/app/build.gradle` 的 release 仍使用 debug keystore。它适合内部测试，不适合正式商店发布。

正确理解：公开发布需要生成自己的 keystore，并保护私钥；Google Play 还更推荐 AAB。

实验验证：查看 `android/app/build.gradle`，release 的 `signingConfig` 指向 `signingConfigs.debug`。

## 实验作业

### 作业 1：检查桌面端 release 产物

目标：

确认桌面端安装包是否存在并匹配版本号。

思路提示：

从 `package.json` 读取版本号，再检查 `dist` 中文件名。

参考答案 / 参考实现方向：

```powershell
cd moefocus
node -p "require('./package.json').version"
Get-ChildItem dist | Where-Object { $_.Name -like '*1.1.0*' }
```

验证方式：

看到 `MoeFocus Setup 1.1.0.exe` 和 `.blockmap`。

预期现象：

文件大小约 100MB。

如果结果不符合预期，优先检查：

- 是否执行了 `npm run package`。
- `electron-builder.yml` 的 output 是否仍是 `dist`。
- 版本号是否还是 `1.1.0`。

### 作业 2：检查移动端依赖是否对齐

目标：

确认 Expo SDK 50 的依赖组合没有漂移。

思路提示：

Expo 官方 CLI 会告诉你推荐版本。

参考答案 / 参考实现方向：

```powershell
cd moefocus-mobile
npx expo install --check
```

验证方式：

命令不再提示 `expo-sqlite`、`react-native`、`react-native-safe-area-context` 需要更新。

预期现象：

输出依赖兼容或没有 outdated dependencies。

如果结果不符合预期，优先检查：

- `package.json` 是否被手动改过。
- `package-lock.json` 是否来自旧机器。
- 是否运行了普通 `npm install expo-sqlite@latest`。

### 作业 3：从零配置 Android SDK 环境变量

目标：

让 Gradle 能找到 Android SDK。

思路提示：

Android SDK 默认放在用户目录更容易迁移。

参考答案 / 参考实现方向：

```powershell
$env:ANDROID_HOME="C:\Users\curiosity\AppData\Local\Android\Sdk"
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
$env:Path="$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
sdkmanager.bat --version
```

验证方式：

`sdkmanager.bat --version` 能输出版本号。

预期现象：

Gradle 不再报 `SDK location not found`。

如果结果不符合预期，优先检查：

- `cmdline-tools/latest/bin` 是否存在。
- `platforms/android-34` 是否安装。
- `build-tools/34.0.0` 是否安装。

### 作业 4：打出移动端 APK

目标：

生成可安装的 Android release APK。

思路提示：

先类型检查，再导出 JS bundle，最后原生构建。

参考答案 / 参考实现方向：

```powershell
cd moefocus-mobile
npm run typecheck
npm run export:android

$env:JAVA_HOME="C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot"
$env:ANDROID_HOME="C:\Users\curiosity\AppData\Local\Android\Sdk"
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
$env:Path="$env:JAVA_HOME\bin;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:ANDROID_HOME\platform-tools;$env:Path"

cd android
.\gradlew.bat assembleRelease
```

验证方式：

检查：

```powershell
Get-ChildItem app\build\outputs\apk\release
```

预期现象：

存在 `app-release.apk`。

如果结果不符合预期，优先检查：

- JDK 是否是 17。
- 是否有完整 JDK 而不是 JRE。
- Android SDK 34 是否安装。
- Expo 依赖是否对齐。

### 作业 5：创建 GitHub Release 草稿

目标：

把桌面端和移动端产物上传为 release 附件。

思路提示：

先使用 draft，检查无误后再手动发布。

参考答案 / 参考实现方向：

```powershell
gh release create v1.1.0 `
  --title "MoeFocus v1.1.0" `
  --notes-file RELEASE_NOTES.md `
  --draft `
  "moefocus/dist/MoeFocus Setup 1.1.0.exe" `
  "moefocus/dist/MoeFocus Setup 1.1.0.exe.blockmap" `
  "moefocus-mobile/android/app/build/outputs/apk/release/app-release.apk"
```

验证方式：

```powershell
gh release view v1.1.0 --web
```

预期现象：

GitHub 页面显示草稿 release，附件包含 exe、blockmap、apk。

如果结果不符合预期，优先检查：

- `gh auth status` 是否登录。
- tag 是否存在并推送。
- 文件路径是否正确。

## 延伸项目

### 练习项目路线：从零实现一个 release pipeline

目标：

为一个最小 C++ 命令行工具设计完整 release 流程。

推荐目录结构：

```text
mini_release_pipeline/
  src/
  tests/
  scripts/
    build.ps1
    package.ps1
    release.ps1
  dist/
  CHANGELOG.md
  VERSION
```

分阶段里程碑：

| 里程碑 | 内容 | 验收标准 |
|--------|------|----------|
| M1 | 编译出 exe | `dist/app.exe` 存在 |
| M2 | 生成 zip | `dist/app-v0.1.0.zip` 存在 |
| M3 | 生成校验和 | `SHA256SUMS.txt` 包含 zip hash |
| M4 | 创建 tag | `git tag --list` 能看到版本 |
| M5 | 创建 GitHub Release | Release 页面有 zip 附件 |

参考项目：

- `qinguoyi/TinyWebServer`：适合学习 Linux C++ 服务端构建，但不要直接照搬 release 流程。
- `tinyhttpd`：适合理解小项目怎样从源码到可运行程序。
- Beej's Guide 示例：适合先补 socket 基础，再做可发布 demo。
- Stanford CS144 labs：适合理解网络协议，不是 release 工程重点。

评价：

这些项目都能让你练“从源码到可运行程序”，但真正的 release 工程还需要版本号、产物校验、发布说明、自动化脚本。不要只学源码，忽略交付。

## 博客题解总结

MoeFocus 本轮 release 打包覆盖了桌面端 Electron 和移动端 Expo / React Native 两条完全不同的交付链路。桌面端通过 `electron-vite build` 生成 `out/`，再由 `electron-builder` 打成 Windows NSIS 安装包；移动端通过 TypeScript 检查、Expo Android bundle 导出、Gradle `assembleRelease` 生成 APK。真正的难点不在命令本身，而在环境与版本矩阵：Expo SDK 50 必须使用兼容的 `expo-sqlite@13.4.0`、`react-native@0.73.6` 等依赖；React Native 0.73 / Gradle 8.3 在本机最终使用完整 JDK 17 成功构建；Android SDK 需要安装 platform-tools、Android 34 platform 和 build-tools。打包完成后，还需要用 Git tag 和 GitHub Release 把产物与源码快照绑定，用户才真正能下载和安装。写完代码不是终点，能稳定交付才是工程闭环。

