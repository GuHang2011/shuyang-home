<script setup lang="ts">
import { ref, watch } from 'vue';
import { baseUrl } from '../platform';
import { stickerUrl } from '../../../shared/useStickers';
const props = defineProps<{ sticker: { id: string; label: string } }>();
const failed = ref(false);
watch(() => props.sticker.id, () => { failed.value = false; });
</script>
<template><view class="sticker-picture"><image v-if="!failed" :src="stickerUrl(sticker.id, baseUrl())" :alt="sticker.label" mode="aspectFit" @error="failed = true"/><text v-else>[表情] {{ sticker.label }}</text></view></template>
<style scoped>.sticker-picture{width:160px;max-width:100%;aspect-ratio:1;display:flex;align-items:center;justify-content:center}.sticker-picture image{width:100%;height:100%}.sticker-picture text{padding:12px;background:#f5eddd;color:#294657;border-radius:12px;font-size:14px}</style>
