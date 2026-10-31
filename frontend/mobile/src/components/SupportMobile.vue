<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { api } from '../platform';
import DateTimeField from './DateTimeField.vue';
import { type Row, statusNames, contactStates, pledgeStates, formatTime, localDateInput, fromLocalInput, requestId } from '../../../shared/domain';
import { useRequestScope } from '../../../shared/useRequestScope';
const props = defineProps<{ mode: 'crowdfunding' | 'contacts'; user: Row | null; target?: Row | null }>();
const emit = defineEmits<{ (event: 'join'): void; (event: 'clear-target'): void }>();
const rows = ref<Row[]>([]), mine = ref<Row[]>([]), pledges = ref<Row[]>([]), members = ref<Row[]>([]), details = ref<Row[]>([]);
const tab = ref('public'), screen = ref(''), form = ref<Row>({}), selected = ref<Row>({}), busy = ref(false), error = ref('');
const types = ['物资', '志愿服务', '资金意向'];
const visible = computed(() => tab.value === 'mine' ? mine.value : rows.value);
const staff = computed(() => props.user && ['superadmin', 'admin', 'organizer'].includes(props.user.role));
const loading = ref(false);
let generation = 0, detailGeneration = 0;
const scope = useRequestScope();
onUnmounted(() => { ++generation; });
async function load() {
  const version = ++generation;loading.value = true;error.value = '';
  try {
    if (props.mode === 'crowdfunding') {
      const data = await api('/crowdfunding');if (version !== generation) return;rows.value = data;
      if (props.user) { const data = await Promise.all([api('/my/crowdfunding'), api('/my/pledges')]);if (version !== generation) return;[mine.value, pledges.value] = data; }
    } else if (props.user) {
      const data = await api('/my/contact-exchanges');if (version !== generation) return;rows.value = data;
      if (props.user.status === 'approved') { const data = await api('/members');if (version !== generation) return;members.value = data.filter((m: Row) => m.id !== props.user?.id); }
    }
  } catch(e) { if (version === generation) error.value = (e as Error).message; }
finally { if (version === generation) loading.value = false; } }
function member() { if (!props.user || props.user.status !== 'approved') { emit('join');return false; }return true; }
function open(kind: string, data: Row = {}) { ++detailGeneration; screen.value = kind;form.value = { ...data };error.value = '';uni.pageScrollTo({ scrollTop: 0, duration: 0 }); }
function back() { if (busy.value) return;++detailGeneration;screen.value = '';error.value = '';emit('clear-target'); }
function create() {
  if (!member()) return;
  open(props.mode === 'contacts' ? 'contact' : 'project', props.mode === 'contacts' ? { recipientId: '', recipientName: '', contact: '', message: '' } : { title: '', type: '物资', unit: '件', goal: '', purpose: '', description: '', endsAt: localDateInput(new Date(Date.now() + 14 * 86400000)), consent: false });
}
async function act(action: () => Promise<any>, text: string, keep = false) {
  if (busy.value) return;const current = scope.capture(), id = selected.value.id;busy.value = true;error.value = '';
  try { await action();if (!current()) return;if (!keep) { screen.value = '';emit('clear-target'); }uni.showToast({ title: text, icon: 'none' });await load();if (current() && keep && selected.value.id === id && screen.value === 'supporters') { const data = await api('/crowdfunding/' + id + '/pledges');if (current() && selected.value.id === id && screen.value === 'supporters') details.value = data; } }
  catch(e) { if (current()) error.value = (e as Error).message; }finally { if (current()) busy.value = false; }
}
function detail(row: Row) { selected.value = row;open('detail'); }
function support(row: Row) { if (!member()) return;selected.value = row;open('pledge', { quantity: '', message: '', requestId: requestId() }); }
async function supporters(row: Row) {
  const current = scope.capture();selected.value = row;details.value = [];open('supporters');
  const detailVersion = detailGeneration;
  const valid = () => current() && detailVersion === detailGeneration && selected.value.id === row.id && screen.value === 'supporters';
  if (!valid()) return;
  try { const data = await api('/crowdfunding/' + row.id + '/pledges');if (valid()) details.value = data; }catch(e) { if (valid()) error.value = (e as Error).message; }
}
function confirm(path: string, content: string, body?: Row, keep = false) { const current = scope.capture();uni.showModal({ title: '请确认', content, success: result => { if (result.confirm && current()) act(() => api(path, 'POST', body), '操作已完成', keep); } }); }
function chooseType(event: any) { form.value.type = types[Number(event.detail.value)];form.value.unit = form.value.type === '资金意向' ? '元' : form.value.type === '志愿服务' ? '小时' : '件'; }
function chooseMember(event: any) { const person = members.value[Number(event.detail.value)];if (person) { form.value.recipientId = person.id;form.value.recipientName = person.name; } }
function consent(event: any) { form.value.consent = Boolean(event.detail.value); }
function targetContact() { if (props.mode === 'contacts' && props.target && member()) open('contact', { recipientId: props.target.id, recipientName: props.target.name, contact: '', message: '' }); }
function accept(row: Row) { selected.value = row;open('acceptContact', { contact: '' }); }
function copy(value: string) { uni.setClipboardData({ data: value }); }
watch([() => props.mode, () => props.user?.id, () => props.user?.status, () => props.user?.role], () => { scope.invalidate();++detailGeneration;busy.value = false;selected.value = {};form.value = {};error.value = '';screen.value = '';++generation;rows.value = [];mine.value = [];pledges.value = [];members.value = [];details.value = [];selected.value = {};form.value = {};screen.value = '';tab.value = 'public';load(); }, { flush: 'sync' });
watch(() => props.target, targetContact);
onMounted(() => { load();targetContact(); });
</script>
<template>
  <view>
    <view v-if="error" class="error">{{ error }}<button v-if="!screen" class="text-button" :disabled="loading" @click="load">重新加载</button></view><view v-if="loading && !screen" class="loading">正在加载…</view>
    <template v-if="!screen">
      <view class="title">{{ mode === 'contacts' ? '让联系，多一份尊重' : '把每份心意，汇成帮助' }}</view>
      <view class="intro">{{ mode === 'contacts' ? '双方同意后，才展示彼此选择分享的信息。' : '物资 · 志愿服务 · 资金意向' }}</view>
      <view v-if="mode === 'crowdfunding'" class="safe-note">资金仅登记支持意向，不代表已收款。本平台不在线收款、扣款或转账。</view>
      <button class="primary" @click="create">{{ mode === 'contacts' ? '申请交换联系方式' : '发起众筹项目' }}</button>
      <view v-if="mode === 'crowdfunding'" class="pill-row">
        <text :class="['pill', { active: tab === 'public' }]" @click="tab = 'public'">众筹项目</text>
        <text v-if="user" :class="['pill', { active: tab === 'mine' }]" @click="tab = 'mine'">我的发起</text>
        <text v-if="user" :class="['pill', { active: tab === 'pledges' }]" @click="tab = 'pledges'">我的支持</text>
      </view>
      <template v-if="mode === 'crowdfunding' && tab !== 'pledges'">
        <view v-if="!loading && !error && !visible.length" class="empty">暂时没有项目。<br/>说明真实需求与用途，审核后邀请老乡支持。</view>
        <view v-for="row in visible" :key="row.id" class="panel">
          <view class="row"><text class="tag">{{ row.type }}</text><text class="muted">{{ row.status !== 'approved' ? statusNames[row.status] : row.ended ? '已结束' : '支持中' }}</text></view>
          <text class="card-title" @click="detail(row)">{{ row.title }}</text><view class="post-excerpt">{{ row.purpose }}</view>
          <view class="support-progress"><view :style="{ width: Math.min(100, Number(row.pledgedQuantity) / Number(row.goal) * 100) + '%' }"/></view>
          <view class="meta">{{ row.type === '资金意向' ? '意向认领' : '已认领' }} {{ row.pledgedQuantity }} / {{ row.goal }} {{ row.unit }}</view>
          <view v-if="row.type !== '资金意向'" class="meta">已核实交付 {{ row.deliveredQuantity }} {{ row.unit }} · {{ row.supporters }}位支持者</view>
          <view class="meta">截止 {{ formatTime(row.endsAt) }} · {{ row.authorName }}</view><view v-if="row.reviewNote" class="notice-line">{{ row.reviewNote }}</view>
          <view class="button-row"><button class="text-button" @click="detail(row)">项目详情</button><button v-if="row.status === 'approved' && !row.ended && Number(row.pledgedQuantity) < Number(row.goal)" class="outline small" @click="support(row)">我来支持</button></view>
          <view v-if="row.authorId === user?.id || staff" class="button-row"><button class="text-button" @click="supporters(row)">支持记录</button><button v-if="!row.ended" class="text-button" @click="confirm('/crowdfunding/' + row.id + '/close', '结束后停止接收新的支持，已有记录保留。')">结束项目</button></view>
        </view>
      </template>
      <template v-if="mode === 'crowdfunding' && tab === 'pledges'">
        <view v-if="!loading && !error && !pledges.length" class="empty">还没有支持记录。</view>
        <view v-for="row in pledges" :key="row.id" class="panel"><text class="tag">{{ row.projectType === '资金意向' && row.status === 'pledged' ? '意向已登记，未收款' : pledgeStates[row.status] }}</text><text class="card-title">{{ row.projectTitle }}</text><view class="meta">{{ row.quantity }} {{ row.unit }} · {{ row.projectType }}</view><view class="prose">{{ row.message }}</view><button v-if="row.status === 'pledged'" class="text-button" @click="confirm('/pledges/' + encodeURIComponent(row.id) + '/cancel', '确认取消认领？项目进度会同步更新。')">取消认领</button></view>
      </template>
      <template v-if="mode === 'contacts'">
        <view v-if="!user" class="empty">登录并通过入会审核后，可申请交换联系方式。<button class="outline" @click="emit('join')">登录 / 申请加入</button></view>
        <view v-else-if="!rows.length" class="empty">还没有联系申请，可到老乡名录中选择希望联系的人。</view>
        <view v-for="row in rows" :key="row.id" class="panel"><text class="tag">{{ contactStates[row.status] }}</text><text class="card-title">{{ row.requesterName }} → {{ row.recipientName }}</text><view class="prose">{{ row.message }}</view>
          <view v-if="row.status === 'accepted'" class="contact-info"><view>{{ row.requesterName }}：{{ row.requesterContact }}</view><view>{{ row.recipientName }}：{{ row.recipientContact }}</view><button class="text-button" @click="copy(row.requesterId === user?.id ? row.recipientContact : row.requesterContact)">复制对方联系方式</button></view>
          <view v-else class="meta">{{ row.status === 'pending' ? '等待接收人同意，联系方式尚未互相展示。' : '本次交换未展示对方联系方式。' }}</view>
          <view v-if="row.status === 'pending'" class="button-row"><template v-if="row.recipientId === user?.id"><button class="primary small" @click="accept(row)">同意并分享</button><button class="text-button" @click="confirm('/contact-exchanges/' + row.id + '/action', '拒绝后，双方不会看到对方的联系方式。', { action: 'reject' })">暂不接受</button></template><button v-else class="text-button" @click="confirm('/contact-exchanges/' + row.id + '/action', '确认取消这次联系申请？', { action: 'cancel' })">取消申请</button></view>
          <button v-if="row.status === 'accepted'" class="text-button" @click="confirm('/contact-exchanges/' + row.id + '/action', '撤销后停止展示彼此联系方式；无法收回对方已保存的信息。', { action: 'revoke' })">撤销展示</button>
        </view>
      </template>
    </template>
    <template v-else>
      <button class="detail-back" :disabled="busy" @click="back">← 返回</button>
      <view class="form-page">
        <template v-if="screen === 'project'">
          <view class="form-title">发起众筹项目</view>
          <view class="field"><text class="field-label">项目名称</text><input v-model="form.title" maxlength="80" placeholder="清楚说明你想一起完成的事"/></view>
          <view class="field"><text class="field-label">支持类型</text><picker :range="types" @change="chooseType"><view class="picker-value">{{ form.type }} ▾</view></picker></view>
          <view class="field"><text class="field-label">目标数量 / 金额</text><input v-model="form.goal" type="digit" placeholder="大于0，最多两位小数"/></view>
          <view class="field"><text class="field-label">单位</text><input v-model="form.unit" :disabled="form.type !== '物资'" maxlength="10"/></view>
          <view class="field"><text class="field-label">用途与受益对象</text><textarea v-model="form.purpose" maxlength="1000" placeholder="至少5字，说明将用于什么、帮助谁"/></view>
          <view class="field"><text class="field-label">项目介绍与执行安排</text><textarea v-model="form.description" maxlength="3000" placeholder="至少10字，说明背景、执行与反馈安排"/></view>
          <DateTimeField v-model="form.endsAt" label="支持截止时间"/>
          <view class="switch-row"><text>如实填写用途，知悉平台不在线收款</text><switch :checked="form.consent" color="#276c63" @change="consent"/></view>
          <button class="primary" :disabled="busy || !form.consent" @click="act(() => api('/crowdfunding', 'POST', { ...form, endsAt: fromLocalInput(form.endsAt) }), '项目已提交审核')">提交项目审核</button>
        </template>
        <template v-if="screen === 'detail'"><text class="tag">{{ selected.type }}</text><view class="form-title">{{ selected.title }}</view><view class="section-title">用途与受益对象</view><view class="prose">{{ selected.purpose }}</view><view class="section-title">执行安排</view><view class="prose">{{ selected.description }}</view><view class="meta">{{ selected.authorName }} · 截止 {{ formatTime(selected.endsAt) }}</view><view v-if="selected.type === '资金意向'" class="safe-note">金额仅为意向认领，不代表已收款。</view><button v-if="selected.status === 'approved' && !selected.ended" class="primary" @click="support(selected)">我来支持</button></template>
        <template v-if="screen === 'pledge'"><view class="form-title">支持 {{ selected.title }}</view><view class="safe-note">{{ selected.type === '资金意向' ? '仅登记资金支持意向，不扣款、不收款。' : '请按实际能力认领；实际交付后由项目发起人核实。' }}</view><view class="field"><text class="field-label">认领数量（{{ selected.unit }}）</text><input v-model="form.quantity" type="digit" placeholder="大于0，最多两位小数"/></view><view class="field"><text class="field-label">给发起人的留言（选填）</text><textarea v-model="form.message" maxlength="300" placeholder="仅本人、发起人及组织者可见"/></view><button class="primary" :disabled="busy" @click="act(() => api('/crowdfunding/' + selected.id + '/pledges', 'POST', form), '支持意向已登记')">{{ selected.type === '资金意向' ? '登记意向，不收款' : '确认认领' }}</button></template>
        <template v-if="screen === 'supporters'"><view class="form-title">支持记录</view><view v-if="!loading && !error && !details.length" class="empty">还没有支持记录。</view><view v-for="row in details" :key="row.id" class="panel"><text class="tag">{{ row.projectType === '资金意向' && row.status === 'pledged' ? '资金意向，未收款' : pledgeStates[row.status] }}</text><text class="card-title">{{ row.supporterName }} · {{ row.quantity }}{{ row.unit }}</text><view class="prose">{{ row.message }}</view><button v-if="row.projectType !== '资金意向' && row.status === 'pledged'" class="outline" :disabled="busy" @click="confirm('/pledges/' + encodeURIComponent(row.id) + '/deliver', '请确认对应物资或志愿服务已经实际交付。', undefined, true)">核实已交付</button></view></template>
        <template v-if="screen === 'contact' || screen === 'acceptContact'">
          <view class="form-title">{{ screen === 'contact' ? '申请交换联系方式' : '同意并分享联系方式' }}</view>
          <template v-if="screen === 'contact'"><view class="field"><text class="field-label">希望联系的老乡</text><picker :range="members" range-key="name" @change="chooseMember"><view class="picker-value">{{ form.recipientName || '从自愿公开名录的会员中选择' }} ▾</view></picker></view><view class="field"><text class="field-label">打个招呼，说明来意</text><textarea v-model="form.message" maxlength="500" placeholder="至少5字，说明联系的原因"/></view></template>
          <template v-else><view class="section-title">{{ selected.requesterName }}</view><view class="prose">{{ selected.message }}</view></template>
          <view class="field"><text class="field-label">你愿意分享的联系方式</text><input v-model="form.contact" maxlength="100" placeholder="手机号、微信号或邮箱，由你选择"/></view>
          <view class="safe-note">双方同意并填写后，才可以查看和保存彼此的信息；撤销展示无法收回已经保存的信息。</view>
          <button class="primary" :disabled="busy" @click="act(() => screen === 'contact' ? api('/contact-exchanges', 'POST', form) : api('/contact-exchanges/' + selected.id + '/action', 'POST', { action: 'accept', contact: form.contact }), screen === 'contact' ? '联系申请已发出' : '双方联系方式已交换')">{{ screen === 'contact' ? '发送联系申请' : '同意并分享' }}</button>
        </template>
      </view>
    </template>
  </view>
</template>
<style scoped>
.support-progress{height:7px;background:#e8efeb;border-radius:7px;overflow:hidden;margin:18px 0 8px}.support-progress>view{height:100%;background:#4d9582}.contact-info{background:#edf5f1;color:#517f6e;padding:16px;border-radius:7px;margin-top:12px;overflow-wrap:anywhere}.contact-info>view{margin-bottom:8px}
</style>
