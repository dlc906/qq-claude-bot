import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

const STORE_PATH = join(process.cwd(), 'data', 'sessions.json')

interface SessionStore {
  [userId: string]: string // userId → sessionId
}

let store: SessionStore = {}

/** Load session map from disk */
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

/** Get stored session ID for a user (undefined if none) */
export function getSession(userId: string): string | undefined {
  return store[userId]
}

/** Save session ID for a user and persist to disk */
export function saveSession(userId: string, sessionId: string) {
  store[userId] = sessionId
  mkdirSync(dirname(STORE_PATH), { recursive: true })
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8')
}

/** Clear session for a user */
export function clearSession(userId: string) {
  delete store[userId]
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8')
}

/** Clear all sessions (e.g. after knowledge base change) */
export function clearAllSessions() {
  store = {}
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8')
}
