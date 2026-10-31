const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../frontend'),vue=require(path.join(root,'node_modules/vue'));
const ts=require(path.join(root,'node_modules/typescript')),sfc=require(path.join(root,'node_modules/@vue/compiler-sfc'));
const tests=[],test=(name,fn)=>tests.push({name,fn});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();await vue.nextTick();};
function harness(file,api,mode) {
  const unmount=[],mounted=[],notifications=[],cache=new Map(),props=vue.reactive({mode,user:{id:'a',status:'approved',role:'member'},manage:false});let token='initial';
  const vueMock={...vue,onMounted:fn=>mounted.push(fn),onUnmounted:fn=>unmount.push(fn)};
  function load(file) {
    file=path.resolve(file);if(cache.has(file))return cache.get(file);
    let source=fs.readFileSync(file,'utf8');
    if(file.endsWith('.vue'))source=sfc.compileScript(sfc.parse(source).descriptor,{id:'module-regression'}).content;
    const exports={};cache.set(file,exports);
    vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{
      exports,console,Date,Math,Set,setTimeout,clearTimeout,setInterval,clearInterval,
      window:{scrollTo(){},addEventListener(){},removeEventListener(){}},document:{activeElement:null},location:{hash:'#home'},history:{pushState(){},replaceState(){}},
      uni:{showToast:value=>notifications.push(value),pageScrollTo(){},showModal:value=>notifications.push(value),setClipboardData(){},$on(){},$off(){}},
      require:request=>request==='vue'?vueMock:request==='@dcloudio/uni-app'?{onHide(){},onShow(){},onLoad(){},onShareAppMessage(){},onPullDownRefresh(){}}:request.endsWith('/features')?{forumEnabled:true}:request.endsWith('/useChat')?{useChatUnread:()=>({unread:vue.ref(0)})}:request.endsWith('/api')||request.endsWith('/platform')?{api,getToken:()=>token,setToken:value=>{token=value;}}:request.endsWith('.vue')?{}:load(path.resolve(path.dirname(file),request+'.ts'))
    });return exports;
  }
  const effect=vue.effectScope();let state;
  effect.run(()=>{state=load(path.join(root,file)).default.setup(props,{expose(){},emit:(...args)=>notifications.push(args)});});
  return {state,props,notifications,token:()=>token,setToken:value=>{token=value;},mount:()=>Promise.all(mounted.map(fn=>fn())),unmount:()=>{unmount.forEach(fn=>fn());effect.stop();}};
}
const modules=[['Community','resources'],['Support','crowdfunding'],['Engagement','ads']];
for(const [module,mode] of modules)for(const surface of ['web','mobile']) {
  const file=surface==='web'?`src/components/${module}Hub.vue`:`mobile/src/components/${module}Mobile.vue`;
  test(`${surface} ${module}: successful reload clears stale error`,async()=>{
    let fail=true;const h=harness(file,async()=>{if(fail)throw Error('offline');return [];},mode);
    try{await h.state.load();assert.equal(h.state.error.value,'offline');fail=false;await h.state.load();assert.equal(h.state.error.value,'');assert.equal(h.state.loading.value,false);}finally{h.unmount();}
  });
  test(`${surface} ${module}: unmounted list stops chained private requests`,async()=>{
    const d=deferred(),calls=[];const h=harness(file,p=>{calls.push(p);return d.promise;},mode);
    const task=h.state.load();h.unmount();d.resolve([]);await task;assert.equal(calls.length,1);
  });
  test(`${surface} ${module}: unmounted action has no follow-up requests or notices`,async()=>{
    const d=deferred(),calls=[],h=harness(file,async p=>{calls.push(p);return [];},mode);
    const task=h.state.act(()=>d.promise,'old action');h.unmount();d.resolve({});await task;assert.equal(calls.length,0);assert.equal(h.notifications.length,0);assert.equal(h.state.message?.value||'','');
  });
  test(`${surface} ${module}: repeated submission makes one write`,async()=>{
    const d=deferred(),h=harness(file,async()=>[],mode);let writes=0;
    try{const action=()=>{writes++;return d.promise;};const first=h.state.act(action,'saved');await h.state.act(action,'saved');assert.equal(writes,1);d.resolve({});await first;}finally{h.unmount();}
  });
  for(const rejected of [false,true])test(`${surface} ${module}: old ${rejected?'failure':'success'} cannot alter a new account`,async()=>{
    const d=deferred(),h=harness(file,async()=>[],mode);
    try {
      const task=h.state.act(()=>d.promise,'old action');h.props.user={id:'b',status:'approved',role:'member'};await flush();
      const screen=h.state.modal||h.state.screen;screen.value='new-form';h.state.form.value={contact:'new-account-draft'};
      assert.equal(h.state.busy.value,false);rejected?d.reject(Error('old error')):d.resolve({});await task;
      assert.equal(screen.value,'new-form');assert.equal(h.state.error.value,'');assert.equal(h.state.form.value.contact,'new-account-draft');
      assert.equal(h.state.message?.value||'','');assert.equal(h.notifications.length,0);
    }finally{h.unmount();}
  });
  test(`${surface} ${module}: identity switch clears private detail immediately`,async()=>{
    const h=harness(file,async()=>[],mode);
    try{h.state.selected.value={contact:'private'};h.state.form.value={contact:'draft'};(h.state.modal||h.state.screen).value='detail';h.props.user=null;
      assert.equal(h.state.selected.value.contact,undefined);assert.equal(h.state.form.value.contact,undefined);assert.equal((h.state.modal||h.state.screen).value,'');await flush();
    }finally{h.unmount();}
  });
  if(module==='Support')test(`${surface} Support: old supporters cannot replace a new detail`,async()=>{
    const a=deferred(),b=deferred(),h=harness(file,p=>p.endsWith('/a/pledges')?a.promise:p.endsWith('/b/pledges')?b.promise:Promise.resolve([]),mode);
    try{const first=h.state.supporters({id:'a'});await flush();const second=h.state.supporters({id:'b'});await flush();b.resolve([{id:'new'}]);await second;a.resolve([{id:'private-old'}]);await first;assert.equal(h.state.details.value[0].id,'new');}finally{h.unmount();}
  });
}
const eventExports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'shared/useEventDiscovery.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:eventExports,require:()=>vue});
for (const surface of ['web','mobile']) {
  const file=surface==='web'?'src/App.vue':'mobile/src/pages/index/index.vue';
  test(`${surface} app: logout clears private identity and reloads public data`,async()=>{
    const h=harness(file,async p=>p==='/events'?[{id:'public'}]:[]);
    try{h.state.user.value={id:'a'};await h.state.logout();assert.equal(h.state.user.value,null);assert.equal(h.token(),'');assert.equal(h.state.events.value[0].id,'public');assert.equal(h.state.busy.value,false);}finally{h.unmount();}
  });
  test(`${surface} app: expired startup token still loads public home`,async()=>{
    const h=harness(file,async p=>{if(p==='/auth/me'){h.setToken('');h.state.expired();throw Error('expired');}return p==='/events'?[{id:'public'}]:[];});
    try{await h.mount();assert.equal(h.state.user.value,null);assert.equal(h.state.events.value[0].id,'public');assert.equal(h.state.loading.value,false);}finally{h.unmount();}
  });
  for(const rejected of [false,true])test(`${surface} app: expired action ${rejected?'failure':'success'} preserves a new account and form`,async()=>{
    const pending=deferred(),h=harness(file,async()=>[]);
    try {h.state.user.value={id:'a'};const task=h.state.act(()=>pending.promise,'obsolete');h.state.expired();h.state.user.value={id:'b'};await h.state.open('profile',{name:'new draft'});h.state.busy.value=true;
      rejected?pending.reject(Error('old failure')):pending.resolve({});await task;assert.equal(h.state.user.value.id,'b');assert.equal(h.state.form.value.name,'new draft');assert.equal((h.state.modal||h.state.screen).value,'profile');assert.equal(h.state.busy.value,true);assert.equal(h.state.error.value,'');assert.equal(h.notifications.length,0);
    }finally{h.unmount();}
  });
  for(const method of ['saveProfile','changePassword',surface==='web'?'loginOrRegister':'authSubmit'])test(`${surface} app: obsolete ${method} cannot restore identity or credentials`,async()=>{
    const pending=deferred(),h=harness(file,()=>pending.promise);
    try {h.state.user.value={id:'a'};await h.state.open(method==='saveProfile'?'profile':method==='changePassword'?'password':'login',{});const task=h.state[method]();h.state.expired();h.state.user.value={id:'b'};pending.resolve({id:'a',token:'obsolete-token',user:{id:'a'}});await task;assert.equal(h.state.user.value.id,'b');assert.equal(h.token(),'initial');assert.equal(h.state.busy.value,false);assert.equal(h.notifications.length,0);}finally{h.unmount();}
  });
  for(const rejected of [false,true])test(`${surface} app: pending action ${rejected?'failure':'success'} preserves a newly opened screen`,async()=>{
    const pending=deferred(),h=harness(file,async()=>[]);
    try {await h.state.open('post',{});const task=h.state.act(()=>pending.promise,'saved');await h.state.open('profile',{name:'keep me'});rejected?pending.reject(Error('old screen error')):pending.resolve({});await task;assert.equal((h.state.modal||h.state.screen).value,'profile');assert.equal(h.state.form.value.name,'keep me');assert.equal(h.state.error.value,'');}finally{h.unmount();}
  });
  test(`${surface} app: unmounted action cannot reload or notify`,async()=>{
    const pending=deferred(),calls=[],h=harness(file,async p=>{calls.push(p);return [];});const task=h.state.act(()=>pending.promise,'obsolete');h.unmount();pending.resolve({});await task;assert.equal(calls.length,0);assert.equal(h.notifications.length,0);assert.equal(h.state.message?.value||'','');
  });
  test(`${surface} app: repeated submit makes one write`,async()=>{
    const pending=deferred(),h=harness(file,async()=>[]);let writes=0;
    try{const action=()=>{writes++;return pending.promise;};const task=h.state.act(action,'saved');await h.state.act(action,'saved');assert.equal(writes,1);pending.resolve({});await task;}finally{h.unmount();}
  });
}
for(const reason of ['expired','navigated'])test(`mobile confirmation: ${reason} prompt cannot submit`,async()=>{
  const calls=[],h=harness('mobile/src/pages/index/index.vue',async p=>{calls.push(p);return [];});
  try{h.state.confirm('/events/old/cancel-signup','cancel');const prompt=h.notifications[0];if(reason==='expired')h.state.expired();else await h.state.open('profile',{});prompt.success({confirm:true});await flush();assert.equal(calls.length,0);}finally{h.unmount();}
});
for(const reason of ['different event','closed','expired'])test(`participants: delayed roster is ignored after ${reason}`,async()=>{
  const pending=deferred(),h=harness('src/App.vue',p=>p.includes('/old/')?pending.promise:Promise.resolve([{userId:'new'}]));
  try{const task=h.state.showParticipants({id:'old'});await flush();if(reason==='different event')await h.state.showParticipants({id:'new'});else if(reason==='closed')h.state.close();else h.state.expired();pending.resolve([{userId:'private-old'}]);await task;assert.equal(h.state.participants.value.some(row=>row.userId==='private-old'),false);}finally{h.unmount();}
});
const now=Date.parse('2026-10-31T08:00:00Z');
const domainExports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'shared/domain.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:domainExports});
test('signup: cancellation respects start boundary and completed attendance',()=>{
  const signup={status:'registered',event:{startsAt:'2026-10-31T08:00:00Z'}};
  assert.equal(domainExports.canCancelSignup(signup,now-1),true);assert.equal(domainExports.canCancelSignup(signup,now),false);
  assert.equal(domainExports.canCancelSignup({...signup,status:'checked_in'},now-1),false);assert.equal(domainExports.canCancelSignup({...signup,status:'cancelled'},now-1),false);
});
test('signup: cancelled and ended events never promise an upcoming meeting',()=>{
  const joined={status:'published',startsAt:'2026-10-30T08:00:00Z',endsAt:'2026-10-31T08:00:00Z',mySignup:{status:'registered'}};
  assert.equal(domainExports.signupLabel(joined,now),'已结束');assert.equal(domainExports.signupLabel({...joined,status:'cancelled'},now),'已取消');
  assert.equal(domainExports.signupLabel({...joined,endsAt:'2026-11-01T08:00:00Z'},now),'已报名 · 活动进行中');
  assert.equal(domainExports.signupLabel({...joined,endsAt:'2026-11-01T08:00:00Z',mySignup:{status:'checked_in'}},now),'已签到');
});
const event=(id,overrides={})=>({id,title:'苏州 Meet',description:'公益摄影',location:'吴中',category:'公益志愿',status:'published',startsAt:'2026-11-01T08:00:00Z',endsAt:'2026-11-01T10:00:00Z',registered:1,capacity:2,...overrides});
test('events: available excludes full, started, cancelled, draft and already joined',()=>{
  const rows=[event('open'),event('full',{registered:2}),event('started',{startsAt:'2026-10-31T08:00:00Z'}),event('cancelled',{status:'cancelled'}),event('draft',{status:'draft'}),event('joined',{mySignup:{id:'s'}})];
  assert.equal(eventExports.discoverEvents(rows,'available','全部','',now).map(r=>r.id).join(','),'open');
});
test('events: mine preserves cancelled event visibility for participants',()=>{
  assert.equal(eventExports.discoverEvents([event('mine',{mySignup:{},status:'cancelled'}),event('other')],'mine','全部','',now)[0].id,'mine');
});
test('events: ended includes exact end boundary and excludes draft/cancelled',()=>{
  const rows=[event('ended',{endsAt:'2026-10-31T08:00:00Z'}),event('draft',{endsAt:'2026-10-30T08:00:00Z',status:'draft'}),event('future')];
  assert.equal(eventExports.discoverEvents(rows,'ended','全部','',now).map(r=>r.id).join(','),'ended');
});
test('events: category, trimmed case-insensitive title and description search combine',()=>{
  assert.equal(eventExports.discoverEvents([event('a')],'all','公益志愿',' meet ',now).length,1);
  assert.equal(eventExports.discoverEvents([event('a')],'all','公益志愿','摄影',now).length,1);
  assert.equal(eventExports.discoverEvents([event('a')],'all','乡情聚会','',now).length,0);
});
test('events: homepage excludes ended/invalid entries and sorts without mutating source',()=>{
  const rows=[event('later',{startsAt:'2026-11-02T08:00:00Z',endsAt:'2026-11-02T10:00:00Z'}),event('soon'),event('old',{endsAt:'2026-10-31T08:00:00Z'}),event('bad',{endsAt:'invalid'})];
  assert.equal(eventExports.upcomingEvents(rows,now).map(r=>r.id).join(','),'soon,later');assert.equal(rows[0].id,'later');
});
(async()=>{const results=[];for(const {name,fn} of tests){try{await fn();results.push({name,status:'passed'});console.log('PASS:',name);}catch(e){results.push({name,status:'failed',error:e.message});console.error('FAIL:',name,e.message);}}const out=path.resolve(root,'../output/module-audit');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'regressions.json'),JSON.stringify(results,null,2));const failed=results.filter(r=>r.status==='failed').length;console.log(`${results.length-failed}/${results.length} module regressions passed`);process.exitCode=failed?1:0;})();
