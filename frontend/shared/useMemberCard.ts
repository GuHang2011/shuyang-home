import { computed, onUnmounted, ref, watch } from 'vue';
import type { Row } from './domain';
type Api = (path: string, method?: string, body?: unknown) => Promise<any>;
export function useMemberCard(getUser: () => Row | null, api: Api) {
  const code=ref(''),expiresAt=ref(''),remaining=ref(0),busy=ref(false),error=ref(''),verifyInput=ref(''),verifying=ref(false),verifyError=ref(''),result=ref<Row|null>(null),demo=ref(false);
  const allowed=computed(()=>getUser()?.status==='approved'&&!getUser()?.mustChangePassword&&!!getUser()?.memberNo);
  const staff=computed(()=>getUser()?.status==='approved'&&!getUser()?.mustChangePassword&&['superadmin','admin','organizer'].includes(getUser()?.role));
  let generation=0,alive=true,timer:ReturnType<typeof setInterval>|undefined;
  function clear() {++generation;if(timer)clearInterval(timer);timer=undefined;code.value='';expiresAt.value='';remaining.value=0;busy.value=false;error.value='';verifyInput.value='';verifying.value=false;verifyError.value='';result.value=null;demo.value=false;}
  async function generate() {
    if(!allowed.value||busy.value)return;const version=generation;busy.value=true;error.value='';code.value='';if(timer)clearInterval(timer);
    try {
      const data=await api('/membership/card-code','POST');if(!alive||version!==generation)return;
      const duration=Date.parse(data?.expiresAt)-Date.parse(data?.serverNow);
      if(typeof data?.code!=='string'||!/^SYH-MEMBER:[A-F0-9]{48}$/.test(data.code)||!Number.isFinite(duration)||duration<=0||duration>600000)throw Error('会员码响应异常，请重新生成');
      code.value=data.code;expiresAt.value=data.expiresAt;demo.value=data.demo===true;const deadline=Date.now()+duration;
      const tick=()=>{remaining.value=Math.max(0,Math.ceil((deadline-Date.now())/1000));if(!remaining.value){code.value='';error.value='会员码已过期，请刷新二维码';if(timer)clearInterval(timer);}};
      tick();timer=setInterval(tick,1000);
    } catch(e) {if(alive&&version===generation)error.value=(e as Error).message;} finally {if(alive&&version===generation)busy.value=false;}
  }
  async function verify(value=verifyInput.value) {
    if(!staff.value||verifying.value)return;verifyInput.value=value.trim();result.value=null;verifyError.value='';const submitted=verifyInput.value,version=generation;
    if(!/^SYH-MEMBER:[A-F0-9]{48}$/.test(submitted)){verifyError.value='请扫描沭阳之家电子会员卡二维码';return;}
    verifying.value=true;
    try {const data=await api('/membership/verify-card','POST',{code:submitted});if(!alive||version!==generation||verifyInput.value!==submitted)return;
      if(typeof data?.name!=='string'||typeof data?.memberNo!=='string'||data.status!=='approved'||!Number.isFinite(Date.parse(data.verifiedAt)))throw Error('核验结果异常，请重试');result.value=data;
    } catch(e) {if(alive&&version===generation&&verifyInput.value===submitted)verifyError.value=(e as Error).message;} finally {if(alive&&version===generation)verifying.value=false;}
  }
  watch(verifyInput,()=>{result.value=null;verifyError.value='';},{flush:'sync'});
  watch(()=>[getUser()?.id,getUser()?.status,getUser()?.role,getUser()?.mustChangePassword,getUser()?.memberNo],clear,{flush:'sync'});
  onUnmounted(()=>{alive=false;clear();});
  return {code,expiresAt,remaining,busy,error,verifyInput,verifying,verifyError,result,demo,allowed,staff,generate,verify};
}

/** Alphanumeric segments avoid TextEncoder/DOM requirements on mini programs. */
export async function memberQrRects(code: string) {
  const qr=await import('qrcode'), matrix=qr.default.create([{data:code,mode:'alphanumeric'}],{errorCorrectionLevel:'M'}).modules;
  const scale=Math.floor(224/(matrix.size+8)),offset=Math.floor((224-matrix.size*scale)/2),rects:number[][]=[];
  for(let y=0;y<matrix.size;y++)for(let x=0;x<matrix.size;x++)if(matrix.data[y*matrix.size+x])rects.push([offset+x*scale,offset+y*scale,scale,scale]);
  return rects;
}
