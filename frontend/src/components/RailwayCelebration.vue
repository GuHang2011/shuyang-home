<script setup lang="ts">
import { useRailwayCelebration } from '../../shared/useRailwayCelebration';
defineProps<{ active: boolean }>();
const emit = defineEmits<{ (event: 'open'): void }>();
const { visible, dismiss } = useRailwayCelebration({ get: key => localStorage.getItem(key), set: (key, value) => localStorage.setItem(key, value) });
function open() { dismiss(); emit('open'); }
</script>

<template>
  <aside v-if="active && visible" class="rail-celebration" aria-label="淮新高铁庆祝专题">
    <button class="rail-celebrate-close" aria-label="关闭庆祝悬浮窗，24小时内不再显示" title="关闭后24小时不再显示" @click="dismiss">×</button>
    <div class="rail-celebrate-label">家乡喜讯 <span class="rail-celebrate-hot">HOT</span></div>
    <h2 class="rail-celebrate-title">庆祝淮新高铁</h2>
    <div class="rail-celebrate-subtitle">进入国家「十五五」</div>
    <div class="rail-celebrate-track" aria-hidden="true"></div>
    <button class="rail-celebrate-open" @click="open"><span>一凡说高铁 · 查看专题</span><span aria-hidden="true">↗</span></button>
  </aside>
</template>

<style scoped src="../../shared/railway-celebration.css"></style>
