import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

const SETTINGS_PATH = join(process.cwd(), 'data', 'settings.json')

export interface Settings {
  llmProvider: 'claude-code' | 'openai' | 'anthropic'
  openaiApiKey: string
  openaiBaseUrl: string
  openaiModel: string
  anthropicApiKey: string
  anthropicBaseUrl: string
  anthropicModel: string
}

const defaults: Settings = {
  llmProvider: 'claude-code',
  openaiApiKey: '',
  openaiBaseUrl: 'https://api.openai.com/v1',
  openaiModel: 'gpt-4o',
  anthropicApiKey: '',
  anthropicBaseUrl: 'https://api.anthropic.com',
  anthropicModel: 'claude-sonnet-4-20250514',
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

/** 返回脱敏后的设置（API Key 只显示后4位） */
export function getSettingsSafe(): Settings {
  const s = { ...settings }
  if (s.openaiApiKey) {
    s.openaiApiKey = '****' + s.openaiApiKey.slice(-4)
  }
  if (s.anthropicApiKey) {
    s.anthropicApiKey = '****' + s.anthropicApiKey.slice(-4)
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
  if (partial.anthropicApiKey !== undefined && !partial.anthropicApiKey.startsWith('****')) {
    settings.anthropicApiKey = partial.anthropicApiKey
  }
  if (partial.anthropicBaseUrl !== undefined) settings.anthropicBaseUrl = partial.anthropicBaseUrl
  if (partial.anthropicModel !== undefined) settings.anthropicModel = partial.anthropicModel

  mkdirSync(dirname(SETTINGS_PATH), { recursive: true })
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8')
  console.log(`[settings] Updated, provider: ${settings.llmProvider}`)
}
