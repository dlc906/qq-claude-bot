import { spawn } from 'child_process'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { config } from './config.js'
import { getSettings } from './settings.js'
import { clearSession } from './sessions.js'
import { getHistory, appendHistory } from './histories.js'
import { getKnowledgeContent, searchKnowledge } from './db.js'

// ── 并发控制 ─────────────────────────────────────────

let activeCalls = 0
const waitQueue: (() => void)[] = []

function acquireSlot(): Promise<void> {
  return new Promise((resolve) => {
    if (activeCalls < config.maxConcurrent) {
      activeCalls++
      resolve()
    } else {
      waitQueue.push(() => { activeCalls++; resolve() })
    }
  })
}

function releaseSlot() {
  activeCalls--
  if (waitQueue.length > 0) waitQueue.shift!()
}

// ── 类型定义 ─────────────────────────────────────────

export interface LLMResult {
  response: string
  sessionId: string | null
}

// ── Claude Code CLI ───────────────────────────────────

const WORKSPACE = join(process.cwd(), 'claude-workspace')
const CLAUDE_MD = join(WORKSPACE, 'CLAUDE.md')

async function askClaudeCode(
  prompt: string,
  sessionId?: string,
  knowledgeContext?: string
): Promise<LLMResult> {
  if (knowledgeContext) {
    writeFileSync(CLAUDE_MD, knowledgeContext, 'utf-8')
  } else {
    writeFileSync(CLAUDE_MD, '', 'utf-8')
  }

  // 先尝试带 session，失败后去掉 session 重试
  try {
    return await callClaudeCLI(prompt, sessionId, knowledgeContext)
  } catch (err: any) {
    if (sessionId && err.message?.includes('No conversation found')) {
      console.log(`[claude] Session ${sessionId} not found, retrying without session`)
      clearSession(sessionId)
      return await callClaudeCLI(prompt, undefined, knowledgeContext)
    }
    throw err
  }
}

function callClaudeCLI(
  prompt: string,
  sessionId?: string,
  knowledgeContext?: string
): Promise<LLMResult> {
  const args = [
    '-p', prompt,
    '--output-format', 'json',
    '--allow-dangerously-skip-permissions',
    '--dangerously-skip-permissions',
  ]
  if (sessionId) args.push('--resume', sessionId)

  return new Promise<LLMResult>((resolve, reject) => {
    const proc = spawn(config.claudePath, args, {
      cwd: WORKSPACE,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
      timeout: config.claudeTimeout,
      shell: true,
    })

    let stdout = '', stderr = ''
    proc.stdout.on('data', (d: Buffer) => stdout += d.toString())
    proc.stderr.on('data', (d: Buffer) => stderr += d.toString())

    proc.on('close', (code) => {
      if (code === 0) {
        try {
          const json = JSON.parse(stdout.trim())
          resolve({ response: json.result || '', sessionId: json.session_id || null })
        } catch {
          resolve({ response: stdout.trim(), sessionId: null })
        }
      } else {
        reject(new Error(stderr || `Claude exited with code ${code}`))
      }
    })
    proc.on('error', reject)
  })
}

// ── 系统提示词构建 ───────────────────────────────────

function buildSystemPrompt(knowledgeContext?: string): string {
  if (!knowledgeContext) return '你是一个有帮助的AI助手。'
  return `你是一个有帮助的AI助手。请参考以下知识库内容回答问题。回答时使用自然的格式，不要滥用标题符号，适当使用列表和段落让内容更易读。\n\n<知识库>\n${knowledgeContext}\n</知识库>`
}

// ── OpenAI 兼容 API ──────────────────────────────────

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

async function askOpenAI(
  prompt: string,
  sessionId?: string,
  knowledgeContext?: string
): Promise<LLMResult> {
  const settings = getSettings()
  const userId = sessionId || '__default__'
  const historyKey = `openai:${userId}`

  const messages: ChatMessage[] = [{ role: 'system', content: buildSystemPrompt(knowledgeContext) }]

  // 加载持久化的对话历史
  const history = getHistory(historyKey)
  if (history.length > 0) {
    messages.push(...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })))
  }

  messages.push({ role: 'user', content: prompt })

  const res = await fetch(`${settings.openaiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: settings.openaiModel,
      messages,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`OpenAI API error ${res.status}: ${body}`)
  }

  const data = await res.json() as any
  const reply = data.choices?.[0]?.message?.content || ''

  // 持久化对话历史
  appendHistory(historyKey, prompt, reply)

  return { response: reply, sessionId: userId }
}

// ── Anthropic API ──────────────────────────────────────

interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string
}

async function askAnthropic(
  prompt: string,
  sessionId?: string,
  knowledgeContext?: string
): Promise<LLMResult> {
  const settings = getSettings()
  const userId = sessionId || '__default__'
  const historyKey = `anthropic:${userId}`

  const systemPrompt = buildSystemPrompt(knowledgeContext)

  const messages: AnthropicMessage[] = []

  // 加载持久化的对话历史
  const history = getHistory(historyKey)
  if (history.length > 0) {
    messages.push(...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })))
  }

  messages.push({ role: 'user', content: prompt })

  const res = await fetch(`${settings.anthropicBaseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': settings.anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: settings.anthropicModel,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Anthropic API error ${res.status}: ${body}`)
  }

  const data = await res.json() as any
  const reply = data.content?.[0]?.text || ''

  // 持久化对话历史
  appendHistory(historyKey, prompt, reply)

  return { response: reply, sessionId: userId }
}

// ── 统一入口 ─────────────────────────────────────────

export async function askLLM(
  prompt: string,
  sessionId?: string,
  knowledgeContext?: string
): Promise<LLMResult> {
  await acquireSlot()
  try {
    const settings = getSettings()
    console.log(`[llm] provider: ${settings.llmProvider}, prompt length: ${prompt.length}`)

    // 各 provider 自行处理知识注入
    const knowledge = settings.llmProvider === 'claude-code'
      ? getKnowledgeContent()
      : searchKnowledge(prompt)

    if (settings.llmProvider === 'openai') {
      return await askOpenAI(prompt, sessionId, knowledge)
    } else if (settings.llmProvider === 'anthropic') {
      return await askAnthropic(prompt, sessionId, knowledge)
    } else {
      return await askClaudeCode(prompt, sessionId, knowledge)
    }
  } finally {
    releaseSlot()
  }
}
