// Deferred responses exercise account switches and navigation while requests are in flight.
const fs = require('fs'), path = require('path'), assert = require('node:assert/strict'), vm = require('node:vm');
const root = path.join(__dirname, '../CropDiseasesDetection_vue');
const ts = require(path.join(root, 'node_modules/typescript'));
const vue = require(path.join(root, 'node_modules/vue'));
const cache = new Map();
function load(file) {
  file = path.resolve(file);if (cache.has(file)) return cache.get(file);
  const exports = {};cache.set(file, exports);
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  vm.runInNewContext(js, { exports, require(name) { if(name === 'vue') return {...vue, onMounted(){}, onUnmounted(){}};return load(path.join(path.dirname(file), name + '.ts')); }, console, Date, Math, Set });
  return exports;
}
const deferred = () => { let resolve;const promise = new Promise(r=>resolve=r);return {promise,resolve}; };
async function main(){
  const scope=vue.effectScope();const tasks=[];
  scope.run(()=>{
    const user=vue.ref({id:'a',role:'admin',status:'approved'}), delayed=deferred();
    const gallery=load(path.join(root,'shared/useGallery.ts')).useGallery(()=>user.value, p=>p==='/albums/a'?delayed.promise:Promise.resolve({albums:[],source:{}}));
    tasks.push((async()=>{ const task=gallery.detail({id:'a'});user.value=null;delayed.resolve({album:{id:'a',status:'draft'},photos:[{id:'private'}]});await task;assert.equal(gallery.selected.value,null);assert.equal(gallery.photos.value.length,0); })());
    const album=load(path.join(root,'shared/useGallery.ts')).useGallery(()=>({id:'a',role:'admin'}),async(p,m)=>m==='POST'?{id:'saved'}:p.startsWith('/albums?')?{albums:[{id:'saved'}],source:{}}:{album:{id:'saved'},photos:[]});
    tasks.push((async()=>{assert.equal(await album.save({title:'saved'}),true);assert.equal(album.selected.value.id,'saved');})());
    const person=vue.ref({id:'a',role:'member',status:'approved'}), order=deferred();
    const shop=load(path.join(root,'shared/useShop.ts')).useShop(()=>person.value,async(p,m)=>m==='POST'?order.promise:[]);
    tasks.push((async()=>{shop.buy({id:'p',stock:3,status:'published'});Object.assign(shop.orderForm.value,{name:'测试用户',phone:'13800008881',delivery:'pickup',consent:true});const task=shop.submitOrder();person.value={id:'b',role:'member',status:'approved'};order.resolve({id:'private-order'});assert.equal(await task,false);assert.equal(shop.orders.value.length,0);assert.equal(shop.selected.value,null);assert.equal(shop.tab.value,'products');})());
    const location=deferred(), sent=[];
    const check=load(path.join(root,'shared/checkin.ts')).useCheckin(()=>({id:'a',status:'approved'}),async(p,m)=>{if(m)sent.push(p);return p.endsWith('config')?{enabled:true}:[]},()=>location.promise);
    tasks.push((async()=>{await check.select({id:'event-a'},'code-a');const task=check.checkin();await check.select({id:'event-b'},'code-b');location.resolve({latitude:1,longitude:1});await task;assert.equal(sent.length,0);assert.equal(check.busy.value,false);})());
    const visitor=vue.ref({id:'a',role:'member',status:'approved'}), post=deferred();
    const forum=load(path.join(root,'shared/useForum.ts')).useForum(()=>visitor.value,async(p,m)=>m==='POST'?post.promise:[]);
    tasks.push((async()=>{forum.create();const task=forum.post();visitor.value=null;post.resolve({id:'private'});await task;assert.equal(forum.tab.value,'public');assert.equal(forum.message.value,'');})());
  });
  await Promise.all(tasks);scope.stop();console.log('PASS: 5 deferred-response scenarios (logout, gallery save, order/account switch, location/navigation, post/logout)');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
