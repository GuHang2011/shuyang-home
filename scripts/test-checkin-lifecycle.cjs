const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),baseline=process.argv.includes('--baseline');
const root=path.resolve(__dirname,'../frontend'),vue=require(path.join(root,'node_modules/vue')),ts=require(path.join(root,'node_modules/typescript')),sfc=require(path.join(root,'node_modules/@vue/compiler-sfc'));
const defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();await vue.nextTick();};
const event=id=>({id,title:id,startsAt:'2026-12-01T08:00:00Z',endsAt:'2026-12-01T10:00:00Z'});
const settings=radius=>({enabled:true,latitude:31,longitude:120,radius,opensAt:'2026-12-01T08:00:00Z',closesAt:'2026-12-01T10:00:00Z'});
function harness(api,admin=false){
 const unmount=[],cache=new Map(),location=defer(),qr=defer(),props=vue.reactive({user:{id:'one',role:'superadmin',status:'approved',enabled:true}});
 function load(file){file=path.resolve(root,file);if(cache.has(file))return cache.get(file);let source=baseline?execFileSync('git',['show','HEAD:frontend/'+path.relative(root,file).replaceAll('\\','/')],{encoding:'utf8',cwd:path.dirname(root)}):fs.readFileSync(file,'utf8');if(file.endsWith('.vue'))source=sfc.compileScript(sfc.parse(source).descriptor,{id:'checkin-lifecycle'}).content;const exports={};cache.set(file,exports);
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,console,Date,Math,Set,Error,window:{isSecureContext:true},navigator:{geolocation:{getCurrentPosition:success=>location.promise.then(coords=>success({coords}))}},require:name=>name==='vue'?{...vue,onMounted(){},onUnmounted:fn=>unmount.push(fn)}:name==='qrcode'?{default:{toDataURL:()=>qr.promise}}:name.endsWith('/api')?{api}:name.endsWith('.vue')?{}:load(path.resolve(path.dirname(file),name+'.ts'))});return exports;}
 const effect=vue.effectScope();let state;effect.run(()=>{state=admin?load('src/components/CheckinHub.vue').default.setup(props,{expose(){},emit(){}}):load('shared/checkin.ts').useCheckin(()=>props.user,api,()=>location.promise);});
 return{state,props,location,qr,dispose(){unmount.forEach(fn=>fn());effect.stop();}};
}
const tests=[],test=(name,run)=>tests.push({name,run});
test('latest same-event selection wins over a delayed settings response',async()=>{
 const a=defer(),b=defer();let n=0;const h=harness(()=>++n===1?a.promise:b.promise);
 try{const one=h.state.select(event('a')),two=h.state.select(event('a'));b.resolve(settings(200));await two;a.resolve(settings(100));await one;assert.equal(h.state.settings.value.radius,200);}finally{h.dispose();}
});
test('returning to the same event cannot revive an abandoned location check-in',async()=>{
 const writes=[],h=harness(async(p,m)=>{if(m)writes.push(p);return m?{}:p.endsWith('config')?settings(100):[];});
 try{await h.state.select(event('a'));const old=h.state.checkin();await h.state.select(event('b'));await h.state.select(event('a'));h.location.resolve({latitude:31,longitude:120,accuracy:10});await old;assert.equal(writes.length,0);assert.equal(h.state.busy.value,false);}finally{h.dispose();}
});
test('scan lookup cannot override a later manual selection',async()=>{
 const old=defer(),id='11111111-1111-1111-1111-111111111111',h=harness(p=>p==='/events/'+id?old.promise:Promise.resolve(settings(100)));
 try{const task=h.state.scanned('SYH:CHECKIN:'+id+':22222222-2222-2222-2222-222222222222');await h.state.select(event('manual'));old.resolve(event(id));assert.equal(await task,false);assert.equal(h.state.selected.value.id,'manual');}finally{h.dispose();}
});
test('disabled membership cancels pending location and clears selected event',async()=>{
 const writes=[],h=harness(async(p,m)=>{if(m)writes.push(p);return p.endsWith('config')?settings(100):[];});
 try{await h.state.select(event('a'));const task=h.state.checkin();h.props.user.enabled=false;h.location.resolve({latitude:31,longitude:120,accuracy:10});await task;assert.equal(writes.length,0);assert.equal(h.state.selected.value,null);}finally{h.dispose();}
});
test('a successful reload clears a prior list error',async()=>{
 let fail=true;const h=harness(async()=>{if(fail)throw Error('offline');return[];});try{await h.state.load();assert.equal(h.state.error.value,'offline');fail=false;await h.state.load();assert.equal(h.state.error.value,'');}finally{h.dispose();}
});
test('valid check-in submits once and retains the success notice',async()=>{
 const writes=[],h=harness(async(p,m)=>{if(m)writes.push(p);return p.endsWith('config')?settings(100):[];});
 try{await h.state.select(event('a'));const one=h.state.checkin(),two=h.state.checkin();h.location.resolve({latitude:31,longitude:120,accuracy:10});await Promise.all([one,two]);assert.deepEqual(writes,['/events/a/self-check-in']);assert.match(h.state.message.value,/签到成功/);assert.equal(h.state.busy.value,false);}finally{h.dispose();}
});
for(const kind of ['location','save','qr'])for(const reason of ['selection','logout','unmount'])test(`admin ${kind} result cannot restore state after ${reason}`,async()=>{
 const pending=defer(),writes=[],h=harness(async(p,m)=>{if(m){writes.push(p);return pending.promise;}return p.endsWith('config')?settings(100):[];},true);
 let disposed=false;
 try{await h.state.select(event('a'));await flush();let task;
 if(kind==='location')task=h.state.useCurrent();else if(kind==='save')task=h.state.save();else{task=h.state.generate();pending.resolve({code:'old-code',expiresAt:'2026-12-01T08:05:00Z'});await flush();}
 if(reason==='selection'){await h.state.select(event('b'));await flush();h.state.form.value.latitude=40;}else if(reason==='logout'){h.props.user=null;await flush();}else{h.dispose();disposed=true;}
 const oldForm=JSON.stringify(h.state.form.value),oldError=h.state.error.value;
 if(kind==='location')h.location.resolve({latitude:32,longitude:121});else if(kind==='save')pending.resolve({});else h.qr.resolve('data:image/png;base64,old');
 await task;assert.equal(h.state.qr.value,'');assert.equal(h.state.message.value,'');assert.equal(h.state.error.value,oldError);assert.equal(JSON.stringify(h.state.form.value),oldForm);
 }finally{if(!disposed)h.dispose();}
});
test('admin repeated save sends one configuration update',async()=>{
 const pending=defer();let writes=0;const h=harness(async(p,m)=>{if(m){writes++;return pending.promise;}return p.endsWith('config')?settings(100):[];},true);
 try{await h.state.select(event('a'));await flush();const one=h.state.save(),two=h.state.save();pending.resolve({});await Promise.all([one,two]);assert.equal(writes,1);assert.equal(h.state.saving.value,false);assert.match(h.state.message.value,/已保存/);}finally{h.dispose();}
});
test('admin controls wait for the selected configuration before submitting',async()=>{
 const pending=defer(),writes=[],h=harness(async(p,m)=>{if(m){writes.push(p);return settings(100);}return pending.promise;},true);
 try{const task=h.state.select(event('a'));await flush();const saving=h.state.save(),generating=h.state.generate();await flush();const count=writes.length;pending.resolve(settings(250));h.qr.resolve('data:image/png;base64,current');await Promise.all([task,saving,generating]);assert.equal(count,0);assert.equal(h.state.settings.value.radius,250);assert.equal(h.state.saving.value,false);}finally{h.dispose();}
});
test('admin save retains persisted values without an unsafe empty-form refresh window',async()=>{
 let reads=0;const writes=[],h=harness(async(p,m,b)=>{if(m){writes.push(b);return settings(350);}reads++;return settings(100);},true);
 try{await h.state.select(event('a'));await flush();h.state.form.value.radius=350;await h.state.save();await flush();assert.equal(writes.length,1);assert.equal(reads,1);assert.equal(h.state.form.value.enabled,true);assert.equal(h.state.form.value.radius,350);assert.equal(h.state.form.value.latitude,31);assert.equal(h.state.saving.value,false);assert.match(h.state.message.value,/已保存/);}finally{h.dispose();}
});
test('admin QR generation keeps its lock through drawing and shows the current expiry',async()=>{
 let writes=0;const expiry='2026-12-01T08:05:00Z',h=harness(async(p,m)=>{if(m){writes++;return{code:'current-code',expiresAt:expiry};}return settings(100);},true);
 try{await h.state.select(event('a'));await flush();const task=h.state.generate();await flush();const duplicate=h.state.generate();await flush();const locked=h.state.saving.value;h.qr.resolve('data:image/png;base64,current');await Promise.all([task,duplicate]);assert.equal(writes,1);assert.equal(locked,true);assert.equal(h.state.qr.value,'data:image/png;base64,current');assert.equal(h.state.expiresAt.value,expiry);assert.equal(h.state.saving.value,false);}finally{h.dispose();}
});
(async()=>{let failures=0;for(const{name,run}of tests){try{await run();console.log('PASS:',name);}catch(e){failures++;console.error('FAIL:',name,e.message);}}console.log(`${tests.length-failures}/${tests.length} check-in lifecycle scenarios passed`);process.exitCode=failures?1:0;})();
