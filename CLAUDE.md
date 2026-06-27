# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

QQ 机器人 × Claude Code 桥接项目 — 通过 WebSocket 接收 QQ 消息，转发给 LLM（Claude Code CLI / OpenAI 兼容 API / Anthropic API），再将回复发回 QQ。包含 Vue Web 管理界面，支持聊天记录查看和知识库管理。

## 常用命令

### 后端（项目根目录）
```bash
npm install          # 安装依赖
npm run dev          # 启动机器人（tsx 热重载）
npm run dev:web      # 启动前端
npm run dev:all      # 同时启动前后端（concurrently）
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

### 一键启动
双击 `start.bat` 自动安装依赖并启动前后端。

### VS Code
- `Ctrl+Shift+B` — 启动前后端（tasks.json）
- F5 调试 — launch.json 配置了后端/前端/全部启动

## 架构

### 消息流程
`QQ WebSocket → index.ts (handleMessage) → llm.ts (askLLM) → Claude Code CLI / OpenAI API / Anthropic API → 通过 qq-bot-sdk 回复`

### 后端模块（src/）
- **index.ts** — 入口。连接 QQ WebSocket，处理消息，发送回复（文字+图片）。含截屏功能（PowerShell）。
- **llm.ts** — LLM 统一调用层。`askLLM()` 根据配置调用三个 provider 之一。内置 session 失效重试逻辑（Claude Code）。
- **claude.ts** — Claude Code CLI 调用封装（被 llm.ts 使用）。知识库通过 `claude-workspace/CLAUDE.md` 注入。`--resume <sessionId>` 恢复会话。
- **settings.ts** — 运行时配置持久化（`data/settings.json`）。Web 端修改后立即生效。支持三种 LLM 提供商。
- **config.ts** — dotenv 读取 `.env`，导出 `config` 对象和 `validateConfig()`。
- **db.ts** — sql.js（WASM SQLite）。表：`messages`（聊天记录）、`knowledge`（文档）。含 `searchKnowledge()` 关键词搜索函数。
- **histories.ts** — OpenAI/Anthropic 对话历史持久化（`data/chat-histories.json`）。重启后恢复。
- **sessions.ts** — userId → Claude sessionId 映射（`data/sessions.json`）。
- **api.ts** — HTTP API 服务（Node `http`）。CORS。用户、消息、知识库、设置 CRUD。
- **parser.ts** — 文档解析：PDF（pdf-parse v1.1.1）、DOCX（mammoth）、txt/md/csv/json 直读。

### 前端（web/src/）
Vue 3 + Vite 5 + TypeScript。深色侧边栏 + 浅色主区域。
- **App.vue** — 侧边栏导航（聊天记录 / 知识库 / 设置）。
- **api.ts** — Fetch 封装。文件上传用 base64 JSON。
- **components/** — UserList、ChatView、KnowledgeView、SettingsView。

### 知识库数据流
1. Web UI 上传文件 → POST `/api/knowledge`（base64）
2. parser.ts 解析，存入 SQLite `knowledge` 表
3. 写入 `claude-workspace/CLAUDE.md`（Claude Code 用）+ 清空所有会话
4. OpenAI/Anthropic 调用时：`searchKnowledge(prompt)` 用中文 n-gram 关键词匹配相关文档片段（最多 3000 字符），无匹配时降级为全量注入

### LLM 提供商
| Provider | 会话恢复 | 知识库注入方式 |
|----------|---------|--------------|
| Claude Code CLI | `--resume` + sessions.json | CLAUDE.md 全量写入 |
| OpenAI 兼容 | histories.json（内存+持久化） | 关键词搜索相关片段（无匹配→全量） |
| Anthropic API | histories.json（内存+持久化） | 关键词搜索相关片段（无匹配→全量） |

## 关键设计决策

- **sql.js**（而非 better-sqlite3）— 纯 WASM，Windows 上无需原生编译。
- **pdf-parse v1.1.1** — v2 在 Node 20.14 上报 DOMMatrix 未定义错误。
- **CLAUDE.md 注入方式** — Windows shell 会破坏长中文文本参数，所以写文件而非传参。
- **claude-workspace/** — Claude Code 在此子目录运行，避免看到机器人源码。
- **Base64 文件上传** — 避免 multipart 解析复杂度。
- **Vite 5** — Vite 8 要求 Node 20.19+，本机为 Node 20.14。
- **知识库关键词搜索** — OpenAI/Anthropic 用中文 n-gram 搜索，只注入相关片段；无匹配时降级为全量知识库注入。
- **pdf-parse 动态导入** — 避免启动时触发库内 debugger 断点。

## 环境变量（.env）

必填：`QQ_APP_ID`、`QQ_APP_SECRET`。可选：`QQ_SANDBOX`、`CLAUDE_PATH`、`MAX_CONCURRENT`、`CLAUDE_TIMEOUT`、`API_PORT`、`LLM_PROVIDER`（claude-code/openai/anthropic）、`OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL`、`ANTHROPIC_API_KEY`、`ANTHROPIC_BASE_URL`、`ANTHROPIC_MODEL`。

## 测试

无自动化测试。通过 QQ 消息手动测试。可用 SQLite 浏览器查看 `data/chat.db` 验证数据。
