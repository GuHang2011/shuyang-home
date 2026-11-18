const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const vue = require(path.join(root, 'frontend/node_modules/vue'));
const ts = require(path.join(root, 'frontend/node_modules/typescript'));
const sfc = require(path.join(root, 'frontend/node_modules/@vue/compiler-sfc'));
const baseline = process.argv.includes('--baseline');
const tests = [];
const test = (name, run) => tests.push({ name, run });
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); await vue.nextTick(); };

function harness({ file, api = async () => [], props = {}, now, draft } = {}) {
  const cache = new Map(), unmounted = [], prompts = [], events = [];
  const stateProps = vue.reactive({ user: { id: 'one', status: 'approved', role: 'member' }, ...props });
  const DateClass = now ? class extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return new Date(now).getTime(); }
  } : Date;
  function load(filename) {
    filename = path.resolve(filename);
    if (cache.has(filename)) return cache.get(filename);
    let source = baseline
      ? execFileSync('git', ['show', 'HEAD:' + path.relative(root, filename).replaceAll('\\', '/')], { cwd: root, encoding: 'utf8' })
      : fs.readFileSync(filename, 'utf8');
    if (filename.endsWith('.vue')) source = sfc.compileScript(sfc.parse(source).descriptor, { id: 'life-shop-reliability' }).content;
    const exports = {}; cache.set(filename, exports);
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
      exports, Date: DateClass, Math, Set, Error, console, encodeURIComponent,
      crypto: require('node:crypto').webcrypto,
      uni: { showModal: prompt => prompts.push(prompt) },
      require: name => name === 'vue' ? { ...vue, onMounted() {}, onUnmounted: fn => unmounted.push(fn) }
        : name.endsWith('/platform') ? { api, baseUrl: () => '' }
        : load(path.resolve(path.dirname(filename), name + '.ts'))
    });
    return exports;
  }
  const scope = vue.effectScope(); let state;
  scope.run(() => {
    const exports = load(path.join(root, file || 'frontend/shared/useLife.ts'));
    state = file ? exports.default.setup(stateProps, { expose() {}, emit: (...args) => events.push(args) })
      : exports.useLife(() => stateProps.user, api, draft || { get: () => '', set() {}, remove() {} });
  });
  return { state, props: stateProps, prompts, events, unmount: () => { unmounted.forEach(fn => fn()); scope.stop(); } };
}

for (const reason of ['account switch', 'logout', 'role change', 'unmount']) {
  test(`shop: stale confirmation cannot submit after ${reason}`, async () => {
    const writes = [], h = harness({ file: 'frontend/mobile/src/components/ShopMobile.vue', api: async (url, method) => { if (method === 'POST') writes.push(url); return []; } });
    try {
      h.state.action({ id: 'old-order' }, 'cancel');
      if (reason === 'account switch') h.props.user = { id: 'two', status: 'approved', role: 'admin' };
      else if (reason === 'logout') h.props.user = null;
      else if (reason === 'role change') h.props.user.role = 'admin';
      else h.unmount();
      h.prompts[0].success({ confirm: true }); await flush();
      assert.equal(writes.length, 0);
    } finally { if (reason !== 'unmount') h.unmount(); }
  });
}
test('shop: only the latest confirmation can submit once', async () => {
  const writes = [], h = harness({ file: 'frontend/mobile/src/components/ShopMobile.vue', api: async (url, method) => { if (method === 'POST') writes.push(url); return []; } });
  try {
    h.state.action({ id: 'first' }, 'cancel'); h.state.action({ id: 'second' }, 'receive');
    h.prompts[0].success({ confirm: true }); await flush();
    assert.equal(writes.length, 0);
    h.prompts[1].success({ confirm: true }); await flush();
    h.prompts[1].success({ confirm: true }); await flush();
    assert.deepEqual(writes, ['/orders/second/action']);
  } finally { h.unmount(); }
});
test('shop: cancelling the confirmation makes no order write', async () => {
  const writes = [], h = harness({ file: 'frontend/mobile/src/components/ShopMobile.vue', api: async (url, method) => { if (method === 'POST') writes.push(url); return []; } });
  try { h.state.action({ id: 'order' }, 'cancel'); h.prompts[0].success({ confirm: false }); await flush(); assert.equal(writes.length, 0); } finally { h.unmount(); }
});

for (const [now, expected] of [
  ['2026-11-17T16:00:00.000Z', '2026-11-18'],
  ['2026-11-17T23:59:59.999Z', '2026-11-18'],
  ['2026-12-31T16:01:00.000Z', '2027-01-01'],
  ['2026-11-18T08:00:00.000Z', '2026-11-18']
]) test(`date picker: time-first input uses Beijing date at ${now}`, () => {
  const h = harness({ file: 'frontend/mobile/src/components/DateTimeField.vue', props: { modelValue: '', label: '活动开始时间' }, now });
  try { h.state.time({ detail: { value: '09:30' } }); assert.equal(h.events[0][1], expected + 'T09:30'); } finally { h.unmount(); }
});
test('date picker: changing time keeps the explicitly selected date', () => {
  const h = harness({ file: 'frontend/mobile/src/components/DateTimeField.vue', props: { modelValue: '2026-12-05T10:30', label: '活动时间' }, now: '2026-11-17T18:00:00Z' });
  try { h.state.time({ detail: { value: '14:45' } }); assert.equal(h.events[0][1], '2026-12-05T14:45'); h.state.date({ detail: { value: '2026-12-06' } }); assert.equal(h.events[1][1], '2026-12-06T10:30'); } finally { h.unmount(); }
});

test('life: blocked local draft deletion does not turn a successful publish into failure', async () => {
  const writes = [], h = harness({ draft: { get: () => '', set() {}, remove() { throw Error('storage unavailable'); } }, api: async (url, method) => {
    if (method === 'POST') { writes.push(url); return { id: 'saved' }; }
    if (url === '/life/entries/saved') return { id: 'saved', type: 'help' };
    return [];
  } });
  try {
    h.state.type.value = 'help'; h.state.editing.value = true;
    h.state.form.value = { title: '帮办事项', content: '已确认的详细说明', requestId: 'request-one' };
    await h.state.save();
    assert.equal(h.state.editing.value, false); assert.equal(h.state.selected.value.id, 'saved');
    assert.equal(h.state.error.value, ''); assert.match(h.state.message.value, /已保存/);
    assert.match(h.state.message.value, /草稿.*未能清除/); assert.equal(writes.length, 1); assert.equal(h.state.busy.value, false);
  } finally { h.unmount(); }
});
test('life: draft deletion failure is actionable and clears an obsolete success notice', () => {
  let fail = true;
  const h = harness({ draft: { get: () => '', set() {}, remove() { if (fail) throw Error('storage unavailable'); } } });
  try {
    h.state.message.value = '旧成功消息'; assert.doesNotThrow(() => h.state.clearDraft());
    assert.equal(h.state.message.value, ''); assert.match(h.state.error.value, /草稿.*清除/);
    fail = false; h.state.clearDraft(); assert.equal(h.state.error.value, ''); assert.equal(h.state.message.value, '草稿已清除');
  } finally { h.unmount(); }
});
test('life: failed server publish retains the form and local draft', async () => {
  let deletes = 0;
  const h = harness({ draft: { get: () => '', set() {}, remove() { deletes++; } }, api: async () => { throw Error('network unavailable'); } });
  try { h.state.type.value = 'help'; h.state.editing.value = true; h.state.form.value = { title: '保留草稿' }; await h.state.save(); assert.equal(h.state.editing.value, true); assert.equal(h.state.form.value.title, '保留草稿'); assert.equal(deletes, 0); assert.equal(h.state.error.value, 'network unavailable'); } finally { h.unmount(); }
});

(async () => {
  let passed = 0;
  for (const { name, run } of tests) { try { await run(); passed++; console.log('PASS:', name); } catch (error) { console.error('FAIL:', name, error.message); } }
  console.log(`${passed}/${tests.length} life/shop reliability regressions passed${baseline ? ' (HEAD baseline)' : ''}`);
  process.exitCode = passed === tests.length ? 0 : 1;
})();
