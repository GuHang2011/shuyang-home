<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import type { Row } from '../../shared/domain';
import { useMemberCard, memberQrRects } from '../../shared/useMemberCard';
import { api } from '../api';
import WebScanner from './WebScanner.vue';
const props=defineProps<{user:Row|null}>();
const {code,remaining,busy,error,verifyInput,verifying,verifyError,result,demo,allowed,staff,generate,verify}=useMemberCard(()=>props.user,api);
const canvas=ref<HTMLCanvasElement|null>(null),scanning=ref(false);
watch(()=>props.user?.id,()=>{scanning.value=false;});
watch(code,async value=>{if(!value)return;try{const rects=await memberQrRects(value);await nextTick();if(code.value!==value||!canvas.value)return;const ctx=canvas.value.getContext('2d');if(!ctx)throw Error();ctx.fillStyle='#fff';ctx.fillRect(0,0,224,224);ctx.fillStyle='#000';rects.forEach(([x,y,w,h])=>ctx.fillRect(x,y,w,h));}catch{if(code.value===value){code.value='';error.value='二维码绘制失败，请刷新重试';}}});
async function scanned(value:string){scanning.value=false;await verify(value);}
</script>
<template><section class="member-qr panel" aria-label="电子会员卡二维码"><h3>会员身份码</h3><p>向工作人员出示二维码核验会员身份，有效期10分钟。刷新后旧码失效。</p><template v-if="allowed"><button class="outline" :disabled="busy" @click="generate">{{ busy ? '正在生成…' : code ? '刷新会员二维码' : '出示会员二维码' }}</button><div v-if="code" class="member-qr-picture"><canvas ref="canvas" width="224" height="224" role="img" aria-label="会员身份二维码"/><p>{{ demo ? '演示会员码 · ' : '' }}剩余 {{ remaining }} 秒</p></div></template><p v-else>审核通过并生成会员编号后可使用会员码。</p><p v-if="error" class="form-error" role="alert">{{ error }}</p><p class="qr-tip">二维码不含姓名或联系方式，仅限站内工作人员核验；不会登录账号、扣款或自动签到。</p>
  <div v-if="staff" class="member-qr-verify"><h3>工作人员核验</h3><button class="outline" :disabled="verifying" @click="scanning=!scanning">{{ scanning ? '收起扫码' : '扫描会员码' }}</button><WebScanner v-if="scanning" confirm-label="确认核验会员身份" @result="scanned"/><form @submit.prevent="verify()"><label>会员码内容<input v-model="verifyInput" maxlength="100" placeholder="也可粘贴扫码得到的会员码" autocomplete="off"></label><button class="primary" :disabled="verifying || !verifyInput.trim()">{{ verifying ? '正在核验…' : '核验会员身份' }}</button></form><p v-if="verifyError" role="alert" class="form-error">{{ verifyError }}</p><div v-if="result" class="member-qr-result" role="status"><strong>{{ result.demo ? '演示核验通过' : '会员身份有效' }}</strong><p>{{ result.name }} · {{ result.memberNo }}</p><p>请现场核对持卡人。此结果不代表活动已签到。</p></div></div>
</section></template>
<style scoped>.member-qr{margin:24px 0;color:var(--skin-text,#303133);overflow-wrap:anywhere}.member-qr h3{font-size:18px;margin:0 0 12px}.member-qr p{font-size:13px;line-height:1.8;margin:12px 0}.member-qr button{min-height:44px}.member-qr-picture{margin:18px 0}.member-qr canvas{display:block;width:224px;height:224px;max-width:100%;background:#fff}.qr-tip{color:var(--skin-muted,#606266)}.member-qr-verify{border-top:1px solid var(--skin-border,#dcdfe6);padding-top:18px;margin-top:18px}.member-qr-verify form{display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;margin-top:16px}.member-qr-verify label{flex:1;min-width:0;font-size:13px}.member-qr-verify input{display:block;width:100%;margin-top:8px;box-sizing:border-box}.member-qr-result{background:var(--skin-soft,#ecf5ff);padding:14px;margin-top:16px;border-radius:8px}</style>
