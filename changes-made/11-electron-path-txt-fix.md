# 11 — Electron 安装后缺失 path.txt 导致 electron-vite 报错

## 故障现象

安装脚本执行成功（npm install + 直接下载解压 electron.zip），但启动 dev server 时报错：

```
Error: Electron uninstall
    at getElectronPath (electron-vite/dist/chunks/lib-BmEkZIgk.mjs:129:19)
```

即使在 `node_modules/electron/dist/` 下确认 `electron.exe` 存在，错误依然发生。

## 根因分析

这是 electron-vite 与 electron npm 包之间的一个隐性耦合点。

### 调用链路

```
npm run dev
  → electron-vite dev
    → getElectronPath()                     // lib-BmEkZIgk.mjs:115
      → require.resolve('electron')         // 解析到 electron 包目录
      → fs.readFileSync('path.txt')         // 读取可执行文件名
      → path.join(dirname, 'dist', name)    // 拼接完整路径
```

### getElectronPath 源码（electron-vite）

```javascript
function getElectronPath() {
    const electronModulePath = path.dirname(require.resolve('electron'));
    const pathFile = path.join(electronModulePath, 'path.txt');
    let executablePath;
    if (fs.existsSync(pathFile)) {
        executablePath = fs.readFileSync(pathFile, 'utf-8');
    }
    if (executablePath) {
        electronExecPath = path.join(electronModulePath, 'dist', executablePath);
    } else {
        throw new Error('Electron uninstall');  // ← 这里抛出的!
    }
    return electronExecPath;
}
```

### electron 官方 install.js 做了什么

```javascript
function extractFile(zipPath) {
    return extract(zipPath, { dir: path.join(__dirname, 'dist') }).then(() => {
        // 关键步骤：写入 path.txt
        return fs.promises.writeFile(
            path.join(__dirname, 'path.txt'),
            platformPath  // Windows → 'electron.exe'
        );
    });
}
```

**`path.txt` 是 electron npm 包的 postinstall 脚本在解压后写入的元数据文件**，内容为平台对应的可执行文件名（Windows 上是 `electron.exe`）。

### 我们的安装脚本哪里出了问题

之前的修复（第10条）绕过了 `@electron/get` 和 `install.js`，直接 HTTP 下载 + `Expand-Archive` 解压。这个方案跳过了 postinstall 中**写入 `path.txt`** 这一步。

- `Expand-Archive` 只解压文件到 `dist/`
- 没有任何代码写入 `path.txt`
- electron-vite 读取 `path.txt` 时发现文件不存在 → `executablePath` 为 falsy → 抛出 `'Electron uninstall'`

### 为什么之前没发现

当前开发环境可能在之前的某次操作中已经通过完整的 `npm install`（在 postinstall 成功时）写入了 `path.txt`，或者 electron 二进制是通过完整 postinstall 安装的。但在**模拟客户克隆环境**（全新 git clone + 运行安装脚本）时，问题必然触发。

## 修复方案

在 `setup.ps1` 和 `start-dev.bat` 的 Electron 下载解压流程中，增加一行写 `path.txt` 的操作。

### setup.ps1 修改

```powershell
# 解压后增加：
"electron.exe" | Out-File -FilePath "node_modules\electron\path.txt" -Encoding ascii -NoNewline
```

使用 `Out-File -NoNewline` 确保不附加尾部换行符。`electron-vite` 内部对 `path.txt` 内容做 `path.join(dir, 'dist', content)` 拼接，末尾有 `\n` 会导致路径错误（`electron.exe\n` 而非 `electron.exe`）。

### start-dev.bat 修改

在嵌入的 PowerShell 命令中，`Remove-Item $zip` 之后增加：

```powershell
'electron.exe' | Out-File -FilePath 'node_modules\electron\path.txt' -Encoding ascii -NoNewline;
```

batch 文件中 `|` 需转义为 `^|`。

## 思维出发点

**"安装"不是单一动作，而是一组契约的组合。**

当我们绕过 `electron` 包的官方 postinstall 时，需要逆向理解 postinstall 到底做了哪些事。`install.js` 做的不只是"下载+解压"：
1. 下载 zip → SHA256 校验
2. 解压 zip 到 `dist/`
3. 移动 `electron.d.ts` 到包根目录（TypeScript 类型定义）
4. **写入 `path.txt`**（electron-vite 定位入口）

我们之前的修复只覆盖了步骤 1-2，遗漏了步骤 4。这就是为什么需要"读官方 install.js 源码"——只有理解了它在哪些地方写入了哪些文件，才能确保绕过后结果等价。

## 验证方法

```powershell
# 1. 确认 path.txt 存在且内容正确
Get-Content node_modules\electron\path.txt
# 预期输出: electron.exe (末尾无换行)

# 2. 确认二进制文件存在
Test-Path node_modules\electron\dist\electron.exe
# 预期输出: True

# 3. 启动 dev server
npm run dev
# 预期: Electron 窗口正常启动
```
