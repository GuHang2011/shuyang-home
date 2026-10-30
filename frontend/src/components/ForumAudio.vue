<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue';
import { mediaBlob } from '../api';
import type { Row } from '../../shared/domain';
const props = defineProps<{ attachment: Row }>();
const url = ref(''), busy = ref(false), error = ref('');
let generation = 0;
function clear() { ++generation;if (url.value) URL.revokeObjectURL(url.value);url.value = '';busy.value = false;error.value = ''; }
async function load() {
  if (busy.value) return;
  const version = generation;busy.value = true;error.value = '';
  try { const blob = await mediaBlob(props.attachment.id);if (version === generation) url.value = URL.createObjectURL(blob); }
  catch(e) { if (version === generation) error.value = (e as Error).message; }
  finally { if (version === generation) busy.value = false; }
}
watch(() => props.attachment.id, clear);
onUnmounted(clear);
</script>
<template>
  <div class="forum-audio">
    <p class="audio-name">语音 · {{ attachment.name }} · {{ Math.ceil(attachment.size / 1024) }} KB</p>
    <audio v-if="url" :src="url" controls preload="metadata" :aria-label="'播放语音：' + attachment.name" @error="error = '当前浏览器无法播放此音频，请尝试MP3或更换浏览器。'"></audio>
    <button v-else type="button" class="outline small" :disabled="busy" @click="load">{{ busy ? '加载语音中…' : '加载语音' }}</button>
    <p v-if="error" class="form-error" role="status">{{ error }}</p>
  </div>
</template>
<style scoped>
.forum-audio{padding:16px;margin:16px 0;background:#f1ecdf;border:1px solid #e5dbc5;border-radius:14px;max-width:100%;overflow:hidden}.audio-name{font-size:13px;color:#786d54;overflow-wrap:anywhere;margin-bottom:10px}.forum-audio audio{display:block;width:100%;max-width:420px;height:48px}
</style>
