<template>
  <div class="settings-view">
    <h2>⚙️ 设置</h2>

    <div class="section">
      <h3>LLM 提供商</h3>
      <label class="radio-label">
        <input type="radio" value="claude-code" v-model="form.llmProvider" />
        Claude Code CLI
      </label>
      <label class="radio-label">
        <input type="radio" value="openai" v-model="form.llmProvider" />
        OpenAI 兼容 API
      </label>
    </div>

    <div class="section" v-if="form.llmProvider === 'openai'">
      <h3>OpenAI 配置</h3>
      <div class="field">
        <label>API Key</label>
        <input type="password" v-model="form.openaiApiKey" placeholder="sk-..." />
      </div>
      <div class="field">
        <label>Base URL</label>
        <input type="text" v-model="form.openaiBaseUrl" placeholder="https://api.openai.com/v1" />
      </div>
      <div class="field">
        <label>模型</label>
        <input type="text" v-model="form.openaiModel" placeholder="gpt-4o" />
      </div>
    </div>

    <button class="save-btn" @click="save" :disabled="saving">
      {{ saving ? '保存中...' : '保存设置' }}
    </button>
    <div class="tip" v-if="saved">✅ 已保存</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { fetchSettings, updateSettings } from '../api'
import type { Settings } from '../types'

const form = ref<Settings>({
  llmProvider: 'claude-code',
  openaiApiKey: '',
  openaiBaseUrl: 'https://api.openai.com/v1',
  openaiModel: 'gpt-4o',
})
const saving = ref(false)
const saved = ref(false)

onMounted(async () => {
  const s = await fetchSettings()
  form.value = s
})

async function save() {
  saving.value = true
  saved.value = false
  const s = await updateSettings(form.value)
  form.value = s
  saving.value = false
  saved.value = true
  setTimeout(() => saved.value = false, 2000)
}
</script>

<style scoped>
.settings-view {
  max-width: 500px;
  margin: 40px auto;
  padding: 24px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
h2 { margin-bottom: 24px; }
.section { margin-bottom: 20px; }
.section h3 { font-size: 14px; color: #666; margin-bottom: 8px; }
.radio-label {
  display: block;
  padding: 8px 0;
  font-size: 14px;
  cursor: pointer;
}
.radio-label input { margin-right: 8px; }
.field { margin-bottom: 12px; }
.field label {
  display: block;
  font-size: 13px;
  color: #666;
  margin-bottom: 4px;
}
.field input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}
.field input:focus { outline: none; border-color: #1976d2; }
.save-btn {
  margin-top: 16px;
  padding: 10px 24px;
  background: #1976d2;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}
.save-btn:hover { background: #1565c0; }
.save-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.tip { margin-top: 8px; font-size: 13px; color: #4caf50; }
</style>
