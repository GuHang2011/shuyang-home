<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue';
import { onHide } from '@dcloudio/uni-app';
import { downloadMedia } from '../platform';
import type { Row } from '../../../shared/domain';
const props = defineProps<{ attachment: Row; active?: boolean }>();
const busy = ref(false), playing = ref(false), error = ref(''), progress = ref('');
let player: UniApp.InnerAudioContext | null = null, browserPlayer: HTMLAudioElement | null = null;
let generation = 0, path = '';
const started = () => { if (props.active === false) pause();else playing.value = true; };
const stopped = () => { playing.value = false; };
const failed = () => { playing.value = false;error.value = '音频无法播放，请尝试MP3格式或重新加载。'; };
function timeUpdated() { const active = browserPlayer || player;if (active) progress.value = Math.floor(active.currentTime) + ' / ' + Math.floor(active.duration || 0) + '秒'; }
// H5 playback returns a Promise. Handle its rejection instead of letting the
// uni-app audio wrapper produce an unhandled rejection for unsupported codecs.
// #ifdef H5
browserPlayer = new Audio();
browserPlayer.autoplay = false;
browserPlayer.addEventListener('play', started);
browserPlayer.addEventListener('pause', stopped);
browserPlayer.addEventListener('ended', stopped);
browserPlayer.addEventListener('error', failed);
browserPlayer.addEventListener('timeupdate', timeUpdated);
// #endif
// #ifdef MP-WEIXIN
player = uni.createInnerAudioContext();
player.autoplay = false;
player.onPlay(started);player.onPause(stopped);player.onEnded(stopped);
player.onError(failed);player.onTimeUpdate(timeUpdated);
// #endif
function release(value: string) {
  // #ifdef H5
  if (value.startsWith('blob:')) URL.revokeObjectURL(value);
  // #endif
}
function clear() { ++generation;player?.stop();if (browserPlayer) { browserPlayer.pause();browserPlayer.removeAttribute('src');browserPlayer.load(); }release(path);path = '';busy.value = false;playing.value = false;progress.value = '';error.value = ''; }
function pause() { ++generation;busy.value = false;playing.value = false;(browserPlayer || player)?.pause(); }
async function toggle() {
  if (busy.value || props.active === false) return;
  if (playing.value) { (browserPlayer || player)?.pause();return; }
  const version = generation;busy.value = true;error.value = '';
  try { if (!path) { const value = await downloadMedia(props.attachment.id);if (version !== generation) { release(value);return; }path = value;const active = browserPlayer || player;if (active) active.src = path; }if (browserPlayer) await browserPlayer.play();else player?.play(); }
  catch(e) { if (version === generation) { if (path) failed();else error.value = (e as Error).message; } }
  finally { if (version === generation) busy.value = false; }
}
watch(() => props.attachment.id, clear);
watch(() => props.active, active => { if (active === false) pause(); }, { flush: 'sync' });
onHide(pause);
onUnmounted(() => { clear();player?.destroy();browserPlayer = null; });
</script>
<template><view class="forum-audio"><view class="audio-name">语音 · {{ attachment.name }}</view><view class="row"><button class="outline small" :disabled="busy || active === false" @click="toggle">{{ busy ? '加载语音中…' : playing ? '暂停语音' : '播放语音' }}</button><text class="meta">{{ progress || Math.ceil(attachment.size / 1024) + ' KB' }}</text></view><view v-if="error" class="error">{{ error }}</view></view></template>
<style scoped>.forum-audio{padding:26rpx;margin:24rpx 0;background:#f1ecdf;border:1px solid #e5dbc5;border-radius:24rpx}.audio-name{font-size:26rpx;color:#786d54;word-break:break-all;margin-bottom:18rpx}.forum-audio .meta{font-size:24rpx}</style>
