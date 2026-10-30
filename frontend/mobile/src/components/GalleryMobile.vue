<script setup lang="ts">
import { ref, watch } from 'vue';
import { api, baseUrl, downloadMedia } from '../platform';
import PhotoFieldMobile from './PhotoFieldMobile.vue';
import { type Row } from '../../../shared/domain';
import { useGallery } from '../../../shared/useGallery';
import { forumEnabled } from '../../../shared/features';
const props = defineProps<{ user: Row | null }>();
const emit = defineEmits<{ (event: 'share'): void }>();
const { albums, photos, selected, source, error, busy, manage, staff, detail, save, photo, togglePhoto } = useGallery(() => props.user, api);
const editing = ref(false), form = ref<Row>({}), pendingPhotos = ref<Row[]>([]), photosPending = ref(false), publishing = ref(false), success = ref('');
watch(() => selected.value?.id, () => { pendingPhotos.value = [];photosPending.value = false;success.value = ''; });
watch(() => props.user?.id, () => { editing.value = false;form.value = {}; });
function edit(row?: Row) { form.value = row ? { ...row } : { title: '', description: '', location: '', date: new Date().toISOString().slice(0,10), status: 'draft' };editing.value = true; }
async function submit() { if (busy.value) return;if (await save(form.value)) editing.value = false; }
async function publishPhotos() {
  if (publishing.value || photosPending.value || !pendingPhotos.value.length) return;
  const albumId = selected.value?.id;publishing.value = true;success.value = '';let count = 0;
  try { for (const row of [...pendingPhotos.value]) {
    if (selected.value?.id !== albumId) break;
    if (!await photo(row.id, row.name.replace(/\.[^.]+$/, ''), albumId)) break;
    count++;pendingPhotos.value = pendingPhotos.value.filter(p => p.id !== row.id);
  } if (selected.value?.id === albumId && count) success.value = `已添加 ${count} 张照片`;
  } finally { publishing.value = false; }
}
function external() {
  // #ifdef H5
  window.open(source.value.url, '_blank', 'noopener,noreferrer');
  // #endif
  // #ifdef MP-WEIXIN
  uni.setClipboardData({ data: source.value.url, success: () => uni.showToast({ title: '链接已复制，可在浏览器查看', icon: 'none' }) });
  // #endif
}
async function preview(row: Row) { try { const path = await downloadMedia(row.mediaId);uni.previewImage({ urls: [path], current: path }); } catch(e) { error.value = (e as Error).message; } }
</script>
<template><view class="gallery-mobile">
  <view class="title">相聚的日子</view><view class="intro">把乡音、笑脸与每一次相助，留在家里的相册。</view>
  <view v-if="error" class="error">{{ error }}</view>
  <view v-if="staff && !editing && !selected" class="button-row gallery-actions"><button class="outline" @click="manage = !manage">{{ manage ? '公开相册' : '管理相册' }}</button><button class="primary" @click="edit()">新建相册</button></view>
  <view v-if="editing" class="form-page">
    <view class="form-title">{{ form.id ? '编辑相册' : '新建活动相册' }}</view>
    <view class="field"><text class="field-label">相册名称</text><input v-model="form.title" maxlength="80" placeholder="例如：周末老乡相聚"/></view>
    <view class="field"><text class="field-label">活动日期</text><picker mode="date" :value="form.date" @change="form.date = $event.detail.value"><view class="picker-value">{{ form.date }} ▾</view></picker></view>
    <view class="field"><text class="field-label">地点</text><input v-model="form.location" maxlength="150" placeholder="活动地点（选填）"/></view>
    <view class="field"><text class="field-label">相册介绍</text><textarea v-model="form.description" maxlength="2000" placeholder="记录这次相聚的故事"/></view>
    <view class="field"><text class="field-label">展示状态</text><picker :range="['保存草稿', '公开展示']" :value="form.status === 'published' ? 1 : 0" @change="form.status = Number($event.detail.value) ? 'published' : 'draft'"><view class="picker-value">{{ form.status === 'published' ? '公开展示' : '保存草稿' }} ▾</view></picker></view>
    <view class="safe-note">请确认照片具备展示授权。草稿相册中的照片仅供管理人员查看。</view>
    <view class="button-row"><button class="primary" :disabled="busy" @click="submit">{{ busy ? '保存中…' : '保存相册' }}</button><button class="outline" :disabled="busy" @click="editing = false">取消</button></view>
  </view>
  <template v-else-if="selected">
    <button class="text-button" :disabled="publishing || photosPending" @click="selected = null">← 所有相册</button>
    <view class="panel"><view class="card-title">{{ selected.title }}</view><view class="meta">{{ selected.date }} · {{ selected.location }}</view><view class="prose">{{ selected.description }}</view><button v-if="staff" class="outline" :disabled="publishing || photosPending" @click="edit(selected)">编辑相册</button></view>
    <view v-if="staff" class="gallery-upload"><PhotoFieldMobile :key="selected.id" v-model="pendingPhotos" :user-id="user?.id" scope="album" :disabled="publishing" @busy="photosPending = $event"/><button class="primary" :disabled="publishing || photosPending || !pendingPhotos.length" @click="publishPhotos">{{ publishing ? '正在添加…' : '添加到相册（' + pendingPhotos.length + '张）' }}</button><view v-if="success" class="notice-line">{{ success }}</view></view>
    <view v-if="!photos.length" class="empty">等待记录下第一份美好。</view>
    <view class="mobile-photo-wall"><view v-for="row in photos" :key="row.id"><view @click="preview(row)"><image v-if="row.status === 'published' && selected.status === 'published'" :src="baseUrl() + '/media/' + row.mediaId" mode="aspectFill" lazy-load/><view v-else class="private-image">点击预览未公开照片</view></view><text>{{ row.caption }}</text><button v-if="staff" class="text-button" :disabled="busy" @click="togglePhoto(row)">{{ row.status === 'published' ? '隐藏照片' : '恢复展示' }}</button></view></view>
  </template>
  <template v-else>
    <view v-if="forumEnabled && !staff" class="photo-invite"><view class="card-title">你的镜头，也有家乡的故事</view><view class="meta">活动相册由管理团队整理，你也可以到论坛分享自己的照片。</view><button class="outline" @click="emit('share')">去论坛分享照片 →</button></view>
    <view class="source-album" @click="external"><text class="source-mark">忆</text><view><text>我们的活动原相册</text><view>{{ source.title }}</view><text>重温相聚的时刻 ↗</text></view></view>
    <view v-if="!albums.length" class="empty">活动影像正在整理中<br/>可先查看上方原相册</view>
    <view v-for="album in albums" :key="album.id" class="mobile-album" @click="detail(album)"><image v-if="album.cover && album.status === 'published'" :src="baseUrl() + '/media/' + album.cover" mode="aspectFill" lazy-load/><view v-else class="album-placeholder">乡情 · 留影</view><view><view class="meta">{{ album.date }} · {{ album.count }} 张照片<span v-if="manage"> · {{ album.status === 'published' ? '已公开' : '草稿' }}</span></view><view class="card-title">{{ album.title }}</view><view class="meta">{{ album.location }}</view></view></view>
  </template>
</view></template>
<style scoped>
.gallery-actions,.gallery-upload{margin-bottom:28rpx}.photo-invite{padding:28rpx;background:#f0eadc;border-radius:24rpx;margin-bottom:30rpx}.source-album{display:flex;gap:28rpx;align-items:center;background:#263f54;color:#fff5db;border-radius:30rpx;padding:34rpx;margin-bottom:30rpx}.source-mark{font-size:32px;background:#e2cea0;color:#375467;border-radius:50%;width:100rpx;height:100rpx;display:flex;align-items:center;justify-content:center;flex-shrink:0}.source-album>view>text{font-size:13px;color:#d6dfda}.source-album>view>view{font-size:17px;margin:15rpx 0}.mobile-album{border:1px solid #e5dece;border-radius:28rpx;overflow:hidden;background:#fffefa;margin:25rpx 0}.mobile-album>image,.album-placeholder{width:100%;height:330rpx}.album-placeholder{background:#e7e0cd;display:flex;align-items:center;justify-content:center;color:#77623e;font-size:20px}.mobile-album>view:last-child{padding:24rpx 30rpx}.mobile-photo-wall{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20rpx}.mobile-photo-wall>view{min-width:0;background:#fffefa;border-radius:20rpx;overflow:hidden}.mobile-photo-wall image,.private-image{width:100%;height:270rpx}.private-image{display:flex;align-items:center;justify-content:center;font-size:13px;text-align:center;padding:15rpx;background:#eee8db}.mobile-photo-wall text{display:block;font-size:13px;color:#635f52;padding:16rpx;overflow-wrap:anywhere}.mobile-photo-wall .text-button{font-size:13px;padding:12rpx 16rpx}
</style>
