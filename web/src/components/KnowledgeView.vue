<template>
  <div class="knowledge-view">
    <div class="kb-header">
      <div>
        <h2>📚 知识库</h2>
        <div class="kb-subtitle">管理 Claude 参考的文档资料</div>
      </div>
      <span class="badge" v-if="docs.length">{{ docs.length }}</span>
    </div>

    <div class="kb-content">
      <!-- Upload area -->
      <div
        class="upload-area"
        :class="{ dragging }"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop.prevent="onDrop"
        @click="openFilePicker"
      >
        <input
          ref="fileInput"
          type="file"
          multiple
          accept=".txt,.md,.pdf,.docx,.csv,.json"
          style="display: none"
          @change="onFileSelect"
        />
        <div class="upload-icon">📤</div>
        <div class="upload-text">点击或拖拽上传文档</div>
        <div class="upload-hint">支持 TXT / Markdown / PDF / Word 格式</div>
      </div>

      <!-- Upload progress -->
      <div v-if="uploading" class="uploading">
        <div class="spinner"></div>
        上传中...
      </div>

      <!-- Document list -->
      <div class="doc-list">
        <div v-if="docs.length === 0 && !uploading" class="empty">
          <div class="empty-icon">📄</div>
          <div class="empty-text">暂无文档</div>
          <div class="empty-hint">上传文档后 Claude 会自动参考其内容回答问题</div>
        </div>
        <div v-for="doc in docs" :key="doc.id" class="doc-item">
          <div class="doc-icon">{{ typeIcon(doc.filetype) }}</div>
          <div class="doc-info">
            <div class="doc-name">{{ doc.filename }}</div>
            <div class="doc-meta">
              <span class="doc-type">{{ doc.filetype }}</span>
              <span class="dot">·</span>
              <span>{{ formatSize(doc.size) }}</span>
              <span class="dot">·</span>
              <span>{{ formatTime(doc.created_at) }}</span>
            </div>
          </div>
          <button class="btn-delete" @click="handleDelete(doc.id)" title="删除文档">🗑️</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { KnowledgeRow } from '../types'
import { fetchKnowledge, uploadKnowledge, deleteKnowledge } from '../api'

const docs = ref<KnowledgeRow[]>([])
const dragging = ref(false)
const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
let timer: ReturnType<typeof setInterval>

async function load() {
  try { docs.value = await fetchKnowledge() } catch {}
}

function openFilePicker() { fileInput.value?.click() }

function onFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) { handleFiles(input.files); input.value = '' }
}

function onDrop(e: DragEvent) {
  dragging.value = false
  if (e.dataTransfer?.files) handleFiles(e.dataTransfer.files)
}

async function handleFiles(files: FileList) {
  uploading.value = true
  for (const file of Array.from(files)) {
    try { await uploadKnowledge(file) } catch (e) {
      console.error('Upload failed:', e)
      alert(`上传失败: ${file.name}`)
    }
  }
  uploading.value = false
  await load()
}

async function handleDelete(id: number) {
  if (!confirm('确定删除该文档？删除后会话将刷新。')) return
  await deleteKnowledge(id)
  await load()
}

function typeIcon(type: string): string {
  const map: Record<string, string> = {
    PDF: '📕', Word: '📘', TXT: '📝', Markdown: '📋', CSV: '📊', JSON: '🔧',
  }
  return map[type] || '📄'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatTime(ts: number): string {
  const d = new Date(ts * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

onMounted(() => { load(); timer = setInterval(load, 10000) })
onUnmounted(() => clearInterval(timer))
</script>

<style scoped>
.knowledge-view {
  flex: 1;
  max-width: 720px;
  margin: 0 auto;
  padding: 32px;
}

.kb-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24px;
}

.kb-header h2 { font-size: 22px; font-weight: 700; }
.kb-subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

.badge {
  background: var(--primary);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 10px;
  margin-top: 4px;
}

.kb-content { display: flex; flex-direction: column; gap: 16px; }

.upload-area {
  padding: 40px;
  border: 2px dashed var(--border);
  border-radius: var(--radius);
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--card);
}

.upload-area:hover,
.upload-area.dragging {
  border-color: var(--primary);
  background: var(--primary-light);
}

.upload-icon { font-size: 40px; margin-bottom: 12px; }
.upload-text { font-size: 15px; font-weight: 500; color: var(--text); margin-bottom: 4px; }
.upload-hint { font-size: 13px; color: var(--text-muted); }

.uploading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px;
  color: var(--primary);
  font-size: 14px;
  font-weight: 500;
  background: var(--primary-light);
  border-radius: var(--radius-sm);
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--primary);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.doc-list { display: flex; flex-direction: column; gap: 8px; }

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px;
  color: var(--text-muted);
}

.empty-icon { font-size: 48px; margin-bottom: 12px; opacity: 0.5; }
.empty-text { font-size: 15px; font-weight: 500; color: var(--text-secondary); }
.empty-hint { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

.doc-item {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  background: var(--card);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  transition: all 0.15s;
  gap: 14px;
}

.doc-item:hover {
  box-shadow: var(--shadow-md);
  border-color: transparent;
}

.doc-icon { font-size: 28px; flex-shrink: 0; }

.doc-info { flex: 1; min-width: 0; }

.doc-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.doc-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 3px;
}

.doc-type {
  background: var(--bg);
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
  font-size: 11px;
}

.dot { color: var(--border); }

.btn-delete {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 6px;
  transition: all 0.15s;
  opacity: 0.4;
}

.btn-delete:hover {
  opacity: 1;
  background: var(--danger-light);
}
</style>
