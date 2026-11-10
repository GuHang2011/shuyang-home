const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../frontend'), vue = require(path.join(root, 'node_modules/vue')), ts = require(path.join(root, 'node_modules/typescript'));
const tests = [], test = (name, run) => tests.push({ name, run });
const RAILWAY = '淮新高铁', OTHER = '苏州生活';
const deferred = () => { let resolve, reject;const promise = new Promise((a, b) => { resolve = a;reject = b; });return { promise, resolve, reject }; };
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve();await vue.nextTick(); };
const topic = (id, category = RAILWAY, extra = {}) => ({ id, category, title: id, content: '高铁讨论内容', authorId: 'author', status: 'approved', replyCount: 0, createdAt: '2026-11-10T00:00:00Z', ...extra });
const ids = rows => Array.from(rows, r => r.id);
function harness(custom = () => undefined, initialBoard = RAILWAY) {
  const cache = new Map(), unmounts = [], calls = [], board = vue.ref(initialBoard), user = vue.ref({ id: 'a', role: 'admin', status: 'approved' });
  function load(file) {
    file = path.resolve(root, file);if (cache.has(file)) return cache.get(file);
    const exports = {};cache.set(file, exports);
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    vm.runInNewContext(source, { exports, console, Date, Math, JSON, Set, Map, require: name => name === 'vue' ? { ...vue, onMounted() {}, onUnmounted: fn => unmounts.push(fn) } : load(path.resolve(path.dirname(file), name + '.ts')) });
    return exports;
  }
  const api = async (p, m, b) => { calls.push({ p, m, b });const response = custom(p, m, b);if (response !== undefined) return response;return p === '/admin/forum' ? { topics: [], replies: [] } : []; };
  const effect = vue.effectScope();let forum;
  effect.run(() => { forum = load('shared/useForum.ts').useForum(() => user.value, api, () => board.value); });
  return { forum, calls, board, user, material: load('shared/railwayForum.ts'), dispose() { unmounts.forEach(fn => fn());effect.stop(); } };
}

test('fixed board filters public, own, moderator topics, joined replies and restrictions', async () => {
  const topics = [topic('rail'), topic('other', OTHER)], h = harness(p => p === '/forum/topics' || p === '/my/forum' ? topics : p === '/admin/forum' ? { topics, replies: [{ id: 'r', topicId: 'rail' }, { id: 'o', topicId: 'other', category: RAILWAY }, { id: 'orphan', topicId: 'missing', category: RAILWAY }] } : p === '/forum/restrictions' ? [{ id: 'rail-ban', board: RAILWAY }, { id: 'other-ban', board: OTHER }] : undefined);
  try { await h.forum.load();for (const key of ['topics', 'mine', 'managed']) assert.deepEqual(ids(h.forum[key].value), ['rail']);assert.deepEqual(ids(h.forum.managedReplies.value), ['r']);assert.deepEqual(ids(h.forum.restrictions.value), ['rail-ban']);h.forum.category.value = OTHER;assert.deepEqual(ids(h.forum.visible.value), ['rail']); } finally { h.dispose(); }
});
test('default forum remains unscoped and category filtering still works', async () => {
  const h = harness(p => p === '/forum/topics' ? [topic('rail'), topic('other', OTHER)] : undefined, '');
  try { await h.forum.load();assert.equal(h.forum.topics.value.length, 2);h.forum.category.value = OTHER;assert.deepEqual(ids(h.forum.visible.value), ['other']); } finally { h.dispose(); }
});
test('board switch drops delayed list and clears drafts, filters and confirmation', async () => {
  const pending = deferred();let first = true;
  const h = harness(p => p === '/forum/topics' ? first ? (first = false, pending.promise) : [topic('new', OTHER)] : undefined);
  try { h.forum.create();h.forum.query.value = 'old';h.forum.reply.value = 'old';h.forum.ask(topic('rail'), 'delete');const task = h.forum.load();h.board.value = OTHER;assert.equal(h.forum.creating.value, false);assert.equal(h.forum.operation.value, null);assert.equal(h.forum.query.value, '');assert.equal(h.forum.reply.value, '');await flush();pending.resolve([topic('old')]);await task;assert.deepEqual(ids(h.forum.topics.value), ['new']); } finally { h.dispose(); }
});
test('board switch cannot restore a delayed detail or its media', async () => {
  const pending = deferred(), h = harness(p => p === '/forum/topics/rail' ? pending.promise : undefined);
  try { const task = h.forum.detail(topic('rail'));h.board.value = OTHER;pending.resolve({ topic: topic('rail', RAILWAY, { photos: [{ id: 'private' }] }), replies: [{ id: 'r', topicId: 'rail' }] });await task;assert.equal(h.forum.selected.value, null);assert.equal(h.forum.replies.value.length, 0); } finally { h.dispose(); }
});
test('identity change cannot restore another account detail, draft or operation', async () => {
  const pending = deferred(), h = harness(p => p === '/forum/topics/rail' ? pending.promise : undefined);
  try { const task = h.forum.detail(topic('rail'));h.forum.ask(topic('rail'), 'delete');h.user.value = { id: 'b', role: 'member', status: 'approved' };pending.resolve({ topic: topic('rail'), replies: [] });await task;assert.equal(h.forum.selected.value, null);assert.equal(h.forum.operation.value, null);assert.equal(h.forum.tab.value, 'public'); } finally { h.dispose(); }
});
test('same moderator losing the board clears management and rejects stale queue', async () => {
  const pending = deferred(), h = harness(p => p === '/admin/forum' ? pending.promise : undefined);
  try { h.user.value = { id: 'a', role: 'moderator', status: 'approved', forumBoards: [RAILWAY] };await flush();assert.equal(h.forum.moderator.value, true);h.forum.managed.value = [topic('old')];h.forum.tab.value = 'manage';h.user.value.forumBoards = [OTHER];assert.equal(h.forum.moderator.value, false);assert.equal(h.forum.managed.value.length, 0);assert.equal(h.forum.tab.value, 'public');pending.resolve({ topics: [topic('stale')], replies: [] });await flush();assert.equal(h.forum.managed.value.length, 0); } finally { h.dispose(); }
});
test('moderator without railway assignment never requests railway management', async () => {
  const h = harness();try { h.user.value = { id: 'm', role: 'moderator', status: 'approved', forumBoards: [OTHER] };await flush();assert.equal(h.forum.moderator.value, false);assert.ok(!h.calls.some(c => c.p === '/admin/forum')); } finally { h.dispose(); }
});
test('foreign detail is never rendered while loading, after success or after rejection', async () => {
  let reject = false;const pending = deferred(), h = harness(p => p === '/forum/topics/foreign' ? reject ? Promise.reject(Error('not visible')) : pending.promise : undefined);
  try { h.forum.selected.value = topic('previous');const task = h.forum.detail({ id: 'foreign' });assert.equal(h.forum.selected.value, null);pending.resolve({ topic: topic('foreign', OTHER), replies: [] });await task;assert.equal(h.forum.selected.value, null);assert.match(h.forum.error.value, /当前板块/);reject = true;await h.forum.detail({ id: 'foreign' });assert.equal(h.forum.selected.value, null);assert.match(h.forum.error.value, /not visible/); } finally { h.dispose(); }
});
test('only replies belonging to the selected topic render and media remain intact', async () => {
  const h = harness(p => p === '/forum/topics/rail' ? { topic: topic('rail', RAILWAY, { photos: [{ id: 'photo' }], audio: { id: 'voice' }, forwarded: topic('other', OTHER) }), replies: [{ id: 'r', topicId: 'rail', audio: { id: 'reply-voice' } }, { id: 'bad', topicId: 'other' }] } : undefined);
  try { await h.forum.detail({ id: 'rail' });assert.deepEqual(ids(h.forum.replies.value), ['r']);assert.equal(h.forum.replies.value[0].category, RAILWAY);assert.equal(h.forum.replies.value[0].audio.id, 'reply-voice');assert.equal(h.forum.selected.value.photos[0].id, 'photo');assert.equal(h.forum.selected.value.audio.id, 'voice');assert.equal(h.forum.selected.value.forwarded.unavailable, true); } finally { h.dispose(); }
});
test('new draft defeats an older detail response', async () => {
  const pending = deferred(), h = harness(p => p === '/forum/topics/rail' ? pending.promise : undefined);
  try { const task = h.forum.detail({ id: 'rail' });h.forum.create();h.forum.form.value.title = '新草稿';pending.resolve({ topic: topic('rail'), replies: [] });await task;assert.equal(h.forum.selected.value, null);assert.equal(h.forum.creating.value, true);assert.equal(h.forum.form.value.title, '新草稿'); } finally { h.dispose(); }
});
test('fixed category and railway metadata survive submit without losing media or forwarding', async () => {
  const h = harness();try { h.forum.create(topic('original', RAILWAY, { discussionType: '资料分享', sourceName: '发布单位', sourceUrl: 'https://example.org/report' }));assert.equal(h.forum.form.value.category, RAILWAY);Object.assign(h.forum.form.value, { category: OTHER, photos: [{ id: 'photo' }], audio: { id: 'voice' } });await h.forum.post();const body = h.calls.find(c => c.m === 'POST').b;assert.equal(body.category, RAILWAY);assert.equal(body.discussionType, '资料分享');assert.equal(body.sourceName, '发布单位');assert.equal(body.sourceUrl, 'https://example.org/report');assert.equal(body.forwardedTopicId, 'original');assert.equal(body.photoIds[0], 'photo');assert.equal(body.audioId, 'voice'); } finally { h.dispose(); }
});
test('railway creation defaults discussion type and accepts no source', async () => {
  const h = harness();try { h.forum.create();await h.forum.post();const body = h.calls.find(c => c.m === 'POST').b;assert.equal(body.discussionType, '进展讨论');assert.equal(body.sourceName, '');assert.equal(body.sourceUrl, ''); } finally { h.dispose(); }
});
test('invalid types, unpaired sources, unsafe URLs and length overflow send no posts', async () => {
  const h = harness();try { for (const fields of [{ discussionType: '其他' }, { sourceName: '单位' }, { sourceUrl: 'https://example.org' }, { sourceName: '单位', sourceUrl: 'javascript:alert(1)' }, { sourceName: '名'.repeat(101), sourceUrl: 'https://example.org' }, { sourceName: '单位', sourceUrl: 'https://example.org/' + 'a'.repeat(1000) }]) { h.forum.create();Object.assign(h.forum.form.value, fields);await h.forum.post();assert.ok(h.forum.error.value);assert.equal(h.forum.creating.value, true); }assert.equal(h.calls.filter(c => c.m === 'POST').length, 0); } finally { h.dispose(); }
});
test('nonrailway post does not carry stale railway source metadata', async () => {
  const h = harness(undefined, '');try { h.forum.create();Object.assign(h.forum.form.value, { category: OTHER, sourceName: '旧来源', sourceUrl: 'https://example.org' });await h.forum.post();const body = h.calls.find(c => c.m === 'POST').b;assert.equal(body.category, OTHER);assert.equal(body.discussionType, undefined);assert.equal(body.sourceUrl, undefined); } finally { h.dispose(); }
});
test('late post cannot close another board draft or change its tab', async () => {
  const pending = deferred(), h = harness((p, m) => m === 'POST' ? pending.promise : undefined);
  try { h.forum.create();const task = h.forum.post();h.board.value = OTHER;h.forum.create();h.forum.form.value.title = '新板块草稿';pending.resolve({});await task;assert.equal(h.forum.creating.value, true);assert.equal(h.forum.form.value.title, '新板块草稿');assert.equal(h.forum.message.value, '');assert.equal(h.forum.busy.value, false); } finally { h.dispose(); }
});
test('latest, most replies, unanswered and type filter keep eligible pinned topics first', () => {
  const h = harness();try { h.forum.topics.value = [topic('older', RAILWAY, { createdAt: '2026-11-01', replyCount: 20, discussionType: '资料分享' }), topic('new', RAILWAY, { createdAt: '2026-11-09', discussionType: '提问求证' }), topic('pin', RAILWAY, { createdAt: '2026-10-01', pinned: true })];assert.deepEqual(ids(h.forum.visible.value), ['pin', 'new', 'older']);h.forum.sort.value = 'replies';assert.deepEqual(ids(h.forum.visible.value), ['pin', 'older', 'new']);h.forum.sort.value = 'unanswered';assert.deepEqual(ids(h.forum.visible.value), ['pin', 'new']);h.forum.discussionType.value = '提问求证';assert.deepEqual(ids(h.forum.visible.value), ['new']);h.forum.query.value = 'none';assert.deepEqual(ids(h.forum.visible.value), []);assert.equal(h.forum.topics.value[0].id, 'older'); } finally { h.dispose(); }
});
test('crossboard reply and moderation targets never send writes', async () => {
  const h = harness();try { h.forum.selected.value = topic('other', OTHER);await h.forum.respond();h.forum.ask(topic('other', OTHER), 'delete');await h.forum.perform();h.forum.operation.value = { row: topic('other', OTHER), action: 'mute' };await h.forum.perform();assert.equal(h.calls.filter(c => c.m).length, 0); } finally { h.dispose(); }
});
test('board restrictions use fixed scope and global personal unblock remains available', async () => {
  const h = harness();try { h.forum.ask(topic('rail'), 'mute');h.forum.note.value = '违规说明';await h.forum.perform();assert.equal(h.calls.find(c => c.p === '/forum/restrictions' && c.m === 'POST').b.board, RAILWAY);h.forum.ask({ id: 'blocked-person' }, 'unblock');await h.forum.perform();assert.equal(h.calls.find(c => c.p === '/members/blocked-person/block').b.active, false); } finally { h.dispose(); }
});
test('source URLs reject executable schemes, credentials and control characters', () => {
  const h = harness();try { const safe = h.material.safeForumSourceUrl;for (const value of ['javascript:alert(1)', '//example.org', 'data:text/html,test', 'https://user:password@example.org', 'https://example.org\\evil', 'https://example.org/\nfoo', 'https://example.org:99999', 'https://', 'https://example.org/<script>', null]) assert.equal(safe(value), '');for (const value of ['https://example.org/news?q=高铁#part', 'http://example.org:8080/a', 'https://[::1]/path']) assert.equal(safe(value), value); } finally { h.dispose(); }
});
test('unmount discards an in-flight detail', async () => {
  const pending = deferred(), h = harness(p => p === '/forum/topics/rail' ? pending.promise : undefined);const task = h.forum.detail({ id: 'rail' });h.dispose();pending.resolve({ topic: topic('rail'), replies: [] });await task;assert.equal(h.forum.selected.value, null);
});

function audioHarness(platform, download = async () => platform === 'web' ? {} : 'blob:voice') {
  const compiler = require(path.join(root, 'node_modules/@vue/compiler-sfc'));
  const unmounts = [], hidden = [], events = {}, revoked = [], props = vue.reactive({ attachment: { id: 'voice' }, active: true });
  let plays = 0, pauses = 0, downloads = 0, created = 0;
  class AudioMock {
    constructor() { this.currentTime = 7;this.duration = 30; }
    addEventListener(name, fn) { events[name] = fn; }
    play() { plays++;events.play?.();return Promise.resolve(); }
    pause() { pauses++;events.pause?.(); }
    removeAttribute() {} load() {}
  }
  const native = { currentTime: 7, duration: 30, onPlay: f => events.play = f, onPause: f => events.pause = f, onEnded: f => events.ended = f, onError: f => events.error = f, onTimeUpdate: f => events.timeupdate = f, play() { plays++;events.play?.(); }, pause() { pauses++;events.pause?.(); }, stop() {}, destroy() {} };
  const file = platform === 'web' ? 'src/components/ForumAudio.vue' : 'mobile/src/components/ForumAudioMobile.vue';
  let source = fs.readFileSync(path.join(root, file), 'utf8').replace(/\/\/ #ifdef (H5|MP-WEIXIN)\r?\n([\s\S]*?)\/\/ #endif/g, (_, target, body) => target === platform ? body : '');
  source = compiler.compileScript(compiler.parse(source).descriptor, { id: 'railway-audio-active' }).content;
  const exports = {}, effect = vue.effectScope(), request = () => { downloads++;return download(); };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports, Audio: AudioMock, URL: { createObjectURL() { created++;return 'blob:voice'; }, revokeObjectURL: value => revoked.push(value) }, uni: { createInnerAudioContext: () => native }, require: name => name === 'vue' ? { ...vue, onUnmounted: f => unmounts.push(f) } : name === '@dcloudio/uni-app' ? { onHide: f => hidden.push(f) } : { mediaBlob: request, downloadMedia: request } });
  let state;effect.run(() => { state = exports.default.setup(props, { expose() {} }); });
  if (platform === 'web') state.player.value = new AudioMock();
  return { props, state, revoked, downloads: () => downloads, created: () => created, plays: () => plays, pauses: () => pauses, hide: () => hidden.forEach(f => f()), dispose() { unmounts.forEach(f => f());effect.stop(); } };
}
for (const platform of ['web', 'H5', 'MP-WEIXIN']) {
  test(`${platform}: hiding a retained discussion pauses audio and showing it does not autoplay`, async () => {
    const h = audioHarness(platform);
    try {
      if (platform === 'web') { await h.state.load();await h.state.player.value.play(); } else await h.state.toggle();
      assert.equal(h.plays(), 1);const before = h.pauses();h.props.active = false;assert.ok(h.pauses() > before);
      if (platform !== 'web') { assert.equal(h.state.playing.value, false);await h.state.toggle(); }
      else await h.state.load();
      assert.equal(h.plays(), 1);h.props.active = true;await flush();assert.equal(h.plays(), 1);assert.equal(h.downloads(), 1);
      if (platform === 'web') { assert.equal(h.state.url.value, 'blob:voice');assert.equal(h.state.player.value.currentTime, 7); }
      else { await h.state.toggle();assert.equal(h.plays(), 2);assert.equal(h.downloads(), 1); }
    } finally { h.dispose(); }
  });
  test(`${platform}: hiding while audio loads discards completion even after the tab is shown`, async () => {
    const pending = deferred(), h = audioHarness(platform, () => pending.promise);
    try {
      const task = platform === 'web' ? h.state.load() : h.state.toggle();h.props.active = false;h.props.active = true;
      pending.resolve(platform === 'web' ? {} : 'blob:late');await task;
      assert.equal(h.plays(), 0);assert.equal(h.state.busy.value, false);
      if (platform === 'web') { assert.equal(h.state.url.value, '');assert.equal(h.created(), 0); }
      if (platform === 'H5') assert.deepEqual(h.revoked, ['blob:late']);
    } finally { h.dispose(); }
  });
}

(async () => { let failures = 0;for (const { name, run } of tests) { try { await run();console.log('PASS: ' + name); } catch (e) { failures++;console.error('FAIL: ' + name + '\n' + e.stack); } }console.log(`${tests.length - failures}/${tests.length} railway forum scenarios passed`);process.exitCode = failures ? 1 : 0; })();
