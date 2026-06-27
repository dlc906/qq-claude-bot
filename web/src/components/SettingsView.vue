<template>
  <div class="settings-view">
    <div class="settings-header">
      <h2>⚙️ 设置</h2>
      <div class="settings-subtitle">配置 AI 模型和连接方式</div>
    </div>

    <div class="settings-card">
      <div class="card-title">LLM 提供商</div>
      <div class="provider-options">
        <label class="provider-option" :class="{ selected: form.llmProvider === 'claude-code' }">
          <input type="radio" value="claude-code" v-model="form.llmProvider" />
          <div class="option-content">
            <div class="option-icon">🧠</div>
            <div>
              <div class="option-title">Claude Code CLI</div>
              <div class="option-desc">通过 Claude Code 命令行工具调用</div>
            </div>
          </div>
        </label>
        <label class="provider-option" :class="{ selected: form.llmProvider === 'openai' }">
          <input type="radio" value="openai" v-model="form.llmProvider" />
          <div class="option-content">
            <div class="option-icon">🌐</div>
            <div>
              <div class="option-title">OpenAI 兼容 API</div>
              <div class="option-desc">DeepSeek / 通义千问 / GPT 等</div>
            </div>
          </div>
        </label>
        <label class="provider-option" :class="{ selected: form.llmProvider === 'anthropic' }">
          <input type="radio" value="anthropic" v-model="form.llmProvider" />
          <div class="option-content">
            <div class="option-icon">✨</div>
            <div>
              <div class="option-title">Anthropic API</div>
              <div class="option-desc">Claude 直连 API（Sonnet / Opus 等）</div>
            </div>
          </div>
        </label>
      </div>
    </div>

    <div class="settings-card" v-if="form.llmProvider === 'openai'">
      <div class="card-title">OpenAI 配置</div>
      <div class="form-grid">
        <div class="form-group">
          <label>API Key</label>
          <input type="password" v-model="form.openaiApiKey" placeholder="sk-..." />
        </div>
        <div class="form-group">
          <label>Base URL</label>
          <input type="text" v-model="form.openaiBaseUrl" placeholder="https://api.openai.com/v1" />
        </div>
        <div class="form-group">
          <label>模型名称</label>
          <input type="text" v-model="form.openaiModel" placeholder="gpt-4o" />
        </div>
      </div>
    </div>

    <div class="settings-card" v-if="form.llmProvider === 'anthropic'">
      <div class="card-title">Anthropic 配置</div>
      <div class="form-grid">
        <div class="form-group">
          <label>API Key</label>
          <input type="password" v-model="form.anthropicApiKey" placeholder="sk-ant-..." />
        </div>
        <div class="form-group">
          <label>Base URL</label>
          <input type="text" v-model="form.anthropicBaseUrl" placeholder="https://api.anthropic.com" />
        </div>
        <div class="form-group">
          <label>模型名称</label>
          <input type="text" v-model="form.anthropicModel" placeholder="claude-sonnet-4-20250514" />
        </div>
      </div>
    </div>

    <div class="actions">
      <button class="btn-save" @click="save" :disabled="saving">
        <span v-if="saving" class="spinner"></span>
        {{ saving ? '保存中...' : '保存设置' }}
      </button>
      <transition name="fade">
        <span class="saved-tip" v-if="saved">✅ 已保存，立即生效</span>
      </transition>
    </div>
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
  anthropicApiKey: '',
  anthropicBaseUrl: 'https://api.anthropic.com',
  anthropicModel: 'claude-sonnet-4-20250514',
})
const saving = ref(false)
const saved = ref(false)

onMounted(async () => { form.value = await fetchSettings() })

async function save() {
  saving.value = true
  saved.value = false
  form.value = await updateSettings(form.value)
  saving.value = false
  saved.value = true
  setTimeout(() => saved.value = false, 2500)
}
</script>

<style scoped>
.settings-view {
  max-width: 560px;
  margin: 0 auto;
  padding: 32px;
  width: 100%;
}

.settings-header { margin-bottom: 28px; }
.settings-header h2 { font-size: 22px; font-weight: 700; }
.settings-subtitle { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

.settings-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
  margin-bottom: 16px;
}

.card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 14px;
}

.provider-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.provider-option {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  border: 2px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s;
}

.provider-option:hover { border-color: #d1d5db; }
.provider-option.selected { border-color: var(--primary); background: var(--primary-light); }
.provider-option input { display: none; }

.option-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.option-icon { font-size: 24px; }
.option-title { font-size: 14px; font-weight: 500; }
.option-desc { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

.form-grid {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.form-group input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  transition: border-color 0.15s;
  background: var(--bg);
}

.form-group input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
}

.actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 24px;
}

.btn-save {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 28px;
  background: var(--primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-save:hover { background: #2563eb; }
.btn-save:disabled { opacity: 0.6; cursor: not-allowed; }

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.saved-tip {
  font-size: 13px;
  color: #10b981;
  font-weight: 500;
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
