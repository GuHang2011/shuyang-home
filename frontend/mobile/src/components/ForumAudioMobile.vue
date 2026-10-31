<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue';
import { onHide } from '@dcloudio/uni-app';
import { downloadMedia } from '../platform';
import type { Row } from '../../../shared/domain';
const props = defineProps<{ attachment: Row }>();
const busy = ref(false), playing = ref(false), error = ref(''), progress = ref('');
const player = uni.createInnerAudioContext();let generation = 0, path = '';
player.autoplay = false;
player.onPlay(() => { playing.value = true; });
player.onPause(() => { playing.value = false; });
player.onEnded(() => { playing.value = false; });
player.onError(() => { playing.value = false;error.value = '音频无法播放，请尝试MP3格式或重新加载。'; });
player.onTimeUpdate(() => { progress.value = Math.floor(player.currentTime) + ' / ' + Math.floor(player.duration || 0) + '秒'; });
function release(value: string) {
  // #ifdef H5
  if (value.startsWith('blob:')) URL.revokeObjectURL(value);
  // #endif
}
function clear() { ++generation;player.stop();release(path);path = '';busy.value = false;playing.value = false;progress.value = '';error.value = ''; }
async function toggle() {
  if (busy.value) return;
  if (playing.value) { player.pause();return; }
  const version = generation;busy.value = true;error.value = '';
  try { if (!path) { const value = await downloadMedia(props.attachment.id);if (version !== generation) { release(value);return; }path = value;player.src = path; }player.play(); }
  catch(e) { if (version === generation) error.value = (e as Error).message; }
  finally { if (version === generation) busy.value = false; }
}
watch(() => props.attachment.id, clear);
onHide(() => player.pause());
onUnmounted(() => { clear();player.destroy(); });
</script>
<template><view class="forum-audio"><view class="audio-name">语音 · {{ attachment.name }}</view><view class="row"><button class="outline small" :disabled="busy" @click="toggle">{{ busy ? '加载语音中…' : playing ? '暂停语音' : '播放语音' }}</button><text class="meta">{{ progress || Math.ceil(attachment.size / 1024) + ' KB' }}</text></view><view v-if="error" class="error">{{ error }}</view></view></template>
<style scoped>.forum-audio{padding:26rpx;margin:24rpx 0;background:#f1ecdf;border:1px solid #e5dbc5;border-radius:24rpx}.audio-name{font-size:26rpx;color:#786d54;word-break:break-all;margin-bottom:18rpx}.forum-audio .meta{font-size:24rpx}</style>
