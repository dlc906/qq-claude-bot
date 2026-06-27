import 'dotenv/config'

export const config = {
  // QQ 机器人
  appId: process.env.QQ_APP_ID || '',
  appSecret: process.env.QQ_APP_SECRET || '',
  sandbox: process.env.QQ_SANDBOX === 'true',

  // Claude Code CLI
  claudePath: process.env.CLAUDE_PATH || 'claude',
  maxConcurrent: parseInt(process.env.MAX_CONCURRENT || '3'),
  claudeTimeout: parseInt(process.env.CLAUDE_TIMEOUT || '120') * 1000,

  // API 服务
  apiPort: parseInt(process.env.API_PORT || '3800'),
} as const

export function validateConfig() {
  const missing: string[] = []
  if (!config.appId) missing.push('QQ_APP_ID')
  if (!config.appSecret) missing.push('QQ_APP_SECRET')

  if (missing.length > 0) {
    console.error(`[config] Missing: ${missing.join(', ')}`)
    console.error('[config] Copy .env.example -> .env and fill in values')
    process.exit(1)
  }
}
