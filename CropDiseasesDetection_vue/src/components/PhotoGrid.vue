<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue';
import { mediaBlob } from '../api';
import type { Row } from '../../shared/domain';
const props = defineProps<{ photos: Row[] }>();
const pictures = ref<Row[]>([]), selected = ref<Row | null>(null), dialog = ref<HTMLDialogElement | null>(null);
let generation = 0;
function clear() { pictures.value.forEach(p => p.url && URL.revokeObjectURL(p.url));pictures.value = [];dialog.value?.close();selected.value = null; }
async function load(picture: Row, version = generation) {
  picture.error = '';picture.loading = true;
  try { const blob = await mediaBlob(picture.id);if (version !== generation) return;picture.url = URL.createObjectURL(blob); }
  catch (e) { if (version === generation) picture.error = (e as Error).message; }
  finally { if (version === generation) picture.loading = false; }
}
watch(() => props.photos.map(p => p.id).join(','), () => {
  ++generation;clear();pictures.value = props.photos.map(p => ({ ...p, url: '', loading: true, error: '' }));
  pictures.value.forEach(p => void load(p));
}, { immediate: true });
async function show(picture: Row) { selected.value = picture;await nextTick();dialog.value?.showModal(); }
onUnmounted(() => { ++generation;clear(); });
</script>
<template><div v-if="pictures.length" class="photo-grid" aria-label="帖子照片">
  <div v-for="(picture,index) in pictures" :key="picture.id" class="photo-tile">
    <button v-if="picture.url" type="button" :aria-label="'查看照片 ' + (index + 1)" @click.stop="show(picture)"><img :src="picture.url" :alt="picture.name" loading="lazy"></button>
    <div v-else class="photo-unavailable" role="status"><span>{{ picture.loading ? '照片加载中…' : picture.error }}</span><button v-if="!picture.loading" type="button" @click.stop="load(picture)">重试</button></div>
  </div>
  <Teleport to="body"><dialog ref="dialog" class="photo-dialog" aria-label="照片预览" @click="($event.target === dialog) && dialog?.close()"><div v-if="selected" class="photo-dialog-body"><button type="button" class="photo-close" autofocus @click="dialog?.close()">关闭 ×</button><img :src="selected.url" :alt="selected.name"><p>{{ selected.name }}</p></div></dialog></Teleport>
</div></template>
<style scoped>
.photo-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:20px 0;max-width:720px}.photo-tile{min-width:0;aspect-ratio:1;border-radius:12px;overflow:hidden;background:#f0ebdf;border:1px solid #e2dccf}.photo-tile>button{width:100%;height:100%;display:block;padding:0}.photo-tile img{width:100%;height:100%;object-fit:cover;display:block}.photo-unavailable{display:flex;flex-direction:column;justify-content:center;text-align:center;height:100%;font-size:13px;padding:10px;color:#596d75}.photo-unavailable button{min-height:44px;text-decoration:underline}.photo-dialog{border:0;background:transparent;color:white;max-width:100vw;max-height:100dvh;width:100vw;height:100dvh;padding:0}.photo-dialog::backdrop{background:#122432f2}.photo-dialog-body{height:100%;padding:80px 24px 30px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:18px}.photo-dialog img{max-width:100%;max-height:calc(100dvh - 170px);object-fit:contain}.photo-dialog p{overflow-wrap:anywhere;font-size:14px}.photo-close{position:absolute;top:20px;right:20px;min-height:44px;min-width:88px;padding:10px 16px;border:1px solid #ffffff66;border-radius:10px;color:white;background:#233f54;font-size:15px}@media(max-width:600px){.photo-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
