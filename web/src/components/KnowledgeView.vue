<template>
  <div class="knowledge-view">
    <div class="kb-header">
      <span class="kb-title">📚 知识库管理</span>
      <span class="kb-count">{{ docs.length }} 个文档</span>
    </div>

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
      <div class="upload-icon">📄</div>
      <div class="upload-text">点击或拖拽上传文档</div>
      <div class="upload-hint">支持 txt / md / pdf / docx</div>
    </div>

    <!-- Upload progress -->
    <div v-if="uploading" class="uploading">上传中...</div>

    <!-- Document list -->
    <div class="doc-list">
      <div v-if="docs.length === 0" class="empty">暂无文档</div>
      <div v-for="doc in docs" :key="doc.id" class="doc-item">
        <div class="doc-icon">{{ typeIcon(doc.filetype) }}</div>
        <div class="doc-info">
          <div class="doc-name">{{ doc.filename }}</div>
          <div class="doc-meta">{{ doc.filetype }} · {{ formatSize(doc.size) }} · {{ formatTime(doc.created_at) }}</div>
        </div>
        <button class="btn-delete" @click="handleDelete(doc.id)" title="删除">✕</button>
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
  try {
    docs.value = await fetchKnowledge()
  } catch (e) {
    console.error('Failed to load knowledge:', e)
  }
}

function openFilePicker() {
  fileInput.value?.click()
}

function onFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) {
    handleFiles(input.files)
    input.value = '' // reset
  }
}

function onDrop(e: DragEvent) {
  dragging.value = false
  if (e.dataTransfer?.files) {
    handleFiles(e.dataTransfer.files)
  }
}

async function handleFiles(files: FileList) {
  uploading.value = true
  for (const file of Array.from(files)) {
    try {
      await uploadKnowledge(file)
    } catch (e) {
      console.error('Upload failed:', e)
      alert(`上传失败: ${file.name}`)
    }
  }
  uploading.value = false
  await load()
}

async function handleDelete(id: number) {
  if (!confirm('确定删除该文档？')) return
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
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

onMounted(() => {
  load()
  timer = setInterval(load, 10000)
})

onUnmounted(() => {
  clearInterval(timer)
})
</script>

<style scoped>
.knowledge-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
  overflow: hidden;
}

.kb-header {
  padding: 14px 20px;
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.kb-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.kb-count {
  font-size: 13px;
  color: #999;
}

.upload-area {
  margin: 16px 20px;
  padding: 32px;
  border: 2px dashed #ccc;
  border-radius: 10px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  background: #fff;
}

.upload-area:hover,
.upload-area.dragging {
  border-color: #1976d2;
  background: #e3f2fd;
}

.upload-icon {
  font-size: 36px;
  margin-bottom: 8px;
}

.upload-text {
  font-size: 14px;
  color: #555;
  margin-bottom: 4px;
}

.upload-hint {
  font-size: 12px;
  color: #aaa;
}

.uploading {
  padding: 10px 20px;
  text-align: center;
  color: #1976d2;
  font-size: 13px;
}

.doc-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 20px 20px;
}

.empty {
  text-align: center;
  color: #bbb;
  padding: 40px;
}

.doc-item {
  display: flex;
  align-items: center;
  padding: 12px 14px;
  background: #fff;
  border-radius: 8px;
  margin-bottom: 8px;
  transition: box-shadow 0.15s;
}

.doc-item:hover {
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.doc-icon {
  font-size: 24px;
  margin-right: 12px;
  flex-shrink: 0;
}

.doc-info {
  flex: 1;
  min-width: 0;
}

.doc-name {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.doc-meta {
  font-size: 12px;
  color: #999;
  margin-top: 2px;
}

.btn-delete {
  background: none;
  border: none;
  color: #ccc;
  font-size: 16px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.15s;
}

.btn-delete:hover {
  color: #e53935;
  background: #ffebee;
}
</style>
