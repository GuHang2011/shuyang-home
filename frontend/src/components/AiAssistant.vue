<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import type { Row } from '../../shared/domain';
import { aiPrompts, useAiAssistant } from '../../shared/useAiAssistant';
import { api } from '../api';
const props = defineProps<{ user: Row | null }>();
const emit = defineEmits<{ (event: 'join'): void }>();
const { messages, draft, error, busy, loading, consent, available, demo, status, failed, allowed, full, canSend, load, clear, send, retry } = useAiAssistant(() => props.user, api);
const history = ref<HTMLElement | null>(null), copyNotice = ref('');
watch(() => [messages.value.length, busy.value], async () => { await nextTick();history.value?.scrollTo({ top: history.value.scrollHeight }); });
watch(() => props.user?.id, () => { copyNotice.value = ''; });
function newConversation() { if (!messages.value.length && !draft.value || window.confirm('清空当前对话？对话不会保存，清空后无法恢复。')) { clear();copyNotice.value = ''; } }
async function copy(text: string) { const identity = props.user?.id;try { await navigator.clipboard.writeText(text);if (identity === props.user?.id) copyNotice.value = '回复已复制'; } catch { if (identity === props.user?.id) copyNotice.value = '无法自动复制，请选中回复文字手动复制'; } }
</script>
<template>
  <section class="ai-assistant" aria-label="AI 助手">
    <header class="ai-heading"><div><p class="eyebrow">SHUYANG HOME · AI</p><h1>AI 助手</h1><p>使用指引、问题解答和文案起草，随时问一问。</p></div><button v-if="allowed" class="outline" :disabled="busy || loading" @click="newConversation">新建对话</button></header>
    <div v-if="!allowed" class="panel ai-welcome"><h2>让日常参与更轻松</h2><p>登录并通过会员审核后，可以向助手提问。系统不会自动读取你的会员资料、订单或聊天记录。</p><button class="primary" @click="emit('join')">登录 / 查看入会状态</button></div>
    <template v-else>
      <div class="ai-status" role="status"><strong>{{ demo ? '演示模式 · 示例回复' : 'AI 智能问答' }}</strong><span>{{ loading ? '正在连接助手…' : status }}</span><button class="text-button" :disabled="busy || loading" @click="load">刷新状态</button></div>
      <p class="ai-disclosure">{{ demo ? '当前体验使用本机固定示例，不连接真实模型，也不会发送到外部服务。' : '发送后，当前对话文字会交由已配置的模型服务处理；请勿填写密码、证件、联系方式等私密信息。' }} 对话仅在当前页面保留，离开页面即清空。回复可能有误，请核实后使用。</p>
      <div class="ai-prompts"><button v-for="prompt in aiPrompts" :key="prompt" class="outline" :disabled="busy || !available || full" @click="draft = prompt">{{ prompt }}</button></div>
      <div ref="history" class="ai-history" role="log" aria-label="助手对话" aria-live="polite" :aria-busy="busy">
        <div v-if="!messages.length && !busy" class="ai-empty">从上方问题开始，或写下你想解决的事情。助手提供建议和草稿，发布、报名和审核仍由你确认操作。</div>
        <article v-for="(row,index) in messages" :key="index" class="ai-message" :class="row.role"><div class="ai-message-label">{{ row.role === 'user' ? '我' : row.demo ? '示例回复 · 非模型生成' : 'AI 助手' }}</div><p class="ai-message-content">{{ row.content }}</p><small v-if="row.truncated">回复达到长度限制，可新建对话请助手分段说明。</small><button v-if="row.role === 'assistant'" class="text-button" @click="copy(row.content)">复制回复</button></article>
        <div v-if="busy" class="ai-thinking">正在整理回复，请稍候…</div>
      </div>
      <p v-if="copyNotice" class="ai-notice" role="status">{{ copyNotice }}</p><p v-if="full" class="ai-notice">当前对话已达长度上限，请新建对话后继续。</p>
      <div v-if="error" class="form-error" role="alert">{{ error }} <button v-if="failed && draft.trim() === failed" class="text-button" :disabled="!canSend" @click="retry">重试本条</button></div>
      <form class="ai-composer" @submit.prevent="send"><label for="ai-question">你的问题</label><textarea id="ai-question" v-model="draft" :disabled="busy || !available || full" maxlength="2000" rows="4" placeholder="例如：帮我起草一段活动邀请，时间和地点用占位符。" @keydown.ctrl.enter.prevent="send"/>
        <label class="ai-consent"><input v-model="consent" type="checkbox" :disabled="busy || !available">{{ demo ? '我了解这是本机示例体验' : '我同意将当前对话文字发送给模型服务' }}</label>
        <div class="ai-send-row"><small>{{ draft.length }} / 2000 · Ctrl + Enter 发送 · 最多5轮</small><button class="primary" :disabled="!canSend">{{ busy ? '正在回复…' : '发送问题' }}</button></div>
      </form>
    </template>
  </section>
</template>
<style scoped>
.ai-assistant{max-width:1000px;margin:0 auto;color:var(--skin-text,#303133)}.ai-heading{display:flex;align-items:center;justify-content:space-between;gap:18px;margin:16px 0 24px}.ai-heading h1{font-size:28px;margin:8px 0}.ai-heading p,.ai-disclosure{font-size:14px;line-height:1.8;color:var(--skin-muted,#606266)}.ai-heading button{flex-shrink:0}.ai-welcome p{margin:18px 0;line-height:1.8}.ai-status{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:14px 18px;background:var(--skin-soft,#ecf5ff);border:1px solid var(--skin-border,#dcdfe6);border-radius:10px}.ai-status span{flex:1;font-size:13px}.ai-disclosure{margin:16px 0}.ai-prompts{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px}.ai-prompts button{text-align:left;line-height:1.7;white-space:normal;min-height:44px}.ai-history{max-height:560px;min-height:200px;overflow-y:auto;padding:20px;border:1px solid var(--skin-border,#dcdfe6);background:var(--skin-surface,#fff);border-radius:12px;overscroll-behavior:contain}.ai-empty{font-size:14px;line-height:1.9;color:var(--skin-muted,#606266);padding:24px 8px}.ai-message{padding:16px;border-radius:10px;background:var(--skin-soft,#ecf5ff);margin-bottom:16px;overflow-wrap:anywhere}.ai-message.user{margin-left:12%;background:var(--skin-bg,#f5f7fa)}.ai-message.assistant{margin-right:4%}.ai-message-label{font-weight:600;font-size:13px;color:var(--skin-primary,#337ecc)}.ai-message-content{white-space:pre-wrap;font-size:15px;line-height:1.9;margin:10px 0;color:var(--skin-text,#303133)!important}.ai-message small,.ai-thinking,.ai-notice{color:var(--skin-muted,#606266);font-size:13px;line-height:1.8}.ai-notice{margin-top:12px}.ai-composer{margin-top:20px}.ai-composer>label:first-child{display:block;font-size:14px;margin-bottom:8px}.ai-composer textarea{width:100%;min-height:110px;padding:12px;border:1px solid var(--skin-border,#dcdfe6);border-radius:8px;font:inherit;resize:vertical;box-sizing:border-box;background:var(--skin-input,#fff);color:var(--skin-text,#303133)}.ai-consent{display:flex;align-items:flex-start;gap:8px;margin:14px 0;font-size:13px;line-height:1.8}.ai-consent input{margin-top:5px;flex-shrink:0}.ai-send-row{display:flex;align-items:center;justify-content:space-between;gap:12px}.ai-send-row small{font-size:12px}.ai-assistant button{min-height:44px}.ai-assistant button:disabled{opacity:.55;cursor:not-allowed}@media(max-width:600px){.ai-heading{align-items:flex-start}.ai-heading h1{font-size:24px}.ai-prompts{grid-template-columns:1fr}.ai-history{padding:12px;max-height:460px}.ai-message{padding:12px}.ai-message.user{margin-left:5%}.ai-send-row{align-items:flex-end}.ai-send-row small{max-width:60%}}
</style>
