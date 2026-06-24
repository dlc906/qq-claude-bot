import { spawn } from 'child_process'
import { config } from './config.js'
import { writeFileSync } from 'fs'
import { join } from 'path'

// Track active calls for concurrency control
let activeCalls = 0
const waitQueue: (() => void)[] = []

function acquireSlot(): Promise<void> {
  return new Promise((resolve) => {
    if (activeCalls < config.maxConcurrent) {
      activeCalls++
      resolve()
    } else {
      waitQueue.push(() => {
        activeCalls++
        resolve()
      })
    }
  })
}

function releaseSlot() {
  activeCalls--
  if (waitQueue.length > 0) {
    const next = waitQueue.shift()!
    next()
  }
}

export interface ClaudeResult {
  response: string
  sessionId: string | null
}

const CLAUDE_MD = join(process.cwd(), 'CLAUDE.md')

/**
 * Call Claude Code CLI in non-interactive mode
 * Knowledge is injected via CLAUDE.md which Claude Code auto-reads
 */
export async function askClaude(
  prompt: string,
  sessionId?: string,
  knowledgeContext?: string
): Promise<ClaudeResult> {
  await acquireSlot()

  console.log(`[claude] prompt length: ${prompt.length}, has knowledge: ${!!knowledgeContext}, has session: ${!!sessionId}`)

  // Write knowledge to CLAUDE.md — Claude Code auto-reads this file
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

  if (sessionId) {
    args.push('--resume', sessionId)
  }

  return new Promise<ClaudeResult>((resolve, reject) => {
    const proc = spawn(config.claudePath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
      timeout: config.claudeTimeout,
      shell: true,
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString()
    })

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      releaseSlot()

      if (code === 0) {
        try {
          const json = JSON.parse(stdout.trim())
          resolve({
            response: json.result || '',
            sessionId: json.session_id || null,
          })
        } catch {
          resolve({ response: stdout.trim(), sessionId: null })
        }
      } else {
        console.error(`[claude] Exit code ${code}: ${stderr}`)
        reject(new Error(stderr || `Claude exited with code ${code}`))
      }
    })

    proc.on('error', (err) => {
      releaseSlot()
      reject(err)
    })
  })
}
