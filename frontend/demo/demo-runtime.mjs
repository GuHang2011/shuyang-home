// Browser-only sample data. This module is never loaded by the production build.
import { demoExtensions } from './demo-extensions.mjs';
export const demoSchema = 1;
const now = () => new Date().toISOString();
const date = days => new Date(Date.now() + days * 86400000).toISOString();
const id = prefix => prefix + '-' + crypto.randomUUID();
const fail = message => { throw new Error(message); };
export function createDemoState() {
  const profile = { status: 'approved', enabled: true, hometown: '江苏沭阳', district: '苏州吴中', industry: '社区服务', bio: '这是虚构的演示资料。', volunteer: true, directoryVisible: true, phoneVisible: false, mustChangePassword: false, forumBoards: [], createdAt: now() };
  return {
    schema: demoSchema,
    users: [{ ...profile, id: 'demo-member', username: 'demo', name: '演示会员', phone: '13800000001', memberNo: 'DEMO001', role: 'member' }, { ...profile, id: 'demo-admin', username: 'admin', name: '演示管理员', phone: '13800000002', memberNo: 'DEMO002', role: 'superadmin' }, { ...profile, id: 'demo-pending', username: 'new', name: '待审核演示会员', phone: '13800000003', memberNo: '', role: 'member', status: 'pending' }],
    events: [{ id: 'demo-event', title: '周末老乡交流会（演示）', category: '乡情聚会', location: '演示社区活动室', content: '这是一场虚构活动，用于体验报名、取消报名和管理名单。请勿据此实际前往。', description: '认识身边的老乡，分享生活经验。此活动仅用于演示。', startsAt: date(7), endsAt: date(7.1), capacity: 30, hours: 2, registered: 0, status: 'published', createdAt: now() }, { id: 'demo-volunteer', title: '社区清洁志愿活动（演示）', category: '公益志愿', location: '演示社区广场', content: '用于体验公益活动报名与志愿时长记录。此活动不实际举办。', description: '一起体验志愿活动报名。', startsAt: date(10), endsAt: date(10.1), capacity: 20, hours: 2, registered: 0, status: 'published', createdAt: now() }],
    signups: [],
    posts: [{ id: 'demo-help', authorId: 'demo-admin', authorName: '演示管理员', title: '初到苏州，欢迎分享生活经验', category: '生活互助', content: '演示互助信息：可以发布一条求助，再切换管理员体验审核。所有内容只保存在此浏览器。', district: '苏州吴中', status: 'approved', progressState: 'open', validDays: 30, expiresAt: date(30), createdAt: now(), revision: 1 }],
    notices: [{ id: 'demo-notice', title: '欢迎体验沭阳之家', category: '平台公告', content: '顶部可切换演示会员、管理员或游客。试试换肤、活动报名、论坛拍照、相册和聊天；点击重置可以恢复初始样例。', status: 'published', createdAt: now() }],
    topics: [{ id: 'demo-topic', authorId: 'demo-admin', authorName: '演示管理员', title: '第一次来，先和老乡打个招呼', category: '乡情闲聊', content: '欢迎体验！可以拍张照片发帖，也可以到家里聊聊发送文字和表情。只有这个浏览器能看到你的演示内容。', photos: [], audio: null, status: 'approved', pinned: true, hot: true, promotionRevision: 1, replyCount: 0, locked: false, createdAt: now() }, { id: 'demo-topic-life', authorId: 'demo-member', authorName: '演示会员', title: '在苏州生活，你有哪些小经验？', category: '苏州生活', content: '分享通勤、周末活动与生活经验。这是一个虚构话题，可以体验回复、热帖筛选和管理审核。', photos: [], audio: null, status: 'approved', pinned: false, hot: true, promotionRevision: 0, replyCount: 0, locked: false, createdAt: now() }],
    replies: [],
    albums: [{ id: 'demo-album', title: '乡情记忆（演示相册）', date: new Date().toISOString().slice(0, 10), location: '演示活动', description: '切换管理员后，可以拍摄照片并添加到相册。', status: 'published', count: 0 }], photos: [],
    products: [{ id: 'demo-product', title: '家乡风味礼盒（演示）', category: '家乡美食', specification: '演示礼盒一份', origin: '江苏沭阳', seller: '演示供货商', sellerContact: '仅供演示，无实际销售', priceCents: 3900, shippingCents: 0, stock: 20, images: [], status: 'published', description: '体验下单与管理员确认流程，不会产生真实订单或付款。', afterSales: '此商品仅为虚构样例，不实际销售或发货。', createdAt: now() }], orders: [],
    rooms: [{ id: 'demo-room', type: 'group', title: '老乡体验群', ownerId: 'demo-admin', description: '仅限本机体验，不与其他访客联机', status: 'active', memberCount: 2, joined: true, sequence: 1, unread: 0, lastRead: 0, peerAvailable: true, updatedAt: now() }],
    messages: [{ id: 'demo-message', roomId: 'demo-room', senderId: 'demo-admin', senderName: '演示管理员', content: '欢迎！试试发送文字、表情或拍照。这些内容只留在你的浏览器中。', sequence: 1, createdAt: now(), recalled: false }],
    broadcasts: [{ id: 'demo-broadcast', title: '在线体验版', content: '这是独立演示环境。样例资料与操作仅保存在当前浏览器，可随时重置。', status: 'published', startsAt: date(-1), endsAt: date(365), revision: 1, audio: null, createdAt: now() }],
    media: {}, polls: [], resources: [], audit: []
  };
}
const pick = (rows, key) => rows.find(row => row.id === key) || fail('演示记录不存在，请刷新或重置演示数据');
export const stickerPacks = [{ id: 'demo', name: '乡情问候', stickers: [{ id: 'demo-hello', label: '老乡好' }, { id: 'demo-great', label: '赞一个' }, { id: 'demo-cheer', label: '加油' }] }];
const mediaView = row => row ? { id: row.id, name: row.name, size: row.size, contentType: row.type, type: row.type.startsWith('image/') ? 'image' : row.type.startsWith('audio/') ? 'audio' : row.type.startsWith('video/') ? 'video' : 'file' } : null;
const broadcastView = row => ({ ...row, state: row.status !== 'published' ? row.status : Date.parse(row.endsAt) <= Date.now() ? 'expired' : Date.parse(row.startsAt) > Date.now() ? 'scheduled' : 'active' });

/** Return the same JSON data shapes as the application, with isolated local state. */
export async function demoRequest(state, request) {
  const url = new URL(request.url), path = url.pathname.replace(/^\/api/, ''), method = request.method, read = method === 'GET';
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer /, ''), actor = state.users.find(row => row.id === token);
  const member = () => actor?.status === 'approved' ? actor : fail('请在顶部选择演示会员或管理员');
  const admin = () => actor?.role === 'superadmin' ? actor : fail('请切换到演示管理员体验此操作');
  const mine = rows => rows.filter(row => row.userId === actor?.id || row.authorId === actor?.id || row.buyerId === actor?.id);
  const eventView = row => ({ ...row, registered: state.signups.filter(s => s.eventId === row.id && s.status !== 'cancelled').length, mySignup: state.signups.find(s => s.eventId === row.id && s.userId === actor?.id && s.status !== 'cancelled') || null });
  const photoRefs = ids => (ids || []).map(key => mediaView(state.media[key])).filter(Boolean);
  const author = () => ({ authorId: member().id, authorName: actor.name, createdAt: now() });
  const workItems = manage => {
    const rows = [], add = (row, kind, kindLabel, title, stateLabel, section) => rows.push({ id: row.id, kind, kindLabel, title, state: stateLabel, section, createdAt: row.createdAt, updatedAt: row.createdAt, waitingSince: row.createdAt });
    if (manage) { admin();state.users.filter(u => u.status === 'pending').forEach(u => add(u, 'user', '入会申请', u.name + '的入会申请', '待审核', 'action')); }
    (manage ? state.topics : mine(state.topics)).filter(t => !manage || t.status === 'pending').forEach(t => add(t, 'forum_topic', '论坛主题', t.title, t.status === 'pending' ? '待审核' : '已处理', t.status === 'pending' ? (manage ? 'action' : 'waiting') : 'done'));
    (manage ? state.orders : mine(state.orders)).filter(o => !manage || o.status === 'pending').forEach(o => add(o, 'order', '特产订单', o.productTitle, o.status === 'pending' ? '待确认' : o.status === 'cancelled' ? '已取消' : '已处理', o.status === 'pending' ? (manage ? 'action' : 'waiting') : 'done'));
    if (!manage) mine(state.signups).forEach(s => add(s, 'signup', '活动报名', pick(state.events, s.eventId).title, s.status === 'registered' ? '已报名' : '已取消', s.status === 'registered' ? 'upcoming' : 'done'));
    return rows;
  };
  const body = read || path === '/media/upload' ? {} : await request.json().catch(() => ({}));
  if (path === '/ai/status' && read) { member();return { available: true, demo: true, message: '本机示例已就绪，不连接真实模型', maxInput: 2000 }; }
  if (path === '/ai/messages' && method === 'POST') {
    member();
    if (body.consent !== true) fail('请先确认本机示例体验');
    const rows = body.messages;
    if (!Array.isArray(rows) || !rows.length || rows.length > 9 || rows.length % 2 === 0) fail('对话过长或顺序无效，请新建对话');
    let total = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i], role = i % 2 === 0 ? 'user' : 'assistant';
      if (!row || row.role !== role || typeof row.content !== 'string' || !row.content.trim() || row.content.trim().length > (role === 'user' ? 2000 : 6000)) fail('对话格式或长度无效');
      total += row.content.trim().length;
    }
    if (total > 16000) fail('对话内容过长，请新建对话');
    const question = rows[rows.length - 1].content;
    let content = '这是本机固定示例，未调用真实 AI。可以体验活动报名指引、活动邀请模板、拍照与表情说明、互助信息草稿。完整部署配置模型服务后，才能回答自由问题。';
    if (/报名|进度/.test(question)) content = '示例指引：进入「乡情活动」查看活动详情，选择报名；在「我的事项」查看报名状态。若需取消，请在活动开始前操作并核对结果。本助手没有读取你的实际报名记录。';
    else if (/邀请/.test(question)) content = '活动邀请示例（请核实后发布）：\n亲爱的老乡们，欢迎参加【活动名称】！\n时间：【日期与时间】\n地点：【地点】\n安排：【活动内容】\n费用：【费用说明】\n报名方式：【报名入口与截止日期】\n期待与大家相聚，共叙乡情。';
    else if (/照片|拍照|表情/.test(question)) content = '示例指引：在论坛、聊天或有管理权限的相册中点击「拍照」，允许摄像头访问，预览并确认后上传。聊天中打开表情面板选择表情，再点击发送。照片上传后仍需确认发帖、发送或添加到相册。';
    else if (/互助|草稿/.test(question)) content = '互助信息示例：\n标题：【简明说明需求】\n所在区域：【大致区域】\n需要的帮助：【具体需求】\n有效时间：【期限】\n补充说明：【已尝试的办法】\n请勿在公开内容中填写身份证、密码或详细住址。核实后到「老乡互助」自行提交审核。';
    return { content, demo: true, truncated: false };
  }
  const extra = demoExtensions(state, { path, method, body: read ? { query: url.searchParams } : body, actor, member, admin });
  if (extra !== undefined) return extra;
  if (path === '/demo/reset' && method === 'POST') return { reset: true };
  if (path === '/membership/card-code' && method === 'POST') {
    const user=member();if(!user.memberNo)fail('会员编号尚未生成');
    const code='SYH-MEMBER:'+Array.from(crypto.getRandomValues(new Uint8Array(24)),n=>n.toString(16).padStart(2,'0').toUpperCase()).join('');
    state.memberCards ||= {};state.memberCards[user.id]={code,expiresAt:new Date(Date.now()+600000).toISOString()};
    return {...state.memberCards[user.id],serverNow:now(),demo:true};
  }
  if (path === '/membership/verify-card' && method === 'POST') {
    admin();if(typeof body.code!=='string'||!/^SYH-MEMBER:[A-F0-9]{48}$/.test(body.code))fail('请扫描沭阳之家电子会员卡二维码');
    const pair=Object.entries(state.memberCards||{}).find(([,card])=>card.code===body.code&&Date.parse(card.expiresAt)>Date.now());
    const user=pair&&state.users.find(u=>u.id===pair[0]);if(!user||user.status!=='approved'||!user.enabled||user.mustChangePassword)fail('会员码已失效，请刷新后重试');
    return {name:user.name,memberNo:user.memberNo,status:user.status,verifiedAt:now(),demo:true};
  }
  if (path === '/auth/me') return actor || fail('请在顶部选择演示身份');
  if (path === '/auth/logout') return {};
  if (path === '/auth/login') {
    const user = state.users.find(row => row.username === body.username || row.phone === body.username);
    if (!user || body.password !== 'Demo12345678') fail('演示账号为 demo 或 admin，密码 Demo12345678；也可直接使用顶部身份切换。');
    return { token: user.id, user };
  }
  if (path === '/profile' && method === 'PUT') { member();for (const key of ['name', 'hometown', 'district', 'industry', 'bio', 'volunteer', 'directoryVisible', 'phoneVisible']) if (key in body) actor[key] = body[key];return actor; }
  if (path === '/home') return { members: state.users.filter(u => u.status === 'approved').length, events: state.events.length, volunteerHours: 12 };
  if (path === '/members') { member();return state.users.filter(u => u.status === 'approved' && u.directoryVisible); }
  if (path === '/admin/members') { admin();return state.users; }
  if (path === '/admin/audit') { admin();return state.audit; }
  let match;
  if ((match = path.match(/^\/admin\/members\/([^/]+)\/review$/)) && !read) { admin();const row = pick(state.users, match[1]);row.status = body.status;row.note = body.note || '';return row; }
  if (path === '/events' && read) return state.events.filter(e => e.status === 'published' || actor?.role === 'superadmin').map(eventView);
  if ((path === '/events' || /^\/events\/[^/]+$/.test(path)) && !read) { admin();const row = path === '/events' ? { id: id('event'), createdAt: now() } : pick(state.events, path.split('/')[2]);Object.assign(row, body);if (path === '/events') state.events.push(row);return eventView(row); }
  if ((match = path.match(/^\/events\/([^/]+)$/)) && read) return eventView(pick(state.events, match[1]));
  if ((match = path.match(/^\/events\/([^/]+)\/(signup|cancel-signup|participants)$/))) {
    const event = pick(state.events, match[1]);member();const existing = state.signups.find(s => s.eventId === event.id && s.userId === actor.id && s.status !== 'cancelled');
    if (match[2] === 'participants') { admin();return state.signups.filter(s => s.eventId === event.id).map(s => ({ ...s, member: pick(state.users, s.userId), name: pick(state.users, s.userId).name, phone: pick(state.users, s.userId).phone })); }
    if (read) fail('请使用页面按钮完成此操作');
    if (match[2] === 'cancel-signup') { if (existing) existing.status = 'cancelled';return {}; }
    if (existing) return existing;
    if (eventView(event).registered >= event.capacity) fail('活动已满员');
    const row = { id: id('signup'), eventId: event.id, userId: actor.id, status: 'registered', hours: 0, createdAt: now() };state.signups.push(row);return row;
  }
  if (path === '/my/signups') return mine(state.signups).map(row => ({ ...row, event: eventView(pick(state.events, row.eventId)) }));
  if (['/posts', '/my/posts', '/admin/posts'].includes(path) && read) return path === '/my/posts' ? mine(state.posts) : path === '/admin/posts' ? (admin(), state.posts) : state.posts.filter(p => p.status === 'approved');
  if (path === '/posts' && !read) { const row = { ...body, ...author(), id: id('post'), status: 'pending', progressState: 'open', revision: 1 };state.posts.unshift(row);return row; }
  if ((match = path.match(/^\/posts\/([^/]+)\/(review|close)$/)) && !read) { const row = pick(state.posts, match[1]);if (match[2] === 'review') admin();else if (row.authorId !== member().id) admin();row.status = match[2] === 'close' ? 'closed' : body.status;return row; }
  if (path === '/notices' && read) return state.notices;
  if ((path === '/notices' || /^\/notices\/[^/]+$/.test(path)) && !read) { admin();const row = { ...body, id: path.split('/')[2] || id('notice'), createdAt: now() };state.notices = [row, ...state.notices.filter(n => n.id !== row.id)];return row; }
  if (path === '/forum/topics' && read) return state.topics.filter(t => t.status === 'approved');
  if (path === '/my/forum') return mine(state.topics);
  if (path === '/admin/forum') { admin();return { topics: state.topics, replies: state.replies }; }
  if (path === '/forum/topics' && !read) { const row = { ...body, ...author(), id: id('topic'), status: 'pending', photos: photoRefs(body.photoIds), audio: mediaView(state.media[body.audioId]), replyCount: 0, pinned: false, hot: false, promotionRevision: 0 };state.topics.unshift(row);return row; }
  if ((match = path.match(/^\/forum\/topics\/([^/]+)$/)) && read) return { topic: pick(state.topics, match[1]), replies: state.replies.filter(r => r.topicId === match[1] && (r.status === 'approved' || r.authorId === actor?.id || actor?.role === 'superadmin')) };
  if ((match = path.match(/^\/forum\/topics\/([^/]+)\/replies$/)) && !read) { const topic = pick(state.topics, match[1]);if (topic.locked) fail('话题已关闭回复');const row = { ...body, ...author(), id: id('reply'), topicId: topic.id, status: 'pending', photos: photoRefs(body.photoIds), audio: mediaView(state.media[body.audioId]) };state.replies.push(row);return row; }
  if ((match = path.match(/^\/forum\/(topics|replies)\/([^/]+)\/(review|delete|lock|promotion)$/)) && !read) {
    admin();const row = pick(match[1] === 'topics' ? state.topics : state.replies, match[2]);
    if (match[3] === 'promotion') { if (row.status !== 'approved') fail('请先审核通过话题');if (body.pinned !== undefined) row.pinned = !!body.pinned;if (body.hot !== undefined) row.hot = !!body.hot;row.promotionRevision++; }
    else if (match[3] === 'lock') row.locked = !row.locked;
    else row.status = match[3] === 'delete' ? 'deleted' : body.status;
    if (row.status !== 'approved') { row.pinned = false;row.hot = false; }
    state.topics.forEach(t => t.replyCount = state.replies.filter(r => r.topicId === t.id && r.status === 'approved').length);return row;
  }
  if (path === '/albums' && read) return { albums: state.albums.map(a => ({ ...a, count: state.photos.filter(p => p.albumId === a.id).length })), source: { title: '在线演示相册', url: '#gallery' } };
  if ((match = path.match(/^\/albums\/([^/]+)$/)) && read) return { album: pick(state.albums, match[1]), photos: state.photos.filter(p => p.albumId === match[1]) };
  if (path === '/albums' && !read) { admin();const row = { ...body, id: body.id || id('album'), count: 0 };state.albums = [row, ...state.albums.filter(a => a.id !== row.id)];return row; }
  if ((match = path.match(/^\/albums\/([^/]+)\/photos$/)) && !read) { admin();pick(state.albums, match[1]);const row = { ...body, id: id('photo'), albumId: match[1] };state.photos.push(row);return row; }
  if ((match = path.match(/^\/album-photos\/([^/]+)$/)) && !read) { admin();const row = pick(state.photos, match[1]);Object.assign(row, body);return row; }
  if (path === '/products' && read) return state.products.filter(p => p.status === 'published' || actor?.role === 'superadmin');
  if (path === '/products' && !read) { admin();const row = { ...body, id: body.id || id('product'), priceCents: Math.round(Number(body.price) * 100), shippingCents: Math.round(Number(body.shippingFee) * 100) };state.products = [row, ...state.products.filter(p => p.id !== row.id)];return row; }
  if (path === '/orders' && read) { member();return actor.role === 'superadmin' && url.searchParams.get('manage') === 'true' ? state.orders : mine(state.orders); }
  if (path === '/orders' && !read) {
    member();const existing = state.orders.find(o => o.requestId === body.requestId && o.buyerId === actor.id);if (existing) return existing;
    const product = pick(state.products, body.productId), quantity = Number(body.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > product.stock) fail('可售库存不足');
    const row = { ...body, id: id('order'), buyerId: actor.id, productTitle: product.title, title: product.title, unitCents: product.priceCents, shippingCents: body.delivery === 'shipping' ? product.shippingCents : 0, totalCents: quantity * product.priceCents + (body.delivery === 'shipping' ? product.shippingCents : 0), status: 'pending', settlement: 'unconfirmed', createdAt: now() };product.stock -= quantity;state.orders.push(row);return row;
  }
  if ((match = path.match(/^\/orders\/([^/]+)\/action$/)) && !read) {
    member();const row = pick(state.orders, match[1]);if (!['cancel', 'receive'].includes(body.action)) admin();else if (row.buyerId !== actor.id) admin();
    const transitions = { confirm: ['pending', 'confirmed'], ship: ['confirmed', 'shipped'], ready: ['confirmed', 'ready'], receive: ['shipped,ready', 'completed'] };
    if (body.action === 'cancel') { if (!['pending', 'confirmed'].includes(row.status)) fail('当前订单不可取消');pick(state.products, row.productId).stock += row.quantity;row.status = 'cancelled'; }
    else if (body.action === 'settle') { if (row.status !== 'confirmed' || body.verified !== true) fail('请先确认订单并核实演示结算');row.settlement = 'confirmed'; }
    else { const next = transitions[body.action];if (!next || !next[0].split(',').includes(row.status)) fail('订单状态不支持此操作');row.status = next[1]; }
    row.fulfillment = body.note;return row;
  }
  if (path === '/media/upload' && !read) {
    member();const form = await request.formData(), file = form.get('file');
    const display = form.get('scope') === 'display';
    if (display) admin();
    const limit = display ? (file?.type === 'video/mp4' ? 15 : 8) : 10;
    if (!(file instanceof Blob) || !file.size || file.size > limit * 1024 * 1024) fail('请选择不超过' + limit + 'MB的演示文件');
    const accepted = display ? ['image/jpeg', 'image/png', 'video/mp4'] : ['image/jpeg', 'image/png', 'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a', 'application/pdf', 'text/plain'];
    if (!accepted.includes(file.type)) fail(display ? '大屏支持 JPG、PNG 和 MP4' : '体验版支持 JPG、PNG、MP3、WAV、M4A、PDF 和 TXT');
    if (Object.values(state.media).reduce((n, m) => n + m.size, 0) + file.size > 50 * 1024 * 1024) fail('演示附件已达50MB，请重置演示数据后继续');
    const row = { id: id('media'), name: file.name || '演示附件', size: file.size, type: file.type, blob: file, scope: form.get('scope'), ownerId: actor.id, linked: false };state.media[row.id] = row;return mediaView(row);
  }
  if ((match = path.match(/^\/media\/([^/]+)$/)) && read) {
    const media = state.media[match[1]];
    if (media?.scope === 'display' && !state.displaySlides.some(s => s.mediaId === media.id && s.status === 'published') && actor?.id !== media.ownerId && actor?.role !== 'superadmin') fail('素材尚未公开展示');
    return media?.blob || fail('本机演示附件不存在');
  }
  if (path === '/chat/unread') return { count: 0 };
  if (path === '/chat/sticker-packs') return stickerPacks;
  if (['/chat/conversations', '/chat/groups'].includes(path) && read) { member();return state.rooms; }
  if (['/chat/groups', '/chat/direct'].includes(path) && !read) { member();const row = { ...state.rooms[0], id: id('room'), title: body.title || '演示私聊', type: path.endsWith('direct') ? 'direct' : 'group', ownerId: actor.id, sequence: 0, updatedAt: now() };state.rooms.push(row);return row; }
  if ((match = path.match(/^\/chat\/conversations\/([^/]+)$/)) && read) { member();return { ...pick(state.rooms, match[1]), messages: state.messages.filter(m => m.roomId === match[1]), recalledIds: [], hasMore: false }; }
  if ((match = path.match(/^\/chat\/conversations\/([^/]+)\/messages$/)) && !read) {
    member();const room = pick(state.rooms, match[1]);const existing = state.messages.find(m => m.requestId === body.requestId && m.senderId === actor.id);if (existing) return existing;
    const row = { id: id('message'), roomId: room.id, senderId: actor.id, senderName: actor.name, content: body.content, attachment: mediaView(state.media[body.attachmentId]), sticker: stickerPacks[0].stickers.find(s => s.id === body.stickerId), sequence: ++room.sequence, requestId: body.requestId, createdAt: now(), recalled: false };state.messages.push(row);room.preview = body.content || '演示附件';return row;
  }
  if (/^\/chat\/conversations\/[^/]+\/read$/.test(path) && !read) return { read: true };
  if ((match = path.match(/^\/chat\/messages\/([^/]+)\/recall$/)) && !read) { const row = pick(state.messages, match[1]);if (row.senderId !== member().id) fail('只能撤回自己的演示消息');row.recalled = true;return row; }
  if (path === '/broadcasts') return { serverTime: now(), items: state.broadcasts.map(broadcastView).filter(b => b.state === 'active') };
  if (path === '/admin/broadcasts' && read) { admin();return state.broadcasts.map(broadcastView); }
  if ((path === '/admin/broadcasts' || /^\/admin\/broadcasts\/[^/]+$/.test(path)) && !read) { admin();const row = { ...body, id: path.split('/')[3] || id('broadcast'), revision: (body.revision || 0) + 1, startsAt: body.startsAt || now(), createdAt: now(), audio: mediaView(state.media[body.audioId]) };state.broadcasts = [row, ...state.broadcasts.filter(b => b.id !== row.id)];return broadcastView(row); }
  if ((match = path.match(/^\/admin\/broadcasts\/([^/]+)\/withdraw$/)) && !read) { admin();const row = pick(state.broadcasts, match[1]);row.status = 'withdrawn';return row; }
  if (path === '/work/summary') { const own = workItems(false);return { action: own.filter(i => i.section === 'action').length, waiting: own.filter(i => i.section === 'waiting').length, upcoming: own.filter(i => i.section === 'upcoming').length, done: own.filter(i => i.section === 'done').length, unread: 0, pending: actor?.role === 'superadmin' ? workItems(true).length : 0 }; }
  if (path === '/work/items') { member();const rows = workItems(url.searchParams.get('manage') === 'true'), kind = url.searchParams.get('kind'), filter = url.searchParams.get('filter');const items = rows.filter(r => (!kind || kind === 'all' || r.kind === kind) && (!filter || filter === 'all' || r.section === filter));return { items, total: items.length, page: 1, pages: 1, counts: {}, through: 0 }; }
  if (path === '/work/target') {
    member();const manage = url.searchParams.get('manage') === 'true', kind = url.searchParams.get('kind'), key = url.searchParams.get('id'), item = workItems(manage).find(r => r.id === key && r.kind === kind);
    if (!item) fail('该演示事项已处理，请刷新列表');
    const actions = [];
    if (manage && kind === 'user') actions.push({ label: '通过入会申请', url: '/admin/members/' + key + '/review', body: { status: 'approved' } });
    if (manage && kind === 'forum_topic') actions.push({ label: '审核通过', url: '/forum/topics/' + key + '/review', body: { status: 'approved' } });
    if (manage && kind === 'order') actions.push({ label: '确认演示订单', url: '/orders/' + key + '/action', body: { action: 'confirm' } });
    if (!manage && kind === 'signup' && item.section === 'upcoming') actions.push({ label: '取消报名', url: '/events/' + pick(state.signups, key).eventId + '/cancel-signup', body: {} });
    return { ...item, fields: [{ label: '当前状态', value: item.state }, { label: '演示说明', value: '此记录仅保存在当前浏览器。' }], actions, ...(kind === 'forum_topic' ? { navigate: 'forum' } : {}) };
  }
  if (path === '/work/notices') return { items: [], total: 0, page: 1, pages: 1, counts: {}, through: 0 };
  if (path === '/admin/resources') return { resources: [], exchanges: [] };
  if (path === '/data-files/options') { admin();return { kinds: [], events: [] }; }
  if (read && ['/ads', '/my/ads', '/admin/ads', '/polls', '/resources', '/my/resources', '/my/exchanges', '/my/blocks', '/forum/restrictions', '/crowdfunding', '/my/crowdfunding', '/admin/crowdfunding', '/my/pledges', '/my/contact-exchanges', '/my/event-proposals', '/admin/event-proposals'].includes(path)) return [];
  if (path.startsWith('/weather')) fail('体验版不请求实时天气或定位。');
  fail('此操作未纳入在线体验范围，请在完整部署版本中使用。');
}
