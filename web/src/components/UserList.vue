<template>
  <div class="user-list">
    <div class="header">💬 聊天记录</div>
    <div v-if="users.length === 0" class="empty">暂无聊天记录</div>
    <div
      v-for="user in users"
      :key="user.user_id"
      class="user-item"
      :class="{ active: selectedUserId === user.user_id }"
      @click="$emit('select', user.user_id)"
    >
      <div class="user-avatar">{{ (user.nickname || user.user_id).slice(0, 1) }}</div>
      <div class="user-info">
        <div class="user-name">{{ user.nickname || user.user_id.slice(0, 12) + '...' }}</div>
        <div class="user-preview">{{ user.last_message.slice(0, 40) }}{{ user.last_message.length > 40 ? '...' : '' }}</div>
      </div>
      <div class="user-meta">
        <div class="user-time">{{ formatTime(user.last_timestamp) }}</div>
        <div class="user-count">{{ user.message_count }} 条</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { UserRow } from '../types'
import { fetchUsers } from '../api'

defineProps<{ selectedUserId: string | null }>()
defineEmits<{ select: [id: string] }>()

const users = ref<UserRow[]>([])
let timer: ReturnType<typeof setInterval>

async function load() {
  try {
    users.value = await fetchUsers()
  } catch (e) {
    console.error('Failed to load users:', e)
  }
}

function formatTime(ts: number): string {
  const d = new Date(ts * 1000)
  const now = new Date()
  const diff = (now.getTime() - d.getTime()) / 1000

  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

onMounted(() => {
  load()
  timer = setInterval(load, 5000)
})

onUnmounted(() => {
  clearInterval(timer)
})
</script>

<style scoped>
.user-list {
  width: 280px;
  min-width: 280px;
  background: #fff;
  border-right: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.header {
  padding: 16px;
  font-size: 16px;
  font-weight: 600;
  border-bottom: 1px solid #e0e0e0;
  background: #fafafa;
}

.empty {
  padding: 32px;
  text-align: center;
  color: #999;
}

.user-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: background 0.15s;
}

.user-item:hover {
  background: #f5f5f5;
}

.user-item.active {
  background: #e3f2fd;
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #1976d2;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
  flex-shrink: 0;
  margin-right: 10px;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-preview {
  font-size: 12px;
  color: #999;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-meta {
  text-align: right;
  flex-shrink: 0;
  margin-left: 8px;
}

.user-time {
  font-size: 11px;
  color: #bbb;
}

.user-count {
  font-size: 11px;
  color: #bbb;
  margin-top: 2px;
}
</style>
