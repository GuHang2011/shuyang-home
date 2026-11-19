const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../frontend'), vue = require(path.join(root, 'node_modules/vue')), ts = require(path.join(root, 'node_modules/typescript'));
const tests = [], test = (name, run) => tests.push({ name, run });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const flush = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); await vue.nextTick(); };
function harness(module, custom = () => undefined) {
  const unmounts = [], cache = new Map(), calls = [], user = vue.ref({ id: 'member', role: 'admin', status: 'approved', enabled: true });
  function load(file) {
    file = path.resolve(file); if (cache.has(file)) return cache.get(file);
    const exports = {}; cache.set(file, exports);
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
      exports, console, Date, Math, Set, Map, Error, encodeURIComponent,
      setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
      require: name => name === 'vue' ? { ...vue, onMounted() {}, onUnmounted: fn => unmounts.push(fn) } : load(path.resolve(path.dirname(file), name + '.ts'))
    }); return exports;
  }
  const effect = vue.effectScope(); let state;
  const api = async (url, method, body) => {
    calls.push({ url, method, body }); const result = custom(url, method, body);
    if (result !== undefined) return result;
    if (url === '/display') return { slides: [] };
    if (url === '/admin/forum') return { topics: [], replies: [] };
    if (url.startsWith('/forum/topics/')) return { topic: { id: url.split('/').pop(), category: '乡情闲聊' }, replies: [] };
    return [];
  };
  effect.run(() => { state = load(path.join(root, 'shared', module + '.ts'))[module](() => user.value, api); });
  return { state, user, calls, dispose: () => { unmounts.forEach(fn => fn()); effect.stop(); } };
}

for (const destination of ['new draft', 'different topic', 'list']) for (const failure of [false, true]) {
  test(`forum: late publication ${failure ? 'failure' : 'success'} preserves ${destination}`, async () => {
    const pending = deferred(), h = harness('useForum', (_url, method) => method === 'POST' ? pending.promise : undefined), f = h.state;
    try {
      f.create(); f.form.value.title = '第一篇'; const task = f.post();
      f.creating.value = false;
      if (destination === 'new draft') { f.create(); f.form.value.title = '仍在撰写的新草稿'; }
      else if (destination === 'different topic') await f.detail({ id: 'other' });
      failure ? pending.reject(Error('旧提交的网络错误')) : pending.resolve({ id: 'first' }); await task;
      if (destination === 'new draft') { assert.equal(f.creating.value, true); assert.equal(f.form.value.title, '仍在撰写的新草稿'); }
      else if (destination === 'different topic') assert.equal(f.selected.value.id, 'other');
      assert.equal(f.error.value, ''); assert.equal(f.message.value, ''); assert.equal(f.tab.value, 'public'); assert.equal(f.busy.value, false);
    } finally { h.dispose(); }
  });
}
test('forum: ordinary publication completes and duplicate submit makes one write', async () => {
  const pending = deferred(), h = harness('useForum', (_url, method) => method === 'POST' ? pending.promise : undefined);
  try { h.state.create(); const first = h.state.post(); await h.state.post(); assert.equal(h.calls.filter(c => c.method === 'POST').length, 1); pending.resolve({}); await first; assert.equal(h.state.creating.value, false); assert.equal(h.state.tab.value, 'mine'); assert.equal(h.state.message.value, '已提交审核'); } finally { h.dispose(); }
});
test('forum: current publication error keeps the original form retryable', async () => {
  const h = harness('useForum', (_url, method) => method === 'POST' ? Promise.reject(Error('请检查网络')) : undefined);
  try { h.state.create(); h.state.form.value.title = '保留内容'; await h.state.post(); assert.equal(h.state.creating.value, true); assert.equal(h.state.form.value.title, '保留内容'); assert.equal(h.state.error.value, '请检查网络'); assert.equal(h.state.busy.value, false); } finally { h.dispose(); }
});

test('address book: disabling the current account immediately clears private contacts and forms', async () => {
  const h = harness('useAddressBook', () => [{ id: 'peer', name: '私人联系人', contact: '私人联系方式' }]);
  try {
    await flush(); assert.equal(h.state.rows.value.length, 1); h.state.edit(h.state.rows.value[0]); h.state.removing.value = h.state.rows.value[0];
    h.user.value.enabled = false;
    assert.equal(h.state.allowed.value, false); assert.equal(h.state.rows.value.length, 0); assert.equal(h.state.editing.value, null); assert.equal(h.state.removing.value, null);
    const before = h.calls.length; h.state.edit({ id: 'peer' }); await h.state.save(); await h.state.load(); assert.equal(h.calls.length, before); assert.equal(h.state.editing.value, null);
  } finally { h.dispose(); }
});
test('address book: a late private list cannot restore data after account disabling', async () => {
  const pending = deferred(), h = harness('useAddressBook', () => pending.promise);
  try { h.user.value.enabled = false; pending.resolve([{ id: 'private' }]); await flush(); assert.equal(h.state.rows.value.length, 0); assert.equal(h.state.loading.value, false); } finally { h.dispose(); }
});
test('display: disabling an administrator clears media management and ignores pending upload', async () => {
  const pending = deferred(), h = harness('useDisplay');
  try {
    await h.state.manage(); h.state.assets.value = [{ id: 'private-draft' }]; h.state.edit(); const upload = h.state.upload(() => pending.promise);
    h.user.value.enabled = false;
    assert.equal(h.state.staff.value, false); assert.equal(h.state.managing.value, false); assert.equal(h.state.assets.value.length, 0); assert.equal(h.state.editing.value, false);
    pending.resolve({ id: 'private-upload' }); await upload; assert.equal(h.state.form.value.mediaId, undefined); assert.equal(h.state.uploading.value, false);
    const before = h.calls.length; h.state.edit(); await h.state.manage(); await h.state.save(); assert.equal(h.calls.length, before); assert.equal(h.state.editing.value, false);
  } finally { h.dispose(); }
});
test('display: late management list cannot restore disabled staff privileges', async () => {
  const pending = deferred(), h = harness('useDisplay', url => url === '/display/slides' ? pending.promise : undefined);
  try { const task = h.state.manage(); h.user.value.enabled = false; pending.resolve([{ id: 'private' }]); await task; assert.equal(h.state.assets.value.length, 0); assert.equal(h.state.managing.value, false); } finally { h.dispose(); }
});
for (const failure of [false, true]) test(`display: latest management request wins over an older ${failure ? 'failure' : 'success'}`, async () => {
  const a = deferred(), b = deferred(); let requests = 0;
  const h = harness('useDisplay', url => url === '/display/slides' ? (++requests === 1 ? a.promise : b.promise) : undefined);
  try { const first = h.state.manage(), second = h.state.manage(); b.resolve([{ id: 'latest' }]); await second; failure ? a.reject(Error('过期错误')) : a.resolve([{ id: 'stale' }]); await first; assert.equal(h.state.assets.value[0].id, 'latest'); assert.equal(h.state.error.value, ''); } finally { h.dispose(); }
});
for (const failure of [false, true]) test(`display: closing management ignores a pending ${failure ? 'failure' : 'success'}`, async () => {
  const pending = deferred(); let requests = 0;
  const h = harness('useDisplay', url => url === '/display/slides' ? (++requests === 1 ? [{ id: 'original' }] : pending.promise) : undefined);
  try {
    await h.state.manage(); h.state.edit(); h.state.removing.value = { id: 'old' }; const task = h.state.manage();
    if (h.state.closeManage) h.state.closeManage(); else { h.state.managing.value = false; h.state.editing.value = false; }
    failure ? pending.reject(Error('收起后的旧错误')) : pending.resolve([{ id: 'old-refresh' }]); await task;
    assert.equal(h.state.managing.value, false); assert.equal(h.state.editing.value, false); assert.equal(h.state.removing.value, null); assert.equal(h.state.error.value, '');
  } finally { h.dispose(); }
});
(async () => { let passed = 0; for (const { name, run } of tests) { try { await run(); passed++; console.log('PASS:', name); } catch (error) { console.error('FAIL:', name, error.message); } } console.log(`${passed}/${tests.length} forum/people lifecycle regressions passed`); process.exitCode = passed === tests.length ? 0 : 1; })();
