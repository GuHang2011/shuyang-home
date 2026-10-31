<script setup lang="ts">
import { ref, watch } from 'vue';
import { stickerUrl } from '../../shared/useStickers';
const props = defineProps<{ sticker: { id: string; label: string } }>();
const failed = ref(false);
watch(() => props.sticker.id, () => { failed.value = false; });
</script>
<template><span class="sticker-picture"><img v-if="!failed" :src="stickerUrl(sticker.id)" :alt="sticker.label" width="160" height="160" @error="failed = true"><span v-else role="img" :aria-label="sticker.label">[表情] {{ sticker.label }}</span></span></template>
<style scoped>.sticker-picture{display:block;max-width:100%;width:160px}.sticker-picture img{display:block;width:100%;height:auto;object-fit:contain}.sticker-picture>span{display:block;padding:12px;color:#294657;background:#f5eddd;border-radius:12px;font-size:14px}</style>
