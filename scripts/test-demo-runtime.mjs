import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoState, demoRequest } from '../frontend/demo/demo-runtime.mjs';
const call = (state, path, method = 'GET', body, actor = 'demo-member') => demoRequest(state, new Request('https://demo.invalid/api' + path, { method, headers: { Authorization: 'Bearer ' + actor, ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body) }));
test('browser demo states are independent', async () => {
  const a = createDemoState(), b = createDemoState();await call(a, '/events/demo-event/signup', 'POST');
  assert.equal(a.signups.length, 1);assert.equal(b.signups.length, 0);
});
test('guest and member cannot perform admin actions', async () => {
  const state = createDemoState();await assert.rejects(call(state, '/admin/members', 'GET', undefined, 'guest'));
  await assert.rejects(call(state, '/admin/members/demo-pending/review', 'POST', { status: 'approved' }));assert.equal(state.users[2].status, 'pending');
});
test('signup is idempotent and can be cancelled', async () => {
  const state = createDemoState();await call(state, '/events/demo-event/signup', 'POST');await call(state, '/events/demo-event/signup', 'POST');
  assert.equal(state.signups.length, 1);assert.equal((await call(state, '/events'))[0].registered, 1);
  await call(state, '/events/demo-event/cancel-signup', 'POST');assert.equal((await call(state, '/events'))[0].registered, 0);
});
test('photo post stays pending until demo administrator reviews it', async () => {
  const state = createDemoState(), row = await call(state, '/forum/topics', 'POST', { title: '演示主题', category: '乡情闲聊', content: '这是一条演示主题内容。', photoIds: [] });
  assert.equal(row.status, 'pending');assert.ok(!(await call(state, '/forum/topics')).some(t => t.id === row.id));
  await call(state, '/forum/topics/' + row.id + '/review', 'POST', { status: 'approved' }, 'demo-admin');assert.ok((await call(state, '/forum/topics')).some(t => t.id === row.id));
});
test('order reserves stock once; repeated cancel cannot inflate inventory', async () => {
  const state = createDemoState(), body = { productId: 'demo-product', quantity: 2, requestId: 'once', delivery: 'pickup' };
  const row = await call(state, '/orders', 'POST', body);await call(state, '/orders', 'POST', body);assert.equal(state.products[0].stock, 18);
  await call(state, '/orders/' + row.id + '/action', 'POST', { action: 'cancel' });await assert.rejects(call(state, '/orders/' + row.id + '/action', 'POST', { action: 'cancel' }));assert.equal(state.products[0].stock, 20);
});
test('media is retained as a local Blob without outbound requests', async () => {
  const state = createDemoState(), data = new FormData();data.set('scope', 'forum');data.set('file', new Blob(['synthetic'], { type: 'image/jpeg' }), 'demo.jpg');
  const media = await call(state, '/media/upload', 'POST', data);const blob = await call(state, '/media/' + media.id);assert.equal(await blob.text(), 'synthetic');
  const copy = structuredClone(state);assert.equal(await copy.media[media.id].blob.text(), 'synthetic');
});
test('active uploads such as HTML are rejected', async () => {
  const data = new FormData();data.set('file', new Blob(['<script>'], { type: 'text/html' }), 'page.html');await assert.rejects(call(createDemoState(), '/media/upload', 'POST', data));
});
test('chat sends only on explicit message API and deduplicates retries', async () => {
  const state = createDemoState(), body = { content: '演示问候', requestId: 'send-once' };assert.equal(state.messages.length, 1);
  await call(state, '/chat/conversations/demo-room/messages', 'POST', body);await call(state, '/chat/conversations/demo-room/messages', 'POST', body);assert.equal(state.messages.length, 2);
});
test('withdrawn broadcasts disappear from public view', async () => {
  const state = createDemoState();await call(state, '/admin/broadcasts/demo-broadcast/withdraw', 'POST', {}, 'demo-admin');assert.equal((await call(state, '/broadcasts')).items.length, 0);
});
test('unsupported operations fail explicitly without pretending success', async () => {
  await assert.rejects(call(createDemoState(), '/unknown-action', 'POST'), /未纳入在线体验范围/);
});
test('work summary matches the local pending list and allows review', async () => {
  const state = createDemoState(), summary = await call(state, '/work/summary', 'GET', undefined, 'demo-admin');
  const list = await call(state, '/work/items?manage=true', 'GET', undefined, 'demo-admin');assert.equal(list.total, summary.pending);
  const detail = await call(state, '/work/target?manage=true&kind=user&id=demo-pending', 'GET', undefined, 'demo-admin');
  await call(state, detail.actions[0].url, 'POST', detail.actions[0].body, 'demo-admin');assert.equal((await call(state, '/work/summary', 'GET', undefined, 'demo-admin')).pending, 0);
});
