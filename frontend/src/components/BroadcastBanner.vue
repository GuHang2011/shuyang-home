<script setup lang="ts">
import { ref } from 'vue';
import ForumAudio from './ForumAudio.vue';
import type { Row } from '../../shared/domain';
defineProps<{ row: Row | null; count: number; error: string; loading: boolean }>();
const emit = defineEmits<{ (event: 'dismiss' | 'next' | 'refresh'): void }>();
const expanded = ref(false);
</script>
<template>
  <section v-if="row" class="broadcast-banner" aria-label="全站广播">
    <div class="broadcast-heading"><span class="broadcast-label">全站广播</span><strong>{{ row.title }}</strong><span v-if="count > 1" class="broadcast-count">共 {{ count }} 条</span></div>
    <p class="broadcast-content">{{ row.content }}</p>
    <div class="broadcast-actions"><button v-if="row.audio" class="outline small" @click="expanded = !expanded">{{ expanded ? '收起语音' : '收听广播' }}</button><button v-if="count > 1" class="text-button" @click="emit('next')">下一条广播</button><button class="text-button" @click="emit('dismiss')">本次关闭</button></div>
    <ForumAudio v-if="expanded && row.audio" :key="row.id + ':' + row.revision" :attachment="row.audio" />
  </section>
  <div v-else-if="error" class="broadcast-error" role="status">广播暂时无法加载。<button class="text-button" :disabled="loading" @click="emit('refresh')">重试</button></div>
</template>
<style scoped>
.broadcast-banner{margin:0 0 22px;padding:18px 22px;background:#ecf5ff;border:1px solid #b3d8ff;border-left:4px solid #409eff;border-radius:10px;color:#29495b;min-width:0}.broadcast-heading{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.broadcast-heading strong{font-size:17px;overflow-wrap:anywhere}.broadcast-label{color:#96733b;font-size:12px;flex-shrink:0}.broadcast-count{font-size:12px;color:#606266}.broadcast-content{font-size:14px;line-height:1.8;white-space:pre-wrap;overflow-wrap:anywhere;margin:10px 0;max-height:180px;overflow:auto}.broadcast-actions{display:flex;gap:14px;flex-wrap:wrap;align-items:center}.broadcast-actions button{min-height:44px}.broadcast-error{font-size:13px;margin-bottom:15px;color:#606266}@media(max-width:600px){.broadcast-banner{padding:15px}.broadcast-heading strong{font-size:16px}}
</style>
