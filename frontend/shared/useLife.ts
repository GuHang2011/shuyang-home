import { computed, onMounted, ref, watch } from 'vue';
import { type Row, requestId } from './domain';
import { lifeTypes, lifeFields, freshLife, entryActions } from './life';
import { useRequestScope } from './useRequestScope';

export function useLife(getUser:()=>Row|null,api:(path:string,method?:string,body?:unknown)=>Promise<any>,draft:{get:(key:string)=>string;set:(key:string,value:string)=>void;remove:(key:string)=>void}) {
  const type=ref('guide'),tab=ref('public'),rows=ref<Row[]>([]),selected=ref<Row|null>(null),editing=ref(false),form=ref<Row>({}),options=ref<Row>({}),query=ref(''),region=ref(''),employment=ref('全部');
  const error=ref(''),message=ref(''),loading=ref(false),busy=ref(false),photoBusy=ref(false),photos=ref<Row[]>([]),applications=ref<Row[]>([]),checked=ref<string[]>([]),meeting=ref<Row>({}),inbox=ref<Row[]>([]),mine=ref<Row[]>([]),feedback=ref<Row[]>([]),reservations=ref<Row[]>([]),orders=ref<Row[]>([]),signups=ref<Row[]>([]);
  const showFinished=ref(false),myApplications=ref<Row[]>([]);
  const unavailableApplications=computed(()=>myApplications.value.filter(app=>['submitted','accepted'].includes(app.status)&&mine.value.some(entry=>entry.id===app.entryId&&entry.status==='unavailable')));
  const taskRows=computed(()=>mine.value.filter(row=>showFinished.value||!['resolved','closed','unavailable'].includes(row.status)&&!row.expired));
  const note=ref(''),applicationText=ref(''),orderId=ref(''),slotId=ref(''),credential=ref<Row|null>(null),pickupCode=ref(''),pickupCheck=ref<Row|null>(null),actionPrompt=ref<{label:string;run:(note:string)=>Promise<void>}|null>(null);
  const scope=useRequestScope();let generation=0,detailGeneration=0;
  const user=computed(getUser),approved=computed(()=>user.value?.status==='approved'),staff=computed(()=>approved.value&&['superadmin','admin','organizer'].includes(user.value?.role)),admin=computed(()=>approved.value&&['superadmin','admin'].includes(user.value?.role));
  const currentType=computed(()=>lifeTypes.find(x=>x.id===type.value)!),fields=computed(()=>lifeFields(type.value));
  const canCreate=computed(()=>approved.value&&(currentType.value.access==='member'||currentType.value.access==='staff'&&staff.value||admin.value));
  const filtered=computed(()=>rows.value.filter(r=>(tab.value!=='public'||!r.expired&&(!['job','help','service','lost'].includes(r.type)||r.status==='open'))&&(!query.value.trim()||[r.title,r.content,r.category,r.employer].join(' ').toLowerCase().includes(query.value.trim().toLowerCase()))&&(!region.value.trim()||String(r.region).includes(region.value.trim()))&&(type.value!=='job'||employment.value==='全部'||r.employment===employment.value)));
  const actions=computed(()=>selected.value?entryActions(selected.value,user.value):[]),unread=computed(()=>inbox.value.filter(r=>!r.read).length);
  const canEdit=computed(()=>selected.value&&(selected.value.mine||admin.value)&&!['working','confirming','resolved'].includes(selected.value.status));
  const canApply=computed(()=>selected.value&&approved.value&&!selected.value.mine&&['help','job','lost','service'].includes(selected.value.type)&&selected.value.status==='open'&&!selected.value.expired);
  const key=()=>`shuyang-life-draft:${user.value?.id}:${type.value}`;
  const enc=encodeURIComponent;
  async function load(){
    const version=++generation,valid=scope.capture();loading.value=true;error.value='';rows.value=[];
    try{
      let nextApplications:Row[]=[];let nextRows:Row[]=[],nextInbox:Row[]=[],nextMine:Row[]=[],nextFeedback:Row[]=[],nextReservations:Row[]=[],nextOrders:Row[]=[],nextSignups:Row[]=[];
      if(['public','mine','manage'].includes(tab.value))nextRows=await api(`/life/entries?type=${type.value}&scope=${tab.value}`);
      if(approved.value){
        nextInbox=await api('/life/notifications');
        if(tab.value==='tasks'){const result=await api('/life/mine');nextMine=result.entries;nextApplications=result.applications;}
        if(tab.value==='feedback')nextFeedback=await api('/life/feedback');
        if(tab.value==='pickup'){nextReservations=await api('/life/pickup');nextOrders=await api('/orders');nextRows=await api('/life/entries?type=slot');}
      }
      if(!valid()||version!==generation)return;
      myApplications.value=nextApplications;rows.value=nextRows;inbox.value=nextInbox;mine.value=nextMine;feedback.value=nextFeedback;reservations.value=nextReservations;orders.value=nextOrders;signups.value=nextSignups;
    }catch(e){if(valid()&&version===generation)error.value=(e as Error).message;}finally{if(valid()&&version===generation)loading.value=false;}
  }
  async function run(fn:()=>Promise<void>,success='操作已保存'){
    if(busy.value)return;busy.value=true;error.value='';message.value='';const valid=scope.capture();
    try{await fn();if(valid())message.value=success;}catch(e){if(valid())error.value=(e as Error).message;}finally{if(valid())busy.value=false;}
  }
  async function open(id:string){
    const version=++detailGeneration,valid=scope.capture();selected.value=null;applications.value=[];checked.value=[];meeting.value={};editing.value=false;actionPrompt.value=null;note.value='';applicationText.value='';error.value='';loading.value=true;
    try{
      const row=await api('/life/entries/'+enc(id));let apps:Row[]=[],check:string[]=[],meet:Row={};
      if(approved.value){if(['help','job','lost','service'].includes(row.type))apps=await api('/life/entries/'+enc(id)+'/applications');if(row.type==='guide')check=(await api('/life/entries/'+enc(id)+'/checklist')).checked.filter((x:string)=>row.checklist.includes(x));if(row.type==='trip')meet=await api('/life/entries/'+enc(id)+'/meeting');}
      if(!valid()||version!==detailGeneration)return;selected.value=row;applications.value=apps;checked.value=check;meeting.value=meet;
    }catch(e){if(valid()&&version===detailGeneration)error.value=(e as Error).message;}finally{if(valid()&&version===detailGeneration)loading.value=false;}
  }
  function back(){if(busy.value)return;++detailGeneration;selected.value=null;editing.value=false;actionPrompt.value=null;error.value='';message.value='';credential.value=null;pickupCheck.value=null;load();}
  function switchTab(next:string){if(busy.value)return;tab.value=next;back();}
  function switchType(next:string){if(busy.value)return;type.value=next;tab.value='public';query.value='';region.value='';employment.value='全部';back();}
  async function edit(row?:Row){
    if(!canCreate.value&&!row)return;const valid=scope.capture();await run(async()=>{const opts=await api('/life/options');if(!valid())return;options.value=opts;form.value=row?{...row,checklistText:(row.checklist||[]).join('\n'),meetingPointsText:(row.meetingPoints||[]).join('\n')}:freshLife(type.value);for(const field of lifeFields(type.value))if(field.kind==='datetime'&&form.value[field.key])form.value[field.key]=new Date(new Date(form.value[field.key]).getTime()+8*3600000).toISOString().slice(0,16);form.value.requestId=requestId();photos.value=[];photoBusy.value=false;editing.value=true;});
  }
  function keepDraft(){try{const value={...form.value};delete value.photos;draft.set(key(),JSON.stringify(value));message.value='文字草稿已保存，照片请在恢复后重新选择';}catch{error.value='设备无法保存草稿，请保留文字后重试';}}
  function restoreDraft(){try{const text=draft.get(key());if(!text){message.value='暂无已保存草稿';return;}const row=JSON.parse(text);if(row.type!==type.value)throw new Error();form.value={...row,requestId:requestId(),photos:[]};photos.value=[];message.value='已恢复文字草稿';}catch{error.value='草稿无法读取，可清除后重新填写';}}
  function clearDraft(){draft.remove(key());message.value='草稿已清除';}
  async function save(){
    if(photoBusy.value){error.value='请等待照片上传完成，或移除失败照片';return;}
    const valid=scope.capture();await run(async()=>{const body:Row={...form.value,type:type.value,photos:[...(form.value.photos||[]),...photos.value.map(p=>p.id)]};for(const field of fields.value){if(field.kind==='number')body[field.key]=Number(body[field.key]);if(field.kind==='datetime'&&body[field.key]&&!String(body[field.key]).endsWith('Z'))body[field.key]=new Date(String(body[field.key])+':00+08:00').toISOString();}
      const saved=await api('/life/entries','POST',body);if(!valid())return;draft.remove(key());editing.value=false;await load();if(valid())await open(saved.id);
    },'已保存；需审核的内容通过后展示');
  }
  function ask(label:string,fn:(note:string)=>Promise<void>){note.value='';actionPrompt.value={label,run:fn};}
  async function confirmAction(){const pending=actionPrompt.value;if(!pending||note.value.trim().length<2){error.value='请填写至少2字的处理说明';return;}const valid=scope.capture();await run(async()=>{await pending.run(note.value.trim());if(valid())actionPrompt.value=null;});}
  function entryAction(action:string,label:string){if(!selected.value)return;const id=selected.value.id,valid=scope.capture();ask(label,async note=>{await api('/life/entries/'+enc(id)+'/action','POST',{action,note});if(valid())await open(id);});}
  function appAction(app:Row,action:string,label:string){const id=selected.value?.id,valid=scope.capture();ask(label,async note=>{await api('/life/applications/'+enc(app.id)+'/action','POST',{action,note});if(valid()){if(id)await open(id);else await load();}});}
  async function apply(){if(!selected.value)return;const id=selected.value.id,valid=scope.capture();await run(async()=>{await api('/life/entries/'+enc(id)+'/apply','POST',{message:applicationText.value});if(valid())await open(id);},'申请已提交，可在我的事项查看');}
  async function subscribe(){if(!selected.value)return;const row=selected.value,valid=scope.capture();await run(async()=>{await api('/life/entries/'+enc(row.id)+'/subscribe','POST',{active:!row.subscribed});if(valid())selected.value={...row,subscribed:!row.subscribed};},'订阅设置已更新，消息在站内通知查看');}
  async function toggleCheck(item:string){if(!selected.value)return;const row=selected.value,next=checked.value.includes(item)?checked.value.filter(x=>x!==item):[...checked.value,item],valid=scope.capture();await run(async()=>{await api('/life/entries/'+enc(row.id)+'/checklist','POST',{checked:next});if(valid())checked.value=next;},'个人材料清单已保存');}
  function report(){if(!selected.value)return;const id=selected.value.id;ask('反馈信息问题',async message=>{await api('/life/entries/'+enc(id)+'/feedback','POST',{message});});}
  function replyFeedback(row:Row){const valid=scope.capture();ask('回复并办结反馈',async reply=>{await api('/life/feedback/'+enc(row.id),'POST',{reply});if(valid())await load();});}
  async function readMessage(row?:Row){const valid=scope.capture();await run(async()=>{await api('/life/notifications/read','POST',{id:row?.id||'all'});if(!valid())return;await load();if(row?.targetId&&valid())await open(row.targetId);},row?'通知已读':'已全部标为已读');}
  async function selectMeeting(point:string){if(!selected.value)return;const id=selected.value.id,valid=scope.capture();await run(async()=>{await api('/life/entries/'+enc(id)+'/meeting','POST',{point});if(valid())await open(id);},'集合点已更新；活动签到需到场后操作');}
  async function reserve(){const valid=scope.capture();await run(async()=>{await api('/life/pickup/reserve','POST',{orderId:orderId.value,slotId:slotId.value});if(valid())await load();},'自提时段已预约');}
  async function cancelPickup(row:Row){const valid=scope.capture();ask('取消自提预约',async()=>{await api('/life/pickup/'+enc(row.id)+'/cancel','POST',{});if(valid()){credential.value=null;await load();}});}
  async function getCredential(row:Row,delegate=false,revoke=false){const valid=scope.capture();await run(async()=>{const result=await api('/life/pickup/'+enc(row.id)+'/credential','POST',{delegate,revoke});if(valid())credential.value=revoke?null:result;},revoke?'代领凭证已撤销':'凭证已生成，重新生成会使同类旧凭证失效');}
  async function checkPickup(confirm=false){const code=pickupCode.value.trim();if(confirm&&pickupCheck.value?.code!==code){error.value='凭证已变化，请重新核对订单';return;}const valid=scope.capture();await run(async()=>{const result=await api('/life/pickup/check','POST',{code,confirm});if(valid()&&code===pickupCode.value.trim())pickupCheck.value={...result,code};},confirm?'已确认交付，结算状态未自动变更':'请核对商品和数量，再确认交付');}
  watch([()=>getUser()?.id,()=>getUser()?.role,()=>getUser()?.status],()=>{scope.invalidate();++generation;++detailGeneration;selected.value=null;editing.value=false;form.value={};photos.value=[];applications.value=[];checked.value=[];meeting.value={};inbox.value=[];mine.value=[];myApplications.value=[];rows.value=[];options.value={};feedback.value=[];reservations.value=[];orders.value=[];signups.value=[];credential.value=null;pickupCheck.value=null;pickupCode.value='';applicationText.value='';orderId.value='';slotId.value='';note.value='';actionPrompt.value=null;busy.value=false;loading.value=false;error.value='';message.value='';tab.value='public';load();},{flush:'sync'});
  onMounted(load);
  return {unavailableApplications,showFinished,taskRows,type,tab,rows,selected,editing,form,options,query,region,employment,error,message,loading,busy,photoBusy,photos,applications,checked,meeting,inbox,mine,feedback,reservations,orders,signups,note,applicationText,orderId,slotId,credential,pickupCode,pickupCheck,actionPrompt,user,approved,staff,admin,currentType,fields,canCreate,filtered,actions,unread,canEdit,canApply,load,open,back,switchTab,switchType,edit,keepDraft,restoreDraft,clearDraft,save,confirmAction,entryAction,appAction,apply,subscribe,toggleCheck,report,replyFeedback,readMessage,selectMeeting,reserve,cancelPickup,getCredential,checkPickup};
}
