<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue';
import { downloadMedia } from '../platform';
import { type Row } from '../../../shared/domain';
const props = defineProps<{ attachment: Row }>();const url = ref(''), error = ref(''), busy = ref(false);let generation = 0;
function release(path: string) {
  // #ifdef H5
  if (path.startsWith('blob:')) URL.revokeObjectURL(path);
  // #endif
}
async function download(open = false) { if (busy.value) return;busy.value = true;error.value = '';const version = generation;try { const path = await downloadMedia(props.attachment.id);if (version !== generation) { release(path);return; }release(url.value);url.value = path;if (open) {
  // #ifdef MP-WEIXIN
  uni.openDocument({ filePath: path, showMenu: true, fail: () => { error.value = '文件已下载，但当前微信不支持预览此类型。'; } });
  // #endif
  // #ifdef H5
  const link = document.createElement('a');link.href = path;link.download = props.attachment.name;link.click();
  // #endif
} } catch(e) { if (version === generation) error.value = (e as Error).message; } finally { if (version === generation) busy.value = false; } }
function preview() { uni.previewImage({ urls: [url.value], current: url.value }); }
watch(() => props.attachment.id, () => { ++generation;release(url.value);url.value = '';busy.value = false;if (props.attachment.type === 'image') download(); }, { immediate: true });
onUnmounted(() => { ++generation;release(url.value); });
</script>
<template><view class="attachment"><image v-if="attachment.type === 'image' && url" :src="url" mode="widthFix" class="attachment-image" @click="preview"/><button v-else class="attachment-file" :disabled="busy" @click="download(true)">{{ busy ? '读取中…' : '↓ ' + attachment.name }} · {{ Math.ceil(attachment.size / 1024) }} KB</button><view v-if="error" class="safe-note">{{ error }}</view></view></template>
<style scoped>.attachment{margin:15rpx 0;max-width:100%}.attachment-image{width:430rpx;max-width:100%;border-radius:20rpx}.attachment-file{padding:20rpx;background:#ede7d7;color:#304b5a;font-size:24rpx;line-height:1.7;word-break:break-all;text-align:left}</style>
