<script setup lang="ts">
import { ref, watch } from 'vue';
import { ElButton } from 'element-plus/es/components/button/index';
import { ElInput } from 'element-plus/es/components/input/index';
import { ElAlert } from 'element-plus/es/components/alert/index';
import { ElTag } from 'element-plus/es/components/tag/index';
import { api } from '../api';
import { type Row, formatTime } from '../../shared/domain';
import { useBroadcastManager, broadcastStates } from '../../shared/useBroadcasts';
import ForumAudioField from './ForumAudioField.vue';
import ForumAudio from './ForumAudio.vue';
const props = defineProps<{ user: Row | null }>();const emit = defineEmits<{ (event: 'updated'): void }>();
const { allowed, rows, form, withdrawing, error, message, busy, loading, load, edit, save, withdraw } = useBroadcastManager(() => props.user, api, () => emit('updated'));
const uploading = ref(false);watch(form, () => { uploading.value = false; });
</script>
<template>
  <section v-if="allowed" class="broadcast-manager element-surface panel" aria-label="全站广播管理">
    <header><div><h2>全站广播</h2><p>向所有访问者展示文字与语音，适合活动提醒、服务变更和重要通知。</p></div><div class="button-row"><ElButton :disabled="busy || uploading" @click="load">刷新广播</ElButton><ElButton type="primary" :disabled="busy || uploading" @click="edit()">新建广播</ElButton></div></header>
    <ElAlert v-if="error" :title="error" type="error" :closable="false" show-icon role="alert" /><ElAlert v-if="message" :title="message" type="success" :closable="false" role="status" />
    <form v-if="form" class="broadcast-form" @submit.prevent="save('published')">
      <h3>{{ form.id ? '编辑广播' : '新建广播' }}</h3><fieldset :disabled="busy || uploading">
        <label>广播标题<ElInput v-model="form.title" maxlength="60" aria-label="广播标题" /></label>
        <label>广播文字<ElInput v-model="form.content" type="textarea" :rows="4" maxlength="1000" show-word-limit aria-label="广播文字" /></label>
        <p class="form-tip">语音为可选项；请填写相应文字，方便不便收听的用户阅读。</p>
        <div class="broadcast-dates"><label>生效时间（北京时间，留空立即）<input v-model="form.startsAt" type="datetime-local" aria-label="广播生效时间"></label><label>到期时间（北京时间）<input v-model="form.endsAt" required type="datetime-local" aria-label="广播到期时间"></label></div>
      </fieldset>
      <ForumAudioField :key="form.id || form.requestId" v-model="form.audio" :user-id="user?.id" scope="broadcast" :disabled="busy" @busy="uploading = $event" />
      <ForumAudio v-if="form.audio" :key="form.audio.id" :attachment="form.audio" />
      <div class="button-row"><ElButton type="primary" native-type="submit" :loading="busy" :disabled="uploading">发布广播</ElButton><ElButton :disabled="busy || uploading" @click="save('draft')">保存草稿</ElButton><ElButton :disabled="busy || uploading" @click="form = null">取消编辑</ElButton></div>
      <p class="form-tip">保存后全站最长约30秒更新；语音由访问者主动播放。编辑已发布广播后，之前关闭过该广播的访问者也会重新看到更新。</p>
    </form>
    <section v-if="withdrawing" class="broadcast-confirm" role="group" aria-label="撤下广播确认"><p>确认撤下“{{ withdrawing.title }}”？全站通知和语音将停止提供。</p><div class="button-row"><ElButton type="danger" :loading="busy" @click="withdraw">确认撤下</ElButton><ElButton :disabled="busy" @click="withdrawing = null">返回</ElButton></div></section>
    <p v-if="loading" role="status">正在加载广播…</p><p v-else-if="!rows.length && !error" class="empty">还没有广播，点击“新建广播”添加。</p>
    <article v-for="row in rows" :key="row.id" class="broadcast-record"><div><ElTag :type="row.state === 'active' ? 'success' : 'info'">{{ broadcastStates[row.state] }}</ElTag><h3>{{ row.title }}</h3><p>{{ row.content }}</p><small>{{ formatTime(row.startsAt) }} — {{ formatTime(row.endsAt) }} · 北京时间{{ row.audio ? ' · 含语音' : '' }}</small></div><div class="button-row"><ElButton :disabled="busy || uploading" @click="edit(row)">编辑</ElButton><ElButton v-if="['active','scheduled'].includes(row.state)" type="danger" plain :disabled="busy || uploading" @click="withdrawing = row">撤下</ElButton></div></article>
  </section>
</template>
<style scoped>
.broadcast-manager header{display:flex;gap:20px;justify-content:space-between;flex-wrap:wrap}.broadcast-manager h2{font-size:24px}.broadcast-manager header p,.broadcast-manager small{color:#606266;font-size:13px;line-height:1.8}.broadcast-form,.broadcast-confirm{margin:24px 0;padding:20px;background:#f8fafc;border:1px solid #dce4ed;border-radius:10px}.broadcast-form h3{font-size:20px}.broadcast-form fieldset{border:0;padding:0;min-width:0}.broadcast-dates{display:grid;grid-template-columns:1fr 1fr;gap:18px}.broadcast-form label{display:block;margin:18px 0;font-size:14px}.broadcast-form :deep(.el-input),.broadcast-form :deep(.el-textarea){margin-top:8px}.broadcast-record{padding:22px 0;border-bottom:1px solid #ebeef5}.broadcast-record h3{font-size:18px;margin:12px 0;overflow-wrap:anywhere}.broadcast-record p{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.8;max-height:140px;overflow:auto}.broadcast-record .button-row{margin-top:14px}@media(max-width:700px){.broadcast-dates{grid-template-columns:1fr;gap:0}.broadcast-form{padding:14px}.broadcast-manager .button-row{flex-wrap:wrap}}
</style>
