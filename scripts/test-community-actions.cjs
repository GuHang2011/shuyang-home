const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../frontend'),vue=require(path.join(root,'node_modules/vue')),ts=require(path.join(root,'node_modules/typescript')),sfc=require(path.join(root,'node_modules/@vue/compiler-sfc'));
const baseline=process.argv.includes('--baseline');
const tests=[],test=(name,run)=>tests.push({name,run});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<16;i++)await Promise.resolve();await vue.nextTick();};
function harness(module,surface,custom=()=>undefined){
 const cache=new Map(),unmount=[],calls=[],prompts=[],notifications=[],props=vue.reactive({mode:{Community:'resources',Support:'crowdfunding',Engagement:'ads'}[module],user:{id:'member',role:'member',status:'approved'}});
 const api=async(url,method,body)=>{calls.push({url,method,body});const result=custom(url,method,body);return result===undefined?[]:result;};
 function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);let source=baseline?require('node:child_process').execFileSync('git',['show','HEAD:frontend/'+path.relative(root,file).replaceAll('\\','/')],{cwd:root,encoding:'utf8'}):fs.readFileSync(file,'utf8');if(file.endsWith('.vue'))source=sfc.compileScript(sfc.parse(source).descriptor,{id:'community-actions'}).content;const exports={};cache.set(file,exports);vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,console,Date,Math,Set,Error,crypto:require('node:crypto').webcrypto,uni:{pageScrollTo(){},showModal:p=>prompts.push(p),showToast:p=>notifications.push(p)},require:name=>name==='vue'?{...vue,onMounted(){},onUnmounted:fn=>unmount.push(fn)}:name.endsWith('/api')||name.endsWith('/platform')?{api}:name.endsWith('.vue')?{}:load(path.resolve(path.dirname(file),name+'.ts'))});return exports;}
 const effect=vue.effectScope();let state;effect.run(()=>{state=load(path.join(root,surface==='web'?`src/components/${module}Hub.vue`:`mobile/src/components/${module}Mobile.vue`)).default.setup(props,{expose(){},emit:(...args)=>notifications.push(args)});});
 return {state,props,calls,prompts,notifications,screen:state.modal||state.screen,dispose:()=>{unmount.forEach(fn=>fn());effect.stop();}};
}
for(const module of ['Community','Support','Engagement'])for(const surface of ['web','mobile']){
 if(surface==='web')test(`web ${module}: the latest form still opens its native dialog`,async()=>{
  const h=harness(module,surface);let opened=0;
  try{h.state.dialog.value={open:false,showModal(){this.open=true;opened++;},close(){this.open=false;}};h.state.create();await flush();assert.equal(opened,1);assert.equal(h.state.dialog.value.open,true);h.state.close();const first=h.state.open('obsolete');const second=h.state.open('latest');await Promise.all([first,second]);assert.equal(opened,2);assert.equal(h.screen.value,'latest');}finally{h.dispose();}
 });
 for(const failed of [false,true])test(`${surface} ${module}: old action ${failed?'failure':'success'} preserves a newly opened form`,async()=>{
  const pending=deferred(),h=harness(module,surface);
  try{const task=h.state.act(()=>pending.promise,'old operation');h.state.create();await flush();h.state.form.value.title='new draft';const screen=h.screen.value;failed?pending.reject(Error('old failure')):pending.resolve({});await task;assert.equal(h.screen.value,screen);assert.equal(h.state.form.value.title,'new draft');assert.equal(h.state.error.value,'');assert.equal(h.state.message?.value||'','');assert.equal(h.notifications.length,0);assert.equal(h.calls.length,0);assert.equal(h.state.busy.value,false);}finally{h.dispose();}
 });
 test(`${surface} ${module}: submission remains locked until list refresh finishes`,async()=>{
  const refresh=deferred(),h=harness(module,surface,()=>refresh.promise);let writes=0;
  try{h.state.create();await flush();const task=h.state.act(async()=>{writes++;},'saved');await flush();assert.equal(h.state.busy.value,true);await h.state.act(async()=>{writes++;},'duplicate');assert.equal(writes,1);refresh.resolve([]);await task;assert.equal(h.state.busy.value,false);assert.equal(h.screen.value,'');}finally{refresh.resolve([]);h.dispose();}
 });
 for(const failed of [false,true])test(`${surface} ${module}: refresh ${failed?'failure':'success'} cannot affect a replacement form`,async()=>{
  const refresh=deferred(),h=harness(module,surface,()=>refresh.promise);
  try{h.state.create();await flush();const task=h.state.act(async()=>{},'saved');await flush();h.state.create();await flush();h.state.form.value.title='replacement';const screen=h.screen.value;failed?refresh.reject(Error('obsolete list failure')):refresh.resolve([]);await task;assert.equal(h.screen.value,screen);assert.equal(h.state.form.value.title,'replacement');assert.equal(h.state.error.value,'');assert.equal(h.state.busy.value,false);}finally{refresh.resolve([]);h.dispose();}
 });
}
function prompt(h,module,id){if(module==='Community')h.state.confirm('/exchanges/'+id+'/action',{action:'accept'},'accept');else if(module==='Support')h.state.confirm('/crowdfunding/'+id+'/close','close');else h.state.withdraw({id});}
for(const module of ['Community','Support','Engagement']){
 for(const navigation of ['new form','other tab','back and return'])test(`mobile ${module}: confirmation is invalid after ${navigation}`,async()=>{
  const h=harness(module,'mobile');
  try{if(navigation==='back and return')h.state.detail({id:'same'});prompt(h,module,'old');if(navigation==='new form')h.state.create();else if(navigation==='other tab')h.state.tab.value='mine';else{h.screen.value='';h.state.detail({id:'same'});}h.prompts[0].success({confirm:true});await flush();assert.equal(h.calls.filter(c=>c.method==='POST').length,0);}finally{h.dispose();}
 });
 test(`mobile ${module}: only the latest confirmation executes once`,async()=>{
  const h=harness(module,'mobile');
  try{prompt(h,module,'old');prompt(h,module,'latest');h.prompts[0].success({confirm:true});await flush();assert.equal(h.calls.filter(c=>c.method==='POST').length,0);h.prompts[1].success({confirm:true});await flush();h.prompts[1].success({confirm:true});await flush();const writes=h.calls.filter(c=>c.method==='POST');assert.equal(writes.length,1);assert.ok(writes[0].url.includes('latest'));}finally{h.dispose();}
 });
 test(`mobile ${module}: cancelled confirmation makes no write`,async()=>{
  const h=harness(module,'mobile');try{prompt(h,module,'cancelled');h.prompts[0].success({confirm:false});await flush();assert.equal(h.calls.length,0);}finally{h.dispose();}
 });
}
(async()=>{let passed=0;for(const {name,run}of tests){try{await run();passed++;console.log('PASS:',name);}catch(error){console.error('FAIL:',name,error.message);}}console.log(`${passed}/${tests.length} community action regressions passed`);process.exitCode=passed===tests.length?0:1;})();
