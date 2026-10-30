// Contract tests for both uni-app targets and mobile lifecycle/network races.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../CropDiseasesDetection_vue');
const ts = require(path.join(root, 'node_modules/typescript'));
const vue = require(path.join(root, 'node_modules/vue'));
const tests = [], test = (name, run) => tests.push({ name, run });
const deferred = () => { let resolve, reject;const promise = new Promise((a,b) => { resolve=a;reject=b; });return { promise,resolve,reject }; };
const flush = async () => { for (let i=0;i<8;i++) await Promise.resolve();await vue.nextTick(); };
function platform(target, configured = true) {
  const requests=[], uploads=[], downloads=[], events=[];let token='session-a';
  const uni={
    getStorageSync:()=>token, setStorageSync:(_,value)=>token=value, removeStorageSync:()=>token='',
    $emit:name=>events.push(name), request:options=>requests.push(options),
    uploadFile:options=>{uploads.push(options);return {onProgressUpdate(){}};},
    downloadFile:options=>downloads.push(options)
  };
  let enabled=true;
  let source=fs.readFileSync(path.join(root,'mobile/src/platform.ts'),'utf8').split('\n').filter(line=>{
    const match=line.match(/\/\/ #ifdef (\S+)/);
    if(match){enabled=match[1]===target;return false;}
    if(line.includes('// #endif')){enabled=true;return false;}
    return enabled;
  }).join('\n');
  source=source.replace(/import\.meta\.env/g, JSON.stringify({VITE_SHUYANG_API_URL:configured && target==='MP-WEIXIN'?'https://api.example.test':''}));
  const exports={};
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,uni,console});
  return {api:exports,requests,uploads,downloads,events,get token(){return token;},set token(value){token=value;}};
}
for(const target of ['H5','MP-WEIXIN']) {
  for(const [label,data] of [['null',null],['HTML','<html>gateway unavailable</html>'],['empty','']]) {
    test(`${target}: ${label} response rejects without hanging`,async()=>{
      const p=platform(target), task=p.api.api('/products').then(()=>({ok:true}),e=>({error:e.message}));
      assert.doesNotThrow(()=>p.requests[0].success({statusCode:200,data}));
      const result=await task;assert.ok(result.error);assert.doesNotMatch(result.error,/<html>|TypeError/);assert.equal(p.token,'session-a');
    });
  }
  test(`${target}: offline/timeout preserves login and rejects clearly`,async()=>{
    const p=platform(target), task=p.api.api('/orders').catch(e=>e.message);
    assert.equal(p.requests[0].timeout,20000);p.requests[0].fail({errMsg:'request:fail timeout'});
    assert.match(await task,/连接|网络|超时/);assert.equal(p.token,'session-a');assert.equal(p.events.length,0);
  });
  test(`${target}: current 401 clears the session`,async()=>{
    const p=platform(target), task=p.api.api('/auth/me').catch(e=>e.message);
    p.requests[0].success({statusCode:401,data:{code:401,message:'登录已失效'}});
    await task;assert.equal(p.token,'');assert.deepEqual(p.events,['session-expired']);
  });
  test(`${target}: stale 401 cannot sign out a new account`,async()=>{
    const p=platform(target), task=p.api.api('/auth/me').catch(e=>e.message);p.token='session-b';
    p.requests[0].success({statusCode:401,data:{code:401,message:'expired'}});
    await task;assert.equal(p.token,'session-b');assert.equal(p.events.length,0);
  });
  test(`${target}: attachment download 401 clears current session`,async()=>{
    const p=platform(target), task=p.api.downloadMedia('private-id').catch(e=>e.message);
    p.downloads[0].success({statusCode:401});await task;
    assert.equal(p.token,'');assert.deepEqual(p.events,['session-expired']);
  });
  test(`${target}: stale attachment 401 keeps the new session`,async()=>{
    const p=platform(target), task=p.api.downloadMedia('private-id').catch(e=>e.message);p.token='session-b';
    p.downloads[0].success({statusCode:401});await task;
    assert.equal(p.token,'session-b');assert.equal(p.events.length,0);
  });
  test(`${target}: upload gateway failure keeps retry possible`,async()=>{
    const p=platform(target), task=p.api.uploadMedia('/test.png','album').catch(e=>e.message);
    p.uploads[0].success({statusCode:502,data:'<html>gateway</html>'});assert.ok(await task);assert.equal(p.token,'session-a');
  });
  test(`${target}: successful request uses its platform base URL`,async()=>{
    const p=platform(target), task=p.api.api('/products');
    assert.equal(p.requests[0].url,target==='H5'?'/api/products':'https://api.example.test/products');
    p.requests[0].success({statusCode:200,data:{code:0,data:[]}});assert.equal((await task).length,0);
  });
}
test('mini-program missing API configuration rejects before networking',async()=>{
  const p=platform('MP-WEIXIN',false);await assert.rejects(p.api.api('/home'),/服务暂未配置/);assert.equal(p.requests.length,0);
});

function logic() {
  const cache=new Map(), mounted=[], unmounted=[], intervals=new Map();let nextTimer=0;
  const document={hidden:false};
  function load(relative) {
    const file=path.resolve(root,relative);if(cache.has(file))return cache.get(file);
    const exports={};cache.set(file,exports);
    const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
    vm.runInNewContext(source,{exports,document,console,Date,Math,Set,
      setInterval:fn=>{const id=++nextTimer;intervals.set(id,fn);return id;},clearInterval:id=>intervals.delete(id),
      require:name=>name==='vue'?{...vue,onMounted:fn=>mounted.push(fn),onUnmounted:fn=>unmounted.push(fn)}:load(path.resolve(path.dirname(file),name+'.ts'))});
    return exports;
  }
  return {load,document,mount:()=>mounted.forEach(fn=>fn()),unmount:()=>unmounted.forEach(fn=>fn()),tick:async()=>{for(const fn of intervals.values())await fn();}};
}
const member=()=>({id:'a',status:'approved',role:'member'});
test('mobile background suspends unread polling and foreground refreshes',async()=>{
  const h=logic(),foreground=vue.ref(true);let calls=0;
  const state=h.load('shared/useChat.ts').useChatUnread(member,async()=>({count:++calls}),()=>foreground.value);
  h.mount();await flush();const initial=calls;
  foreground.value=false;await flush();await h.tick();assert.equal(calls,initial);assert.equal(state.unread.value,initial);
  foreground.value=true;await flush();assert.ok(calls>initial);h.unmount();
});
test('hidden H5 document suspends unread requests',async()=>{
  const h=logic();let calls=0;h.load('shared/useChat.ts').useChatUnread(member,async()=>{calls++;return {count:2};});
  h.mount();await flush();h.document.hidden=true;const before=calls;await h.tick();assert.equal(calls,before);h.unmount();
});
test('network failure does not erase an existing unread badge',async()=>{
  const h=logic();let offline=false;
  const unread=h.load('shared/useChat.ts').useChatUnread(member,async()=>{if(offline)throw new Error('offline');return {count:7};});
  await unread.refreshUnread();offline=true;await unread.refreshUnread();assert.equal(unread.unread.value,7);
});
test('weak-network send preserves the next draft and attachment',async()=>{
  const h=logic(),pending=deferred();
  const chat=h.load('shared/useChat.ts').useChat(member,async(p,m)=>m==='POST'?pending.promise:p.endsWith('/room')?{id:'room',status:'active',messages:[],lastRead:0}:[]);
  chat.active.value={id:'room',status:'active'};chat.draft.value='first';chat.attachment.value={id:'photo-a'};
  const task=chat.send();chat.draft.value='next message';chat.attachment.value={id:'photo-b'};pending.resolve({});await task;
  assert.equal(chat.draft.value,'next message');assert.equal(chat.attachment.value.id,'photo-b');
});
test('failed send keeps draft and reuses request ID on retry',async()=>{
  const h=logic(),writes=[];
  const chat=h.load('shared/useChat.ts').useChat(member,async(p,m,body)=>{if(m==='POST'){writes.push(body);if(writes.length===1)throw new Error('offline');return {};}return p.endsWith('/room')?{id:'room',status:'active',messages:[],lastRead:0}:[];});
  chat.active.value={id:'room',status:'active'};chat.draft.value='retry me';await chat.send();assert.equal(chat.draft.value,'retry me');assert.equal(chat.busy.value,false);
  await chat.send();assert.equal(writes[0].requestId,writes[1].requestId);assert.equal(chat.draft.value,'');
});
test('background chat never marks a newly loaded message as read',async()=>{
  const h=logic(),writes=[];h.document.hidden=true;
  const chat=h.load('shared/useChat.ts').useChat(member,async(p,m)=>{if(m==='POST')writes.push(p);return p.endsWith('/room')?{id:'room',status:'active',messages:[{id:'m1',sequence:1}],lastRead:0}:[];});
  await chat.select({id:'room'});assert.equal(writes.length,0);
});
test('in-flight polling cannot fetch a room after the page is destroyed',async()=>{
  const h=logic(),pending=deferred();let details=0;
  const chat=h.load('shared/useChat.ts').useChat(member,async p=>{if(p.endsWith('/room')){details++;return {id:'room',messages:[],lastRead:0};}return pending.promise;});
  chat.active.value={id:'room'};h.mount();const tick=h.tick();h.unmount();pending.resolve([]);await tick;assert.equal(details,0);
});
for(const reason of ['定位权限已拒绝','定位超时','当前设备不支持定位']) {
  test(`check-in: ${reason} never submits invented coordinates`,async()=>{
    const h=logic(),writes=[];
    const check=h.load('shared/checkin.ts').useCheckin(member,async(p,m)=>{if(m)writes.push(p);return {enabled:true};},async()=>{throw new Error(reason);});
    await check.select({id:'event'});await check.checkin();assert.equal(writes.length,0);assert.equal(check.busy.value,false);assert.equal(check.error.value,reason);
  });
}
(async()=>{
  const results=[];
  for(const item of tests){const scope=vue.effectScope();try{await scope.run(item.run);results.push({name:item.name,status:'passed'});console.log('PASS:',item.name);}catch(error){results.push({name:item.name,status:'failed',error:error.message});console.error('FAIL:',item.name,'-',error.message);}finally{scope.stop();}}
  const out=path.resolve(root,'../output/mobile-environments');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'contracts.json'),JSON.stringify({results},null,2));
  const failed=results.filter(r=>r.status==='failed').length;console.log(`${results.length-failed}/${results.length} mobile environment contracts passed`);process.exitCode=failed?1:0;
})();
