import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

const SETTINGS_PATH = join(process.cwd(), 'data', 'settings.json')

export interface Settings {
  llmProvider: 'claude-code' | 'openai'
  openaiApiKey: string
  openaiBaseUrl: string
  openaiModel: string
}

const defaults: Settings = {
  llmProvider: 'claude-code',
  openaiApiKey: '',
  openaiBaseUrl: 'https://api.openai.com/v1',
  openaiModel: 'gpt-4o',
}

let settings: Settings = { ...defaults }

export function loadSettings() {
  if (existsSync(SETTINGS_PATH)) {
    try {
      const saved = JSON.parse(readFileSync(SETTINGS_PATH, 'utf-8'))
      settings = { ...defaults, ...saved }
      console.log(`[settings] Loaded, provider: ${settings.llmProvider}`)
    } catch {
      settings = { ...defaults }
    }
  }
}

export function getSettings(): Settings {
  return { ...settings }
}

/** Return settings with API key masked */
export function getSettingsSafe(): Settings & { openaiApiKey: string } {
  const s = { ...settings }
  if (s.openaiApiKey) {
    const key = s.openaiApiKey
    s.openaiApiKey = '****' + key.slice(-4)
  }
  return s
}

export function updateSettings(partial: Partial<Settings>) {
  if (partial.llmProvider !== undefined) settings.llmProvider = partial.llmProvider
  if (partial.openaiApiKey !== undefined && !partial.openaiApiKey.startsWith('****')) {
    settings.openaiApiKey = partial.openaiApiKey
  }
  if (partial.openaiBaseUrl !== undefined) settings.openaiBaseUrl = partial.openaiBaseUrl
  if (partial.openaiModel !== undefined) settings.openaiModel = partial.openaiModel

  mkdirSync(dirname(SETTINGS_PATH), { recursive: true })
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8')
  console.log(`[settings] Updated, provider: ${settings.llmProvider}`)
}
