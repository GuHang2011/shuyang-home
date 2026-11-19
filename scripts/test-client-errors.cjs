const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../frontend'), ts = require(path.join(root, 'node_modules/typescript'));
const sourceText = file => process.argv.includes('--baseline') ? require('node:child_process').execFileSync('git', ['show', 'HEAD:frontend/' + file], { encoding: 'utf8' }) : fs.readFileSync(path.join(root, file), 'utf8');
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
function web(fetch = async () => new Response('{}')) {
  let token = 'member-a', next = 0;const timers = new Map(), uploads = [], events = [], exports = {};
  class Upload { constructor() { this.upload = {};uploads.push(this); } open() {}setRequestHeader() {}send() {} }
  vm.runInNewContext(compile(sourceText('src/api.ts')), {
    exports, JSON, fetch, AbortController, DOMException, TypeError, SyntaxError, Event, Error, FormData: class { append() {} }, XMLHttpRequest: Upload,
    sessionStorage: { getItem: () => token, setItem: (_key, value) => { token = value; }, removeItem: () => { token = ''; } },
    window: { dispatchEvent: event => events.push(event.type), setTimeout: callback => { timers.set(++next, callback);return next; } }, clearTimeout: key => timers.delete(key)
  });
  return { api: exports, uploads, events, timers, get token() { return token; } };
}
function mobile(target) {
  let token = 'member-a', include = true;const uploads = [], events = [], exports = {};
  const source = sourceText('mobile/src/platform.ts').split('\n').filter(line => {
    const start = line.match(/\/\/ #ifdef (\S+)/);if (start) { include = start[1] === target;return false; }if (line.includes('// #endif')) { include = true;return false; }return include;
  }).join('\n').replace(/import\.meta\.env/g, '{VITE_SHUYANG_API_URL:"https://service.test"}');
  vm.runInNewContext(compile(source), { exports, JSON, Error, SyntaxError, uni: { getStorageSync: () => token, setStorageSync: (_key, value) => { token = value; }, removeStorageSync: () => { token = ''; }, $emit: event => events.push(event), uploadFile: value => { uploads.push(value);return { onProgressUpdate() {} }; } } });
  return { api: exports, uploads, events, get token() { return token; } };
}
const tests = [], test = (name, run) => tests.push({ name, run });
for (const body of ['null', '[]', '"unavailable"', '<html>Bad Gateway</html>']) test(`Web API handles malformed response: ${body}`, async () => {
  const h = web(async () => new Response(body, { status: 200 }));await assert.rejects(h.api.api('/home'), /服务响应异常.*重试/);assert.equal(h.timers.size, 0);assert.equal(h.token, 'member-a');
});
test('Web API never renders an object as the error message', async () => {
  const h = web(async () => new Response(JSON.stringify({ message: { detail: 'proxy failed' } }), { status: 503 }));await assert.rejects(h.api.api('/home'), /请求未完成.*重试/);
});
test('Web API expires the current session as soon as 401 headers arrive', async () => {
  let resolveBody;const body = new Promise(resolve => { resolveBody = resolve; });const h = web(async () => ({ status: 401, ok: false, json: () => body }));
  const request = h.api.api('/auth/me');await Promise.resolve();await Promise.resolve();await Promise.resolve();
  const tokenBeforeBody = h.token, eventsBeforeBody = [...h.events];resolveBody(null);await assert.rejects(request);
  assert.equal(tokenBeforeBody, '');assert.deepEqual(eventsBeforeBody, ['session-expired']);assert.equal(h.timers.size, 0);
});
test('Web API body timeout remains a timeout instead of a JSON format error', async () => {
  const h = web(async (_url, options) => ({ status: 200, ok: true, json: () => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('body aborted', 'AbortError')))) }));
  const request = h.api.api('/home');for (let i = 0; i < 6; i++) await Promise.resolve();
  const result = assert.rejects(request, /连接超时.*重试/);[...h.timers.values()][0]();await result;assert.equal(h.timers.size, 0);
});
test('Web API stale 401 keeps the current account even with a null body', async () => {
  let resolve;const pending = new Promise(r => { resolve = r; }), h = web(() => pending), task = h.api.api('/auth/me');h.api.setToken('member-b');resolve(new Response('null', { status: 401 }));
  await assert.rejects(task, /服务响应异常/);assert.equal(h.token, 'member-b');assert.deepEqual(h.events, []);
});
for (const target of ['Web', 'H5', 'MP-WEIXIN']) {
  const harness = () => target === 'Web' ? web() : mobile(target);
  const respond = (h, data, status = 502) => target === 'Web' ? Object.assign(h.uploads[0], { status, responseText: data }).onload() : h.uploads[0].success({ statusCode: status, data });
  for (const body of ['null', '[]', '<html>Bad Gateway</html>']) test(`${target} upload gives a readable retry error for ${body}`, async () => {
    const h = harness(), task = h.api.uploadMedia('photo.png', 'forum');respond(h, body);await assert.rejects(task, /上传服务响应异常.*重试/);assert.equal(h.token, 'member-a');
  });
  test(`${target} upload preserves server validation messages`, async () => {
    const h = harness(), task = h.api.uploadMedia('photo.png', 'forum');respond(h, JSON.stringify({ code: 400, message: '图片不能超过8MB' }), 400);await assert.rejects(task, /图片不能超过8MB/);
  });
  test(`${target} upload never renders an object message`, async () => {
    const h = harness(), task = h.api.uploadMedia('photo.png', 'forum');respond(h, JSON.stringify({ message: { detail: 'proxy failed' } }));await assert.rejects(task, /上传失败.*重试/);
  });
  test(`${target} malformed upload 401 clears only the original current session`, async () => {
    const h = harness(), task = h.api.uploadMedia('photo.png', 'forum');respond(h, 'null', 401);await assert.rejects(task, /上传服务响应异常/);assert.equal(h.token, '');assert.deepEqual(h.events, ['session-expired']);
    const fresh = harness(), old = fresh.api.uploadMedia('photo.png', 'forum');fresh.api.setToken('member-b');respond(fresh, '<html>Unauthorized</html>', 401);await assert.rejects(old);assert.equal(fresh.token, 'member-b');assert.deepEqual(fresh.events, []);
  });
  test(`${target} upload can succeed on explicit retry after a gateway failure`, async () => {
    const h = harness(), failed = h.api.uploadMedia('photo.png', 'forum');respond(h, '<html>Bad Gateway</html>');await assert.rejects(failed);h.uploads.shift();
    const retry = h.api.uploadMedia('photo.png', 'forum');respond(h, JSON.stringify({ code: 0, data: { id: 'uploaded' } }), 200);assert.equal((await retry).id, 'uploaded');
  });
}
(async () => { let failed = 0;for (const { name, run } of tests) { try { await run();console.log('PASS:', name); } catch (error) { failed++;console.error('FAIL:', name, error.message); } }console.log(`${tests.length - failed}/${tests.length} client error scenarios passed`);process.exitCode = failed ? 1 : 0; })();
