# MoeFocus 学习文档总览

## 当前学习主线

MoeFocus 的学习文档按“知识点”组织，而不是按源码文件流水账组织。推荐顺序：

1. 数据与状态：`01`、`02`、`03`、`12`。
2. Electron 与工程化：`04`、`08`、`10`、`11`。
3. 分布式同步：`13`、`14`、`15`。
4. 桌面端打包发版：`16`。
5. 桌面端 + 移动端完整 release：`17`。

## 最新新增

`17-desktop-mobile-release-packaging.md` 记录了本轮从换 PC 后重新配置环境，到完成桌面端 NSIS 安装包和移动端 Android APK 的完整流程。

重点知识：

- Electron release 产物：`moefocus/dist/MoeFocus Setup 1.1.0.exe`。
- 移动端 release 产物：`moefocus-mobile/android/app/build/outputs/apk/release/app-release.apk`。
- Expo SDK 50 依赖版本必须对齐。
- Android 原生构建推荐使用完整 JDK 17。
- Android SDK 需要安装 platform-tools、platforms android-34、build-tools 34.0.0。

## 当前待进一步完善

- 移动端 release 目前使用 debug keystore 签名，只适合内部测试。
- 后续正式发布应新增独立 release keystore，并考虑生成 AAB。
- 桌面端还缺少正式应用图标和代码签名。

