<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { api } from '../api';
import type { Row } from '../../shared/domain';
const props = defineProps<{ placement: string }>();
const ads = ref<Row[]>([]);
async function load() { try { ads.value = (await api<Row[]>('/ads')).filter(ad => ad.placement === props.placement); } catch { ads.value = []; } }
onMounted(load); watch(() => props.placement, load);
</script>
<template><section v-if="ads.length" class="ad-placements" aria-label="合作广告"><article v-for="ad in ads" :key="ad.id" class="ad-placement"><div><span class="ad-label">广告</span><small>{{ ad.sponsor }}</small></div><h3>{{ ad.title }}</h3><p>{{ ad.content }}</p><div class="ad-bottom"><span>{{ ad.contact }}</span><a v-if="ad.url" :href="ad.url" target="_blank" rel="noopener noreferrer sponsored">了解详情 ↗</a></div></article></section></template>
<style scoped>
.ad-placements{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px;margin:24px 0}.ad-placement{padding:22px;background:#f4f0e8;border:1px solid #e7decd;border-radius:8px}.ad-placement>div:first-child{display:flex;gap:10px;align-items:center}.ad-label{font-size:9px;border:1px solid #c8bda8;border-radius:3px;color:#9d8d72;padding:1px 5px}.ad-placement h3{margin:12px 0 8px;font-size:17px;color:#6c614d}.ad-placement p{font-size:12px;color:#918370;white-space:pre-wrap;overflow-wrap:anywhere}.ad-bottom{display:flex;justify-content:space-between;gap:15px;margin-top:15px;font-size:11px;color:#8d7852}.ad-bottom span{overflow-wrap:anywhere}.ad-bottom a{white-space:nowrap}
</style>
