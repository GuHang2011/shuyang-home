// Execute the real MP/H5 component and shared check-in logic with controlled native callbacks.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../frontend'), baseline = process.argv.includes('--baseline');
const vue = require(path.join(root, 'node_modules/vue')), ts = require(path.join(root, 'node_modules/typescript')), sfc = require(path.join(root, 'node_modules/@vue/compiler-sfc'));
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); await vue.nextTick(); };
const firstId = '11111111-1111-1111-1111-111111111111', secondId = '22222222-2222-2222-2222-222222222222';
const qr = id => 'SYH:CHECKIN:' + id + ':33333333-3333-3333-3333-333333333333';
const event = id => ({ id, title: id, startsAt: '2026-12-01T08:00:00Z', endsAt: '2026-12-01T10:00:00Z' });
const settings = { enabled: true, latitude: 31, longitude: 120, radius: 200, opensAt: '2026-12-01T08:00:00Z', closesAt: '2026-12-01T10:00:00Z' };
function harness(platform = 'MP-WEIXIN', custom = () => undefined) {
  const unmounts = [], hides = [], scans = [], calls = [], cache = new Map(), props = vue.reactive({ user: { id: 'one', role: 'member', status: 'approved', enabled: true }, target: null });
  let disposed = false;
  const api = async (route, method, body) => {
    calls.push({ route, method, body }); const value = custom(route, method, body);
    if (value !== undefined) return value;
    if (route.endsWith('/checkin-config')) return { ...settings };
    if (route === '/events' || route === '/my/signups') return [];
    if (route.startsWith('/events/')) return event(route.split('/')[2]);
    return {};
  };
  function load(relative) {
    const file = path.resolve(root, relative); if (cache.has(file)) return cache.get(file);
    let source = baseline ? execFileSync('git', ['show', 'HEAD:frontend/' + path.relative(root, file).replaceAll('\\', '/')], { cwd: path.dirname(root), encoding: 'utf8' }) : fs.readFileSync(file, 'utf8');
    if (file.endsWith('.vue')) {
      source = source.replace(/\/\/ #ifdef (H5|MP-WEIXIN)\r?\n([\s\S]*?)\/\/ #endif/g, (_, target, content) => target === platform ? content : '');
      source = sfc.compileScript(sfc.parse(source).descriptor, { id: 'native-checkin' }).content;
    }
    const exports = {}; cache.set(file, exports);
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
      exports, Error, Date, Math, console, uni: { scanCode: options => scans.push(options), getLocation: options => options.success({ latitude: 31, longitude: 120, accuracy: 10 }) },
      require: name => name === 'vue' ? { ...vue, onMounted() {}, onUnmounted: fn => unmounts.push(fn) }
        : name === '@dcloudio/uni-app' ? { onHide: fn => hides.push(fn) }
        : name.endsWith('/platform') ? { api } : name.endsWith('/domain') ? { formatTime: value => value }
        : name.endsWith('.vue') ? {} : load(path.resolve(path.dirname(file), name + '.ts'))
    }); return exports;
  }
  const scope = vue.effectScope(); let state;
  scope.run(() => { state = load('mobile/src/components/CheckinMobile.vue').default.setup(props, { expose() {}, emit() {} }); });
  return { state, props, scans, calls, hide: () => hides.forEach(fn => fn()),
    dispose() { if (disposed) return; disposed = true; unmounts.forEach(fn => fn()); scope.stop(); } };
}
const tests = [], test = (name, run) => tests.push({ name, run });
function nativeResult(h, value) { h.state.scan(); h.scans.at(-1).success({ result: value }); }

test('a native scan requires explicit confirmation before loading the event', async () => {
  const h = harness(); try { nativeResult(h, qr(firstId)); assert.equal(h.state.scanResult.value, qr(firstId)); assert.equal(h.calls.length, 0); await h.state.confirm(qr(firstId)); assert.equal(h.state.selected.value.id, firstId); assert.equal(h.state.scanResult.value, ''); } finally { h.dispose(); }
});
test('canceling a new native scan clears its old result and preserves the chosen activity', async () => {
  const h = harness(); try { await h.state.select(event(firstId)); nativeResult(h, qr(secondId)); h.state.scan(); h.scans.at(-1).fail({ errMsg: 'scanCode:fail cancel' }); assert.equal(h.state.scanResult.value, ''); assert.equal(h.state.error.value, ''); assert.equal(h.state.selected.value.id, firstId); assert.equal(h.state.settings.value.enabled, true); await h.state.checkin(); assert.equal(h.calls.find(call => call.method === 'POST').route, '/events/' + firstId + '/self-check-in'); } finally { h.dispose(); }
});
test('canceling another scan retains the signed token for the current activity', async () => {
  const h = harness(); try { nativeResult(h, qr(firstId)); await h.state.confirm(qr(firstId)); h.state.scan(); h.scans.at(-1).fail({ errMsg: 'scanCode:fail cancel' }); await h.state.checkin(); const write = h.calls.find(call => call.method === 'POST'); assert.equal(write.route, '/events/' + firstId + '/self-check-in'); assert.equal(write.body.code, qr(firstId).split(':')[3]); assert.equal(h.state.error.value, ''); } finally { h.dispose(); }
});
test('canceling the scanner does not interrupt a manually chosen activity loading its settings', async () => {
  const pending = deferred(), h = harness('MP-WEIXIN', route => route.endsWith('/checkin-config') ? pending.promise : undefined);
  try { const selected = h.state.select(event(firstId)); h.state.scan(); h.scans.at(-1).fail({ errMsg: 'scanCode:fail cancel' }); pending.resolve(settings); await selected; assert.equal(h.state.selected.value.id, firstId); assert.equal(h.state.settings.value.enabled, true); assert.equal(h.state.error.value, ''); } finally { h.dispose(); }
});
test('a failed scan clears an old code and succeeds on retry without its previous error', async () => {
  const h = harness(); try { nativeResult(h, qr(firstId)); h.state.scan(); h.scans.at(-1).fail({ errMsg: 'scanCode:fail permission denied' }); assert.equal(h.state.scanResult.value, ''); assert.match(h.state.error.value, /权限/); nativeResult(h, qr(secondId)); assert.equal(h.state.scanResult.value, qr(secondId)); assert.equal(h.state.error.value, ''); } finally { h.dispose(); }
});
test('repeated clicks open only one native scanner until it completes', async () => {
  const h = harness(); try { h.state.scan(); h.state.scan(); assert.equal(h.scans.length, 1); h.scans[0].fail({ errMsg: 'scanCode:fail cancel' }); h.state.scan(); assert.equal(h.scans.length, 2); } finally { h.dispose(); }
});
test('empty native payload cannot preserve a previous code', async () => {
  const h = harness(); try { nativeResult(h, qr(firstId)); nativeResult(h, '   '); assert.equal(h.state.scanResult.value, ''); assert.match(h.state.error.value, /识别/); } finally { h.dispose(); }
});
test('a completed old native callback cannot overwrite a newer scan', async () => {
  const h = harness(); try { nativeResult(h, qr(firstId)); nativeResult(h, qr(secondId)); h.scans[0].success({ result: qr(firstId) }); h.scans[0].fail({ errMsg: 'late camera error' }); assert.equal(h.state.scanResult.value, qr(secondId)); assert.equal(h.state.error.value, ''); } finally { h.dispose(); }
});
for (const action of ['switch', 'logout', 'disable', 'reject', 'role', 'unmount']) for (const failed of [false, true]) test(`native ${failed ? 'failure' : 'success'} is ignored after ${action}`, async () => {
  const h = harness(); try {
    h.state.scan(); const pending = h.scans[0];
    if (action === 'switch') h.props.user = { ...h.props.user, id: 'two' };
    if (action === 'logout') h.props.user = null;
    if (action === 'disable') h.props.user.enabled = false;
    if (action === 'reject') h.props.user.status = 'rejected';
    if (action === 'role') h.props.user.role = 'moderator';
    if (action === 'unmount') h.dispose();
    await flush(); const previousError = h.state.error.value;
    failed ? pending.fail({ errMsg: 'late camera failure' }) : pending.success({ result: qr(firstId) });
    assert.equal(h.state.scanResult.value, ''); assert.equal(h.state.error.value, previousError);
  } finally { h.dispose(); }
});
for (const platform of ['MP-WEIXIN', 'H5']) test(`${platform} identity changes discard already displayed scan results`, async () => {
  const h = harness(platform); try { if (platform === 'H5') h.state.scan(); else nativeResult(h, qr(firstId)); h.props.user = { ...h.props.user, id: 'two' }; await flush(); assert.equal(h.state.scanResult.value, ''); assert.equal(h.state.scanning.value, false); } finally { h.dispose(); }
});
test('unapproved or disabled accounts cannot invoke the native scanner', async () => {
  for (const user of [null, { id: 'one', status: 'pending' }, { id: 'one', status: 'approved', enabled: false }]) {
    const h = harness(); try { h.props.user = user; await flush(); h.state.scan(); assert.equal(h.scans.length, 0); assert.match(h.state.error.value, /审核/); } finally { h.dispose(); }
  }
});
test('switching the target event discards a pending native callback and keeps the new event', async () => {
  const h = harness(); try { h.state.scan(); h.props.target = event(secondId); await flush(); h.scans[0].success({ result: qr(firstId) }); assert.equal(h.state.scanResult.value, ''); assert.equal(h.state.selected.value.id, secondId); } finally { h.dispose(); }
});
test('ordinary manual selection invalidates pending native callbacks', async () => {
  const h = harness(); try { h.state.scan(); await h.state.select(event(secondId)); h.scans[0].success({ result: qr(firstId) }); assert.equal(h.state.scanResult.value, ''); assert.equal(h.state.selected.value.id, secondId); } finally { h.dispose(); }
});
test('duplicate confirmation clicks issue one event lookup', async () => {
  const pending = deferred(), h = harness('MP-WEIXIN', route => route === '/events/' + firstId ? pending.promise : undefined);
  try { nativeResult(h, qr(firstId)); const first = h.state.confirm(qr(firstId)), second = h.state.confirm(qr(firstId)); assert.equal(h.calls.filter(call => call.route === '/events/' + firstId).length, 1); pending.resolve(event(firstId)); await Promise.all([first, second]); assert.equal(h.state.selected.value.id, firstId); } finally { h.dispose(); }
});
for (const failed of [false, true]) test(`rescan discards a pending confirmation ${failed ? 'error' : 'result'}`, async () => {
  const pending = deferred(), h = harness('MP-WEIXIN', route => route === '/events/' + firstId ? pending.promise : undefined);
  try { nativeResult(h, qr(firstId)); const task = h.state.confirm(qr(firstId)); nativeResult(h, qr(secondId)); failed ? pending.reject(Error('old lookup failed')) : pending.resolve(event(firstId)); await task; assert.equal(h.state.selected.value, null); assert.equal(h.state.scanResult.value, qr(secondId)); assert.equal(h.state.error.value, ''); await h.state.confirm(qr(secondId)); assert.equal(h.state.selected.value.id, secondId); } finally { h.dispose(); }
});
test('rescan discards delayed settings without clearing the new QR', async () => {
  const pending = deferred(), h = harness('MP-WEIXIN', route => route === '/events/' + firstId + '/checkin-config' ? pending.promise : undefined);
  try { nativeResult(h, qr(firstId)); const task = h.state.confirm(qr(firstId)); await flush(); nativeResult(h, qr(secondId)); pending.resolve(settings); await task; assert.equal(h.state.settings.value.enabled, undefined); assert.equal(h.state.scanResult.value, qr(secondId)); await h.state.confirm(qr(secondId)); assert.equal(h.state.selected.value.id, secondId); } finally { h.dispose(); }
});
test('current confirmation failure keeps its QR for a successful retry', async () => {
  let fail = true; const h = harness('MP-WEIXIN', route => route === '/events/' + firstId && fail ? Promise.reject(Error('temporary network error')) : undefined);
  try { nativeResult(h, qr(firstId)); await h.state.confirm(qr(firstId)); assert.equal(h.state.scanResult.value, qr(firstId)); assert.match(h.state.error.value, /network/); fail = false; await h.state.confirm(qr(firstId)); assert.equal(h.state.scanResult.value, ''); assert.equal(h.state.error.value, ''); assert.equal(h.state.selected.value.id, firstId); } finally { h.dispose(); }
});
test('foreign QR confirmation stays local and preserves its result for replacement', async () => {
  const h = harness(); try { nativeResult(h, 'https://untrusted.invalid/'); await h.state.confirm(h.state.scanResult.value); assert.equal(h.calls.length, 0); assert.match(h.state.error.value, /不是本平台/); assert.equal(h.state.scanResult.value, 'https://untrusted.invalid/'); } finally { h.dispose(); }
});
for (const platform of ['MP-WEIXIN', 'H5']) test(`${platform} leaving after capture clears the scanner without losing the chosen activity`, async () => {
  const h = harness(platform); try { await h.state.select(event(firstId)); if (platform === 'H5') h.state.scan(); else nativeResult(h, qr(secondId)); h.hide(); assert.equal(h.state.scanResult.value, ''); assert.equal(h.state.scanning.value, false); assert.equal(h.state.selected.value.id, firstId); assert.equal(h.state.settings.value.enabled, true); } finally { h.dispose(); }
});
test('native camera transition can finish while the component remains mounted', async () => {
  const h = harness(); try { h.state.scan(); h.hide(); h.scans[0].success({ result: qr(firstId) }); assert.equal(h.state.scanResult.value, qr(firstId)); } finally { h.dispose(); }
});
test('leaving while confirmation is pending discards its event and local result', async () => {
  const pending = deferred(), h = harness('MP-WEIXIN', route => route === '/events/' + firstId ? pending.promise : undefined);
  try { nativeResult(h, qr(firstId)); const task = h.state.confirm(qr(firstId)); h.hide(); pending.resolve(event(firstId)); await task; assert.equal(h.state.scanResult.value, ''); assert.equal(h.state.selected.value, null); } finally { h.dispose(); }
});
test('H5 can close and reopen its scanner while a previous confirmation is pending', async () => {
  const pending = deferred(), h = harness('H5', route => route === '/events/' + firstId ? pending.promise : undefined);
  try { h.state.scan(); const task = h.state.confirm(qr(firstId)); h.state.scan(); h.state.scan(); pending.resolve(event(firstId)); await task; assert.equal(h.state.scanning.value, true); assert.equal(h.state.selected.value, null); } finally { h.dispose(); }
});
(async () => { let failed = 0; for (const { name, run } of tests) { try { await run(); console.log('PASS:', name); } catch (error) { failed++; console.error('FAIL:', name, error.message); } } console.log(`${tests.length - failed}/${tests.length} native/mobile check-in scenarios passed`); process.exitCode = failed ? 1 : 0; })();
