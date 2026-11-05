<script setup lang="ts">
import { appearances } from '../../../shared/appearance';
const themes = appearances.filter(item => ['amber','classic','night'].includes(item.id));
defineProps<{theme:string;error:string}>();
const emit=defineEmits<{(event:'change',value:string):void}>();
</script>
<template><view class="appearance-mobile"><view class="title">把界面，调成你的习惯</view><view class="intro">切换立即生效，下次打开记住本设备的选择。</view><button v-for="item in themes" :key="item.id" :class="['theme-choice','preview-'+item.id,{chosen:theme===item.id}]" @click="emit('change',item.id)"><view class="theme-swatch"><view/><view/><view/></view><view class="theme-copy"><view class="card-title">{{item.name}} {{theme===item.id?'✓':''}}</view><view class="meta">{{item.description}}</view></view></button><view v-if="error" class="error">{{error}}</view></view></template>
<style scoped>
.theme-choice{display:flex;align-items:center;gap:28rpx;width:100%;padding:28rpx;margin:24rpx 0;text-align:left;border:2px solid var(--ui-line);border-radius:28rpx;background:var(--ui-surface);color:var(--ui-text);line-height:1.7}.theme-choice.chosen{border-color:var(--ui-accent)}.theme-swatch{flex-shrink:0;width:120rpx;height:140rpx;background:#f6f2e8;border-radius:14rpx;display:flex;flex-direction:column;gap:12rpx;padding:18rpx}.theme-swatch view{height:20rpx;background:#d9d2c3;border-radius:4rpx}.theme-swatch view:first-child{height:48rpx;background:#284b61}.theme-swatch view:last-child{width:65%;background:#b18b48}.preview-classic .theme-swatch{background:#f1f5f9}.preview-classic .theme-swatch view:first-child{background:#2563a5}.preview-classic .theme-swatch view:last-child{background:#8eb5df}.preview-night .theme-swatch{background:#0e1824}.preview-night .theme-swatch view{background:#34475b}.preview-night .theme-swatch view:first-child{background:#83b4d5}.preview-night .theme-swatch view:last-child{background:#d9b776}.theme-copy{min-width:0}.theme-copy .meta{margin:10rpx 0 0}
</style>
