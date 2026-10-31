<script setup lang="ts">
import { ref, watch } from 'vue';
import { chooseAudioFile, uploadMedia } from '../platform';
import { useRequestScope } from '../../../shared/useRequestScope';
import type { Row } from '../../../shared/domain';
const props = defineProps<{ modelValue: Row | null; userId?: string }>();
const emit = defineEmits<{ (event: 'update:modelValue', value: Row | null): void; (event: 'busy', value: boolean): void }>();
const busy = ref(false), error = ref(''), scope = useRequestScope();
watch(() => props.userId, () => { scope.invalidate();busy.value = false;error.value = '';emit('busy', false); }, { flush: 'sync' });
async function attach() {
  if (busy.value) return;const valid = scope.capture();busy.value = true;emit('busy',true);error.value = '';
  try { const file = await chooseAudioFile();if (!valid()) return;if (file.size > 10 * 1024 * 1024) throw new Error('语音不能超过10MB');const row = await uploadMedia(file.path, 'forum', '', file.name);if (valid()) emit('update:modelValue',row); }
  catch(e) { if (valid()) error.value = (e as Error).message; }
  finally { if (valid()) { busy.value = false;emit('busy',false); } }
}
</script>
<template><view class="audio-field"><button class="outline" :disabled="busy" @click="attach">{{ busy ? '上传语音中…' : '上传语音' }}</button><view class="safe-note">MP3 / M4A / WAV，最多10MB；可只附语音，文字选填。请只上传有权分享的音频，审核通过后公开。</view><!-- #ifdef MP-WEIXIN --><view class="safe-note">从微信聊天中选择音频文件；手机录音可先作为文件发送到文件传输助手。</view><!-- #endif --><view v-if="modelValue" class="audio-pending"><text>{{ modelValue.name }}</text><button class="text-button" :disabled="busy" @click="emit('update:modelValue',null)">移除语音</button></view><view v-if="error" class="error">{{ error }}</view></view></template>
<style scoped>.audio-field{margin:30rpx 0}.audio-pending{padding:20rpx;background:#f1ecdf;border-radius:20rpx;word-break:break-all;font-size:26rpx}</style>
