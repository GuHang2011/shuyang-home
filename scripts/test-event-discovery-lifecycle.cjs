const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../frontend'), vue = require(path.join(root, 'node_modules/vue'));
const ts = require(path.join(root, 'node_modules/typescript')), sfc = require(path.join(root, 'node_modules/@vue/compiler-sfc'));
const start = Date.parse('2026-11-21T02:00:00Z'), tests = [], test = (name, run) => tests.push({ name, run });
const event = (extra = {}) => ({ id: 'synthetic-event', title: '苏州 Meet 摄影交流', category: '交流分享', description: '合成验收活动内容', location: '吴中测试场地', status: 'published', registered: 1, capacity: 4, startsAt: new Date(start + 1500).toISOString(), endsAt: new Date(start + 4500).toISOString(), ...extra });
const flush = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); await vue.nextTick(); };
function harness(surface) {
  const cache = new Map(), mounted = [], unmounts = [], timers = new Map(), calls = [], notices = [], remote = { events: [event()], signups: [] };
  let clock = start, nextTimer = 0;
  const timer = (callback, delay, interval = false) => { const id = ++nextTimer; timers.set(id, { callback, time: clock + Number(delay || 0), interval, delay }); return id; };
  const api = async (url, method, body) => {
    calls.push({ url, method, body });
    if (url === '/auth/me') return { id: 'member', role: 'member', status: 'approved' };
    if (url === '/events') return remote.events.map(row => ({ ...row }));
    if (url === '/my/signups') return remote.signups;
    if (url === '/home') return {};
    return [];
  };
  function load(file) {
    file = path.resolve(file); if (cache.has(file)) return cache.get(file);
    const relative = path.relative(root, file).replaceAll('\\', '/');
    let source = process.argv.includes('--baseline') && ['src/App.vue', 'mobile/src/pages/index/index.vue', 'shared/useEventDiscovery.ts'].includes(relative)
      ? require('node:child_process').execFileSync('git', ['show', 'HEAD:frontend/' + relative], { encoding: 'utf8' }) : fs.readFileSync(file, 'utf8');
    if (file.endsWith('.vue')) source = sfc.compileScript(sfc.parse(source).descriptor, { id: 'event-lifecycle' }).content;
    const exports = {}; cache.set(file, exports);
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
      exports, console, Date: class extends Date { static now() { return clock; } }, Math, Set, Map,
      setTimeout: (fn, delay) => timer(fn, delay), clearTimeout: id => timers.delete(id), setInterval: (fn, delay) => timer(fn, delay, true), clearInterval: id => timers.delete(id),
      window: { scrollTo() {}, addEventListener() {}, removeEventListener() {} }, document: { activeElement: null, hidden: false, addEventListener() {}, removeEventListener() {} },
      location: { hash: '#home' }, history: { pushState() {}, replaceState() {} },
      uni: { showToast: value => notices.push(value), pageScrollTo() {}, showModal: value => notices.push(value), $on() {}, $off() {} },
      require: request => request === 'vue' ? { ...vue, onMounted: fn => mounted.push(fn), onUnmounted: fn => unmounts.push(fn) }
        : request === '@dcloudio/uni-app' ? { onHide() {}, onShow() {}, onLoad() {}, onShareAppMessage() {}, onPullDownRefresh() {} }
        : /use(Web|Mobile)Appearance$/.test(request) ? { useWebAppearance: () => ({}), useMobileAppearance: () => ({}) }
        : request.endsWith('/useChat') ? { useChatUnread: () => ({ unread: vue.ref(0) }) }
        : request.endsWith('/useBroadcasts') ? { useBroadcastFeed: () => ({}), canBroadcast: () => false }
        : request.endsWith('/useWorkCenter') ? { useWorkSummary: () => ({}), useHelpDiscovery: () => ({}), helpProgress: {} }
        : request.endsWith('/api') || request.endsWith('/platform') ? { api, getToken: () => '', setToken() {} }
        : request.endsWith('.vue') ? {} : load(path.resolve(path.dirname(file), request + '.ts'))
    }); return exports;
  }
  const scope = vue.effectScope(); let state;
  scope.run(() => { state = load(path.join(root, surface === 'web' ? 'src/App.vue' : 'mobile/src/pages/index/index.vue')).default.setup({}, { expose() {}, emit() {} }); });
  return { state, calls, remote, notices, timers, mount: () => Promise.all(mounted.map(fn => fn())),
    refresh: () => (state.refresh || state.load)(), detail: row => { state.detail(surface === 'web' ? 'eventDetail' : 'event', row); return flush(); },
    selected: () => surface === 'web' ? state.form.value : state.selected.value,
    jump(ms) { clock += ms; },
    async advance(ms) { const end = clock + ms; let count = 0; for (;;) { const due = [...timers].filter(([, t]) => t.time <= end).sort((a, b) => a[1].time - b[1].time)[0]; if (!due) break; assert(++count < 100, 'Clock must not busy-loop'); const [id, current] = due; clock = current.time; if (current.interval) current.time += current.delay; else timers.delete(id); current.callback(); await flush(); } clock = end; await flush(); },
    dispose() { unmounts.splice(0).forEach(fn => fn()); scope.stop(); }
  };
}
for (const surface of ['web', 'mobile']) {
  test(`${surface}: open detail changes from available to ongoing and ended without user input`, async () => {
    const h = harness(surface); try {
      await h.mount(); await h.detail(h.remote.events[0]);
      const label = vue.computed(() => h.state.signupLabel(h.selected()));
      assert.equal(label.value, '我要报名'); await h.advance(1500); assert.equal(label.value, '进行中');
      await h.advance(3000); assert.equal(label.value, '已结束');
    } finally { h.dispose(); }
  });
  test(`${surface}: my signup cancellation expires at the same start boundary`, async () => {
    const h = harness(surface); try {
      await h.mount(); const signup = { status: 'registered', event: h.remote.events[0] }, cancel = vue.computed(() => h.state.canCancelSignup(signup));
      assert.equal(cancel.value, true); await h.advance(1500); assert.equal(cancel.value, false);
    } finally { h.dispose(); }
  });
  test(`${surface}: a late click cannot submit after the actual start time`, async () => {
    const h = harness(surface); try {
      await h.mount(); h.state.user.value = { id: 'member', status: 'approved', role: 'member' }; await h.detail(h.remote.events[0]); h.jump(1600);
      surface === 'web' ? h.state.signup(h.selected()) : h.state.signup(); await flush();
      assert.equal(h.calls.filter(call => call.method === 'POST' && call.url.endsWith('/signup')).length, 0); assert.ok(h.state.error.value);
    } finally { h.dispose(); }
  });
  for (const status of ['full', 'cancelled', 'joined', 'cancelled-signup']) test(`${surface}: reloading updates an open ${status} detail`, async () => {
    const h = harness(surface); try {
      await h.mount(); const row = h.remote.events[0]; if (status === 'cancelled-signup') row.mySignup = { id: 's', status: 'registered' };
      await h.detail(row);
      h.remote.events = [{ ...row, ...(status === 'full' ? { registered: 4 } : status === 'cancelled' ? { status: 'cancelled' } : status === 'joined' ? { mySignup: { id: 's', status: 'registered' } } : { mySignup: null, registered: 0 }) }];
      await h.refresh(); await flush();
      const expected = status === 'full' ? '已满员' : status === 'cancelled' ? '已取消' : status === 'joined' ? '你已报名，期待相见' : '我要报名';
      assert.equal(h.state.signupLabel(h.selected()), expected);
    } finally { h.dispose(); }
  });
  test(`${surface}: background event refresh preserves an unrelated editing form`, async () => {
    const h = harness(surface); try {
      await h.mount(); await h.state.open('profile', { name: '保留编辑内容' }); h.remote.events = [event({ registered: 4 })]; await h.refresh();
      assert.equal(h.state.form.value.name, '保留编辑内容');
    } finally { h.dispose(); }
  });
  test(`${surface}: an event withdrawn from the public list cannot remain open for signup`, async () => {
    const h = harness(surface);
    try {
      await h.mount();
      await h.detail(h.remote.events[0]);
      h.remote.events = [];
      await h.refresh();
      const screen = surface === 'web' ? h.state.modal : h.state.screen;
      assert.equal(screen.value, '');
      assert.equal(h.selected().id, undefined);
    } finally { h.dispose(); }
  });
  test(`${surface}: search, status filters and registration cancellation agree after refresh`, async () => {
    const h = harness(surface); try {
      h.remote.events = [event({ id: 'open' }), event({ id: 'full', registered: 4 }), event({ id: 'joined', mySignup: { id: 's', status: 'registered' } }), event({ id: 'ongoing', startsAt: new Date(start - 1000).toISOString() }), event({ id: 'ended', endsAt: new Date(start).toISOString() }), event({ id: 'cancelled', status: 'cancelled' })];
      await h.mount(); h.state.eventView.value = 'available'; h.state.filter.value = '交流分享'; h.state.search.value = ' meet ';
      const rows = h.state.filteredEvents || h.state.listEvents; assert.equal(rows.value.map(row => row.id).join(','), 'open');
      h.state.eventView.value = 'mine'; assert.equal(rows.value.map(row => row.id).join(','), 'joined');
      h.remote.events[2].mySignup = null; await h.refresh(); assert.equal(rows.value.length, 0);
      h.state.eventView.value = 'available'; assert.equal(rows.value.map(row => row.id).join(','), 'open,joined');
      h.state.eventView.value = 'ended'; assert.equal(rows.value.map(row => row.id).join(','), 'ended');
    } finally { h.dispose(); }
  });
  test(`${surface}: the event clock stops on unmount`, async () => {
    const h = harness(surface); await h.mount(); assert.ok(h.timers.size); h.dispose(); assert.equal(h.timers.size, 0);
  });
}
(async () => { let passed = 0; for (const { name, run } of tests) { try { await run(); passed++; console.log('PASS:', name); } catch (error) { console.error('FAIL:', name, error.message); } } console.log(`${passed}/${tests.length} event lifecycle scenarios passed`); process.exitCode = passed === tests.length ? 0 : 1; })();
