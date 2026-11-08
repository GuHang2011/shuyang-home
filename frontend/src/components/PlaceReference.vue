<script setup lang="ts">
import { suzhouReference } from '../../shared/placeMaterials';
</script>
<template>
  <aside class="place-reference">
    <div><h3>在苏州生活</h3><p>{{ suzhouReference.description }}</p></div>
    <a :href="suzhouReference.url" target="_blank" rel="noopener noreferrer">{{ suzhouReference.source }} · {{ suzhouReference.title }} ↗</a>
  </aside>
</template>
<style scoped>
.place-reference{margin:24px 0;padding:20px 0;border-top:1px solid var(--skin-border,#e2ddcf);border-bottom:1px solid var(--skin-border,#e2ddcf);display:flex;justify-content:space-between;align-items:center;gap:20px}.place-reference h3{font-size:18px;margin:0 0 6px}.place-reference p{font-size:14px;line-height:1.8;margin:0;color:var(--skin-muted,#657076)}.place-reference a{font-size:13px;color:var(--skin-primary,#29495b);line-height:1.8;min-height:44px;display:flex;align-items:center;flex-shrink:0}@media(max-width:900px){.place-reference{display:block}.place-reference a{margin-top:4px}}
</style>
