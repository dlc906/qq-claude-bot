<template>
  <div class="app">
    <nav class="sidebar">
      <div class="logo">
        <span class="logo-icon">🤖</span>
        <span class="logo-text">QQ Bot</span>
      </div>
      <div class="nav-items">
        <div class="nav-item" :class="{ active: activeTab === 'chat' }" @click="activeTab = 'chat'">
          <span class="nav-icon">💬</span>
          <span>聊天记录</span>
        </div>
        <div class="nav-item" :class="{ active: activeTab === 'kb' }" @click="activeTab = 'kb'">
          <span class="nav-icon">📚</span>
          <span>知识库</span>
        </div>
        <div class="nav-item" :class="{ active: activeTab === 'settings' }" @click="activeTab = 'settings'">
          <span class="nav-icon">⚙️</span>
          <span>设置</span>
        </div>
      </div>
      <div class="sidebar-footer">
        <div class="version">Claude Code × QQ</div>
      </div>
    </nav>

    <main class="main">
      <div class="panel" v-show="activeTab === 'chat'">
        <UserList :selectedUserId="selectedUserId" @select="onSelect" />
        <ChatView :userId="selectedUserId" />
      </div>
      <div class="panel full" v-show="activeTab === 'kb'">
        <KnowledgeView />
      </div>
      <div class="panel full" v-show="activeTab === 'settings'">
        <SettingsView />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import UserList from './components/UserList.vue'
import ChatView from './components/ChatView.vue'
import KnowledgeView from './components/KnowledgeView.vue'
import SettingsView from './components/SettingsView.vue'

const activeTab = ref<'chat' | 'kb' | 'settings'>('chat')
const selectedUserId = ref<string | null>(null)

function onSelect(id: string) {
  selectedUserId.value = id
}
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --bg: #f0f2f5;
  --sidebar-bg: #1a1d23;
  --sidebar-hover: #2a2d35;
  --sidebar-active: #3b82f6;
  --card: #ffffff;
  --text: #1f2937;
  --text-secondary: #6b7280;
  --text-muted: #9ca3af;
  --border: #e5e7eb;
  --primary: #3b82f6;
  --primary-light: #eff6ff;
  --danger: #ef4444;
  --danger-light: #fef2f2;
  --user-bubble: #3b82f6;
  --assistant-bubble: #ffffff;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06);
  --radius: 12px;
  --radius-sm: 8px;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--bg);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
}

.app {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

/* ── Sidebar ─────────────────────────── */

.sidebar {
  width: 220px;
  background: var(--sidebar-bg);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.logo {
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}

.logo-icon { font-size: 24px; }
.logo-text {
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  letter-spacing: -0.3px;
}

.nav-items {
  flex: 1;
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  color: #9ca3af;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.nav-item:hover {
  background: var(--sidebar-hover);
  color: #e5e7eb;
}

.nav-item.active {
  background: var(--sidebar-active);
  color: #fff;
}

.nav-icon { font-size: 18px; }

.sidebar-footer {
  padding: 16px 20px;
  border-top: 1px solid rgba(255,255,255,0.08);
}

.version {
  font-size: 11px;
  color: #6b7280;
  text-align: center;
}

/* ── Main ────────────────────────────── */

.main {
  flex: 1;
  overflow: hidden;
}

.panel {
  display: flex;
  height: 100%;
}

.panel.full {
  display: flex;
  overflow-y: auto;
}

/* ── Scrollbar ───────────────────────── */

::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
</style>
