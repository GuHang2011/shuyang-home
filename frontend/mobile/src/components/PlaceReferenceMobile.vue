<script setup lang="ts">
import { suzhouReference } from '../../../shared/placeMaterials';
function open() {
  // #ifdef H5
  window.open(suzhouReference.url, '_blank', 'noopener,noreferrer');
  // #endif
  // #ifdef MP-WEIXIN
  uni.setClipboardData({ data: suzhouReference.url, success: () => uni.showToast({ title: '来源链接已复制', icon: 'none' }) });
  // #endif
}
</script>
<template><view class="place-reference"><view class="place-title">在苏州生活</view><view class="place-copy">{{ suzhouReference.description }}</view><button @click="open">{{ suzhouReference.source }} · {{ suzhouReference.title }} ↗</button></view></template>
<style scoped>
.place-reference{margin:22px 0;padding:18px 0;border-top:1px solid var(--skin-border,#e2ddcf);border-bottom:1px solid var(--skin-border,#e2ddcf)}.place-title{font-size:18px;font-weight:600;margin-bottom:8px}.place-copy{font-size:14px;line-height:1.8;color:var(--skin-muted,#657076)}.place-reference button{padding:0;margin:4px 0 0;background:transparent;color:var(--skin-primary,#29495b);min-height:44px;font-size:13px;line-height:1.8;text-align:left;display:flex;align-items:center}
</style>
