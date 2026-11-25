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
const deferred = () => { let resolve, reject;const promise = new Promise((a, b) => { resolve = a;reject = b; });return { promise, resolve, reject }; };

function harness({ file, api = async () => [], props = {}, now, draft } = {}) {
  const cache = new Map(), unmounted = [], prompts = [], events = [];let session = 'session-one';
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
      exports, Date: DateClass, Math, Set, Map, Error, console, encodeURIComponent, document: { activeElement: null },
      crypto: require('node:crypto').webcrypto,
      uni: { showModal: prompt => prompts.push(prompt) },
      require: name => name === 'vue' ? { ...vue, onMounted() {}, onUnmounted: fn => unmounted.push(fn) }
        : name.endsWith('/platform') || name.endsWith('/api') ? { api, baseUrl: () => '', getToken: () => session }
        : load(path.resolve(path.dirname(filename), name + '.ts'))
    });
    return exports;
  }
  let scope = vue.effectScope(), state;
  function mount() { scope.run(() => {
    const exports = load(path.join(root, file || 'frontend/shared/useLife.ts'));
    state = file ? exports.default.setup(stateProps, { expose() {}, emit: (...args) => events.push(args) })
      : exports.useLife(() => stateProps.user, api, draft || { get: () => '', set() {}, remove() {} });
  }); }
  mount();
  const unmount = () => { unmounted.splice(0).forEach(fn => fn());scope.stop(); };
  return { get state() { return state; }, props: stateProps, prompts, events, unmount,
    remount(nextSession = session) { unmount();session = nextSession;scope = vue.effectScope();mount(); } };
}

const item = (id = 'product', extra = {}) => ({ id, title: '家乡特产', category: '家乡美食', description: '用于回归的商品说明', specification: '一袋', origin: '沭阳', status: 'published', stock: 1, priceCents: 1200, shippingCents: 300, images: [], ...extra });
function fillOrder(h, product = item()) { h.state.buy(product);Object.assign(h.state.orderForm.value, { name: '测试会员', phone: '13800001111', address: '江苏省苏州市测试地址', consent: true }); }
function navigate(h, method, fallback, ...args) { return h.state[method] ? h.state[method](...args) : fallback(); }
for (const file of ['frontend/src/components/ShopHub.vue', 'frontend/mobile/src/components/ShopMobile.vue']) {
  const platform = file.includes('/mobile/') ? 'H5/mini-program' : 'Web';
  test(`${platform} shop: returning to the same product preserves order details and request number`, async () => {
    const h = harness({ file, api: async url => url.startsWith('/products') ? [item()] : [] });
    try {
      fillOrder(h);const request = h.state.orderForm.value.requestId;h.state.orderForm.value.quantity = 1;
      navigate(h, 'backToProduct', () => { h.state.ordering.value = false; });await flush();h.state.order(h.state.selected.value);
      assert.equal(h.state.orderForm.value.requestId, request);assert.equal(h.state.orderForm.value.address, '江苏省苏州市测试地址');assert.equal(h.state.orderForm.value.consent, true);
    } finally { h.unmount(); }
  });
  test(`${platform} shop: reopening a previously confirmed draft after a price change requires new consent`, async () => {
    const h = harness({file, api: async url => url.startsWith('/products') ? [item('product', {priceCents: 1500})] : []});
    try {
      fillOrder(h);const requestId = h.state.orderForm.value.requestId;
      h.state.backToProduct();await flush();h.state.buy(h.state.selected.value);
      assert.equal(h.state.orderForm.value.consent, false);assert.equal(h.state.orderForm.value.requestId, requestId);
      assert.equal(h.state.total.value, 1800);assert.match(h.state.message.value, /重新确认/);
    } finally { h.unmount(); }
  });
  test(`${platform} shop: normal card entry refreshes availability and rejects a withdrawn product`, async () => {
    const h = harness({ file, api: async () => [] });try {
      navigate(h, 'openProduct', () => { h.state.selected.value = item(); }, item());await flush();
      assert.equal(h.state.selected.value.status, 'withdrawn');assert.equal(h.state.selected.value.stock, 0);assert.match(h.state.message.value, /下架/);
    } finally { h.unmount(); }
  });
  test(`${platform} shop: current product refresh updates price and revokes previous consent`, async () => {
    const h = harness({ file, api: async url => url.startsWith('/products') ? [item('product', { priceCents: 1800, stock: 5 })] : [] });
    try { fillOrder(h);await h.state.load();assert.equal(h.state.selected.value.priceCents, 1800);assert.equal(h.state.orderForm.value.consent, false);assert.equal(h.state.total.value, 2100);assert.match(h.state.message.value, /重新确认/); } finally { h.unmount(); }
  });
  test(`${platform} shop: product and order loading failures recover independently`, async () => {
    let productsFail = true, ordersFail = false;const h = harness({ file, api: async url => {
      if (url.startsWith('/products')) { if (productsFail) throw Error('products offline');return [item()]; }
      if (ordersFail) throw Error('orders offline');return [{ id: 'existing-order', status: 'pending' }];
    } });
    try { await h.state.load();assert.equal(h.state.orders.value[0]?.id, 'existing-order');assert.match(h.state.error.value, /products offline/);productsFail = false;ordersFail = true;await h.state.load();assert.equal(h.state.filtered.value.length, 1);assert.equal(h.state.orders.value.length, 0);ordersFail = false;await h.state.load();assert.equal(h.state.error.value, '');assert.equal(h.state.orders.value.length, 1); } finally { h.unmount(); }
  });
  test(`${platform} shop: malformed product responses cannot leave a stale purchasable detail`, async () => {
    const h = harness({ file, api: async url => url.startsWith('/products') ? {} : [] });try { h.state.selected.value = item();await h.state.load();assert.equal(h.state.selected.value.status, 'unavailable');assert.match(h.state.error.value, /响应异常/);assert.equal(h.state.filtered.value.length, 0); } finally { h.unmount(); }
  });
  test(`${platform} shop: a lost last-unit response recovers the existing order without another write`, async () => {
    let receipt, writes = 0;const h = harness({ file, api: async (url, method, body) => {
      if (method === 'POST') { writes++;receipt = { ...body, id: 'one:' + body.requestId, title: '已保存的订单', status: 'pending' };throw Error('connection lost'); }
      return url.startsWith('/products') ? [item('product', { stock: 0 })] : receipt ? [receipt] : [];
    } });
    try { fillOrder(h);assert.equal(await h.state.submitOrder(), true);assert.equal(writes, 1);assert.equal(h.state.orders.value[0]?.id, receipt.id);assert.equal(h.state.ordering.value, false);assert.equal(h.state.tab.value, 'orders');assert.match(h.state.message.value, /订单已提交/); } finally { h.unmount(); }
  });
  test(`${platform} shop: last-unit retry survives stock refresh and component remount`, async () => {
    let receipt, writes = 0, readFail = true;const h = harness({ file, api: async (url, method, body) => {
      if (method === 'POST') { writes++;receipt ||= { ...body, id: 'one:' + body.requestId, status: 'pending' };throw Error('connection lost'); }
      if (url.startsWith('/products')) return [item('product', { stock: receipt ? 0 : 1 })];
      if (readFail) throw Error('orders offline');return receipt ? [receipt] : [];
    } });
    try { fillOrder(h);const request = h.state.orderForm.value.requestId;await h.state.submitOrder();await h.state.load();assert.equal(h.state.canResumeOrder.value, true);h.remount();h.state.selected.value = item('product', { stock: 0 });assert.equal(h.state.canResumeOrder.value, true);h.state.buy(h.state.selected.value);assert.equal(h.state.orderForm.value.requestId, request);readFail = false;assert.equal(await h.state.submitOrder(), true);assert.equal(writes, 1);assert.equal(h.state.orders.value[0].id, receipt.id); } finally { h.unmount(); }
  });
  test(`${platform} shop: a new login session does not inherit another session's address or request`, async () => {
    const h = harness({ file });try { fillOrder(h);const request = h.state.orderForm.value.requestId;h.remount('session-two');h.state.buy(item());assert.notEqual(h.state.orderForm.value.requestId, request);assert.equal(h.state.orderForm.value.address, '');assert.equal(h.state.orderForm.value.consent, false); } finally { h.unmount(); }
  });
  test(`${platform} shop: changed uncertain order cannot create a second write while reconciliation fails`, async () => {
    let writes = 0;const h = harness({ file, api: async (url, method) => { if (method === 'POST') { writes++;throw Error('timeout'); }if (url.startsWith('/orders')) throw Error('offline');return [item()]; } });
    try { fillOrder(h);await h.state.submitOrder();h.state.orderForm.value.address = '另外一个五字以上的地址';await h.state.submitOrder();assert.equal(writes, 1);assert.match(h.state.error.value, /恢复原/);h.state.restoreAttempt();assert.equal(h.state.orderForm.value.address, '江苏省苏州市测试地址');await h.state.submitOrder();assert.equal(writes, 2); } finally { h.unmount(); }
  });
  test(`${platform} shop: rejected order may be corrected without abandoning its idempotency key`, async () => {
    const writes = [];const h = harness({ file, api: async (url, method, body) => { if (method === 'POST') { writes.push(body);if (writes.length === 1) throw Error('库存不足，请调整数量');return { ...body, id: 'one:' + body.requestId }; }return url.startsWith('/products') ? [item('product', { stock: 5 })] : []; } });
    try { fillOrder(h, item('product', { stock: 5 }));h.state.orderForm.value.quantity = 5;await h.state.submitOrder();h.state.orderForm.value.quantity = 1;assert.equal(await h.state.submitOrder(), true);assert.equal(writes[0].requestId, writes[1].requestId);assert.equal(writes[1].quantity, 1); } finally { h.unmount(); }
  });
  test(`${platform} shop: price conflicts refresh totals and require consent again`, async () => {
    const writes = [];let changed = false;const h = harness({ file, api: async (url, method, body) => { if (method === 'POST') { writes.push(body);if (!changed) { changed = true;throw Error('商品价格或运费已变化，请刷新商品并确认金额后重新下单'); }return { ...body, id: 'one:' + body.requestId }; }return url.startsWith('/products') ? [item('product', { priceCents: changed ? 1800 : 1200, shippingCents: changed ? 500 : 300 })] : []; } });
    try { fillOrder(h);await h.state.submitOrder();assert.equal(writes[0].expectedUnitCents, 1200);assert.equal(writes[0].expectedShippingCents, 300);assert.equal(h.state.total.value, 2300);assert.equal(h.state.orderForm.value.consent, false);await h.state.submitOrder();assert.equal(writes.length, 1);h.state.orderForm.value.consent = true;h.state.orderForm.value.delivery = 'pickup';await h.state.submitOrder();assert.equal(writes[1].expectedUnitCents, 1800);assert.equal(writes[1].expectedShippingCents, 0); } finally { h.unmount(); }
  });
  test(`${platform} shop: successful order remains visible when both list refreshes fail`, async () => {
    const h = harness({ file, api: async (_url, method, body) => { if (method === 'POST') return { ...body, id: 'one:' + body.requestId, title: '已成功订单' };throw Error('list offline'); } });
    try { fillOrder(h);assert.equal(await h.state.submitOrder(), true);assert.equal(h.state.orders.value[0]?.title, '已成功订单');assert.match(h.state.message.value, /订单已提交/);assert.match(h.state.error.value, /offline/); } finally { h.unmount(); }
  });
  test(`${platform} shop: leaving the form during submission does not force old navigation`, async () => {
    const pending = deferred();const h = harness({ file, api: async (url, method) => method === 'POST' ? pending.promise : url.startsWith('/products') ? [item()] : [] });
    try { fillOrder(h);const task = h.state.submitOrder();navigate(h, 'switchTab', () => { h.state.ordering.value = false;h.state.selected.value = null;h.state.tab.value = 'products'; }, 'products');await flush();pending.resolve({ id: 'saved' });await task;assert.equal(h.state.tab.value, 'products');assert.equal(h.state.selected.value, null);assert.equal(h.state.message.value, ''); } finally { h.unmount(); }
  });
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
