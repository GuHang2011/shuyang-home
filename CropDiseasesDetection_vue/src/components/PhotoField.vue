<script setup lang="ts">
import { ref, watch } from 'vue';
import { uploadMedia } from '../api';
import { usePhotoUpload } from '../../shared/usePhotoUpload';
import type { Row } from '../../shared/domain';
const props = withDefaults(defineProps<{ modelValue?: Row[]; userId?: string; scope?: string; disabled?: boolean; max?: number }>(), { scope: 'forum', max: 9 });
const emit = defineEmits<{ (event: 'update:modelValue', value: Row[]): void; (event: 'busy', value: boolean): void }>();
const picker = ref<HTMLInputElement | null>(null), camera = ref<HTMLInputElement | null>(null);
const { items, error, running, remaining, add, remove, retry } = usePhotoUpload({
  identity: () => props.userId, max: props.max,
  upload: async (file, progress) => {
    if (!/\.(jpe?g|png)$/i.test(file.name)) throw new Error('请选择 JPG 或 PNG 照片；HEIC 请先导出为 JPG。');
    if (!file.size || file.size > 8 * 1024 * 1024) throw new Error('每张照片须大于 0 字节且不超过 8MB。');
    return uploadMedia(file.source, props.scope, '', progress);
  },
  changed: rows => emit('update:modelValue', rows), pending: value => emit('busy', value),
  release: file => URL.revokeObjectURL(file.preview)
});
watch(() => props.modelValue, rows => {
  const ids = new Set((rows || []).map(p => p.id));
  if (!running.value) items.value.filter(p => p.status === 'done' && !ids.has(p.media?.id)).forEach(p => remove(p.key));
});
function select(event: Event) {
  const input = event.target as HTMLInputElement;
  if (!props.disabled && !running.value) add(Array.from(input.files || []).map(file => ({ name: file.name, size: file.size, source: file, preview: URL.createObjectURL(file) })));
  input.value = '';
}
</script>
<template>
  <section class="photo-field" aria-label="上传照片" :aria-busy="running">
    <div class="photo-field-heading"><strong>添加照片</strong><span>{{ items.length }} / {{ max }} 张</span></div>
    <p class="photo-hint">JPG / PNG，每张不超过 8MB。选择后可预览、移除，提交后才会发布。</p>
    <input ref="picker" class="photo-input" type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" multiple aria-label="选择照片" :disabled="disabled || running || !remaining" @change="select">
    <input ref="camera" class="photo-input" type="file" accept="image/jpeg,image/png" capture="environment" aria-label="拍照上传" :disabled="disabled || running || !remaining" @change="select">
    <div class="photo-actions"><button type="button" class="outline" :disabled="disabled || running || !remaining" @click="picker?.click()">＋ 选择照片</button><button type="button" class="outline" :disabled="disabled || running || !remaining" @click="camera?.click()">拍照上传</button></div>
    <div v-if="items.length" class="photo-selection">
      <article v-for="item in items" :key="item.key" class="photo-selection-item">
        <img :src="item.preview" :alt="item.name"><p class="photo-name">{{ item.name }}</p>
        <p class="photo-state" :class="{ 'photo-failed': item.status === 'failed' }" role="status">{{ item.status === 'done' ? '已上传 · 待提交' : item.status === 'uploading' ? (item.progress >= 100 ? '正在处理…' : '上传中 ' + item.progress + '%') : item.status === 'failed' ? item.error : '等待上传…' }}</p>
        <div class="photo-item-actions"><button v-if="item.status === 'failed'" type="button" :disabled="disabled || running" @click="retry(item.key)">重试</button><button type="button" :disabled="disabled || running" :aria-label="'移除照片 ' + item.name" @click="remove(item.key)">移除</button></div>
      </article>
    </div>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
  </section>
</template>
<style scoped>
.photo-field{margin:24px 0;padding:20px;background:#f6f3eb;border:1px dashed #c8b992;border-radius:16px}.photo-field-heading{display:flex;justify-content:space-between;align-items:center;gap:16px;color:#294657;font-size:16px}.photo-field-heading span,.photo-hint{font-size:13px;color:#5c6b70;line-height:1.7}.photo-hint{margin:8px 0 16px}.photo-input{display:none}.photo-actions,.photo-item-actions{display:flex;gap:12px;flex-wrap:wrap}.photo-actions button{min-height:44px;font-size:14px}.photo-selection{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:18px}.photo-selection-item{min-width:0;background:#fffdf8;border:1px solid #e2dccf;border-radius:12px;overflow:hidden}.photo-selection-item img{width:100%;height:120px;object-fit:cover;display:block}.photo-name{padding:8px 10px 0;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.photo-state{padding:5px 10px;font-size:12px;color:#446853;line-height:1.6;overflow-wrap:anywhere}.photo-failed{color:#a33c29}.photo-item-actions{padding:0 10px}.photo-item-actions button{min-height:44px;color:#304e60;font-size:13px;padding:8px 4px}.photo-item-actions button:disabled{opacity:.5}@media(max-width:600px){.photo-field{padding:16px}.photo-selection{grid-template-columns:repeat(2,minmax(0,1fr))}.photo-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.photo-actions button{padding:10px 5px;white-space:nowrap}}
</style>
