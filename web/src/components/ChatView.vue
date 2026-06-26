<template>
  <div class="chat-view">
    <div class="chat-header" v-if="userId">
      <div class="header-left">
        <div class="header-avatar" :style="{ background: '#3b82f6' }">
          {{ (nickname || userId).slice(0, 1) }}
        </div>
        <div>
          <div class="header-name">{{ nickname || userId }}</div>
          <div class="header-status">{{ messages.length }} 条消息</div>
        </div>
      </div>
      <button class="btn-delete" @click="handleClear">
        <span>🗑️</span> 清空
      </button>
    </div>
    <div class="chat-header empty-header" v-else>
      <div class="header-placeholder">
        <span class="placeholder-icon">💬</span>
        <span>选择一个会话查看聊天记录</span>
      </div>
    </div>

    <div class="messages" ref="messagesContainer">
      <div v-if="!userId" class="empty-state">
        <div class="empty-graphic">💬</div>
        <div class="empty-title">选择一个会话</div>
        <div class="empty-desc">从左侧列表中选择用户查看聊天记录</div>
      </div>
      <div v-else-if="messages.length === 0" class="empty-state">
        <div class="empty-graphic">📭</div>
        <div class="empty-title">暂无消息</div>
        <div class="empty-desc">该用户还没有发送过消息</div>
      </div>
      <template v-else>
        <div
          v-for="msg in messages"
          :key="msg.id"
          class="message"
          :class="msg.role"
        >
          <div class="msg-avatar" v-if="msg.role === 'assistant'">🤖</div>
          <div class="bubble-wrap" :class="msg.role">
            <div class="bubble">
              <div class="content">{{ msg.content }}</div>
            </div>
            <div class="msg-time">{{ formatTime(msg.timestamp) }}</div>
          </div>
          <div class="msg-avatar user-avatar" v-if="msg.role === 'user'">
            <div class="avatar-circle">{{ (nickname || 'U').slice(0, 1) }}</div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import type { MessageRow } from '../types'
import { fetchMessages, deleteUserMessages } from '../api'

const props = defineProps<{ userId: string | null }>()

const messages = ref<MessageRow[]>([])
const nickname = ref('')
const messagesContainer = ref<HTMLElement | null>(null)
let timer: ReturnType<typeof setInterval> | null = null

async function load() {
  if (!props.userId) { messages.value = []; nickname.value = ''; return }
  try {
    const data = await fetchMessages(props.userId)
    messages.value = data
    if (data.length > 0) nickname.value = data[0].nickname || ''
    await nextTick()
    scrollToBottom()
  } catch {}
}

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

async function handleClear() {
  if (!props.userId) return
  if (!confirm('确定清空该用户的聊天记录？')) return
  await deleteUserMessages(props.userId)
  messages.value = []
}

function formatTime(ts: number): string {
  const d = new Date(ts * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

watch(() => props.userId, load, { immediate: true })
onMounted(() => { timer = setInterval(load, 5000) })
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>

<style scoped>
.chat-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  min-width: 0;
}

.chat-header {
  padding: 14px 24px;
  background: var(--card);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.empty-header { justify-content: center; }

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 600;
  color: #fff;
}

.header-name { font-size: 15px; font-weight: 600; }
.header-status { font-size: 12px; color: var(--text-muted); }

.header-placeholder {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-muted);
  font-size: 14px;
}

.placeholder-icon { font-size: 20px; }

.btn-delete {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
}

.btn-delete:hover {
  border-color: var(--danger);
  color: var(--danger);
  background: var(--danger-light);
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.empty-graphic { font-size: 56px; opacity: 0.6; }
.empty-title { font-size: 16px; font-weight: 500; color: var(--text-secondary); }
.empty-desc { font-size: 13px; color: var(--text-muted); }

.message {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  max-width: 80%;
}

.message.user { align-self: flex-end; flex-direction: row-reverse; }
.message.assistant { align-self: flex-start; }

.msg-avatar { flex-shrink: 0; font-size: 20px; padding-top: 2px; }

.avatar-circle {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
}

.bubble-wrap {
  display: flex;
  flex-direction: column;
}

.bubble-wrap.user { align-items: flex-end; }
.bubble-wrap.assistant { align-items: flex-start; }

.bubble {
  padding: 10px 16px;
  border-radius: 16px;
  word-break: break-word;
  white-space: pre-wrap;
  line-height: 1.5;
}

.message.user .bubble {
  background: var(--user-bubble);
  color: #fff;
  border-bottom-right-radius: 4px;
}

.message.assistant .bubble {
  background: var(--assistant-bubble);
  color: var(--text);
  border-bottom-left-radius: 4px;
  box-shadow: var(--shadow-sm);
}

.content { font-size: 14px; }

.msg-time {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 4px;
  padding: 0 4px;
}
</style>
