<template>
  <div class="chat-view">
    <div class="chat-header" v-if="userId">
      <div class="header-info">
        <span class="header-name">{{ nickname || userId }}</span>
        <span class="header-count">{{ messages.length }} 条消息</span>
      </div>
      <button class="btn-clear" @click="handleClear">清空记录</button>
    </div>
    <div class="chat-header placeholder" v-else>
      <span>选择一个用户查看聊天记录</span>
    </div>

    <div class="messages" ref="messagesContainer">
      <div v-if="!userId" class="empty-hint">
        <div class="empty-icon">💬</div>
        <div>从左侧选择一个用户</div>
      </div>
      <div v-else-if="messages.length === 0" class="empty-hint">
        <div>暂无消息</div>
      </div>
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="message"
        :class="msg.role"
      >
        <div class="bubble">
          <div class="content">{{ msg.content }}</div>
          <div class="time">{{ formatTime(msg.timestamp) }}</div>
        </div>
      </div>
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
  if (!props.userId) {
    messages.value = []
    nickname.value = ''
    return
  }
  try {
    const data = await fetchMessages(props.userId)
    messages.value = data
    if (data.length > 0) {
      nickname.value = data[0].nickname || ''
    }
    await nextTick()
    scrollToBottom()
  } catch (e) {
    console.error('Failed to load messages:', e)
  }
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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

watch(() => props.userId, () => {
  load()
}, { immediate: true })

onMounted(() => {
  timer = setInterval(load, 5000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.chat-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #f0f0f0;
  min-width: 0;
}

.chat-header {
  padding: 12px 20px;
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.chat-header.placeholder {
  justify-content: center;
  color: #999;
}

.header-info {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.header-name {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.header-count {
  font-size: 13px;
  color: #999;
}

.btn-clear {
  padding: 6px 14px;
  border: 1px solid #e57373;
  background: #fff;
  color: #e57373;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
}

.btn-clear:hover {
  background: #e57373;
  color: #fff;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-hint {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #bbb;
  font-size: 15px;
  gap: 10px;
}

.empty-icon {
  font-size: 48px;
}

.message {
  display: flex;
}

.message.user {
  justify-content: flex-end;
}

.message.assistant {
  justify-content: flex-start;
}

.bubble {
  max-width: 70%;
  padding: 10px 14px;
  border-radius: 12px;
  word-break: break-word;
  white-space: pre-wrap;
}

.message.user .bubble {
  background: #dcf8c6;
  border-bottom-right-radius: 4px;
}

.message.assistant .bubble {
  background: #fff;
  border-bottom-left-radius: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}

.content {
  font-size: 14px;
  line-height: 1.5;
  color: #333;
}

.time {
  font-size: 11px;
  color: #aaa;
  margin-top: 4px;
  text-align: right;
}
</style>
