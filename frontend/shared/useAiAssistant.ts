import { computed, onUnmounted, ref, watch } from 'vue';
import type { Row } from './domain';

export type AiMessage = { role: 'user' | 'assistant'; content: string; demo?: boolean; truncated?: boolean };
export const aiPrompts = ['如何报名活动和查看进度？', '帮我起草一段老乡活动邀请', '如何上传照片和使用聊天表情？', '帮我整理一份互助信息发布草稿'];
type Api = (path: string, method?: string, body?: unknown) => Promise<any>;
export function useAiAssistant(getUser: () => Row | null, api: Api) {
  const messages = ref<AiMessage[]>([]), draft = ref(''), error = ref(''), busy = ref(false), loading = ref(false), consent = ref(false);
  const available = ref(false), demo = ref(false), status = ref(''), failed = ref('');
  const allowed = computed(() => getUser()?.status === 'approved' && !getUser()?.mustChangePassword);
  let generation = 0, statusGeneration = 0, alive = true;
  const full = computed(() => messages.value.length >= 10 || messages.value.reduce((total, row) => total + row.content.length, 0) >= 14000);
  const canSend = computed(() => allowed.value && available.value && consent.value && !loading.value && !busy.value && !full.value && !!draft.value.trim() && draft.value.trim().length <= 2000);
  async function load() {
    if (!allowed.value) return;const version = generation, request = ++statusGeneration;loading.value = true;error.value = '';available.value = false;
    try {
      const data = await api('/ai/status');if (!alive || version !== generation || request !== statusGeneration) return;
      if (typeof data?.available !== 'boolean' || typeof data?.demo !== 'boolean' || typeof data?.message !== 'string') throw Error('助手状态暂不可用，请重试');
      available.value = data.available;demo.value = data.demo;status.value = data.message;
    } catch (e) { if (alive && version === generation && request === statusGeneration) error.value = (e as Error).message; }
    finally { if (alive && version === generation && request === statusGeneration) loading.value = false; }
  }
  function clear() { ++generation;++statusGeneration;messages.value = [];draft.value = '';failed.value = '';error.value = '';busy.value = false;loading.value = false; }
  async function send() {
    if (!canSend.value) return;
    const question = draft.value.trim(), previous = [...messages.value], version = generation;
    const outgoing = [...previous.map(({ role, content }) => ({ role, content })), { role: 'user', content: question }];
    if (outgoing.reduce((total, row) => total + row.content.length, 0) > 16000) { error.value = '对话内容过长，请新建对话后继续';return; }
    busy.value = true;error.value = '';failed.value = '';draft.value = '';messages.value.push({ role: 'user', content: question });
    try {
      const data = await api('/ai/messages', 'POST', { messages: outgoing, consent: true });
      if (!alive || version !== generation) return;
      if (typeof data?.content !== 'string' || !data.content.trim() || data.content.length > 6000 || typeof data.demo !== 'boolean') throw Error('助手回复格式异常，请重试');
      messages.value.push({ role: 'assistant', content: data.content, demo: data.demo, truncated: data.truncated === true });
    } catch (e) {
      if (alive && version === generation) { messages.value = previous;draft.value = question;failed.value = question;error.value = (e as Error).message || '暂时无法回复，请稍后重试'; }
    } finally { if (alive && version === generation) busy.value = false; }
  }
  function retry() { if (!failed.value || draft.value.trim() !== failed.value) return;return send(); }
  watch(() => [getUser()?.id, getUser()?.status, getUser()?.mustChangePassword], () => { clear();available.value = false;consent.value = false;demo.value = false;status.value = '';void load(); }, { immediate: true, flush: 'sync' });
  onUnmounted(() => { alive = false;clear(); });
  return { messages, draft, error, busy, loading, consent, available, demo, status, failed, allowed, full, canSend, load, clear, send, retry };
}
