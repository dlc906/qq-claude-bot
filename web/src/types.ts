export interface UserRow {
  user_id: string
  nickname: string
  last_message: string
  last_timestamp: number
  message_count: number
}

export interface MessageRow {
  id: number
  user_id: string
  nickname: string
  content: string
  role: 'user' | 'assistant'
  timestamp: number
  session_id: string
}

export interface KnowledgeRow {
  id: number
  filename: string
  filetype: string
  size: number
  created_at: number
}

export interface Settings {
  llmProvider: 'claude-code' | 'openai'
  openaiApiKey: string
  openaiBaseUrl: string
  openaiModel: string
}
