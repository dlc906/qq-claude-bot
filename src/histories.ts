import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

const STORE_PATH = join(process.cwd(), 'data', 'chat-histories.json')

interface HistoryStore {
  [key: string]: Array<{ role: string; content: string }>
}

let store: HistoryStore = {}

export function loadHistories() {
  if (existsSync(STORE_PATH)) {
    try {
      store = JSON.parse(readFileSync(STORE_PATH, 'utf-8'))
      console.log(`[histories] Loaded ${Object.keys(store).length} conversations`)
    } catch {
      store = {}
    }
  }
}

function flush() {
  mkdirSync(dirname(STORE_PATH), { recursive: true })
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8')
}

/** 获取指定 provider+用户 的对话历史 */
export function getHistory(key: string): Array<{ role: string; content: string }> {
  return store[key] || []
}

/** 追加一轮对话并持久化 */
export function appendHistory(key: string, userMsg: string, assistantMsg: string, maxTurns = 20) {
  if (!store[key]) store[key] = []
  store[key].push({ role: 'user', content: userMsg })
  store[key].push({ role: 'assistant', content: assistantMsg })
  // 只保留最近 N 轮（每轮 = 2 条消息）
  if (store[key].length > maxTurns * 2) {
    store[key] = store[key].slice(-(maxTurns * 2))
  }
  flush()
}

/** 清除指定 key 的历史 */
export function clearHistory(key: string) {
  delete store[key]
  flush()
}

/** 清除所有历史 */
export function clearAllHistories() {
  store = {}
  flush()
}
