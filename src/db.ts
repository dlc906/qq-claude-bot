import initSqlJs, { Database as SqlJsDatabase } from 'sql.js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

const DB_PATH = join(process.cwd(), 'data', 'chat.db')

let db: SqlJsDatabase

export interface MessageRow {
  id: number
  user_id: string
  nickname: string
  content: string
  role: 'user' | 'assistant'
  timestamp: number
  session_id: string
}

export interface UserRow {
  user_id: string
  nickname: string
  last_message: string
  last_timestamp: number
  message_count: number
}

export interface KnowledgeRow {
  id: number
  filename: string
  content: string
  filetype: string
  size: number
  created_at: number
}

/** 初始化 SQLite 数据库（异步，因为 sql.js 加载 WASM） */
export async function initDb(): Promise<void> {
  const SQL = await initSqlJs()

  mkdirSync(dirname(DB_PATH), { recursive: true })

  if (existsSync(DB_PATH)) {
    const buf = readFileSync(DB_PATH)
    db = new SQL.Database(buf)
  } else {
    db = new SQL.Database()
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT    NOT NULL,
      nickname    TEXT    NOT NULL DEFAULT '',
      content     TEXT    NOT NULL,
      role        TEXT    NOT NULL CHECK(role IN ('user', 'assistant')),
      timestamp   INTEGER NOT NULL DEFAULT (unixepoch()),
      session_id  TEXT    NOT NULL DEFAULT ''
    )
  `)
  db.run('CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id)')
  db.run('CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)')

  db.run(`
    CREATE TABLE IF NOT EXISTS knowledge (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      filename   TEXT    NOT NULL,
      content    TEXT    NOT NULL,
      filetype   TEXT    NOT NULL DEFAULT '',
      size       INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)

  console.log('[db] SQLite initialized')
}

/** 将数据库持久化到磁盘 */
function flush() {
  const data = db.export()
  writeFileSync(DB_PATH, Buffer.from(data))
}

/** 插入一条消息 */
export function insertMessage(
  userId: string,
  nickname: string,
  content: string,
  role: 'user' | 'assistant',
  sessionId: string = ''
) {
  db.run(
    'INSERT INTO messages (user_id, nickname, content, role, timestamp, session_id) VALUES (?, ?, ?, ?, unixepoch(), ?)',
    [userId, nickname, content, role, sessionId]
  )
  flush()
}

/** 获取所有用户及最后一条消息预览 */
export function getUsers(): UserRow[] {
  const rows = db.exec(`
    SELECT
      m.user_id,
      m.nickname,
      m.content AS last_message,
      m.timestamp AS last_timestamp,
      sub.cnt AS message_count
    FROM messages m
    INNER JOIN (
      SELECT user_id, MAX(timestamp) AS max_ts, COUNT(*) AS cnt
      FROM messages
      GROUP BY user_id
    ) sub ON m.user_id = sub.user_id AND m.timestamp = sub.max_ts
    ORDER BY m.timestamp DESC
  `)

  if (rows.length === 0) return []

  return rows[0].values.map((row) => ({
    user_id: row[0] as string,
    nickname: row[1] as string,
    last_message: row[2] as string,
    last_timestamp: row[3] as number,
    message_count: row[4] as number,
  }))
}

/** 获取某用户的消息（按时间正序） */
export function getMessages(userId: string, limit = 100, offset = 0): MessageRow[] {
  const stmt = db.prepare(
    'SELECT * FROM messages WHERE user_id = ? ORDER BY timestamp ASC LIMIT ? OFFSET ?'
  )
  stmt.bind([userId, limit, offset])

  const results: MessageRow[] = []
  while (stmt.step()) {
    const row = stmt.getAsObject()
    results.push({
      id: row.id as number,
      user_id: row.user_id as string,
      nickname: row.nickname as string,
      content: row.content as string,
      role: row.role as 'user' | 'assistant',
      timestamp: row.timestamp as number,
      session_id: row.session_id as string,
    })
  }
  stmt.free()
  return results
}

/** 删除某用户的所有消息 */
export function deleteUserMessages(userId: string): number {
  db.run('DELETE FROM messages WHERE user_id = ?', [userId])
  flush()

  const rows = db.exec('SELECT changes()')
  return rows.length > 0 ? (rows[0].values[0][0] as number) : 0
}

// ── 知识库 ──────────────────────────────────────────

/** 插入知识库文档 */
export function insertKnowledge(filename: string, content: string, filetype: string, size: number): number {
  db.run(
    'INSERT INTO knowledge (filename, content, filetype, size, created_at) VALUES (?, ?, ?, ?, unixepoch())',
    [filename, content, filetype, size]
  )
  flush()

  const rows = db.exec('SELECT last_insert_rowid()')
  return rows.length > 0 ? (rows[0].values[0][0] as number) : 0
}

/** 列出所有知识库文档（不含正文内容） */
export function getKnowledgeList(): Omit<KnowledgeRow, 'content'>[] {
  const rows = db.exec('SELECT id, filename, filetype, size, created_at FROM knowledge ORDER BY created_at DESC')
  if (rows.length === 0) return []

  return rows[0].values.map((row) => ({
    id: row[0] as number,
    filename: row[1] as string,
    filetype: row[2] as string,
    size: row[3] as number,
    created_at: row[4] as number,
  }))
}

/** 获取全部知识库内容（用于 Claude 上下文注入） */
export function getKnowledgeContent(): string {
  const rows = db.exec('SELECT filename, content FROM knowledge ORDER BY created_at ASC')
  if (rows.length === 0) return ''

  return rows[0].values
    .map((row) => `[文档: ${row[0]}]\n${row[1]}`)
    .join('\n\n')
}

/** 按关键词搜索知识库 — 返回匹配的文档片段 */
export function searchKnowledge(query: string, maxChars = 3000): string {
  // 中文提取 2-4 字 n-gram 作为关键词，英文按空格分词
  const words: string[] = []

  // 提取中文字符和英文单词
  const chineseChars = query.match(/[一-鿿]+/g) || []
  const englishWords = query.match(/[a-zA-Z0-9]{2,}/g) || []

  // 从中文片段生成 n-gram（2字和3字）
  for (const seg of chineseChars) {
    if (seg.length <= 4) {
      words.push(seg) // 短片段直接使用
    } else {
      for (let i = 0; i <= seg.length - 2; i++) {
        words.push(seg.slice(i, i + 2))
      }
      for (let i = 0; i <= seg.length - 3; i++) {
        words.push(seg.slice(i, i + 3))
      }
    }
  }

  words.push(...englishWords)

  // 去重并限制数量
  const unique = [...new Set(words)].slice(0, 15)

  console.log(`[kb] search keywords:`, unique)

  if (unique.length === 0) {
    const list = getKnowledgeList()
    if (list.length === 0) return ''
    return `[知识库文档: ${list.map(d => d.filename).join(', ')}]`
  }

  // 构造 WHERE 子句 — 匹配任意关键词
  const conditions = unique.map(() => 'content LIKE ?').join(' OR ')
  const params = unique.map(w => `%${w}%`)

  const stmt = db.prepare(
    `SELECT filename, content FROM knowledge WHERE ${conditions} ORDER BY created_at ASC`
  )
  stmt.bind(params)

  const results: string[] = []
  let totalChars = 0

  while (stmt.step()) {
    const row = stmt.getAsObject()
    const filename = row.filename as string
    const content = row.content as string

    // 查找最佳匹配位置
    let bestPos = 0
    const contentLower = content.toLowerCase()
    for (const word of unique) {
      const pos = contentLower.indexOf(word.toLowerCase())
      if (pos >= 0) { bestPos = pos; break }
    }

    const start = Math.max(0, bestPos - 200)
    const end = Math.min(content.length, bestPos + 1500)
    const snippet = (start > 0 ? '...' : '') + content.slice(start, end) + (end < content.length ? '...' : '')

    const entry = `[文档: ${filename}]\n${snippet}`
    totalChars += entry.length

    if (totalChars > maxChars) break
    results.push(entry)
  }
  stmt.free()

  console.log(`[kb] found ${results.length} matching docs, total ${totalChars} chars`)

  // 无匹配时降级为全量知识库内容
  if (results.length === 0) {
    return getKnowledgeContent()
  }

  return results.join('\n\n')
}

/** 删除知识库文档 */
export function deleteKnowledge(id: number): number {
  db.run('DELETE FROM knowledge WHERE id = ?', [id])
  flush()

  const rows = db.exec('SELECT changes()')
  return rows.length > 0 ? (rows[0].values[0][0] as number) : 0
}

/** 关闭数据库 */
export function closeDb() {
  if (db) {
    flush()
    db.close()
    console.log('[db] SQLite closed')
  }
}
