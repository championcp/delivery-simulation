# 信息科技小课堂快递柜体验系统 V1.0

面向小学生的快递柜操作模拟程序，采用 Next.js + Tailwind CSS 构建。系统忠实还原“信息科技小课堂快递柜”的投件、取件流程，支持动画演示、提示音反馈，以及 SQLite 数据存储，方便在课堂或体验活动中使用。

## 功能亮点

- **直观界面**：快递柜平面图、电子屏幕操作区均为中文提示，按钮和输入框尺寸适合学生鼠标操作。
- **双流程体验**：覆盖“快递员投件”和“用户取件”两套核心操作，生成/验证 6 位取件码，贴近真实体验。
- **动态反馈**：柜门开启/关闭动画与提示音同步，让学生感受到真实柜体的动作。
- **数据持久化**：使用 `data/locker.db`（SQLite）持久保存柜格占用和包裹信息，刷新页面不会丢失状态。
- **易于扩展**：后端服务抽象为 API，可在后续 Sprint 中继续扩展寄件、异常处理、账户体系等功能。

## 技术栈

- [Next.js 15 App Router](https://nextjs.org/)（TypeScript）
- [Tailwind CSS](https://tailwindcss.com/) + 自定义动画
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) 用于 SQLite 数据库访问
- Web Audio API 播放提示音

## 目录结构

```
web/
├─ src/
│  ├─ app/              # App Router 页面与 API 路由
│  ├─ components/       # 前端组件（LockerSimulation 等）
│  └─ lib/              # 数据库与业务逻辑
├─ data/
│  └─ locker.db         # 运行时生成的 SQLite 数据库（首次启动自动创建）
├─ public/              # 静态资源
└─ package.json
```

## 本地运行

1. 进入项目目录并安装依赖：
   ```bash
   cd web
   npm install
   ```
2. 启动开发服务器：
   ```bash
   npm run dev
   ```
3. 打开浏览器访问 [http://localhost:3000](http://localhost:3000)。

初次访问时会自动在 `data/locker.db` 创建数据库并写入 24 个默认柜格。若需重置，可删除该文件后重新启动。

## 安装与部署

以下步骤面向没有开发经验的老师或同学，请按顺序逐条执行。

### 1. 准备运行环境

1. 打开浏览器访问 [https://nodejs.org/zh-cn](https://nodejs.org/zh-cn)。
2. 在首页选择“LTS（长期支持版）”，点击下载适合自己系统（Windows/macOS）的安装包。
3. 下载完成后双击安装包，安装过程保持默认选项即可。Node.js 会同时安装 `npm`（包管理器）。
4. 安装结束后，打开终端：
   - Windows：按 `Win + X` → 选择“Windows PowerShell”或“终端”；
   - macOS：打开“应用程序” → “实用工具” → “终端”。
5. 在终端输入以下命令检查安装是否成功（回车后应看到版本号）：
   ```bash
   node -v
   npm -v
   ```
   如果命令无法识别，请重新启动电脑后再试一次。

### 2. 获取程序并进入目录

1. 将老师提供的项目压缩包解压，或从 GitHub 下载源码后解压。
2. 记住解压后的路径（例如 `C:\Users\你的名字\Desktop\delivery-simulation`）。
3. 在终端中输入（请把路径替换成自己的实际路径）：
   ```bash
   cd C:\Users\你的名字\Desktop\delivery-simulation\web
   ```
   macOS 下示例：
   ```bash
   cd ~/Desktop/delivery-simulation/web
   ```

### 3. 安装项目依赖（只需首次执行）

```bash
npm install
```

- 第一次安装会从网络下载所需的开源包，时间可能在 1-5 分钟之间。
- 安装成功会回到命令提示符，无错误信息。

### 4. 课堂演示 / 测试运行

```bash
npm run dev
```

- 终端提示 `Ready in http://localhost:3000` 后，打开浏览器访问该地址即可看到系统。
- 想停止运行时，在终端按 `Ctrl + C`（Windows/macOS 通用）。

### 5. 正式部署（供长期使用）

1. 构建生产版本：
   ```bash
   npm run build
   ```
2. 启动生产服务：
   ```bash
   npm run start
   ```
3. 浏览器访问 [http://localhost:3000](http://localhost:3000) 即可使用。
4. 生产服务运行期间不要关闭终端窗口，如需停止服务同样按 `Ctrl + C`。
5. 如果希望关掉终端后服务仍继续运行，可在具备经验的同事帮助下配置 PM2、systemd 等进程守护工具。

### 6. 数据存储说明

- 系统会在首次运行时自动创建 `data/locker.db` 数据库文件，用于记录柜门状态。
- 请不要删除 `data` 文件夹；若确需重置所有数据，先关闭程序，再手动删除其中的 `locker.db*` 文件，重新运行后会自动生成空数据库。

### 7. 常见问题

- **端口被占用**：若 3000 端口已被其他应用占用，可通过 `PORT=4000 npm run start`（Windows PowerShell 使用 `$env:PORT=4000; npm run start`）改用其他端口。
- **网络缓慢或安装失败**：确保设备联网良好，可更换网络后重试。
- **权限不足**：若提示权限错误，请以管理员身份运行终端（Windows 右键“以管理员身份运行”）。

### 8. 傻瓜式一键部署包（开发人员预制）

为方便完全没有工程背景的老师使用，可由开发人员制作“解压即用”的一键部署包。

#### 开发人员制作步骤

1. 在开发机执行：
   ```bash
   cd web
   npm install
   npm run build
   npm prune --omit=dev
   ```
   确保 `node_modules` 与 `.next` 已生成。
2. 下载 Node.js 便携版 ZIP（Windows）或 tar.gz（macOS/Linux），解压至 `bundle/node/`。
3. 创建目录结构：
   ```
   bundle/
   ├─ node/                # Node 便携版（包含 node.exe 或 bin/node）
   ├─ web/                 # 本项目目录（包含 .next、node_modules、data 等）
   ├─ start.bat            # Windows 启动脚本
   └─ start.command        # macOS 双击脚本（可选）
   ```
4. `start.bat` 示例：
   ```bat
   @echo off
   setlocal
   set APP_DIR=%~dp0web
   set NODE_DIR=%~dp0node
   cd /d "%APP_DIR%"
   if not exist data mkdir data
   "%NODE_DIR%\node.exe" node_modules\npm\bin\npm-cli.js run start
   endlocal
   pause
   ```
5. macOS `start.command` 示例：
   ```bash
   #!/bin/bash
   DIR="$(cd "$(dirname "$0")" && pwd)"
   APP_DIR="$DIR/web"
   NODE_BIN="$DIR/node/bin/node"
   mkdir -p "$APP_DIR/data"
   cd "$APP_DIR"
   "$NODE_BIN" node_modules/npm/bin/npm-cli.js run start
   ```
   保存后运行 `chmod +x start.command`。
6. 将 `bundle` 目录压缩为 `locker-simulator-win64.zip` 等文件提供给部署者。

> **快速方式**：仓库提供脚本 `./scripts/package-windows.sh` 会自动完成上述步骤，产物位于 `dist/locker-simulator-win64.zip`。  
> - 默认使用当前 Node.js 版本，可通过 `NODE_VERSION_OVERRIDE=20.17.0 ./scripts/package-windows.sh` 指定 Windows 打包所用的 Node 版本。  
> - 脚本会为 Windows 创建 `start.bat`，并下载对应的 Node 便携包，无需手动准备。

#### 使用者操作步骤

1. 解压压缩包至任意目录（例如 `C:\locker-simulator`）。
2. Windows 用户双击 `start.bat`，macOS 用户双击 `start.command`。
3. 终端窗口提示服务已启动后，访问 [http://localhost:3000](http://localhost:3000) 即可使用。
4. 使用结束后，在窗口内按 `Ctrl + C` 或关闭窗口。

## 操作指南

### 快递员投件流程

1. 点击屏幕上的「快递员投件」。
2. 输入收件人手机号码（11 位），可选填写姓名。
3. 选择包裹适合的柜格大小（小/中/大）。
4. 点击「打开柜门」后，系统会自动分配可用柜格并生成 6 位取件码：
   - 屏幕显示柜格编号和取件码；
   - 柜门动画打开，同时播放提示音。
5. 放入包裹，点击「已放入包裹，关闭柜门」模拟关门，系统回到首页。

### 用户取件流程

1. 点击「用户取件」。
2. 使用屏幕上的数字键盘输入 6 位取件码。
3. 点击「打开柜门」：
   - 若取件码正确，屏幕显示柜格编号和取件提示；
   - 柜门动画打开，并播放提示音。
4. 取出包裹后点击「已取出包裹，关闭柜门」，系统回到首页。

输入错误时屏幕会给出中文提示，可重新尝试或返回首页。

## 数据说明

| 表名       | 说明                     |
| ---------- | ------------------------ |
| `lockers`  | 24 个柜格基础信息、尺寸 |
| `packages` | 投件记录、取件码及状态  |

- 柜格状态通过 `packages` 表中的 `status` 自动计算，无需手动维护。
- 取件成功后状态更新为 `picked`，占用自动释放。

## 下一步迭代建议

1. 扩展寄件、退件、异常求助等模块。
2. 引入教师端仪表板，支持批量生成体验数据。
3. 增加语音提示、字号调节等无障碍能力，适配低年级学生。

欢迎在新的 Sprint 中继续迭代，保持 GitHub Flow 工作流：为每个需求创建独立分支，开发完成后通过 Pull Request 合并。
