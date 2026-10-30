<script setup lang="ts">
import { onUnmounted, watch } from 'vue';
import { choosePhotos, uploadMedia } from '../platform';
import { usePhotoUpload } from '../../../shared/usePhotoUpload';
import type { Row } from '../../../shared/domain';
const props = withDefaults(defineProps<{ modelValue?: Row[]; userId?: string; scope?: string; disabled?: boolean; max?: number }>(), { scope: 'forum', max: 9 });
const emit = defineEmits<{ (event: 'update:modelValue', value: Row[]): void; (event: 'busy', value: boolean): void }>();
const { items, error, running, remaining, add, remove, retry } = usePhotoUpload({
  identity: () => props.userId, max: props.max,
  upload: async (file, progress) => {
    if (!/\.(jpe?g|png)$/i.test(file.name)) throw new Error('请选择 JPG 或 PNG 照片；HEIC 请先导出为 JPG。');
    if (!file.size || file.size > 8 * 1024 * 1024) throw new Error('每张照片不能超过 8MB。');
    return uploadMedia(file.source, props.scope, '', file.name, progress);
  }, changed: rows => emit('update:modelValue', rows), pending: value => emit('busy', value)
});
watch(() => props.modelValue, rows => {
  const ids = new Set((rows || []).map(p => p.id));
  if (!running.value) items.value.filter(p => p.status === 'done' && !ids.has(p.media?.id)).forEach(p => remove(p.key));
});
let alive = true;onUnmounted(() => { alive = false; });
async function choose(camera = false) {
  if (props.disabled || running.value || !remaining.value) return;
  const owner = props.userId;
  try { const files = await choosePhotos(camera ? 1 : remaining.value, camera);if (alive && owner === props.userId) add(files); }
  catch (e) { if (alive && owner === props.userId) error.value = (e as Error).message; }
}
function preview(path: string) { uni.previewImage({ current: path, urls: items.value.map(item => item.preview) }); }
</script>
<template><view class="photo-field">
  <view class="photo-field-heading"><text>添加照片</text><text>{{ items.length }} / {{ max }} 张</text></view>
  <view class="photo-hint">JPG / PNG，每张最多 8MB。选择后可预览、移除，提交后才会发布。</view>
  <view class="photo-actions"><button :disabled="disabled || running || !remaining" @click="choose()">＋ 选择照片</button><button :disabled="disabled || running || !remaining" @click="choose(true)">拍照上传</button></view>
  <view class="photo-selection"><view v-for="item in items" :key="item.key" class="photo-selection-item">
    <image :src="item.preview" mode="aspectFill" @click="preview(item.preview)"/><view class="photo-name">{{ item.name }}</view>
    <view :class="['photo-state', { 'photo-failed': item.status === 'failed' }]">{{ item.status === 'done' ? '已上传 · 待提交' : item.status === 'uploading' ? (item.progress >= 100 ? '正在处理…' : '上传中 ' + item.progress + '%') : item.status === 'failed' ? item.error : '等待上传…' }}</view>
    <view class="photo-item-actions"><button v-if="item.status === 'failed'" :disabled="disabled || running" @click="retry(item.key)">重试</button><button :disabled="disabled || running" @click="remove(item.key)">移除</button></view>
  </view></view><view v-if="error" class="error">{{ error }}</view>
</view></template>
<style scoped>
.photo-field{margin:36rpx 0;padding:28rpx;background:#f6f3eb;border:1px dashed #c8b992;border-radius:24rpx}.photo-field-heading{display:flex;justify-content:space-between;gap:20rpx;font-size:16px;font-weight:600;color:#294657}.photo-field-heading>text:last-child,.photo-hint{font-size:13px;font-weight:400;color:#5c6b70}.photo-hint{line-height:1.8;margin:14rpx 0 24rpx}.photo-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16rpx}.photo-actions button{font-size:14px;min-height:44px;margin:0;padding:18rpx 8rpx;line-height:1.6;color:#304e60;background:#fffdf8;border:1px solid #d7cebd}.photo-selection{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18rpx;margin-top:24rpx}.photo-selection-item{min-width:0;background:#fffdf8;border:1px solid #e2dccf;border-radius:20rpx;overflow:hidden}.photo-selection-item image{width:100%;height:210rpx;display:block}.photo-name{padding:14rpx 14rpx 0;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.photo-state{font-size:12px;padding:8rpx 14rpx;line-height:1.7;color:#446853;overflow-wrap:anywhere}.photo-failed{color:#a33c29}.photo-item-actions{display:flex;padding:0 12rpx}.photo-item-actions button{font-size:13px;min-height:44px;flex:1;padding:12rpx 6rpx;background:transparent;color:#304e60}
</style>
