// Race conditions and failure paths discovered in the three-role review.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../frontend');
const ts = require(path.join(root, 'node_modules/typescript'));
const vue = require(path.join(root, 'node_modules/vue'));
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function harness() {
  const cache = new Map(), unmount = [];
  function load(file) {
    file = path.resolve(root, file);
    if (cache.has(file)) return cache.get(file);
    const exports = {}; cache.set(file, exports);
    const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    vm.runInNewContext(js, { exports, require(name) { return name === 'vue' ? { ...vue, onMounted() {}, onUnmounted(fn) { unmount.push(fn); } } : load(path.resolve(path.dirname(file), name + '.ts')); }, console, Date, Math, Set, setInterval, clearInterval });
    return exports;
  }
  return { load, unmount: () => unmount.forEach(fn => fn()) };
}
const member = () => ({ id: 'a', role: 'member', status: 'approved' });
const tests = [];
const test = (name, run) => tests.push({ name, run });
test('chat creation cannot reopen a room after logout', async () => {
  const { load } = harness(), user = vue.ref(member()), pending = deferred();
  const chat = load('shared/useChat.ts').useChat(() => user.value, async (p, m) => m === 'POST' ? pending.promise : []);
  const task = chat.create('direct', { recipientId: 'b' });
  user.value = null; await vue.nextTick(); pending.resolve({ id: 'private-room' });
  assert.equal(await task, false); assert.equal(chat.active.value, null);
});
test('old leave response cannot close the newly selected conversation', async () => {
  const { load } = harness(), pending = deferred();
  const chat = load('shared/useChat.ts').useChat(member, async (p, m) => m === 'POST' ? pending.promise : p.endsWith('/b') ? { id: 'b', messages: [], lastRead: 0 } : []);
  chat.active.value = { id: 'a' }; const task = chat.action('a', 'leave');
  await chat.select({ id: 'b' }); pending.resolve({}); await task;
  assert.equal(chat.active.value.id, 'b');
});
test('chat completion after unmount does not issue more requests', async () => {
  const h = harness(), pending = deferred(); let reads = 0;
  const chat = h.load('shared/useChat.ts').useChat(member, async (p, m) => { if (m === 'POST') return pending.promise; reads++; return []; });
  const task = chat.create('direct', {}); h.unmount(); pending.resolve({ id: 'old' });
  assert.equal(await task, false); assert.equal(reads, 0);
});
test('old chat selection cannot dismiss current loading indicator', async () => {
  const { load } = harness(), a = deferred(), b = deferred();
  const chat = load('shared/useChat.ts').useChat(member, async p => p.endsWith('/a') ? a.promise : p.endsWith('/b') ? b.promise : []);
  const first = chat.select({ id: 'a' }), second = chat.select({ id: 'b' });
  a.resolve({ id: 'a', messages: [], lastRead: 0 }); await first;
  assert.equal(chat.loading.value, true);
  b.resolve({ id: 'b', messages: [], lastRead: 0 }); await second;
  assert.equal(chat.loading.value, false);
});
for (const [file, factory, payload] of [
  ['useShop', 'useShop', []], ['useGallery', 'useGallery', { albums: [], source: {} }], ['useForum', 'useForum', []]
]) {
  test(`${file}: older load failure cannot overwrite a successful reload`, async () => {
    const { load } = harness(), pending = deferred(); let count = 0;
    const state = load(`shared/${file}.ts`)[factory](() => null, async () => ++count === 1 ? pending.promise : payload);
    const first = state.load(); await state.load(); pending.reject(new Error('obsolete error')); await first;
    assert.equal(state.error.value, '');
  });
  test(`${file}: successful retry clears previous failure`, async () => {
    const { load } = harness(); let count = 0;
    const state = load(`shared/${file}.ts`)[factory](() => null, async () => { if (++count === 1) throw new Error('offline'); return payload; });
    await state.load(); await state.load(); assert.equal(state.error.value, '');
  });
}
for (const [file, factory, method, args, prepare] of [
  ['useShop', 'useShop', 'saveProduct', [{}], () => {}],
  ['useGallery', 'useGallery', 'save', [{}], () => {}],
  ['useForum', 'useForum', 'post', [], s => s.create()]
]) {
  test(`${file}: repeated submission sends only one write`, async () => {
    const { load } = harness(), pending = deferred(); let writes = 0;
    const state = load(`shared/${file}.ts`)[factory](member, async (p, m) => { if (m === 'POST') { writes++; return pending.promise; } return p.startsWith('/albums?') ? { albums: [], source: {} } : p === '/albums/saved' ? { album: { id: 'saved' }, photos: [] } : []; });
    prepare(state); const first = state[method](...args), second = state[method](...args);
    pending.resolve({ id: 'saved' }); await Promise.all([first, second]); assert.equal(writes, 1);
  });
}
test('shop rejects invalid mobile order locally', async () => {
  const { load } = harness(); let writes = 0;
  const shop = load('shared/useShop.ts').useShop(member, async (p, m) => { if (m === 'POST') writes++; return []; });
  shop.buy({ id: 'p', stock: 3, status: 'published' });
  Object.assign(shop.orderForm.value, { quantity: -1, name: '测试用户', phone: '13800008881', delivery: 'pickup', consent: true });
  assert.equal(await shop.submitOrder(), false); assert.equal(writes, 0); assert.match(shop.error.value, /数量/);
});
test('shop distinguishes successful order from failed list refresh', async () => {
  const { load } = harness();
  const shop = load('shared/useShop.ts').useShop(member, async (p, m) => { if (m === 'POST') return { id: 'saved' }; throw new Error('list offline'); });
  shop.buy({ id: 'p', stock: 3, status: 'published' });
  Object.assign(shop.orderForm.value, { name: '测试用户', phone: '13800008881', delivery: 'pickup', consent: true });
  assert.equal(await shop.submitOrder(), true); assert.equal(shop.ordering.value, false);
  assert.match(shop.message.value, /订单已提交/); assert.match(shop.error.value, /list offline/);
});
(async () => {
  let failed = 0;
  for (const item of tests) {
    const scope = vue.effectScope();
    try { await scope.run(item.run); console.log('PASS:', item.name); }
    catch (error) { failed++; console.error('FAIL:', item.name, '-', error.message); }
    finally { scope.stop(); }
  }
  console.log(`${tests.length - failed}/${tests.length} audit regression scenarios passed`);
  process.exitCode = failed ? 1 : 0;
})();
