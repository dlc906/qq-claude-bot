import { spawn } from 'child_process'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { config } from './config.js'
import { getSettings } from './settings.js'

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

// Per-user conversation history for OpenAI sessions
const chatHistories = new Map<string, ChatMessage[]>()

async function askOpenAI(
  prompt: string,
  sessionId?: string,
  knowledgeContext?: string
): Promise<LLMResult> {
  const settings = getSettings()
  const userId = sessionId || '__default__'

  // Build messages
  const messages: ChatMessage[] = []

  // System prompt with knowledge
  if (knowledgeContext) {
    messages.push({ role: 'system', content: `你是一个有帮助的AI助手。以下是参考知识库内容：\n\n${knowledgeContext}` })
  } else {
    messages.push({ role: 'system', content: '你是一个有帮助的AI助手。' })
  }

  // Load existing history if resuming
  if (sessionId && chatHistories.has(userId)) {
    messages.push(...chatHistories.get(userId)!)
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

  // Save history for this user
  const history = chatHistories.get(userId) || []
  history.push({ role: 'user', content: prompt })
  history.push({ role: 'assistant', content: reply })
  // Keep last 20 turns to avoid token overflow
  if (history.length > 40) history.splice(0, history.length - 40)
  chatHistories.set(userId, history)

  return { response: reply, sessionId: userId }
}

/** Clear OpenAI chat history for a user */
export function clearOpenAISession(userId: string) {
  chatHistories.delete(userId)
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
    } else {
      return await askClaudeCode(prompt, sessionId, knowledgeContext)
    }
  } finally {
    releaseSlot()
  }
}
