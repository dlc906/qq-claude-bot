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

/** Get conversation history for a provider+user combo */
export function getHistory(key: string): Array<{ role: string; content: string }> {
  return store[key] || []
}

/** Append a turn to history and persist */
export function appendHistory(key: string, userMsg: string, assistantMsg: string, maxTurns = 20) {
  if (!store[key]) store[key] = []
  store[key].push({ role: 'user', content: userMsg })
  store[key].push({ role: 'assistant', content: assistantMsg })
  // Keep last N turns (each turn = 2 messages)
  if (store[key].length > maxTurns * 2) {
    store[key] = store[key].slice(-(maxTurns * 2))
  }
  flush()
}

/** Clear history for a key */
export function clearHistory(key: string) {
  delete store[key]
  flush()
}

/** Clear all histories */
export function clearAllHistories() {
  store = {}
  flush()
}
