<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue';
import { mediaBlob } from '../api';
import { type Row } from '../../shared/domain';
const props = defineProps<{ attachment: Row }>();
const url = ref(''), error = ref(''), busy = ref(false), preview = ref(false);let generation = 0;
async function load(download = false) { if (busy.value) return;busy.value = true;error.value = '';const version = generation;try { const blob = await mediaBlob(props.attachment.id);if (version !== generation) return;if (url.value) URL.revokeObjectURL(url.value);url.value = URL.createObjectURL(blob);if (download) { const link = document.createElement('a');link.href = url.value;link.download = props.attachment.name;link.click(); } } catch(e) { error.value = (e as Error).message; } finally { busy.value = false; } }
watch(() => props.attachment.id, () => { ++generation;if (url.value) URL.revokeObjectURL(url.value);url.value = '';if (props.attachment.type === 'image') load(); }, { immediate: true });
onUnmounted(() => { ++generation;if (url.value) URL.revokeObjectURL(url.value); });
</script>
<template><div class="attachment"><button v-if="attachment.type === 'image' && url" class="attachment-picture" @click="preview = true"><img :src="url" :alt="attachment.name"></button><button v-else :disabled="busy" class="attachment-file" @click="load(true)">{{ busy ? '读取中…' : '↓ ' + attachment.name }} · {{ Math.ceil(attachment.size / 1024) }} KB</button><small v-if="error" role="status">{{ error }}</small><div v-if="preview" class="image-overlay" @click.self="preview = false"><button @click="preview = false">关闭 ×</button><img :src="url" :alt="attachment.name"></div></div></template>
<style scoped>.attachment{margin:8px 0;max-width:100%}.attachment-picture{display:block}.attachment-picture img{display:block;width:auto;max-width:min(260px,100%);max-height:220px;border-radius:14px}.attachment-file{max-width:100%;text-align:left;overflow-wrap:anywhere;background:#ede7d7;padding:15px;border-radius:12px;color:#304b5a;font-size:13px}.attachment small{display:block;color:#9d674e}.image-overlay{position:fixed;inset:0;z-index:200;background:#142632ed;display:flex;align-items:center;justify-content:center;padding:45px}.image-overlay img{max-width:100%;max-height:90vh;object-fit:contain}.image-overlay>button{position:absolute;right:20px;top:20px;color:#fff}</style>
