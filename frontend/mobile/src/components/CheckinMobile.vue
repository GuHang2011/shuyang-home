<script setup lang="ts">
import { ref, watch } from 'vue';
import { api } from '../platform';
import { type Row, formatTime } from '../../../shared/domain';
import { useCheckin } from '../../../shared/checkin';
// #ifdef H5
import WebScanner from '../../../src/components/WebScanner.vue';
// #endif
const props = defineProps<{ user: Row | null; target?: Row | null }>();const emit = defineEmits<{ (event: 'join'): void }>();const scanning = ref(false), scanResult = ref('');
function locate(): Promise<Row> { return new Promise((resolve,reject) => uni.getLocation({ type: 'wgs84', isHighAccuracy: true, success: p => resolve({ latitude: p.latitude, longitude: p.longitude, accuracy: p.accuracy }), fail: () => reject(new Error('无法取得位置，请检查定位授权，或联系现场组织者')) })); }
const { mine,signup,selected,settings,error,message,busy,select,scanned,checkin } = useCheckin(() => props.user, api, locate);
function scan() {
  // #ifdef H5
  scanning.value = !scanning.value;
  // #endif
  // #ifdef MP-WEIXIN
  uni.scanCode({ scanType: ['qrCode'], onlyFromCamera: false, success: result => { scanResult.value = result.result; }, fail: () => { error.value = '未能识别二维码，请检查相机权限或选择清晰图片重试。'; } });
  // #endif
}
async function confirm(value: string) { if (await scanned(value)) { scanning.value = false;scanResult.value = ''; } }
watch(() => props.target, row => { if (row && props.user?.status === 'approved') select(row); }, { immediate: true });
</script>
<template><view><view class="title">到场签到</view><view class="intro">到场了，和老乡打个招呼。</view><button class="primary" @click="scan">扫一扫／选择二维码图片</button><!-- #ifdef H5 --><WebScanner v-if="scanning" @result="confirm"/><!-- #endif --><view v-if="scanResult" class="panel"><view class="meta">识别结果</view><view class="scan-result">{{ scanResult }}</view><button class="outline" @click="confirm(scanResult)">确认打开站内签到</button></view><view v-if="error" class="error">{{ error }}</view><view v-if="message" class="notice-line">{{ message }}</view><view v-if="user?.status !== 'approved'" class="empty">审核通过后即可签到<button class="primary" @click="emit('join')">登录／查看入会状态</button></view><template v-else><view v-if="selected" class="panel selected-event"><button class="text-button" @click="selected = null">← 我的活动</button><view class="card-title">{{ selected.title }}</view><view class="meta">{{ selected.location }}</view><view v-if="signup?.status === 'checked_in'" class="notice-line">已签到 · {{ formatTime(signup.checkedAt) }}<br/>{{ signup.hoursFinalized === false ? '志愿时长等待组织者核定' : '已核定 ' + signup.hours + ' 小时' }}</view><template v-else-if="settings.enabled"><view class="prose">开放时间：{{ formatTime(settings.opensAt) }} — {{ formatTime(settings.closesAt) }}</view><view class="meta">须在签到点 {{ settings.radius }} 米范围内</view><view class="safe-note">点击后请求定位授权。只记录签到时间和距离，不保存你的原始坐标。</view><button class="primary" :disabled="busy" @click="checkin">{{ busy ? '正在定位并核验…' : '授权定位并签到' }}</button></template><view v-else class="safe-note">组织者尚未开放地点签到，请联系现场工作人员。</view></view><template v-else><view class="section-title">我的活动</view><view v-if="!mine.length" class="empty">报名活动后，即可在这里签到。</view><view v-for="row in mine" :key="row.id" class="panel" @click="select(row.event)"><view class="row"><view class="card-title">{{ row.event.title }}</view><text class="tag">{{ row.status === 'checked_in' ? '已签到' : '查看签到' }}</text></view><view class="meta">{{ formatTime(row.event.startsAt) }}</view><view class="meta">{{ row.event.location }}</view></view></template></template></view></template>
<style scoped>.selected-event{margin-top:30rpx}.selected-event .card-title{margin:25rpx 0}.scan-result{font-size:24rpx;word-break:break-all;line-height:1.9;margin:20rpx 0}</style>
