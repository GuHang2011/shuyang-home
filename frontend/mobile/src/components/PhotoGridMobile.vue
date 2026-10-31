<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue';
import { downloadMedia } from '../platform';
import type { Row } from '../../../shared/domain';
const props = defineProps<{ photos: Row[] }>();
const pictures = ref<Row[]>([]);let generation = 0;
function release(path: string) {
  // #ifdef H5
  if (path?.startsWith('blob:')) URL.revokeObjectURL(path);
  // #endif
}
async function load(picture: Row, version = generation) {
  picture.error = '';picture.loading = true;
  try { const path = await downloadMedia(picture.id);if (version !== generation) { release(path);return; }picture.url = path; }
  catch (e) { if (version === generation) picture.error = (e as Error).message; }
  finally { if (version === generation) picture.loading = false; }
}
watch(() => props.photos.map(p => p.id).join(','), () => { ++generation;pictures.value.forEach(p => release(p.url));pictures.value = props.photos.map(p => ({ ...p, url: '', loading: true }));pictures.value.forEach(p => void load(p)); }, { immediate: true });
function preview(path: string) { uni.previewImage({ current: path, urls: pictures.value.filter(p => p.url).map(p => p.url) }); }
onUnmounted(() => { ++generation;pictures.value.forEach(p => release(p.url)); });
</script>
<template><view v-if="pictures.length" class="photo-grid"><view v-for="picture in pictures" :key="picture.id" class="photo-tile"><image v-if="picture.url" :src="picture.url" :alt="picture.name" mode="aspectFill" @click.stop="preview(picture.url)"/><view v-else class="photo-unavailable"><text>{{ picture.loading ? '照片加载中…' : picture.error }}</text><button v-if="!picture.loading" @click.stop="load(picture)">重试</button></view></view></view></template>
<style scoped>.photo-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18rpx;margin:28rpx 0}.photo-tile{min-width:0;height:250rpx;border-radius:20rpx;overflow:hidden;background:#f0ebdf;border:1px solid #e2dccf}.photo-tile image{width:100%;height:100%;display:block}.photo-unavailable{display:flex;flex-direction:column;justify-content:center;text-align:center;height:100%;font-size:13px;padding:12rpx;color:#596d75}.photo-unavailable button{min-height:44px;font-size:13px;background:transparent}</style>
