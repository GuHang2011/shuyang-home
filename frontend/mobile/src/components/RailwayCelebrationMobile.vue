<script setup lang="ts">
import { useRailwayCelebration } from '../../../shared/useRailwayCelebration';
defineProps<{ active: boolean }>();
const emit = defineEmits<{ (event: 'open'): void }>();
const { visible, dismiss } = useRailwayCelebration({ get: key => uni.getStorageSync(key), set: (key, value) => uni.setStorageSync(key, value) });
function open() { dismiss(); emit('open'); }
</script>

<template>
  <view v-if="active && visible" class="rail-celebration" aria-label="淮新高铁庆祝专题">
    <button role="button" class="rail-celebrate-close" aria-label="关闭庆祝悬浮窗，24小时内不再显示" @click="dismiss">×</button>
    <view class="rail-celebrate-label">家乡喜讯 <text class="rail-celebrate-hot">HOT</text></view>
    <view class="rail-celebrate-title">庆祝淮新高铁</view>
    <view class="rail-celebrate-subtitle">进入国家「十五五」</view>
    <view class="rail-celebrate-track"/>
    <button role="button" class="rail-celebrate-open" @click="open"><text>一凡说高铁 · 查看专题</text><text>↗</text></button>
  </view>
</template>

<style scoped src="../../../shared/railway-celebration.css"></style>
