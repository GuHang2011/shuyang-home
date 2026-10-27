<script setup lang="ts">
import { ref, watch } from 'vue';
import { uploadMedia } from '../api';
import { useRequestScope } from '../../shared/useRequestScope';
import type { Row } from '../../shared/domain';
const props = defineProps<{ modelValue: Row | null; userId?: string }>();
const emit = defineEmits<{ (event: 'update:modelValue', value: Row | null): void; (event: 'busy', value: boolean): void }>();
const busy = ref(false), error = ref(''), scope = useRequestScope();
watch(() => props.userId, () => { scope.invalidate();busy.value = false;error.value = '';emit('busy', false); }, { flush: 'sync' });
async function attach(event: Event) {
  const input = event.target as HTMLInputElement, file = input.files?.[0];if (!file || busy.value) return;
  const valid = scope.capture();busy.value = true;emit('busy', true);error.value = '';
  try { if (file.size > 10 * 1024 * 1024) throw new Error('语音不能超过10MB');const row = await uploadMedia(file, 'forum');if (valid()) emit('update:modelValue', row); }
  catch(e) { if (valid()) error.value = (e as Error).message; }
  finally { if (valid()) { busy.value = false;emit('busy', false); }input.value = ''; }
}
</script>
<template><div class="audio-field"><label>上传语音（MP3 / M4A / WAV，最多10MB）<input type="file" accept=".mp3,.m4a,.wav,audio/mpeg,audio/mp4,audio/wav" :disabled="busy" @change="attach"></label><p v-if="busy" role="status">语音上传中…</p><div v-if="modelValue" class="audio-pending"><span>{{ modelValue.name }}</span><button type="button" class="text-button" :disabled="busy" @click="emit('update:modelValue',null)">移除语音</button></div><p v-if="error" class="form-error" role="alert">{{ error }}</p><p class="form-tip">可只附语音，文字选填。请只上传有权分享的音频，审核通过后公开。</p></div></template>
<style scoped>.audio-field{margin:20px 0}.audio-pending{display:flex;gap:15px;align-items:center;overflow-wrap:anywhere;padding:12px;background:#f1ecdf;border-radius:12px}.audio-pending span{flex:1;min-width:0}.audio-pending button{flex-shrink:0}</style>
