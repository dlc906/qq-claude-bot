<template>
  <div class="app">
    <div class="app-body" v-show="activeTab === 'chat'">
      <UserList :selectedUserId="selectedUserId" @select="onSelect" />
      <ChatView :userId="selectedUserId" />
    </div>
    <div class="app-body" v-show="activeTab === 'kb'">
      <KnowledgeView />
    </div>
    <div class="tab-bar">
      <div class="tab" :class="{ active: activeTab === 'chat' }" @click="activeTab = 'chat'">💬 聊天记录</div>
      <div class="tab" :class="{ active: activeTab === 'kb' }" @click="activeTab = 'kb'">📚 知识库</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import UserList from './components/UserList.vue'
import ChatView from './components/ChatView.vue'
import KnowledgeView from './components/KnowledgeView.vue'

const activeTab = ref<'chat' | 'kb'>('chat')
const selectedUserId = ref<string | null>(null)

function onSelect(id: string) {
  selectedUserId.value = id
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f5f5;
}

.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.app-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.tab-bar {
  display: flex;
  background: #fff;
  border-top: 1px solid #e0e0e0;
}

.tab {
  flex: 1;
  text-align: center;
  padding: 10px;
  font-size: 14px;
  color: #666;
  cursor: pointer;
  transition: all 0.15s;
}

.tab:hover {
  background: #f5f5f5;
}

.tab.active {
  color: #1976d2;
  font-weight: 600;
  border-top: 2px solid #1976d2;
}
</style>
