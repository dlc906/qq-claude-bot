<template>
  <div class="user-list">
    <div class="list-header">
      <h3>会话</h3>
      <span class="badge" v-if="users.length">{{ users.length }}</span>
    </div>
    <div class="list-body">
      <div v-if="users.length === 0" class="empty">
        <div class="empty-icon">💬</div>
        <div class="empty-text">暂无聊天记录</div>
      </div>
      <div
        v-for="user in users"
        :key="user.user_id"
        class="user-item"
        :class="{ active: selectedUserId === user.user_id }"
        @click="$emit('select', user.user_id)"
      >
        <div class="avatar" :style="{ background: avatarColor(user.user_id) }">
          {{ (user.nickname || user.user_id).slice(0, 1) }}
        </div>
        <div class="info">
          <div class="name-row">
            <span class="name">{{ user.nickname || user.user_id.slice(0, 12) }}</span>
            <span class="time">{{ formatTime(user.last_timestamp) }}</span>
          </div>
          <div class="preview">{{ user.last_message.slice(0, 50) }}{{ user.last_message.length > 50 ? '...' : '' }}</div>
        </div>
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

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#f97316']

function avatarColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return COLORS[Math.abs(hash) % COLORS.length]
}

async function load() {
  try { users.value = await fetchUsers() } catch {}
}

function formatTime(ts: number): string {
  const d = new Date(ts * 1000)
  const now = new Date()
  const diff = (now.getTime() - d.getTime()) / 1000
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

onMounted(() => { load(); timer = setInterval(load, 5000) })
onUnmounted(() => clearInterval(timer))
</script>

<style scoped>
.user-list {
  width: 300px;
  min-width: 300px;
  background: var(--card);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
}

.list-header {
  padding: 18px 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--border);
}

.list-header h3 {
  font-size: 16px;
  font-weight: 600;
}

.badge {
  background: var(--primary);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
}

.list-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--text-muted);
}

.empty-icon { font-size: 40px; margin-bottom: 12px; }
.empty-text { font-size: 14px; }

.user-item {
  display: flex;
  align-items: center;
  padding: 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.15s;
  gap: 12px;
}

.user-item:hover { background: var(--bg); }
.user-item.active { background: var(--primary-light); }

.avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
  flex-shrink: 0;
}

.info { flex: 1; min-width: 0; }

.name-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 3px;
}

.name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.time {
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
  margin-left: 8px;
}

.preview {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}
</style>
