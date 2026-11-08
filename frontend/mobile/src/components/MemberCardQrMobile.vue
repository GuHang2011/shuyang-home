<script setup lang="ts">
import { getCurrentInstance, nextTick, ref, watch } from 'vue';
import type { Row } from '../../../shared/domain';
import { useMemberCard, memberQrRects } from '../../../shared/useMemberCard';
import { api } from '../platform';
// #ifdef H5
import WebScanner from '../../../src/components/WebScanner.vue';
// #endif
const props=defineProps<{user:Row|null}>();
const {code,remaining,busy,error,verifyInput,verifying,verifyError,result,demo,allowed,staff,generate,verify}=useMemberCard(()=>props.user,api);
const instance=getCurrentInstance(),scanning=ref(false);
watch(()=>props.user?.id,()=>{scanning.value=false;});
watch(code,async value=>{if(!value)return;try{const rects=await memberQrRects(value);await nextTick();if(code.value!==value)return;const ctx=uni.createCanvasContext('member-qr-canvas',instance?.proxy);ctx.setFillStyle('#ffffff');ctx.fillRect(0,0,224,224);ctx.setFillStyle('#000000');rects.forEach(([x,y,w,h])=>ctx.fillRect(x,y,w,h));ctx.draw();}catch{if(code.value===value){code.value='';error.value='二维码绘制失败，请刷新重试';}}});
function scan(){
  // #ifdef H5
  scanning.value=!scanning.value;
  // #endif
  // #ifdef MP-WEIXIN
  const identity=props.user?.id;uni.scanCode({scanType:['qrCode'],onlyFromCamera:false,success:r=>{if(identity===props.user?.id&&staff.value)verifyInput.value=r.result;},fail:()=>{if(identity===props.user?.id)verifyError.value='未能识别二维码，请检查权限或重试';}});
  // #endif
}
async function scanned(value:string){scanning.value=false;await verify(value);}
</script>
<template><view class="member-qr panel"><view class="card-title">会员身份码</view><view class="qr-note">向工作人员出示二维码核验会员身份，有效期10分钟。刷新后旧码失效。</view><template v-if="allowed"><button class="outline" :disabled="busy" @click="generate">{{ busy ? '正在生成…' : code ? '刷新会员二维码' : '出示会员二维码' }}</button><view v-if="code" class="member-qr-picture"><canvas canvas-id="member-qr-canvas" id="member-qr-canvas" style="width:224px;height:224px"/><view class="qr-note">{{ demo ? '演示会员码 · ' : '' }}剩余 {{ remaining }} 秒</view></view></template><view v-else class="qr-note">审核通过并生成会员编号后可使用会员码。</view><view v-if="error" class="error">{{ error }}</view><view class="qr-note">码内不含姓名或联系方式，仅限工作人员核验；不会登录账号、扣款或自动签到。</view>
  <view v-if="staff" class="member-qr-verify"><view class="card-title">工作人员核验</view><button class="outline" :disabled="verifying" @click="scan">{{ scanning ? '收起扫码' : '扫描会员码' }}</button><!-- #ifdef H5 --><WebScanner v-if="scanning" confirm-label="确认核验会员身份" @result="scanned"/><!-- #endif --><view class="qr-note">会员码内容</view><input v-model="verifyInput" maxlength="100" placeholder="也可粘贴扫码得到的会员码"/><button class="primary" :disabled="verifying || !verifyInput.trim()" @click="verify()">{{ verifying ? '正在核验…' : '核验会员身份' }}</button><view v-if="verifyError" class="error">{{ verifyError }}</view><view v-if="result" class="member-qr-result"><view>{{ result.demo ? '演示核验通过' : '会员身份有效' }}</view><view>{{ result.name }} · {{ result.memberNo }}</view><view class="qr-note">请现场核对持卡人，此结果不代表活动已签到。</view></view></view>
</view></template>
<style scoped>.member-qr{overflow-wrap:anywhere;word-break:break-word;min-width:0;margin:24rpx 0;color:var(--skin-text,#303133)}.qr-note{font-size:13px;line-height:1.8;color:var(--skin-muted,#606266);margin:18rpx 0}.member-qr button{min-height:44px;margin:16rpx 0}.member-qr-picture{margin:24rpx 0}.member-qr canvas{background:#fff;max-width:100%}.member-qr-verify{border-top:1px solid var(--skin-border,#dcdfe6);padding-top:24rpx;margin-top:24rpx}.member-qr-result{padding:20rpx;background:var(--skin-soft,#ecf5ff);font-size:15px;line-height:1.8}.member-qr input{box-sizing:border-box;min-width:0;width:100%}.member-qr-result{overflow-wrap:anywhere;word-break:break-all}</style>
