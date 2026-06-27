import { readFileSync, mkdirSync, writeFileSync, unlinkSync } from 'fs'
import { execSync } from 'child_process'
import { join } from 'path'
import { tmpdir } from 'os'
import { config, validateConfig } from './config.js'
import { askLLM } from './llm.js'
import { loadSessions, getSession, saveSession, clearSession } from './sessions.js'
import { initDb, closeDb, insertMessage, searchKnowledge } from './db.js'
import { startApiServer, getKnowledgeContent } from './api.js'
import { loadSettings, getSettings } from './settings.js'
import { loadHistories, clearHistory } from './histories.js'
import { createOpenAPI, createWebsocket, AvailableIntentsEventsEnum } from 'qq-bot-sdk'

const client = createOpenAPI({
  appID: config.appId,
  token: '',
  secret: config.appSecret,
})

const ws: any = createWebsocket({
  appID: config.appId,
  token: '',
  secret: config.appSecret,
  intents: [AvailableIntentsEventsEnum.GROUP_AND_C2C_EVENT],
})

// ── Message handler ──────────────────────────────────

let msgSeq = 0

async function handleMessage(data: any) {
  const msg = data.msg
  if (!msg) return

  const userId = msg.author?.user_openid || msg.author?.id || 'unknown'
  const content = (msg.content || '').trim()
  const msgId = msg.id

  // Log incoming message
  const hasImage = msg.attachments?.length > 0 || msg.media
  console.log(`[msg] ${userId}: ${content || '(no text)'} ${hasImage ? '[has image]' : ''}`)
  insertMessage(userId, msg.author?.nickname || '', content, 'user')

  // Special commands
  if (content === '/clear') {
    clearSession(userId)
    const provider = getSettings().llmProvider
    if (provider !== 'claude-code') {
      clearHistory(`${provider}:${userId}`)
    }
    await sendText(msg, 'Session cleared.')
    return
  }

  // Screenshot command — handled by bot directly, not Claude
  if (content === '/screenshot' || content === '/截屏' || content.includes('截屏') || content.includes('截图') || content.includes('screenshot')) {
    await sendText(msg, '📸 截屏中...').catch(() => null)
    try {
      const screenPath = await takeScreenshot()
      await sendImage(msg, screenPath)
    } catch (err: any) {
      console.error('[screenshot] Error:', err.message)
      await sendText(msg, `截屏失败: ${err.message}`)
    }
    return
  }

  // Build prompt with image info
  let prompt = content
  if (hasImage) {
    const imageUrls = (msg.attachments || []).map((a: any) => a.url || a.proxy_url).filter(Boolean)
    if (imageUrls.length > 0) {
      prompt = `${content}\n\n[用户发送了图片: ${imageUrls.join(', ')}]`
    }
  }

  if (!prompt) return

  // Show thinking indicator
  await sendText(msg, '🤔 思考中...').catch(() => null)

  try {
    const existingSession = getSession(userId)
    // Claude Code reads CLAUDE.md directly; OpenAI/Anthropic get relevant snippets only
    const provider = getSettings().llmProvider
    const knowledge = provider === 'claude-code'
      ? getKnowledgeContent()
      : searchKnowledge(prompt)
    const result = await askLLM(prompt, existingSession ?? undefined, knowledge || undefined)

    // Persist session for next call
    if (result.sessionId) {
      saveSession(userId, result.sessionId)
    }

    const response = result.response
    console.log(`[msg] Claude replied: ${response.slice(0, 100)}...`)
    insertMessage(userId, '', response.slice(0, 5000), 'assistant', result.sessionId ?? '')

    // Check if response contains image paths (from Claude Code screenshots)
    const imagePaths = extractImagePaths(response)

    if (imagePaths.length > 0) {
      // Send images + text
      for (const imgPath of imagePaths) {
        await sendImage(msg, imgPath).catch((err: any) => {
          console.error(`[img] Failed to send ${imgPath}:`, err.message || err)
        })
      }
      // Send remaining text (without image paths)
      const textOnly = removeImagePaths(response).trim()
      if (textOnly) await sendText(msg, textOnly.slice(0, 2000))
    } else {
      await sendText(msg, response.slice(0, 2000))
    }
  } catch (err: any) {
    if (err.data) {
      console.error(`[msg] API Error:`, JSON.stringify(err.data))
    } else {
      console.error(`[msg] Error:`, err.message || err)
    }
    await sendText(msg, '处理出错，请稍后再试')
  }
}

// ── Screenshot ───────────────────────────────────────

const SCREENSHOT_DIR = join(tmpdir(), 'claude-qq-screenshots')

async function takeScreenshot(): Promise<string> {
  mkdirSync(SCREENSHOT_DIR, { recursive: true })

  const filename = `screen_${Date.now()}.png`
  const filepath = join(SCREENSHOT_DIR, filename)
  const forwardPath = filepath.replace(/\\/g, '/')

  // Write PS1 script to temp file (avoids escaping issues)
  const scriptPath = join(SCREENSHOT_DIR, '_capture.ps1')
  const psScript = [
    'Add-Type -AssemblyName System.Windows.Forms',
    'Add-Type -AssemblyName System.Drawing',
    '$screen = [System.Windows.Forms.Screen]::PrimaryScreen',
    '$bitmap = New-Object System.Drawing.Bitmap($screen.Bounds.Width, $screen.Bounds.Height)',
    '$graphics = [System.Drawing.Graphics]::FromImage($bitmap)',
    '$graphics.CopyFromScreen($screen.Bounds.Location, [System.Drawing.Point]::Empty, $screen.Bounds.Size)',
    `$bitmap.Save('${forwardPath}')`,
    '$graphics.Dispose()',
    '$bitmap.Dispose()',
  ].join('\n')

  writeFileSync(scriptPath, psScript, 'utf-8')
  console.log(`[screenshot] Script: ${scriptPath}`)
  console.log(`[screenshot] Saving to: ${forwardPath}`)

  try {
    const output = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`, {
      timeout: 10000,
      windowsHide: true,
      encoding: 'utf-8',
    })
    console.log(`[screenshot] PS output: ${output}`)
    console.log(`[screenshot] Saved: ${filepath}`)
    return filepath
  } catch (err: any) {
    console.error(`[screenshot] PS stderr: ${err.stderr}`)
    console.error(`[screenshot] PS stdout: ${err.stdout}`)
    throw err
  } finally {
    // Cleanup script file
    try { unlinkSync(scriptPath) } catch {}
  }
}

// ── Send text ────────────────────────────────────────

async function sendText(msg: any, content: string): Promise<any> {
  const userId = msg.author?.user_openid
  msgSeq++
  const body = { content, msg_type: 0, msg_seq: msgSeq }

  if (msg.group_id) {
    return client.groupApi.postMessage(msg.group_id, { ...body, msg_id: msg.id })
  } else if (userId) {
    return client.c2cApi.postMessage(userId, { ...body, msg_id: msg.id })
  }
}

// ── Send image (upload → send) ───────────────────────

async function sendImage(msg: any, filePath: string): Promise<any> {
  const userId = msg.author?.user_openid
  msgSeq++

  // Read file and convert to base64
  const fileBuffer = readFileSync(filePath)
  const base64Data = fileBuffer.toString('base64')

  console.log(`[img] Uploading ${filePath} (${fileBuffer.length} bytes)`)

  // Step 1: Upload file → get file_info
  let fileRes: any
  if (msg.group_id) {
    fileRes = await client.groupApi.postFile(msg.group_id, {
      file_type: 1, // image
      file_data: base64Data,
      srv_send_msg: false, // don't send yet, just get file_info
    })
  } else if (userId) {
    fileRes = await client.c2cApi.postFile(userId, {
      file_type: 1,
      file_data: base64Data,
      srv_send_msg: false,
    })
  }

  if (!fileRes?.data?.file_info) {
    throw new Error('Upload failed, no file_info returned')
  }

  console.log(`[img] Uploaded, file_info: ${fileRes.data.file_info.slice(0, 50)}...`)

  // Step 2: Send rich media message
  const sendBody = {
    msg_type: 7, // rich media
    media: { file_info: fileRes.data.file_info },
    msg_id: msg.id,
    msg_seq: msgSeq,
  }

  if (msg.group_id) {
    return client.groupApi.postMessage(msg.group_id, sendBody)
  } else if (userId) {
    return client.c2cApi.postMessage(userId, sendBody)
  }
}

// ── Send image from URL ──────────────────────────────

async function sendImageFromUrl(msg: any, url: string): Promise<any> {
  const userId = msg.author?.user_openid
  msgSeq++

  console.log(`[img] Uploading from URL: ${url}`)

  let fileRes: any
  if (msg.group_id) {
    fileRes = await client.groupApi.postFile(msg.group_id, {
      file_type: 1,
      url,
      srv_send_msg: false,
    })
  } else if (userId) {
    fileRes = await client.c2cApi.postFile(userId, {
      file_type: 1,
      url,
      srv_send_msg: false,
    })
  }

  if (!fileRes?.data?.file_info) {
    throw new Error('Upload failed')
  }

  const sendBody = {
    msg_type: 7,
    media: { file_info: fileRes.data.file_info },
    msg_id: msg.id,
    msg_seq: msgSeq,
  }

  if (msg.group_id) {
    return client.groupApi.postMessage(msg.group_id, sendBody)
  } else if (userId) {
    return client.c2cApi.postMessage(userId, sendBody)
  }
}

// ── Image path detection ─────────────────────────────

// Match common image file paths in Claude's response
const IMAGE_PATH_PATTERN = /(?:^|\s)([^\s"'`]+\.(?:png|jpg|jpeg|gif|webp|bmp))(?:\s|$|["'`])/gi

function extractImagePaths(text: string): string[] {
  const paths: string[] = []
  let match
  while ((match = IMAGE_PATH_PATTERN.exec(text)) !== null) {
    const p = match[1]
    // Filter out obvious non-paths (URLs, node_modules, etc.)
    if (p.startsWith('http') || p.includes('node_modules')) continue
    paths.push(p)
  }
  return paths
}

function removeImagePaths(text: string): string {
  return text.replace(IMAGE_PATH_PATTERN, ' ')
}

// ── Events ───────────────────────────────────────────

ws.on(AvailableIntentsEventsEnum.GROUP_AND_C2C_EVENT, (data: any) => {
  console.log(`[ws] EVENT:`, JSON.stringify(data).slice(0, 300))
  handleMessage(data).catch((err) => {
    console.error('[ws] Handler error:', err)
  })
})

ws.on('READY', () => console.log('[ws] Bot ready!'))
ws.on('INVALID_SESSION', () => console.error('[ws] Invalid session'))
ws.on('RECONNECT', () => console.log('[ws] Reconnecting...'))
ws.on('CLOSED', () => console.error('[ws] Connection closed'))

// ── Start ────────────────────────────────────────────

validateConfig()
loadSettings()
loadHistories()
loadSessions()
await initDb()
startApiServer(config.apiPort)
console.log('=== Claude Code × QQ Bot ===')
console.log(`Sandbox: ${config.sandbox}`)
console.log('Connecting...')

process.on('SIGINT', () => {
  console.log('\nShutting down...')
  closeDb()
  process.exit(0)
})
