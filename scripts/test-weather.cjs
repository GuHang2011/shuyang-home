// Exercise search and location races with deferred responses, using the shared H5/Web logic.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('node:assert/strict');
const root = path.join(__dirname, '../frontend');
const ts = require(path.join(root, 'node_modules/typescript')), vue = require(path.join(root, 'node_modules/vue'));
const code = ts.transpileModule(fs.readFileSync(path.join(root, 'shared/weather.ts'), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const exportsForTest = {}, unmount = [];
vm.runInNewContext(code, {exports:exportsForTest,require:() => ({...vue,onMounted(){},onUnmounted(fn){unmount.push(fn);}})});
const {useWeather} = exportsForTest;
const deferred = () => {let resolve, reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {resolve,reject,promise};};
const city = {name:'淮安市',latitude:33.58861,longitude:119.01917};
async function main() {
  const old=deferred(), recent=deferred(), searches=useWeather(p=>p.includes(encodeURIComponent('淮安'))?old.promise:recent.promise);
  searches.search.value='淮安';const a=searches.find();searches.search.value='南京';const b=searches.find();
  recent.resolve([{name:'南京'}]);await b;old.resolve([city]);await a;assert.equal(searches.cities.value[0].name,'南京');
  searches.search.value='a';await searches.find();assert.equal(searches.cities.value.length,0);assert.match(searches.searchError.value,/2至40/);

  const pending=deferred(), typing=useWeather(()=>pending.promise);typing.search.value='淮安';const searching=typing.find();typing.search.value='宿州';pending.resolve([city]);await searching;assert.equal(typing.cities.value.length,0);
  const broken=useWeather(async()=>{throw new Error('offline');});broken.cities.value=[city];broken.search.value='淮安';await broken.find();assert.equal(broken.cities.value.length,0);assert.equal(broken.searchError.value,'offline');

  const requests=[], location=useWeather(async p=>{requests.push(p);return p==='/weather/network-location'?{...city,locationSource:'network'}:{current:{temperature_2m:20}};});
  await location.locate(async()=>{throw new Error('denied');});assert.equal(location.city.value.name,'淮安市');assert.match(location.locationHint.value,/网络估算/);assert.ok(requests.includes('/weather?latitude=33.59&longitude=119.02'));
  requests.length=0;await location.locate(async()=>({latitude:20,longitude:110,accuracy:8000}));assert.equal(requests[0],'/weather/network-location');
  requests.length=0;await location.locate(async()=>({latitude:30,longitude:120,accuracy:100}));assert.ok(!requests.includes('/weather/network-location'));assert.equal(location.city.value.locationSource,'device');
  requests.length=0;await location.locate();assert.equal(requests[0],'/weather/network-location');

  const lateGps=deferred(), gps=useWeather(async()=>({current:{}}));const gpsTask=gps.locate(()=>lateGps.promise);await gps.load(city);lateGps.resolve({latitude:20,longitude:110,accuracy:100});assert.equal(await gpsTask,false);assert.equal(gps.city.value.name,'淮安市');
  const lateNetwork=deferred(), net=useWeather(p=>p==='/weather/network-location'?lateNetwork.promise:Promise.resolve({current:{}}));const netTask=net.locate();await net.load(city);lateNetwork.resolve({name:'旧位置',latitude:20,longitude:110});assert.equal(await netTask,false);assert.equal(net.city.value.name,'淮安市');
  const failed=useWeather(async()=>{throw new Error('网络定位不可用');});assert.equal(await failed.locate(),false);assert.equal(failed.city.value.name,'苏州');assert.equal(failed.locating.value,false);assert.equal(failed.error.value,'网络定位不可用');
  const detached=deferred(), gone=useWeather(()=>detached.promise);const goneTask=gone.locate();unmount.forEach(fn=>fn());detached.resolve(city);assert.equal(await goneTask,false);assert.equal(gone.city.value.name,'苏州');
  console.log('PASS: 12 weather scenarios (search races, stale results, permission/accuracy fallback, device/network choice, manual selection, errors and unmount)');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
