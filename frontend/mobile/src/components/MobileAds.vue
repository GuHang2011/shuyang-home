<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { api } from '../platform';
import type { Row } from '../../../shared/domain';
const props = defineProps<{ placement: string }>();
const rows = ref<Row[]>([]);
async function load() { try { rows.value = (await api<Row[]>('/ads')).filter(ad => ad.placement === props.placement); }catch { rows.value = []; } }
function copy(url: string) { uni.setClipboardData({ data: url }); }
onMounted(load);watch(() => props.placement, load);
</script>
<template><view v-if="rows.length"><view v-for="ad in rows" :key="ad.id" class="mobile-ad"><view class="row"><text class="tag">广告</text><text class="muted">{{ ad.sponsor }}</text></view><text class="card-title">{{ ad.title }}</text><view class="prose">{{ ad.content }}</view><view class="meta">{{ ad.contact }}</view><button v-if="ad.url" class="text-button" @click="copy(ad.url)">复制详情链接 ↗</button></view></view></template>
<style scoped>.mobile-ad{padding:28rpx;background:#f5f0e7;border:1px solid #e6ddce;border-radius:12rpx;margin:25rpx 0}.mobile-ad .prose{font-size:24rpx;color:#998775}</style>
