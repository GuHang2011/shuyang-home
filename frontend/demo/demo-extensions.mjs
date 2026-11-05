// Local-only examples for the display, address book and life guide.
const fail = message => { throw Error(message); };
const now = () => new Date().toISOString();
const pick = (rows, id) => rows.find(row => row.id === id) || fail('演示记录不存在');
export function prepareExtensions(state) {
  state.addressContacts ||= [];
  if (!state.displaySlides) {
    state.displaySlides = ['相聚有时，乡情常在', '把每一份温暖，传给身边的人'].map((title, i) => {
      const mediaId = 'demo-display-' + i;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="${i ? '#193d48' : '#22374b'}"/><circle cx="1080" cy="130" r="260" fill="#c5aa70" opacity=".18"/><path d="M0 600 Q320 350 640 600 T1280 540 V720 H0" fill="#c5aa70" opacity=".24"/><text x="80" y="220" font-family="sans-serif" font-size="28" fill="#d3bb88">SHUYANG HOME · 演示插画</text><text x="80" y="350" font-family="sans-serif" font-size="48" fill="#fff">${title}</text><text x="80" y="420" font-family="sans-serif" font-size="26" fill="#d7e0e6">在苏州，也在家。一起留下新的乡情记忆。</text></svg>`;
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      state.media[mediaId] = { id: mediaId, name: title + '.svg', size: blob.size, type: blob.type, blob, scope: 'display', ownerId: 'demo-admin', linked: true };
      return { id: mediaId, title, caption: '原创示意插画，非真实活动照片。管理员可上传照片或MP4视频替换。', type: 'image', mediaId, status: 'published', seconds: 10, position: i, updatedAt: now() };
    });
  }
  state.lifeEntries ||= [{ id: 'demo-guide', type: 'guide', title: '第一次参加老乡活动（演示指南）', region: '苏州', category: '活动参与', content: '这是一份演示指南。先浏览活动安排，再报名并查看组织者通知；具体安排以活动详情为准。', ownerId: 'demo-admin', ownerName: '演示管理员', status: 'open', photos: [], checklist: ['确认活动时间与地点', '在活动页面完成报名', '查看组织者发布的出行安排'], sourceName: '平台演示资料', sourceUrl: '', verifiedOn: now().slice(0, 10), createdAt: now(), updatedAt: now(), expired: false }];
  state.lifeChecks ||= {};
}

export function demoExtensions(state, { path, method, body, actor, member, admin }) {
  prepareExtensions(state);
  const read = method === 'GET';
  const publicPerson = row => row.enabled && row.status === 'approved' && row.directoryVisible;
  if (path === '/address-book' && read) {
    member();
    return state.users.filter(row => row.id !== actor.id).map(row => {
      const saved = state.addressContacts.find(r => r.ownerId === actor.id && r.memberId === row.id);
      if (!publicPerson(row) && !saved) return null;
      const view = publicPerson(row) ? { id: row.id, name: row.name, hometown: row.hometown, district: row.district, industry: row.industry, available: true, ...(row.phoneVisible ? { phone: row.phone } : {}) } : { id: row.id, name: '联系人暂不可用', available: false };
      return { ...view, saved: !!saved, group: saved?.group || '', note: saved?.note || '', favorite: !!saved?.favorite, contact: '' };
    }).filter(Boolean);
  }
  const contact = path.match(/^\/address-book\/([^/]+)$/);
  if (contact && ['PUT', 'DELETE'].includes(method)) {
    member();const target = pick(state.users, decodeURIComponent(contact[1]));
    const saved = state.addressContacts.find(r => r.ownerId === actor.id && r.memberId === target.id);
    if (method === 'PUT') {
      if (target.id === actor.id || (!saved && !publicPerson(target))) fail('对方尚未公开资料');
      if (String(body.group || '').length > 30 || String(body.note || '').length > 300) fail('分组最多30字，备注最多300字');
      if (!saved && state.addressContacts.filter(r => r.ownerId === actor.id).length >= 500) fail('最多保存500位联系人');
    }
    state.addressContacts = state.addressContacts.filter(r => r !== saved);
    if (method === 'PUT') state.addressContacts.push({ ownerId: actor.id, memberId: target.id, group: String(body.group || ''), note: String(body.note || ''), favorite: !!body.favorite });
    return true;
  }
  if (path === '/display' && read) {
    const events = state.events.filter(e => e.status === 'published'), categories = new Map();
    events.forEach(e => categories.set(e.category, (categories.get(e.category) || 0) + 1));
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth() - 5 + i);
      const label = d.toISOString().slice(0, 7);return { label, value: events.filter(e => e.startsAt.slice(0, 7) === label).length };
    });
    return { members: state.users.filter(u => u.enabled && u.status === 'approved').length, events: events.length, hours: state.signups.filter(s => s.status === 'checked_in' && events.some(e => e.id === s.eventId)).reduce((n, s) => n + (s.hours || 0), 0), months, categories: [...categories].map(([label, value]) => ({ label, value })), upcoming: events.filter(e => Date.parse(e.endsAt) > Date.now()).sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, 4).map(e => ({ id: e.id, title: e.title, startsAt: e.startsAt, location: e.location })), slides: state.displaySlides.filter(s => s.status === 'published').sort((a, b) => a.position - b.position), updatedAt: now() };
  }
  if (path === '/display/slides') {
    admin();if (read) return state.displaySlides;
    if (method !== 'POST') fail('不支持此操作');
    const media = state.media[body.mediaId], previous = body.id ? pick(state.displaySlides, body.id) : null;
    if (!previous && state.displaySlides.length >= 30) fail('最多保留30条素材');
    if (!media || media.scope !== 'display' || !/^(image|video)\//.test(media.type)) fail('请选择大屏专用照片或视频');
    if (previous?.mediaId !== body.mediaId && (media.ownerId !== actor.id || media.linked)) fail('请上传本人的未发布素材');
    if (!['draft', 'published'].includes(body.status)) fail('请选择有效的展示状态');
    if (body.status === 'published' && body.consent !== true) fail('请确认素材可公开展示');
    if (typeof body.title !== 'string' || body.title.trim().length < 2 || body.title.length > 80 || String(body.caption || '').length > 300) fail('请填写2至80字标题和不超过300字的说明');
    if (!Number.isInteger(body.position) || body.position < 0 || body.position > 999 || !Number.isInteger(body.seconds) || body.seconds < 5 || body.seconds > 60) fail('请检查排序和播放时长');
    const row = { id: previous?.id || crypto.randomUUID(), title: body.title.trim(), caption: String(body.caption || ''), mediaId: media.id, type: media.type.startsWith('video/') ? 'video' : 'image', status: body.status, position: body.position, seconds: body.seconds, updatedAt: now() };
    media.linked = true;state.displaySlides = [row, ...state.displaySlides.filter(s => s.id !== row.id)];return row;
  }
  const slide = path.match(/^\/display\/slides\/([^/]+)$/);
  if (slide && method === 'DELETE') { admin();pick(state.displaySlides, slide[1]);state.displaySlides = state.displaySlides.filter(s => s.id !== slide[1]);return true; }
  // The public demo includes reading guides and maintaining a private checklist.
  if (path === '/life/entries' && read) {
    const scope = body.query.get('scope'), type = body.query.get('type');
    if (scope === 'manage') admin();if (scope === 'mine') member();
    return state.lifeEntries.filter(e => (!type || type === e.type) && (scope !== 'mine' || e.ownerId === actor.id));
  }
  if (path === '/life/mine' && read) { member();return { entries: state.lifeEntries.filter(e => e.ownerId === actor.id), applications: [] }; }
  if (['/life/notifications', '/life/feedback', '/life/pickup'].includes(path) && read) { member();return []; }
  const guide = path.match(/^\/life\/entries\/([^/]+)(\/checklist)?$/);
  if (guide) {
    const entry = pick(state.lifeEntries, guide[1]);if (!guide[2] && read) return entry;
    if (guide[2]) {
      member();const key = actor.id + ':' + entry.id;
      if (method === 'POST') state.lifeChecks[key] = (Array.isArray(body.checked) ? body.checked : []).filter(item => entry.checklist.includes(item));
      return { checked: state.lifeChecks[key] || [] };
    }
  }
  if (path.startsWith('/life/')) fail('在线演示支持浏览指南与个人清单；招聘、帮办、自提等完整流程需运行后端服务。');
  return undefined;
}

export function demoBlobResponse(blob, range) {
  const headers = { 'Content-Type': blob.type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes' };
  if (!range) return new Response(blob, { headers });
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  const invalid = () => new Response(null, { status: 416, headers: { ...headers, 'Content-Range': 'bytes */' + blob.size } });
  if (!match || (!match[1] && !match[2])) return invalid();
  const start = match[1] ? Number(match[1]) : Math.max(0, blob.size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), blob.size - 1) : blob.size - 1;
  if (start >= blob.size || end < start) return invalid();
  return new Response(blob.slice(start, end + 1, blob.type), { status: 206, headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${blob.size}`, 'Content-Length': String(end - start + 1) } });
}
