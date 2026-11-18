const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../frontend');
const vue = require(path.join(root, 'node_modules/vue')), ts = require(path.join(root, 'node_modules/typescript')), sfc = require(path.join(root, 'node_modules/@vue/compiler-sfc'));
const tests = [], test = (name, run) => tests.push({ name, run });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const flush = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); await vue.nextTick(); };
function harness(surface) {
  const unmount = [], cache = new Map(), capture = deferred(), upload = deferred(), writes = [], released = [], requests = [];
  const props = vue.reactive({ user: { id: 'member-a', role: 'member', status: 'approved' } });
  const room = id => ({ id, type: 'direct', status: 'active', peerAvailable: true, messages: [], lastRead: 0 });
  let captures = 0, cancellations = 0;
  const photograph = request => { captures++; requests.push(request); request.cancel = () => { cancellations++; capture.resolve(null); }; return capture.promise; };
  const platform = {
    api: async url => url.startsWith('/chat/conversations/') ? room(url.split('/')[3]) : [],
    uploadMedia: (...args) => { writes.push(args); return upload.promise; },
    choosePhotos: async (_count, _camera, request) => { const photo = await photograph(request); return photo ? [photo] : []; },
    chooseFile: async () => ({ path: 'blob:file', name: '说明.pdf' })
  };
  function load(file) {
    file = path.resolve(file); if (cache.has(file)) return cache.get(file);
    let source = fs.readFileSync(file, 'utf8');
    if (file.endsWith('.vue')) source = sfc.compileScript(sfc.parse(source).descriptor, { id: 'chat-media-lifecycle' }).content;
    const exports = {}; cache.set(file, exports);
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
      exports, console, Date, Math, Set, Error, clearInterval, crypto: require('node:crypto').webcrypto,
      URL: { revokeObjectURL: value => released.push(value) },
      require: name => name === 'vue' ? { ...vue, onMounted() {}, onUnmounted: fn => unmount.push(fn) }
        : name.endsWith('/browserCamera') ? { captureBrowserPhoto: photograph }
        : name.endsWith('/api') || name.endsWith('/platform') ? platform
        : name.endsWith('.vue') ? {} : load(path.resolve(path.dirname(file), name + '.ts'))
    }); return exports;
  }
  const effect = vue.effectScope(); let state;
  effect.run(() => { state = load(path.join(root, surface === 'web' ? 'src/components/ChatHub.vue' : 'mobile/src/components/ChatMobile.vue')).default.setup(props, { expose() {}, emit() {} }); });
  state.active.value = room('room-a');
  return { state, props, capture, upload, writes, released, requests, room, captures: () => captures, cancellations: () => cancellations, dispose: () => { unmount.forEach(fn => fn()); effect.stop(); } };
}
const start = (h, surface, kind) => surface === 'mobile' ? h.state.attach(kind) : kind === 'camera' ? h.state.takePhoto() : h.state.uploadFile({ name: '说明.pdf' });
const photo = { source: 'blob:photo', preview: 'blob:photo', name: '拍照.jpg' };

for (const surface of ['web', 'mobile']) {
  test(`${surface}: same-conversation polling preserves camera and pending upload`, async () => {
    const h = harness(surface);
    try {
      const task = start(h, surface, 'camera'); await flush();
      for (let i = 0; i < 3; i++) await h.state.detail('room-a');
      assert.equal(h.captures(), 1); assert.equal(h.cancellations(), 0);
      assert.equal((surface === 'web' ? h.state.taking : h.state.uploading).value, true);
      h.capture.resolve(photo); await flush(); assert.equal(h.writes.length, 1);
      await h.state.detail('room-a'); assert.equal(h.state.uploading.value, true);
      h.upload.resolve({ id: 'photo-attachment', name: photo.name }); await task;
      assert.equal(h.state.attachment.value.id, 'photo-attachment'); assert.equal(h.state.uploading.value, false);
      assert.ok(h.released.includes('blob:photo'));
    } finally { h.dispose(); }
  });
  test(`${surface}: same-conversation polling preserves file upload and its error`, async () => {
    const h = harness(surface);
    try {
      const task = start(h, surface, 'file'); await flush(); await h.state.detail('room-a');
      assert.equal(h.state.uploading.value, true); assert.equal(h.writes.length, 1);
      h.upload.reject(Error('上传连接中断，请重试')); await task;
      assert.equal(h.state.error.value, '上传连接中断，请重试'); assert.equal(h.state.uploading.value, false);
    } finally { h.dispose(); }
  });
  for (const kind of ['camera', 'file']) for (const reason of ['account switch', 'conversation switch', 'send permission lost', 'unmount']) {
    test(`${surface}: ${kind} result is discarded after ${reason}`, async () => {
      const h = harness(surface);
      try {
        const task = start(h, surface, kind); await flush();
        if (reason === 'account switch') h.props.user = { ...h.props.user, id: 'member-b' };
        else if (reason === 'conversation switch') h.state.active.value = h.room('room-b');
        else if (reason === 'send permission lost') h.state.active.value = { ...h.room('room-a'), status: 'blocked' };
        else h.dispose();
        h.capture.resolve(photo); h.upload.resolve({ id: 'obsolete-attachment' }); await task;
        assert.equal(h.state.attachment.value, null);
        if (kind === 'camera') { assert.equal(h.cancellations(), 1); assert.equal(h.writes.length, 0); }
      } finally { if (reason !== 'unmount') h.dispose(); }
    });
  }
}
(async () => {
  let passed = 0;
  for (const { name, run } of tests) { try { await run(); passed++; console.log('PASS:', name); } catch (error) { console.error('FAIL:', name, error.message); } }
  console.log(`${passed}/${tests.length} chat media lifecycle regressions passed`); process.exitCode = passed === tests.length ? 0 : 1;
})();
