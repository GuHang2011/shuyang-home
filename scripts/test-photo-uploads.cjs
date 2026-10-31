const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'../frontend'),ts=require(path.join(root,'node_modules/typescript')),vue=require(path.join(root,'node_modules/vue'));
const exportsObject={},unmount=[];
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'shared/usePhotoUpload.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:exportsObject,require:()=>({...vue,onUnmounted:fn=>unmount.push(fn)}),Error,Set});
const {usePhotoUpload}=exportsObject,flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();},file=name=>({name,size:42,preview:name,source:name});
async function main(){
  let tests=0;const scope=vue.effectScope();
  const user=vue.ref('a'),state={photos:[],pending:false,released:[]};let attempt=0;
  const upload=scope.run(()=>usePhotoUpload({identity:()=>user.value,max:2,upload:async item=>{if(item.name==='bad'&&++attempt===1)throw new Error('offline');return{id:item.name};},changed:rows=>state.photos=rows,pending:value=>state.pending=value,release:item=>state.released.push(item.name)}));
  upload.add([file('good'),file('bad'),file('extra')]);await flush();
  assert.equal(upload.items.value.length,2);assert.equal(state.photos.length,1);assert.equal(state.pending,true);assert.equal(upload.items.value[1].status,'failed');assert.ok(state.released.includes('extra'));tests++;
  upload.retry(upload.items.value[1].key);await flush();assert.equal(state.photos.length,2);assert.equal(state.pending,false);tests++;
  upload.remove(upload.items.value[0].key);assert.equal(state.photos[0].id,'bad');assert.equal(upload.remaining.value,1);tests++;
  let resolve;const delayed=new Promise(r=>resolve=r),old={photos:[],pending:false};
  const queue=scope.run(()=>usePhotoUpload({identity:()=>user.value,max:9,upload:()=>delayed,changed:r=>old.photos=r,pending:v=>old.pending=v}));
  queue.add([file('private')]);user.value='b';resolve({id:'private'});await flush();assert.equal(old.photos.length,0);assert.equal(old.pending,false);assert.equal(queue.items.value.length,0);tests++;
  let finish;const late=new Promise(r=>finish=r);let emitted=0;
  const gone=scope.run(()=>usePhotoUpload({identity:()=>null,max:9,upload:()=>late,changed:()=>emitted++,pending:()=>{}}));gone.add([file('late')]);const before=emitted;unmount.forEach(fn=>fn());finish({id:'late'});await flush();assert.equal(emitted,before);tests++;
  scope.stop();console.log(`PASS: ${tests} photo queue scenarios (limits, retry, removal, account switch, unmount)`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
