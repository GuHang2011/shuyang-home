// Execute the real scanner setup with controlled image and camera completion order.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../frontend');
const vue = require(path.join(root, 'node_modules/vue')), ts = require(path.join(root, 'node_modules/typescript')), sfc = require(path.join(root, 'node_modules/@vue/compiler-sfc'));
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
async function flush() { for (let i = 0; i < 12; i++) await Promise.resolve(); await vue.nextTick(); }
function harness() {
  const images = [], cameras = [], created = [], revoked = [], unmounts = [], exports = {};
  class Reader {
    decodeFromConstraints(_constraints, video, callback) {
      const pending = deferred(), stream = { live: true };
      // ZXing stops this request's tracks AND clears its supplied video element.
      const control = { stop() { stream.live = false; video.srcObject = null; } };
      cameras.push({ pending, stream, control, video, found: text => callback({ getText: () => text }, undefined, control),
        ready() { video.srcObject = stream; pending.resolve(control); } });
      return pending.promise;
    }
  }
  const original = process.argv.includes('--baseline') ? require('node:child_process').execFileSync('git', ['show', 'HEAD:frontend/src/components/WebScanner.vue'], { encoding: 'utf8' }) : fs.readFileSync(path.join(root, 'src/components/WebScanner.vue'), 'utf8');
  const script = sfc.compileScript(sfc.parse(original).descriptor, { id: 'scanner-lifecycle' }).content;
  vm.runInNewContext(ts.transpileModule(script, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
    exports, Error, navigator: { mediaDevices: { getUserMedia() {} } }, window: { isSecureContext: true },
    URL: { createObjectURL: () => { const url = 'blob:scan-' + (created.length + 1); created.push(url); return url; }, revokeObjectURL: url => revoked.push(url) },
    require: name => name === 'vue' ? { ...vue, h: (tag, props) => ({ tag, props }), onUnmounted: fn => unmounts.push(fn) } : name === '@zxing/browser' ? { BrowserQRCodeReader: Reader } : {
      decodeQrImage(reader, url) { const pending = deferred(); images.push({ pending, reader, url }); return pending.promise; }
    }
  });
  const scope = vue.effectScope(); let state;
  scope.run(() => {
    state = exports.default.setup({ confirmLabel: '确认' }, { expose() {}, emit() {} });
    // Model keyed native DOM replacement using the component's actual render function.
    const render = state.NativeCamera.setup(); let lastKey, element;
    vue.watchEffect(() => {
      const node = render(); if (!element || node.props.key !== lastKey) { element = vue.markRaw({ srcObject: null }); lastKey = node.props.key; }
      node.props.ref(element);
    });
  });
  return { state, cameras, images, created, revoked,
    image: () => state.image({ target: { files: [{ name: 'code.png' }], value: 'code.png' } }),
    dispose: () => { unmounts.splice(0).forEach(fn => fn()); scope.stop(); }
  };
}
const tests = [], test = (name, run) => tests.push({ name, run });
async function imageResult(h, text) { const task = h.image(); await flush(); h.images.at(-1).pending.resolve(text); await task; }

test('a current image succeeds and releases its object URL', async () => {
  const h = harness(); try { await imageResult(h, 'CURRENT'); assert.equal(h.state.result.value, 'CURRENT'); assert.deepEqual(h.revoked, h.created); } finally { h.dispose(); }
});
test('selecting another image clears the previous code before decoding or failure', async () => {
  const h = harness(); try {
    await imageResult(h, 'OLD'); const task = h.image(); await flush(); const during = h.state.result.value;
    h.images.at(-1).pending.reject(Error('not a QR')); await task;
    assert.equal(during, ''); assert.equal(h.state.result.value, ''); assert.match(h.state.error.value, /没有识别/);
    await imageResult(h, 'RETRY'); assert.equal(h.state.result.value, 'RETRY'); assert.equal(h.state.error.value, '');
  } finally { h.dispose(); }
});
for (const failure of [false, true]) test(`an older image ${failure ? 'error' : 'result'} cannot replace the latest image`, async () => {
  const h = harness(); try {
    const old = h.image(); await flush(); await imageResult(h, 'LATEST');
    failure ? h.images[0].pending.reject(Error('old image failed')) : h.images[0].pending.resolve('OLD'); await old;
    assert.equal(h.state.result.value, 'LATEST'); assert.equal(h.state.error.value, ''); assert.deepEqual([...h.revoked].sort(), [...h.created].sort());
  } finally { h.dispose(); }
});
test('a late image cannot stop a newer camera scan', async () => {
  const h = harness(); try {
    const old = h.image(); await flush(); const camera = h.state.start(); await flush(); h.cameras[0].ready(); await camera;
    h.images[0].pending.resolve('OLD'); await old;
    assert.equal(h.state.result.value, ''); assert.equal(h.state.running.value, true); assert.equal(h.cameras[0].stream.live, true);
  } finally { h.dispose(); }
});
test('stop then restart discards late camera controls without clearing the newer video', async () => {
  const h = harness(); try {
    const first = h.state.start(); await flush(); h.state.stop(); const second = h.state.start(); await flush();
    h.cameras[1].ready(); await second; h.cameras[0].ready(); await first;
    assert.equal(h.cameras[0].stream.live, false); assert.equal(h.cameras[1].stream.live, true);
    assert.equal(h.state.video.value.srcObject, h.cameras[1].stream); assert.equal(h.state.running.value, true);
    h.dispose(); assert.equal(h.cameras[1].stream.live, false);
  } finally { h.dispose(); }
});
test('an old camera startup failure cannot stop the current camera or show an error', async () => {
  const h = harness(); try {
    const first = h.state.start(); await flush(); h.state.stop(); const second = h.state.start(); await flush();
    h.cameras[1].ready(); await second; h.cameras[0].pending.reject(Error('old permission failure')); await first;
    assert.equal(h.state.running.value, true); assert.equal(h.cameras[1].stream.live, true); assert.equal(h.state.error.value, '');
  } finally { h.dispose(); }
});
test('a callback from the stopped camera cannot stop the newer camera', async () => {
  const h = harness(); try {
    const first = h.state.start(); await flush(); h.cameras[0].ready(); await first; h.state.stop();
    const second = h.state.start(); await flush(); h.cameras[1].ready(); await second; h.cameras[0].found('OLD');
    assert.equal(h.state.result.value, ''); assert.equal(h.state.running.value, true); assert.equal(h.cameras[1].stream.live, true);
    assert.equal(h.state.video.value.srcObject, h.cameras[1].stream);
  } finally { h.dispose(); }
});
test('switching from the camera to an image ignores old camera callbacks', async () => {
  const h = harness(); try {
    const camera = h.state.start(); await flush(); h.cameras[0].ready(); await camera; await imageResult(h, 'IMAGE'); h.cameras[0].found('OLD-CAMERA');
    assert.equal(h.state.result.value, 'IMAGE'); assert.equal(h.cameras[0].stream.live, false);
  } finally { h.dispose(); }
});
test('a result before camera startup resolves stops its controls and keeps the result', async () => {
  const h = harness(); try {
    const task = h.state.start(); await flush(); h.cameras[0].found('CAMERA'); h.cameras[0].ready(); await task;
    assert.equal(h.state.result.value, 'CAMERA'); assert.equal(h.state.running.value, false); assert.equal(h.cameras[0].stream.live, false);
  } finally { h.dispose(); }
});
test('a current camera failure can be retried successfully', async () => {
  const h = harness(); try {
    const first = h.state.start(); await flush(); h.cameras[0].pending.reject(Error('permission denied')); await first;
    assert.equal(h.state.running.value, false); assert.match(h.state.error.value, /摄像头权限/);
    const second = h.state.start(); await flush(); h.cameras[1].ready(); await second; h.cameras[1].found('RETRY');
    assert.equal(h.state.result.value, 'RETRY'); assert.equal(h.state.error.value, ''); assert.equal(h.cameras[1].stream.live, false);
  } finally { h.dispose(); }
});
test('unmount stops an active camera and ignores queued callbacks', async () => {
  const h = harness(); const task = h.state.start(); await flush(); h.cameras[0].ready(); await task; h.dispose(); h.cameras[0].found('LATE');
  assert.equal(h.cameras[0].stream.live, false); assert.equal(h.state.result.value, '');
});
test('unmount before camera startup finishes stops the late stream', async () => {
  const h = harness(); const task = h.state.start(); await flush(); h.dispose(); h.cameras[0].ready(); await task; h.cameras[0].found('LATE');
  assert.equal(h.cameras[0].stream.live, false); assert.equal(h.state.result.value, ''); assert.equal(h.state.error.value, '');
});
for (const failure of [false, true]) test(`unmount releases a pending image URL and ignores its late ${failure ? 'error' : 'result'}`, async () => {
  const h = harness(); const task = h.image(); await flush(); h.dispose(); const releasedOnUnmount = [...h.revoked];
  failure ? h.images[0].pending.reject(Error('unmounted')) : h.images[0].pending.resolve('LATE'); await task;
  assert.deepEqual(releasedOnUnmount, h.created); assert.deepEqual(h.revoked, h.created); assert.equal(h.state.result.value, ''); assert.equal(h.state.error.value, '');
});
(async () => { let failed = 0; for (const { name, run } of tests) { try { await run(); console.log('PASS:', name); } catch (error) { failed++; console.error('FAIL:', name, error.message); } } console.log(`${tests.length - failed}/${tests.length} scanner lifecycle scenarios passed`); process.exitCode = failed ? 1 : 0; })();
