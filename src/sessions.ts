import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

const STORE_PATH = join(process.cwd(), 'data', 'sessions.json')

interface SessionStore {
  [userId: string]: string // userId → sessionId
}

let store: SessionStore = {}

/** 从磁盘加载会话映射 */
export function loadSessions() {
  if (existsSync(STORE_PATH)) {
    try {
      store = JSON.parse(readFileSync(STORE_PATH, 'utf-8'))
      console.log(`[sessions] Loaded ${Object.keys(store).length} sessions`)
    } catch {
      store = {}
    }
  }
}

/** 获取用户的会话 ID（无则返回 undefined） */
export function getSession(userId: string): string | undefined {
  return store[userId]
}

/** 保存用户的会话 ID 并持久化到磁盘 */
export function saveSession(userId: string, sessionId: string) {
  store[userId] = sessionId
  mkdirSync(dirname(STORE_PATH), { recursive: true })
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8')
}

/** 清除用户的会话 */
export function clearSession(userId: string) {
  delete store[userId]
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8')
}

/** 清除所有会话（如知识库变更时） */
export function clearAllSessions() {
  store = {}
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8')
}
