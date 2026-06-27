import { readFileSync, mkdirSync, writeFileSync, unlinkSync } from 'fs'
import { execSync } from 'child_process'
import { join } from 'path'
import { tmpdir } from 'os'
import { config, validateConfig } from './config.js'
import { askLLM } from './llm.js'
import { loadSessions, getSession, saveSession, clearSession } from './sessions.js'
import { initDb, closeDb, insertMessage } from './db.js'
import { startApiServer } from './api.js'
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

// ── 消息处理 ─────────────────────────────────────────

let msgSeq = 0

async function handleMessage(data: any) {
  const msg = data.msg
  if (!msg) return

  const userId = msg.author?.user_openid || msg.author?.id || 'unknown'
  const content = (msg.content || '').trim()
  const msgId = msg.id

  // 记录收到的消息
  const hasImage = msg.attachments?.length > 0 || msg.media
  console.log(`[msg] ${userId}: ${content || '(no text)'} ${hasImage ? '[has image]' : ''}`)
  insertMessage(userId, msg.author?.nickname || '', content, 'user')

  // 特殊命令
  if (content === '/clear') {
    clearSession(userId)
    const provider = getSettings().llmProvider
    if (provider !== 'claude-code') {
      clearHistory(`${provider}:${userId}`)
    }
    await sendText(msg, 'Session cleared.')
    return
  }

  // 截屏命令 — 由机器人直接处理，不转发给 Claude
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

  // 构造包含图片信息的提示词
  let prompt = content
  if (hasImage) {
    const imageUrls = (msg.attachments || []).map((a: any) => a.url || a.proxy_url).filter(Boolean)
    if (imageUrls.length > 0) {
      prompt = `${content}\n\n[用户发送了图片: ${imageUrls.join(', ')}]`
    }
  }

  if (!prompt) return

  // 显示思考中提示
  await sendText(msg, '🤔 思考中...').catch(() => null)

  try {
    const existingSession = getSession(userId)
    const result = await askLLM(prompt, existingSession ?? undefined)

    // 持久化会话 ID 供下次使用
    if (result.sessionId) {
      saveSession(userId, result.sessionId)
    }

    const response = result.response
    console.log(`[msg] Claude replied: ${response.slice(0, 100)}...`)
    insertMessage(userId, '', response.slice(0, 5000), 'assistant', result.sessionId ?? '')

    // 检查回复中是否包含图片路径（来自 Claude Code 截屏）
    const imagePaths = extractImagePaths(response)

    if (imagePaths.length > 0) {
      // 发送图片 + 文字
      for (const imgPath of imagePaths) {
        await sendImage(msg, imgPath).catch((err: any) => {
          console.error(`[img] Failed to send ${imgPath}:`, err.message || err)
        })
      }
      // 发送剩余文字（去掉图片路径）
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

// ── 截屏功能 ─────────────────────────────────────────

const SCREENSHOT_DIR = join(tmpdir(), 'claude-qq-screenshots')

async function takeScreenshot(): Promise<string> {
  mkdirSync(SCREENSHOT_DIR, { recursive: true })

  const filename = `screen_${Date.now()}.png`
  const filepath = join(SCREENSHOT_DIR, filename)
  const forwardPath = filepath.replace(/\\/g, '/')

  // 写 PS1 脚本到临时文件（避免转义问题）
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
    // 清理脚本文件
    try { unlinkSync(scriptPath) } catch {}
  }
}

// ── 发送文字 ─────────────────────────────────────────

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

// ── 发送图片（上传 → 发送） ─────────────────────────

async function sendImage(msg: any, filePath: string): Promise<any> {
  const userId = msg.author?.user_openid
  msgSeq++

  // 读取文件并转为 base64
  const fileBuffer = readFileSync(filePath)
  const base64Data = fileBuffer.toString('base64')

  console.log(`[img] Uploading ${filePath} (${fileBuffer.length} bytes)`)

  // 第一步：上传文件 → 获取 file_info
  let fileRes: any
  if (msg.group_id) {
    fileRes = await client.groupApi.postFile(msg.group_id, {
      file_type: 1, // image
      file_data: base64Data,
      srv_send_msg: false, // 不立即发送，只获取 file_info
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

  // 第二步：发送富媒体消息
  const sendBody = {
    msg_type: 7, // 富媒体
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

// ── 通过 URL 发送图片 ────────────────────────────────

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

// ── 图片路径检测 ─────────────────────────────────────

// 匹配回复中常见的图片文件路径
const IMAGE_PATH_PATTERN = /(?:^|\s)([^\s"'`]+\.(?:png|jpg|jpeg|gif|webp|bmp))(?:\s|$|["'`])/gi

function extractImagePaths(text: string): string[] {
  const paths: string[] = []
  let match
  while ((match = IMAGE_PATH_PATTERN.exec(text)) !== null) {
    const p = match[1]
    // 过滤掉明显的非路径（URL、node_modules 等）
    if (p.startsWith('http') || p.includes('node_modules')) continue
    paths.push(p)
  }
  return paths
}

function removeImagePaths(text: string): string {
  return text.replace(IMAGE_PATH_PATTERN, ' ')
}

// ── 事件处理 ─────────────────────────────────────────

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

// ── 启动 ─────────────────────────────────────────────

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
