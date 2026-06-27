# QQ Bot × Claude Code

将 QQ 机器人与 LLM 连接，实现通过 QQ 与 AI 对话，支持聊天记录存储、会话持久化和知识库管理。

## ✨ 功能

- **QQ 机器人** — 通过 WebSocket 连接 QQ
- **多 LLM 提供商** — 支持 Claude Code CLI / OpenAI 兼容 API / Anthropic API，可从 Web 界面切换
- **会话持久化** — 重启服务后对话上下文不丢失（所有 provider）
- **聊天记录存储** — SQLite 数据库保存所有聊天记录
- **知识库管理** — 上传 PDF / DOCX / TXT / MD / CSV / JSON 文档，AI 自动参考知识库回答
- **知识库智能搜索** — OpenAI/Anthropic 模式下用中文 n-gram 关键词匹配，只注入相关片段，节省 token
- **Web 管理界面** — Vue 3 前端，查看聊天记录、管理知识库、切换 LLM 提供商
- **并发控制** — 支持多用户同时对话，可配置最大并发数

## 📁 项目结构

```
├── src/
│   ├── index.ts          # 主入口，连接 QQ 并处理消息
│   ├── llm.ts            # LLM 统一调用层（Claude Code / OpenAI / Anthropic）
│   ├── claude.ts          # Claude Code CLI 调用封装
│   ├── settings.ts        # 运行时配置持久化（data/settings.json）
│   ├── histories.ts       # 对话历史持久化（data/chat-histories.json）
│   ├── config.ts          # 环境变量配置
│   ├── db.ts              # SQLite 数据库（聊天记录 + 知识库）
│   ├── sessions.ts        # 会话 ID 映射（data/sessions.json）
│   ├── api.ts             # REST API 服务
│   └── parser.ts          # 文档解析（PDF/DOCX/TXT/MD/CSV/JSON）
├── claude-workspace/      # Claude Code 工作目录（隔离机器人源码）
├── web/                   # Vue 3 前端
│   └── src/
│       ├── App.vue        # 主界面（侧边栏导航）
│       ├── api.ts          # 前端 API 调用封装
│       └── components/
│           ├── UserList.vue       # 用户列表
│           ├── ChatView.vue       # 聊天记录查看
│           ├── KnowledgeView.vue  # 知识库管理
│           └── SettingsView.vue   # LLM 提供商设置
├── .vscode/               # VS Code 调试和任务配置
├── .env.example           # 环境变量模板
├── start.bat              # Windows 一键启动脚本
└── package.json
```

## 🚀 快速开始

### 前提条件

- **Node.js** ≥ 20
- **QQ 机器人凭证**（QQ_APP_ID 和 QQ_APP_SECRET）
- 根据选择的 LLM 提供商，还需要：
  - **Claude Code CLI**：已安装 `claude` 命令
  - **OpenAI 兼容**：API Key（支持 DeepSeek、通义千问等）
  - **Anthropic**：API Key

### 1. 安装依赖

```bash
npm install
cd web && npm install && cd ..
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 填入凭证：

```env
# 必填
QQ_APP_ID=你的AppID
QQ_APP_SECRET=你的AppSecret

# 可选
QQ_SANDBOX=true              # 测试用沙箱模式
LLM_PROVIDER=claude-code     # claude-code / openai / anthropic
MAX_CONCURRENT=3             # 最大并发调用数
CLAUDE_TIMEOUT=120           # 回复超时（秒）
API_PORT=3800                # Web API 端口
```

LLM 提供商的 API Key、Base URL、Model 等配置可通过 Web 设置页面在线修改，无需重启。

### 3. 启动（三选一）

```bash
# 方式一：同时启动前后端（推荐）
npm run dev:all

# 方式二：只启动后端
npm run dev

# 方式三：Windows 双击 start.bat
```

### 4. VS Code 开发

- `Ctrl+Shift+B` — 同时启动前后端
- `F5` — 调试后端/前端/全部启动

## 🤖 LLM 提供商

| 提供商 | 会话恢复 | 知识库注入 |
|--------|---------|-----------|
| Claude Code CLI | `--resume` + sessions.json | CLAUDE.md 全量写入 |
| OpenAI 兼容 API | histories.json 持久化 | 中文 n-gram 关键词搜索相关片段 |
| Anthropic API | histories.json 持久化 | 中文 n-gram 关键词搜索相关片段 |

在 Web 设置页面（`⚙️ 设置`）可随时切换提供商，配置立即生效。

## 📚 知识库

1. 打开 Web 管理界面，切换到「知识库」Tab
2. 拖拽或点击上传文件（支持 PDF / DOCX / TXT / MD / CSV / JSON）
3. 上传后 Claude 会自动读取知识库内容回答问题
4. OpenAI/Anthropic 模式下会根据问题自动搜索相关文档片段，节省 token
5. 删除文档后会话自动刷新

## 🔧 API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/users` | 获取所有用户列表 |
| GET | `/api/messages/:userId` | 获取用户聊天记录 |
| DELETE | `/api/messages/:userId` | 删除用户聊天记录 |
| GET | `/api/knowledge` | 获取知识库文档列表 |
| POST | `/api/knowledge` | 上传知识库文档（JSON: `{filename, data: base64}`） |
| DELETE | `/api/knowledge/:id` | 删除知识库文档 |
| GET | `/api/settings` | 获取当前设置（脱敏） |
| POST | `/api/settings` | 更新设置 |

## 🛠 技术栈

- **后端**: Node.js + TypeScript + sql.js (SQLite) + WebSocket
- **前端**: Vue 3 + Vite 5 + TypeScript
- **LLM**: Claude Code CLI / OpenAI 兼容 API / Anthropic API
- **文档解析**: mammoth (DOCX) + pdf-parse (PDF)

## 📝 注意事项

- 知识库内容通过 `CLAUDE.md` 注入 Claude Code；OpenAI/Anthropic 用关键词搜索相关片段
- 上传/删除知识库文档后会自动清空所有会话，确保下次对话加载最新知识
- `.env` 文件包含敏感信息，已在 `.gitignore` 中排除，请勿提交
- `claude-workspace/` 目录用于隔离 Claude Code 运行环境，避免看到机器人源码
