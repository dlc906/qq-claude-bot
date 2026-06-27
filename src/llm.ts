import { spawn } from 'child_process'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { config } from './config.js'
import { getSettings } from './settings.js'
import { clearSession } from './sessions.js'
import { getHistory, appendHistory } from './histories.js'

// ── Concurrency control ───────────────────────────────

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

// ── Types ─────────────────────────────────────────────

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

  // Try with session first, retry without if session not found
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

// ── OpenAI Compatible API ─────────────────────────────

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

  const messages: ChatMessage[] = []

  if (knowledgeContext) {
    messages.push({ role: 'system', content: `你是一个有帮助的AI助手。以下是参考知识库内容：\n\n${knowledgeContext}` })
  } else {
    messages.push({ role: 'system', content: '你是一个有帮助的AI助手。' })
  }

  // Load persisted history
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

  // Persist history
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

  const systemPrompt = knowledgeContext
    ? `你是一个有帮助的AI助手。以下是参考知识库内容：\n\n${knowledgeContext}`
    : '你是一个有帮助的AI助手。'

  const messages: AnthropicMessage[] = []

  // Load persisted history
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

  // Persist history
  appendHistory(historyKey, prompt, reply)

  return { response: reply, sessionId: userId }
}

// ── Unified entry point ───────────────────────────────

export async function askLLM(
  prompt: string,
  sessionId?: string,
  knowledgeContext?: string
): Promise<LLMResult> {
  await acquireSlot()
  try {
    const settings = getSettings()
    console.log(`[llm] provider: ${settings.llmProvider}, prompt length: ${prompt.length}`)

    if (settings.llmProvider === 'openai') {
      return await askOpenAI(prompt, sessionId, knowledgeContext)
    } else if (settings.llmProvider === 'anthropic') {
      return await askAnthropic(prompt, sessionId, knowledgeContext)
    } else {
      return await askClaudeCode(prompt, sessionId, knowledgeContext)
    }
  } finally {
    releaseSlot()
  }
}
