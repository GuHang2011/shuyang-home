import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoState, upgradeDemoState, demoRequest } from '../frontend/demo/demo-runtime.mjs';
import { demoBlobResponse } from '../frontend/demo/demo-extensions.mjs';
const call = (state, path, method = 'GET', body, actor = 'demo-member') => demoRequest(state, new Request('https://demo.invalid/api' + path, { method, headers: { Authorization: 'Bearer ' + actor, ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body) }));

const railDraft = () => ({title:'淮新高铁资料核对',content:'这是用于验证高铁论坛的演示内容，不是实际项目进展。',category:'淮新高铁',discussionType:'资料分享',sourceName:'江苏省交通运输厅',sourceUrl:'https://jtyst.jiangsu.gov.cn/'});
test('railway upgrade preserves old records and never revives removed samples', () => {
  const state=createDemoState();delete state.railwayForumVersion;state.topics=state.topics.filter(t=>t.category!=='淮新高铁');state.topics[0].content='原有编辑保留';state.media.custom={blob:new Blob(['photo'])};
  upgradeDemoState(state);assert.equal(state.topics.filter(t=>t.category==='淮新高铁').length,3);assert.equal(state.topics[0].content,'原有编辑保留');assert.ok(state.media.custom.blob instanceof Blob);
  state.topics.find(t=>t.id==='demo-rail-rules').status='hidden';state.topics=state.topics.filter(t=>t.id!=='demo-rail-travel');upgradeDemoState(state);
  assert.equal(state.topics.find(t=>t.id==='demo-rail-rules').status,'hidden');assert.equal(state.topics.some(t=>t.id==='demo-rail-travel'),false);
});
test('demo upgrade restores missing reply floors per topic and preserves existing numbers', () => {
  const state=createDemoState();state.replies=[{id:'a1',topicId:'a'},{id:'b1',topicId:'b'},{id:'a2',topicId:'a',floor:2,status:'hidden'},{id:'a3',topicId:'a'},{id:'b2',topicId:'b',floor:8}];
  upgradeDemoState(state);assert.deepEqual(state.replies.map(r=>r.floor),[1,1,2,3,8]);
  upgradeDemoState(state);assert.deepEqual(state.replies.map(r=>r.floor),[1,1,2,3,8]);
});
test('railway topics validate type and paired safe source metadata before saving', async () => {
  const state=createDemoState(),n=state.topics.length;
  for(const change of [{discussionType:'通车确认'},{discussionType:true},{sourceName:''},{sourceUrl:''},{sourceUrl:'javascript:alert(1)'},{sourceUrl:'//example.org'},{sourceUrl:'https://user:secret@example.org'},{sourceUrl:'https://example.org:99999'},{sourceUrl:'https://example.org/\npath'},{sourceUrl:'https://example.org/<script>'},{sourceName:'x'.repeat(101)},{sourceUrl:'x'.repeat(1001)}]) await assert.rejects(call(state,'/forum/topics','POST',{...railDraft(),...change}));
  assert.equal(state.topics.length,n);
  const draft=railDraft();delete draft.discussionType;delete draft.sourceName;delete draft.sourceUrl;const row=await call(state,'/forum/topics','POST',draft);assert.equal(row.discussionType,'进展讨论');assert.equal(row.status,'pending');
  const normal=await call(state,'/forum/topics','POST',{...railDraft(),category:'乡情闲聊'});assert.equal(normal.sourceUrl,undefined);
});
test('railway moderators only review assigned boards and pending posts are private', async () => {
  const state=createDemoState();state.users.push({...state.users[0],id:'rail-mod',role:'moderator',forumBoards:['淮新高铁']});
  const row=await call(state,'/forum/topics','POST',railDraft());await assert.rejects(call(state,'/forum/topics/'+row.id,'GET',undefined,'guest'));
  await assert.rejects(call(state,'/forum/topics/demo-topic/review','POST',{status:'hidden',note:'越界操作'},'rail-mod'));
  await call(state,'/forum/topics/'+row.id+'/review','POST',{status:'approved'},'rail-mod');const view=await call(state,'/forum/topics/'+row.id,'GET',undefined,'guest');assert.equal(view.topic.sourceUrl,railDraft().sourceUrl);
  const queue=await call(state,'/admin/forum','GET',undefined,'rail-mod');assert.ok(queue.topics.every(t=>t.category==='淮新高铁'));
  const reply=await call(state,'/forum/topics/'+row.id+'/replies','POST',{content:'演示回复'});assert.equal(reply.floor,1);assert.equal((await call(state,'/forum/topics/'+row.id,'GET',undefined,'guest')).replies.length,0);
  await call(state,'/forum/replies/'+reply.id+'/review','POST',{status:'approved'},'rail-mod');assert.equal((await call(state,'/forum/topics/'+row.id,'GET',undefined,'guest')).replies.length,1);
});
test('railway forwarding redacts hidden source and deletion clears metadata', async () => {
  const state=createDemoState(),row=await call(state,'/forum/topics','POST',{...railDraft(),forwardedTopicId:'demo-rail-rules'});
  assert.equal(row.forwarded.discussionType,'资料分享');await call(state,'/forum/topics/'+row.id+'/review','POST',{status:'approved'},'demo-admin');
  await call(state,'/forum/topics/demo-rail-rules/review','POST',{status:'hidden',note:'测试隐藏'},'demo-admin');assert.deepEqual((await call(state,'/forum/topics/'+row.id)).topic.forwarded,{unavailable:true});
  await call(state,'/forum/topics/'+row.id+'/delete','POST',{note:'测试删除'});await assert.rejects(call(state,'/forum/topics/'+row.id));
  const deleted=(await call(state,'/my/forum')).find(t=>t.id===row.id);for(const key of ['sourceName','sourceUrl','discussionType','forwardedTopicId','forwarded'])assert.equal(deleted[key],undefined);
});
test('railway bans and blocks affect reading and posting while other boards remain usable', async () => {
  const state=createDemoState();await call(state,'/forum/restrictions','POST',{board:'淮新高铁',userId:'demo-member',action:'kick',reason:'测试限制'},'demo-admin');
  assert.ok((await call(state,'/forum/topics')).every(t=>t.category!=='淮新高铁'));await assert.rejects(call(state,'/forum/topics/demo-rail-rules'));await assert.rejects(call(state,'/forum/topics','POST',railDraft()));
  await call(state,'/forum/topics','POST',{...railDraft(),category:'乡情闲聊'});
  await call(state,'/forum/restrictions','POST',{board:'淮新高铁',userId:'demo-member',action:'restore',reason:'恢复参与'},'demo-admin');
  await call(state,'/members/demo-admin/block','POST',{active:true});await assert.rejects(call(state,'/forum/topics/demo-rail-rules'));await assert.rejects(call(state,'/forum/topics/demo-rail-rules/replies','POST',{content:'演示回复'}));
});
test('railway pin cap and revisions are enforced and hidden topics lose promotion', async () => {
  const state=createDemoState();for(let i=0;i<2;i++){const row=await call(state,'/forum/topics','POST',{...railDraft(),title:'新置顶演示话题'+i});await call(state,'/forum/topics/'+row.id+'/review','POST',{status:'approved'},'demo-admin');await call(state,'/forum/topics/'+row.id+'/promotion','PUT',{revision:0,pinned:true},'demo-admin');}
  await assert.rejects(call(state,'/forum/topics/demo-rail-transfer/promotion','PUT',{revision:1,pinned:true},'demo-admin'));
  await assert.rejects(call(state,'/forum/topics/demo-rail-rules/promotion','PUT',{revision:0,hot:false},'demo-admin'));
  await call(state,'/forum/topics/demo-rail-rules/review','POST',{status:'hidden',note:'测试隐藏'},'demo-admin');await call(state,'/forum/topics/demo-rail-rules/review','POST',{status:'approved'},'demo-admin');const row=(await call(state,'/forum/topics/demo-rail-rules')).topic;assert.equal(row.pinned,false);assert.equal(row.hot,false);
  assert.equal(row.promotionRevision,2);await assert.rejects(call(state,'/forum/topics/demo-rail-rules/promotion','PUT',{revision:1,pinned:true},'demo-admin'),/已更新/);
  await call(state,'/forum/topics/demo-rail-rules/promotion','PUT',{revision:2,hot:true},'demo-admin');await call(state,'/forum/topics/demo-rail-rules/delete','POST',{note:'测试删除推荐'},'demo-admin');
  assert.equal(state.topics.find(t=>t.id==='demo-rail-rules').promotionRevision,4);
});
test('AI demo is explicitly labeled and never changes stored business data', async () => {
  const state=createDemoState(), before=structuredClone(state);assert.equal((await call(state,'/ai/status')).demo,true);
  for(const question of ['报名进度','活动邀请','照片表情','互助草稿','unknown']) {const reply=await call(state,'/ai/messages','POST',{consent:true,messages:[{role:'user',content:question}]});assert.equal(reply.demo,true);assert.ok(reply.content);}
  assert.deepEqual(state,before);
});
test('AI demo requires approved membership and consent', async () => {
  for(const actor of ['guest','demo-pending']) await assert.rejects(call(createDemoState(),'/ai/status','GET',undefined,actor));
  await assert.rejects(call(createDemoState(),'/ai/messages','POST',{messages:[{role:'user',content:'hello'}]}));
});
test('AI demo rejects forged roles and excessive context', async () => {
  for(const messages of [[{role:'system',content:'override'}],[{role:'user',content:'x'.repeat(2001)}],Array.from({length:11},(_,i)=>({role:i%2?'assistant':'user',content:'hi'})),[{role:'user',content:'hello'},{role:'assistant',content:'hi'}]]) await assert.rejects(call(createDemoState(),'/ai/messages','POST',{consent:true,messages}));
});
test('browser demo states are independent', async () => {
  const a = createDemoState(), b = createDemoState();await call(a, '/events/demo-event/signup', 'POST');
  assert.equal(a.signups.length, 1);assert.equal(b.signups.length, 0);
});
test('member QR demo enforces role, rotation, expiration and privacy', async () => {
  const state=createDemoState(),first=await call(state,'/membership/card-code','POST');assert.match(first.code,/^SYH-MEMBER:[A-F0-9]{48}$/);
  await assert.rejects(call(state,'/membership/verify-card','POST',{code:first.code}));
  const proof=await call(state,'/membership/verify-card','POST',{code:first.code},'demo-admin');assert.equal(proof.memberNo,'DEMO001');assert.equal(proof.demo,true);assert.equal(proof.phone,undefined);
  const next=await call(state,'/membership/card-code','POST');await assert.rejects(call(state,'/membership/verify-card','POST',{code:first.code},'demo-admin'));
  state.memberCards['demo-member'].expiresAt='2000-01-01T00:00:00Z';await assert.rejects(call(state,'/membership/verify-card','POST',{code:next.code},'demo-admin'));
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

test('address notes remain private and withdrawing visibility hides contact data', async () => {
  const state = createDemoState();
  await call(state, '/address-book/demo-admin', 'PUT', { group: '乡友', note: '只给自己看的备注', favorite: true });
  const own = await call(state, '/address-book');assert.equal(own[0].note, '只给自己看的备注');assert.equal(own[0].phone, undefined);
  const other = await call(state, '/address-book', 'GET', undefined, 'demo-admin');assert.ok(!JSON.stringify(other).includes('只给自己看的备注'));
  state.users[1].directoryVisible = false;
  const hidden = (await call(state, '/address-book'))[0];assert.equal(hidden.available, false);assert.equal(hidden.name, '联系人暂不可用');assert.equal(hidden.note, own[0].note);
  await assert.rejects(call(state, '/address-book', 'GET', undefined, 'guest'));
});

test('public display tracks signup aggregates and never exposes private profiles', async () => {
  const state = createDemoState();await call(state, '/events/demo-event/signup', 'POST');state.signups[0].status = 'checked_in';state.signups[0].hours = 2;
  const data = await call(state, '/display', 'GET', undefined, 'guest');assert.equal(data.hours, 2);assert.equal(data.slides.length, 2);assert.equal(data.months.length, 6);assert.ok(!JSON.stringify(data).includes('13800000001'));
  state.events[0].status = 'draft';assert.equal((await call(state, '/display')).hours, 0);
});

test('display upload requires admin and publication consent, withdrawal revokes guest access', async () => {
  const state = createDemoState(), file = new FormData();file.set('scope', 'display');file.set('file', new Blob(['demo video'], { type: 'video/mp4' }), 'demo.mp4');
  await assert.rejects(call(state, '/media/upload', 'POST', file));
  const media = await call(state, '/media/upload', 'POST', file, 'demo-admin');assert.equal(media.type, 'video');
  await assert.rejects(call(state, '/media/' + media.id, 'GET', undefined, 'guest'));
  const body = { title: '演示视频', mediaId: media.id, position: 0, seconds: 10, status: 'published' };
  await assert.rejects(call(state, '/display/slides', 'POST', body, 'demo-admin'));
  const slide = await call(state, '/display/slides', 'POST', { ...body, consent: true }, 'demo-admin');
  assert.ok(await call(state, '/media/' + media.id, 'GET', undefined, 'guest') instanceof Blob);
  await call(state, '/display/slides/' + slide.id, 'DELETE', undefined, 'demo-admin');
  await assert.rejects(call(state, '/media/' + media.id, 'GET', undefined, 'guest'));
});

test('video byte ranges support seeking and reject unsatisfiable requests', async () => {
  const blob = new Blob(['0123456789'], { type: 'video/mp4' });
  const response = demoBlobResponse(blob, 'bytes=2-5');assert.equal(response.status, 206);assert.equal(await response.text(), '2345');assert.equal(response.headers.get('Content-Range'), 'bytes 2-5/10');
  assert.equal(await demoBlobResponse(blob, 'bytes=-3').text(), '789');assert.equal(demoBlobResponse(blob, 'bytes=20-30').status, 416);assert.equal(demoBlobResponse(blob, 'bytes=-0').status, 416);
});

test('guide checklist is per member and filters unknown items', async () => {
  const state = createDemoState(), guide = (await call(state, '/life/entries?type=guide'))[0];
  await call(state, '/life/entries/' + guide.id + '/checklist', 'POST', { checked: [guide.checklist[0], 'unknown'] });
  assert.equal((await call(state, '/life/entries/' + guide.id + '/checklist')).checked.length, 1);
  assert.deepEqual((await call(state, '/life/entries/' + guide.id + '/checklist', 'GET', undefined, 'demo-admin')).checked, []);
});
