# QQ Bot × Claude Code

将 QQ 机器人与 Claude Code 连接，实现通过 QQ 与 Claude 对话，并支持聊天记录存储、会话持久化和知识库管理。

## ✨ 功能

- **QQ 机器人** — 通过 WebSocket 连接 QQ（支持 OPQ / NapCat 等适配器）
- **Claude Code 集成** — 调用 Claude Code CLI 非交互模式，支持 `--resume` 会话续接
- **会话持久化** — 重启服务后对话上下文不丢失
- **聊天记录存储** — SQLite 数据库保存所有聊天记录
- **知识库管理** — 上传 PDF / DOCX / TXT / MD 文档，Claude 自动参考知识库内容回答问题
- **Web 管理界面** — Vue 3 前端，查看聊天记录、管理知识库
- **并发控制** — 支持多用户同时对话，可配置最大并发数

## 📁 项目结构

```
├── src/
│   ├── index.ts          # 主入口，连接 QQ 并处理消息
│   ├── claude.ts          # Claude Code CLI 调用封装
│   ├── config.ts          # 配置管理
│   ├── db.ts              # SQLite 数据库（聊天记录 + 知识库）
│   ├── sessions.ts        # 会话持久化
│   ├── api.ts             # REST API 服务
│   └── parser.ts          # 文档解析（PDF/DOCX/TXT/MD）
├── web/                   # Vue 3 前端
│   └── src/
│       ├── App.vue        # 主界面（聊天记录 + 知识库 Tab）
│       └── components/
│           ├── UserList.vue       # 用户列表
│           ├── ChatView.vue       # 聊天记录查看
│           └── KnowledgeView.vue  # 知识库管理
├── .env.example           # 环境变量模板
└── package.json
```

## 🚀 快速开始

### 前提条件

- **Node.js** ≥ 20
- **Claude Code CLI** 已安装并可用（`claude` 命令在 PATH 中）
- **QQ 适配器**（OPQ / NapCat 等）运行中

### 1. 安装依赖

```bash
# 后端
npm install

# 前端
cd web && npm install && cd ..
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 填入你的 QQ 机器人凭证：

```env
QQ_APP_ID=你的AppID
QQ_APP_SECRET=你的AppSecret
QQ_SANDBOX=true          # 测试用沙箱模式
CLAUDE_PATH=claude       # Claude Code 路径
MAX_CONCURRENT=3         # 最大并发 Claude 调用数
CLAUDE_TIMEOUT=120       # 回复超时（秒）
API_PORT=3800            # Web API 端口
```

### 3. 启动后端

```bash
npm run dev
```

### 4. 启动前端（可选）

```bash
cd web
npm run dev
```

前端默认运行在 `http://localhost:5173`，API 代理到 `http://localhost:3800`。

## 📚 知识库

1. 打开 Web 管理界面，切换到「知识库」Tab
2. 拖拽或点击上传文件（支持 PDF / DOCX / TXT / MD）
3. 上传后 Claude 会自动读取知识库内容回答问题
4. 删除文档后会话自动刷新

## 🔧 API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/users` | 获取所有用户列表 |
| GET | `/api/messages/:userId` | 获取用户聊天记录 |
| DELETE | `/api/messages/:userId` | 删除用户聊天记录 |
| GET | `/api/knowledge` | 获取知识库文档列表 |
| POST | `/api/knowledge` | 上传知识库文档（JSON: `{filename, data: base64}`） |
| DELETE | `/api/knowledge/:id` | 删除知识库文档 |

## 🛠 技术栈

- **后端**: Node.js + TypeScript + sql.js (SQLite) + WebSocket
- **前端**: Vue 3 + Vite 5 + TypeScript
- **AI**: Claude Code CLI（`claude -p` 非交互模式）
- **文档解析**: mammoth (DOCX) + pdf-parse (PDF)

## 📝 注意事项

- 知识库内容通过 `CLAUDE.md` 注入，Claude Code 会自动读取该文件
- 上传/删除知识库文档后会自动清空所有会话，确保下次对话加载最新知识
- `.env` 文件包含敏感信息，已在 `.gitignore` 中排除，请勿提交
