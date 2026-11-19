// The platform image preview outlives its Vue component unless explicitly closed.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../frontend');
const vue = require(path.join(root, 'node_modules/vue')), ts = require(path.join(root, 'node_modules/typescript')), sfc = require(path.join(root, 'node_modules/@vue/compiler-sfc'));
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
async function flush() { for (let i = 0; i < 8; i++) await Promise.resolve(); await vue.nextTick(); }
function harness(target, initialType = 'image') {
  const pending = deferred(), events = [], revoked = [], unmount = [], props = vue.reactive({ attachment: { id: 'private-image', name: 'private.jpg', type: initialType } });
  let enabled = true;
  const original = process.argv.includes('--baseline') ? require('node:child_process').execFileSync('git', ['show', 'HEAD:frontend/mobile/src/components/MobileAttachment.vue'], { encoding: 'utf8' }) : fs.readFileSync(path.join(root, 'mobile/src/components/MobileAttachment.vue'), 'utf8');
  const source = original.split('\n').filter(line => {
    const match = line.match(/\/\/ #ifdef (\S+)/); if (match) { enabled = match[1] === target; return false; }if (line.includes('// #endif')) { enabled = true; return false; }return enabled;
  }).join('\n');
  const script = sfc.compileScript(sfc.parse(source).descriptor, { id: 'chat-preview' }).content, exports = {};
  vm.runInNewContext(ts.transpileModule(script, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
    exports, Error, URL: { revokeObjectURL: url => revoked.push(url) },
    uni: { previewImage: value => events.push({ preview: value }), closePreviewImage: () => events.push({ closed: true }), openDocument() {} },
    document: { createElement: () => ({ click() {} }) },
    require: name => name === 'vue' ? { ...vue, onUnmounted: fn => unmount.push(fn) } : { downloadMedia: () => pending.promise }
  });
  const scope = vue.effectScope();let state;scope.run(() => { state = exports.default.setup(props, { expose() {}, emit() {} }); });
  const dispose = () => { unmount.splice(0).forEach(fn => fn());scope.stop(); };
  return { state, props, pending, events, revoked, dispose, another: () => {
    const mark = unmount.length, nextScope = vue.effectScope();let nextState;
    nextScope.run(() => { nextState = exports.default.setup(vue.reactive({ attachment: { id: 'another', type: 'image', name: 'another.jpg' } }), { expose() {}, emit() {} }); });
    const hooks = unmount.splice(mark);return { state: nextState, dispose: () => { hooks.forEach(fn => fn());nextScope.stop(); } };
  } };
}
const tests = [], test = (name, run) => tests.push({ name, run });
for (const target of ['H5', 'MP-WEIXIN']) {
  test(`${target}: removing a recalled message closes its open private image preview`, async () => {
    const h = harness(target);h.pending.resolve('blob:private-image');await flush();h.state.preview();assert.equal(h.events.filter(e => e.preview).length, 1);
    h.dispose();assert.equal(h.events.filter(e => e.closed).length, 1);assert.equal(h.revoked.length, target === 'H5' ? 1 : 0);
  });
  test(`${target}: removing another attachment does not close the current preview`, async () => {
    const h = harness(target);h.pending.resolve('blob:other-image');await flush();h.dispose();assert.equal(h.events.filter(e => e.closed).length, 0);
  });
  test(`${target}: removing a previously previewed image does not close the newer preview`, async () => {
    const h = harness(target);h.pending.resolve('blob:private-image');await flush();h.state.preview();
    const next = h.another();await flush();next.state.preview();h.dispose();assert.equal(h.events.filter(e => e.closed).length, 0);
    next.dispose();assert.equal(h.events.filter(e => e.closed).length, 1);
  });
  test(`${target}: a late download after message removal cannot open a preview`, async () => {
    const h = harness(target);h.dispose();h.pending.resolve('blob:late');await flush();assert.equal(h.events.length, 0);assert.equal(h.revoked.length, target === 'H5' ? 1 : 0);
  });
}
(async () => { let failed = 0;for (const { name, run } of tests) { try { await run();console.log('PASS:', name); } catch (error) { failed++;console.error('FAIL:', name, error.message); } }console.log(`${tests.length - failed}/${tests.length} chat preview scenarios passed`);process.exitCode = failed ? 1 : 0; })();
