import http from 'http'
import { writeFileSync } from 'fs'
import { join } from 'path'
import {
  getUsers, getMessages, deleteUserMessages,
  getKnowledgeList, getKnowledgeContent, insertKnowledge, deleteKnowledge,
} from './db.js'
import { parseFile, getFileType } from './parser.js'
import { clearAllSessions } from './sessions.js'
import { getSettings, getSettingsSafe, updateSettings } from './settings.js'

const WORKSPACE = join(process.cwd(), 'claude-workspace')

function setCors(res: http.ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function sendJson(res: http.ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

/** 读取完整的请求体并解析为 JSON */
function readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')))
      } catch {
        resolve({})
      }
    })
    req.on('error', reject)
  })
}

export function startApiServer(port: number): http.Server {
  const server = http.createServer(async (req, res) => {
    setCors(res)

    // CORS 预检请求
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    const url = new URL(req.url ?? '/', `http://localhost:${port}`)
    const pathname = url.pathname
    const method = req.method

    try {
      // ── 消息 ─────────────────────────────────────

      // GET /api/users
      if (method === 'GET' && pathname === '/api/users') {
        sendJson(res, 200, getUsers())
        return
      }

      // GET /api/messages/:userId
      const msgGetMatch = pathname.match(/^\/api\/messages\/(.+)$/)
      if (method === 'GET' && msgGetMatch) {
        const userId = decodeURIComponent(msgGetMatch[1])
        const limit = parseInt(url.searchParams.get('limit') || '100')
        const offset = parseInt(url.searchParams.get('offset') || '0')
        sendJson(res, 200, getMessages(userId, limit, offset))
        return
      }

      // DELETE /api/messages/:userId
      const msgDeleteMatch = pathname.match(/^\/api\/messages\/(.+)$/)
      if (method === 'DELETE' && msgDeleteMatch) {
        const userId = decodeURIComponent(msgDeleteMatch[1])
        sendJson(res, 200, { deleted: deleteUserMessages(userId) })
        return
      }

      // ── 知识库 ──────────────────────────────────

      // GET /api/knowledge — list
      if (method === 'GET' && pathname === '/api/knowledge') {
        sendJson(res, 200, getKnowledgeList())
        return
      }

      // POST /api/knowledge — 上传（JSON body: { filename, data (base64) }）
      if (method === 'POST' && pathname === '/api/knowledge') {
        const body = await readBody(req)
        const filename = body.filename as string
        const data = body.data as string // base64 编码

        if (!filename || !data) {
          sendJson(res, 400, { error: 'Missing filename or data' })
          return
        }

        const buffer = Buffer.from(data, 'base64')
        const content = await parseFile(buffer, filename)
        const filetype = getFileType(filename)
        const id = insertKnowledge(filename, content, filetype, buffer.length)

        // 刷新 CLAUDE.md 并清除会话，让下次对话使用新知识
        const kbContent = getKnowledgeContent()
        writeFileSync(join(WORKSPACE, 'CLAUDE.md'), kbContent, 'utf-8')
        clearAllSessions()

        sendJson(res, 200, { id, filename, filetype, size: buffer.length })
        return
      }

      // DELETE /api/knowledge/:id
      const kbDeleteMatch = pathname.match(/^\/api\/knowledge\/(\d+)$/)
      if (method === 'DELETE' && kbDeleteMatch) {
        const id = parseInt(kbDeleteMatch[1])
        const deleted = deleteKnowledge(id)
        // 刷新 CLAUDE.md 并清除所有会话
        const content = getKnowledgeContent()
        writeFileSync(join(WORKSPACE, 'CLAUDE.md'), content, 'utf-8')
        clearAllSessions()
        sendJson(res, 200, { deleted })
        return
      }

      // ── 设置 ─────────────────────────────────────

      // GET /api/settings
      if (method === 'GET' && pathname === '/api/settings') {
        sendJson(res, 200, getSettingsSafe())
        return
      }

      // POST /api/settings
      if (method === 'POST' && pathname === '/api/settings') {
        const body = await readBody(req)
        updateSettings(body as any)
        sendJson(res, 200, getSettingsSafe())
        return
      }

      sendJson(res, 404, { error: 'Not found' })
    } catch (err: any) {
      console.error('[api] Error:', err.message)
      sendJson(res, 500, { error: err.message })
    }
  })

  server.listen(port, () => {
    console.log(`[api] Chat history API running on http://localhost:${port}`)
  })

  return server
}

/** 导出供 index.ts 使用 — 获取 Claude 的知识上下文 */
export { getKnowledgeContent }
