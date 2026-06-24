import type { UserRow, MessageRow, KnowledgeRow } from './types'

export async function fetchUsers(): Promise<UserRow[]> {
  const res = await fetch('/api/users')
  return res.json()
}

export async function fetchMessages(userId: string, limit = 100, offset = 0): Promise<MessageRow[]> {
  const res = await fetch(`/api/messages/${encodeURIComponent(userId)}?limit=${limit}&offset=${offset}`)
  return res.json()
}

export async function deleteUserMessages(userId: string): Promise<{ deleted: number }> {
  const res = await fetch(`/api/messages/${encodeURIComponent(userId)}`, { method: 'DELETE' })
  return res.json()
}

// ── Knowledge base ────────────────────────────────

export async function fetchKnowledge(): Promise<KnowledgeRow[]> {
  const res = await fetch('/api/knowledge')
  return res.json()
}

export async function uploadKnowledge(file: File): Promise<{ id: number; filename: string; filetype: string; size: number }> {
  const arrayBuffer = await file.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)

  // Chunked base64 conversion (avoids call stack overflow on large files)
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, chunk as unknown as number[])
  }
  const base64 = btoa(binary)

  const res = await fetch('/api/knowledge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, data: base64 }),
  })
  return res.json()
}

export async function deleteKnowledge(id: number): Promise<{ deleted: number }> {
  const res = await fetch(`/api/knowledge/${id}`, { method: 'DELETE' })
  return res.json()
}
