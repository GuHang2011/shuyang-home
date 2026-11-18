// Execute the real Web attachment client with controlled HTTP failures and timers.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const ts = require('../frontend/node_modules/typescript');
const source = fs.readFileSync(path.resolve(__dirname, '../frontend/src/api.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
function harness(fetch) {
  const storage = new Map(), events = [], timers = new Map(); let nextTimer = 0;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, fetch, AbortController, DOMException, TypeError, Error, Event, Blob,
    sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    window: { dispatchEvent: event => events.push(event.type), setTimeout: callback => { const id = ++nextTimer; timers.set(id, callback); return id; } },
    clearTimeout: id => timers.delete(id)
  });
  return { ...exports, events, timers };
}
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const json = (status, value) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const tests = [];
const test = (name, run) => tests.push({ name, run });
test('authenticated attachment returns bytes and releases its timeout', async () => {
  let sent;
  const h = harness(async (url, init) => { sent = { url, init }; return new Response('photo', { headers: { 'Content-Type': 'image/png' } }); });
  h.setToken('member-a');
  const blob = await h.mediaBlob('image/1');
  assert.equal(await blob.text(), 'photo'); assert.equal(blob.type, 'image/png');
  assert.equal(sent.url, '/api/media/image%2F1'); assert.equal(sent.init.headers.Authorization, 'Bearer member-a');
  assert.equal(h.timers.size, 0);
});
test('public attachment never sends an empty bearer token', async () => {
  const h = harness(async (url, init) => { assert.equal(init.headers.Authorization, undefined); return new Response('public'); });
  await h.mediaBlob('public'); assert.deepEqual(h.events, []);
});
test('current expired session is cleared on attachment 401', async () => {
  const h = harness(async () => json(401, { message: '登录已过期，请重新登录' })); h.setToken('expired');
  await assert.rejects(h.mediaBlob('private'), /登录已过期/);
  assert.equal(h.getToken(), ''); assert.deepEqual(h.events, ['session-expired']); assert.equal(h.timers.size, 0);
});
test('late 401 from previous account preserves the newly logged-in session', async () => {
  const pending = deferred(), h = harness(() => pending.promise); h.setToken('old');
  const request = h.mediaBlob('private'); h.setToken('new'); pending.resolve(json(401, { message: '登录已过期' }));
  await assert.rejects(request, /登录已过期/); assert.equal(h.getToken(), 'new'); assert.deepEqual(h.events, []);
});
test('HTML 401 still expires the current session with a readable message', async () => {
  const h = harness(async () => new Response('<html>Unauthorized</html>', { status: 401 })); h.setToken('expired');
  await assert.rejects(h.mediaBlob('private'), /登录已过期/); assert.equal(h.getToken(), ''); assert.deepEqual(h.events, ['session-expired']);
});
test('HTML gateway failure gives a retry message instead of JSON parser output', async () => {
  const h = harness(async () => new Response('<html>Bad Gateway</html>', { status: 502 }));
  await assert.rejects(h.mediaBlob('image'), /附件暂不可用.*重试/); assert.equal(h.timers.size, 0);
});
test('null error body gives a readable attachment error', async () => {
  const h = harness(async () => json(503, null));
  await assert.rejects(h.mediaBlob('image'), /附件暂不可用/);
});
test('permission denial preserves a valid session and server explanation', async () => {
  const h = harness(async () => json(403, { message: '你已不在此会话中' })); h.setToken('valid');
  await assert.rejects(h.mediaBlob('private'), /你已不在此会话中/); assert.equal(h.getToken(), 'valid'); assert.deepEqual(h.events, []);
});
test('offline attachment request reports a network retry action', async () => {
  const h = harness(async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(h.mediaBlob('image'), /检查网络.*重试/); assert.equal(h.timers.size, 0);
});
test('stalled attachment aborts and releases its timeout', async () => {
  const h = harness((url, init) => new Promise((resolve, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))));
  const request = h.mediaBlob('stalled'); const result = assert.rejects(request, /附件读取超时.*重试/);
  assert.equal(h.timers.size, 1, 'attachment must have a bounded request');
  [...h.timers.values()][0](); await result; assert.equal(h.timers.size, 0);
});
(async () => {
  let failed = 0;
  for (const { name, run } of tests) { try { await run(); console.log('PASS: ' + name); } catch (error) { failed++; console.error('FAIL: ' + name + ': ' + error.message); } }
  console.log(`${tests.length - failed}/${tests.length} media API regression scenarios passed`); process.exitCode = failed ? 1 : 0;
})();
