import { computed, ref, watch } from 'vue';
import type { Row } from './domain';
import { useRequestScope } from './useRequestScope';
export function useAddressBook(getUser:()=>Row|null,api:(url:string,method?:string,body?:unknown)=>Promise<any>){
 const rows=ref<Row[]>([]),query=ref(''),group=ref('全部分组'),mode=ref('all'),page=ref(1),loading=ref(false),busy=ref(false),error=ref(''),message=ref(''),editing=ref<Row|null>(null),removing=ref<Row|null>(null);
 const allowed=computed(()=>getUser()?.status==='approved'),scope=useRequestScope();let generation=0;
 const groups=computed(()=>['全部分组',...Array.from(new Set(rows.value.filter(r=>r.saved&&r.group).map(r=>r.group))).sort()]);
 const filtered=computed(()=>rows.value.filter(r=>(mode.value==='all'||mode.value==='saved'&&r.saved||mode.value==='favorite'&&r.favorite)&&(!query.value.trim()||[r.name,r.hometown,r.district,r.industry,r.note,r.group].join(' ').toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase()))&&(group.value==='全部分组'||r.group===group.value)).sort((a,b)=>Number(!!b.favorite)-Number(!!a.favorite)||String(a.name).localeCompare(String(b.name),'zh-CN')));
 const pages=computed(()=>Math.max(1,Math.ceil(filtered.value.length/20))),visible=computed(()=>filtered.value.slice((page.value-1)*20,page.value*20));
 watch([query,group,mode],()=>{page.value=1;});watch(pages,value=>{page.value=Math.min(page.value,value);});
 async function load(){const valid=scope.capture(),version=++generation;rows.value=[];if(!allowed.value)return;loading.value=true;error.value='';try{const data=await api('/address-book');if(valid()&&version===generation)rows.value=data;}catch(e){if(valid()&&version===generation)error.value=(e as Error).message;}finally{if(valid()&&version===generation)loading.value=false;}}
 function edit(row:Row){editing.value={id:row.id,name:row.name,group:row.group||'',note:row.note||'',favorite:!!row.favorite};message.value='';}
 async function save(remove=false){const row=remove?removing.value:editing.value;if(!row||busy.value||!allowed.value)return;const valid=scope.capture();busy.value=true;error.value='';try{await api('/address-book/'+encodeURIComponent(row.id),remove?'DELETE':'PUT',remove?undefined:{group:row.group,note:row.note,favorite:row.favorite});if(!valid())return;editing.value=null;removing.value=null;message.value=remove?'已从我的通讯录移除':'已保存到我的通讯录';await load();}catch(e){if(valid())error.value=(e as Error).message;}finally{if(valid())busy.value=false;}}
 watch([()=>getUser()?.id,()=>getUser()?.role,()=>getUser()?.status],()=>{scope.invalidate();++generation;rows.value=[];editing.value=null;removing.value=null;busy.value=false;loading.value=false;error.value='';message.value='';query.value='';group.value='全部分组';mode.value='all';load();},{immediate:true,flush:'sync'});
 return {rows,query,group,mode,page,loading,busy,error,message,editing,removing,allowed,groups,filtered,pages,visible,load,edit,save};
}
