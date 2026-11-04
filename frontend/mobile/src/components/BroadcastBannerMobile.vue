<script setup lang="ts">
import { ref } from 'vue';
import ForumAudioMobile from './ForumAudioMobile.vue';
import type { Row } from '../../../shared/domain';
defineProps<{ row: Row | null; count: number; error: string; loading: boolean }>();
const emit = defineEmits<{ (event: 'dismiss' | 'next' | 'refresh'): void }>();const expanded = ref(false);
</script>
<template><view v-if="row" class="broadcast-banner"><view class="broadcast-label">全站广播 <text v-if="count > 1">· 共 {{ count }} 条</text></view><view class="broadcast-title">{{ row.title }}</view><scroll-view scroll-y class="broadcast-content"><text>{{ row.content }}</text></scroll-view><view class="button-row"><button v-if="row.audio" class="outline small" @click="expanded = !expanded">{{ expanded ? '收起语音' : '收听广播' }}</button><button v-if="count > 1" class="text-button" @click="emit('next')">下一条广播</button><button class="text-button" @click="emit('dismiss')">本次关闭</button></view><ForumAudioMobile v-if="expanded && row.audio" :key="row.id + ':' + row.revision" :attachment="row.audio"/></view><view v-else-if="error" class="safe-note">广播暂时无法加载。<button class="text-button" :disabled="loading" @click="emit('refresh')">重试</button></view></template>
<style scoped>.broadcast-banner{margin:0 0 30rpx;padding:28rpx;background:#ecf5ff;border:1px solid #b3d8ff;border-left:6rpx solid #409eff;border-radius:18rpx}.broadcast-label{font-size:24rpx;color:#96733b}.broadcast-title{font-size:32rpx;font-weight:600;color:#29495b;margin:14rpx 0;word-break:break-all}.broadcast-content{font-size:28rpx;line-height:1.8;white-space:pre-wrap;max-height:300rpx;word-break:break-all}.broadcast-banner .button-row{display:flex;flex-wrap:wrap;margin-top:18rpx;gap:16rpx}.broadcast-banner button{min-height:44px}</style>
