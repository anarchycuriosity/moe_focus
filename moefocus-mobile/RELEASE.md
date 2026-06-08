# MoeFocus Mobile v1.1.0

## 发布定位

这是移动端重新开发后的第一个可用版本。旧移动端方案已被替换，新的实现目标是让手机端保留桌面端的核心工作流：

1. 今日任务管理。
2. 专注计时与休息阶段。
3. 本周统计与事项分布。
4. 长期任务管理。
5. 日记生成、反思保存与归档。
6. 通过 GitHub 数据仓库同步专注会话、长期任务和日记 Markdown。

## 同步说明

桌面端使用本地 Git 工作区同步 `data/` 与 `sums/` 文件。移动端不直接运行 Git 命令，而是通过 GitHub Contents API 读写同一批文件：

- `data/focus_sessions.json`
- `data/long_term_goals.json`
- `sums/YYYY-MM-DD.md`

手机端配置 GitHub Token 后，点击“同步到 GitHub”即可上传本机数据，并导入远程已有的 UUID 数据。

## 验证

- `npx tsc --noEmit` 已通过。
