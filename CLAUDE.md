# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

QQ 机器人 × Claude Code 桥接项目 — 通过 WebSocket 接收 QQ 消息，转发给 Claude Code CLI（`claude -p`），再将回复发回 QQ。包含 Vue Web 管理界面，支持聊天记录查看和知识库管理。

## 常用命令

### 后端（项目根目录）
```bash
npm install          # 安装依赖
npm run dev          # 启动机器人（tsx 热重载）
npm run build        # 编译 TS → dist/
npm run start        # 运行编译后的 JS
npx tsc --noEmit     # 仅类型检查
```

### 前端（web/ 目录）
```bash
cd web && npm install
npm run dev          # Vite 开发服务器 :5173，代理 /api → :3800
npm run build        # vue-tsc + vite 构建
```

## 架构

### 消息流程
`QQ WebSocket → index.ts (handleMessage) → claude.ts (askClaude, 调用 CLI) → 通过 qq-bot-sdk 回复`

### 后端模块（src/）
- **index.ts** — 入口。连接 QQ WebSocket，处理收到的消息，发送回复（文字+图片）。包含截屏功能（PowerShell）。
- **claude.ts** — 调用 `claude -p` 并传入 `--output-format json`。通过 slot 队列控制并发。知识库通过 `claude-workspace/CLAUDE.md` 注入。通过 `--resume <sessionId>` 恢复会话。
- **config.ts** — 通过 dotenv 读取 `.env`，导出 `config` 对象和 `validateConfig()`。
- **db.ts** — sql.js（WASM SQLite）。表：`messages`（聊天记录）、`knowledge`（上传的文档）。写入后自动 flush 到 `data/chat.db`。
- **sessions.ts** — userId → Claude sessionId 映射。持久化到 `data/sessions.json`。`clearAllSessions()` 在知识库变更时调用。
- **api.ts** — HTTP API 服务（Node `http` 模块）。启用 CORS。用户、消息、知识库 CRUD 路由。上传/删除知识库时：刷新 CLAUDE.md + 清空所有会话。
- **parser.ts** — 文档解析器：PDF（pdf-parse v1.1.1）、DOCX（mammoth）、txt/md/csv/json（直接读取）。

### 前端（web/src/）
Vue 3 + Vite 5 + TypeScript。双面板布局，底部 Tab 切换（聊天记录 / 知识库）。
- **api.ts** — Fetch 请求封装。上传文件用 base64 JSON（非 multipart）。
- **components/** — UserList（侧边栏用户列表）、ChatView（聊天气泡）、KnowledgeView（拖拽上传 + 文档列表）。

### 知识库数据流
1. 用户通过 Web UI 上传文件 → POST `/api/knowledge`（base64）
2. api.ts 解析文件，存入 SQLite `knowledge` 表
3. 将所有知识库内容写入 `claude-workspace/CLAUDE.md`
4. 清空所有会话（强制 Claude 重新读取 CLAUDE.md）
5. Claude Code CLI 在 `claude-workspace/` 目录运行时自动读取 CLAUDE.md

## 关键设计决策

- **sql.js**（而非 better-sqlite3）— 纯 WASM，Windows 上无需原生编译。
- **pdf-parse v1.1.1** — v2 在 Node 20.14 上报 DOMMatrix 未定义错误。
- **CLAUDE.md 注入方式** — 知识库写入 `claude-workspace/CLAUDE.md` 而非通过 CLI 参数传递，因为 Windows shell 会破坏长中文文本参数。
- **claude-workspace/** — Claude Code 在此子目录运行，避免看到机器人源码。
- **Base64 文件上传** — 避免 Node http 服务端的 multipart 解析复杂度。
- **Vite 5** — Vite 8 要求 Node 20.19+，本机为 Node 20.14。

## 环境变量（.env）

必填：`QQ_APP_ID`、`QQ_APP_SECRET`。可选：`QQ_SANDBOX`、`CLAUDE_PATH`、`MAX_CONCURRENT`、`CLAUDE_TIMEOUT`、`API_PORT`。

## 测试

无自动化测试。通过 QQ 消息手动测试。可用 SQLite 浏览器查看 `data/chat.db` 验证数据。
