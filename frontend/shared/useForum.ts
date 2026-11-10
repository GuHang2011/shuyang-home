import { useRequestScope } from './useRequestScope';
import { computed, onMounted, ref, watch } from 'vue';
import { type Row, forumCategories } from './domain';
import { RAILWAY_BOARD, railwayDiscussionTypes, safeForumSourceUrl } from './railwayForum';

export function useForum(getUser: () => Row | null, api: (path: string, method?: string, body?: unknown) => Promise<any>, getBoard: () => string = () => '') {
  const topics = ref<Row[]>([]), mine = ref<Row[]>([]), managed = ref<Row[]>([]), managedReplies = ref<Row[]>([]), restrictions = ref<Row[]>([]), blocks = ref<Row[]>([]), selected = ref<Row | null>(null), replies = ref<Row[]>([]);
  const tab = ref('public'), category = ref('全部'), query = ref(''), discussionType = ref('全部'), sort = ref('latest');
  const error = ref(''), message = ref(''), busy = ref(false), creating = ref(false), form = ref<Row>({}), reply = ref(''), replyAudio = ref<Row | null>(null), replyPhotos = ref<Row[]>([]), quoted = ref<Row | null>(null), operation = ref<Row | null>(null), note = ref('');
  let generation = 0, detailGeneration = 0;
  const scope = useRequestScope();
  const lockedBoard = computed(() => getBoard().trim());
  const railwayMode = computed(() => (lockedBoard.value || category.value) === RAILWAY_BOARD);
  const moderator = computed(() => {
    const user = getUser();
    if (user?.status !== 'approved' || user.enabled === false) return false;
    if (['superadmin', 'admin', 'organizer'].includes(user.role)) return true;
    return user.role === 'moderator' && (!lockedBoard.value || (Array.isArray(user.forumBoards) && user.forumBoards.includes(lockedBoard.value)));
  });
  // Board scoping is presentation only. The server enforces membership,
  // board assignments, restrictions and moderation authorization.
  function inBoard(row: Row) { return !lockedBoard.value || (row.category || row.board) === lockedBoard.value; }
  function rowsInBoard(rows: Row[] = []) { return rows.filter(inBoard); }
  const visible = computed(() => {
    const rows = rowsInBoard(tab.value === 'mine' ? mine.value : topics.value).filter(t =>
      (tab.value !== 'hot' || t.hot === true) &&
      (lockedBoard.value || category.value === '全部' || t.category === category.value) &&
      (!railwayMode.value || discussionType.value === '全部' || (t.discussionType || railwayDiscussionTypes[0]) === discussionType.value) &&
      (!railwayMode.value || sort.value !== 'unanswered' || Number(t.replyCount || 0) === 0) &&
      [t.title, t.content, t.authorName].join(' ').includes(query.value.trim()));
    if (tab.value === 'mine' && !railwayMode.value) return rows;
    return rows.sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) ||
      ((railwayMode.value ? sort.value === 'replies' : tab.value === 'hot') ? Number(b.replyCount || 0) - Number(a.replyCount || 0) : 0) ||
      (!railwayMode.value ? String(b.pinnedAt || '').localeCompare(String(a.pinnedAt || '')) : 0) ||
      String(b.createdAt).localeCompare(String(a.createdAt)) || String(a.id).localeCompare(String(b.id)));
  });
  async function load() {
    const version = ++generation, valid = scope.capture();
    const current = () => version === generation && valid();
    error.value = '';
    try {
      const rows = await api('/forum/topics');
      if (!current()) return;
      topics.value = rowsInBoard(rows);
      if (getUser()?.status === 'approved') {
        const [own, blocked] = await Promise.all([api('/my/forum'), api('/my/blocks')]);
        if (!current()) return;
        mine.value = rowsInBoard(own);blocks.value = blocked;
        if (moderator.value) {
          const [queue, bans] = await Promise.all([api('/admin/forum'), api('/forum/restrictions')]);
          if (!current()) return;
          managed.value = rowsInBoard(queue.topics);
          const parentBoards = new Map<string, string>((queue.topics || []).map((t: Row) => [t.id, t.category]));
          managedReplies.value = rowsInBoard((queue.replies || []).map((r: Row) => ({ ...r, category: parentBoards.get(r.topicId) })));
          restrictions.value = rowsInBoard(bans);
        }
      }
    } catch (e) { if (current()) error.value = (e as Error).message; }
  }
  async function detail(row: Row) {
    const valid = scope.capture(), version = ++detailGeneration;
    selected.value = null;replies.value = [];reply.value = '';quoted.value = null;replyAudio.value = null;replyPhotos.value = [];
    error.value = '';
    if (lockedBoard.value && row.category && !inBoard(row)) { error.value = '该话题不属于当前板块';return; }
    const current = () => valid() && version === detailGeneration;
    try {
      const data = await api('/forum/topics/' + encodeURIComponent(row.id));
      if (!current()) return;
      if (!data.topic || data.topic.id !== row.id || !inBoard(data.topic)) throw Error('该话题不属于当前板块或已不可见');
      const topic = { ...data.topic };
      if (lockedBoard.value && topic.forwarded && !topic.forwarded.unavailable && !inBoard(topic.forwarded)) topic.forwarded = { unavailable: true };
      selected.value = topic;
      replies.value = (data.replies || []).filter((r: Row) => r.topicId === topic.id).map((r: Row) => ({ ...r, category: topic.category }));
      creating.value = false;
    } catch (e) { if (current()) { selected.value = null;replies.value = [];error.value = (e as Error).message; } }
  }
  function create(source?: Row) {
    ++detailGeneration;
    if (source && !inBoard(source)) { error.value = '请在当前板块中选择要转发的话题';return; }
    form.value = { title: source ? ('转发 · ' + source.title).slice(0, 80) : '', category: lockedBoard.value || forumCategories[0], content: '', audio: null, photos: [], forwardedTopicId: source?.id || '', discussionType: source?.discussionType || railwayDiscussionTypes[0], sourceName: source?.sourceName || '', sourceUrl: source?.sourceUrl || '' };
    creating.value = true;selected.value = null;error.value = '';
  }
  async function post() {
    if (busy.value) return;
    const current = scope.capture();busy.value = true;error.value = '';
    try {
      const payload: Row = { ...form.value, category: lockedBoard.value || form.value.category, audioId: form.value.audio?.id || '', photoIds: (form.value.photos || []).map((p: Row) => p.id) };
      if (payload.category === RAILWAY_BOARD) {
        payload.discussionType = payload.discussionType || railwayDiscussionTypes[0];
        if (!railwayDiscussionTypes.includes(payload.discussionType)) throw Error('请选择有效的高铁话题类型');
        payload.sourceName = String(payload.sourceName || '').trim();payload.sourceUrl = String(payload.sourceUrl || '').trim();
        if (payload.sourceName.length > 100 || payload.sourceUrl.length > 1000) throw Error('来源名称最多100字，链接最多1000字');
        if (!!payload.sourceName !== !!payload.sourceUrl) throw Error('来源名称和链接请同时填写，也可以全部留空');
        if (payload.sourceUrl && !safeForumSourceUrl(payload.sourceUrl)) throw Error('来源链接请填写有效的 http 或 https 地址');
      } else { delete payload.discussionType;delete payload.sourceName;delete payload.sourceUrl; }
      await api('/forum/topics', 'POST', payload);
      if (!current()) return;
      creating.value = false;tab.value = 'mine';message.value = '已提交审核';await load();
    } catch (e) { if (current()) error.value = (e as Error).message; }
    finally { if (current()) busy.value = false; }
  }
  async function respond() {
    if (!selected.value || busy.value) return;
    const target = selected.value;
    if (!inBoard(target)) { error.value = '该话题不属于当前板块';return; }
    if (quoted.value && !replies.value.some(r => r.id === quoted.value?.id)) { error.value = '引用的回复已不可见，请重新选择';return; }
    const current = scope.capture();busy.value = true;error.value = '';
    try {
      await api('/forum/topics/' + encodeURIComponent(target.id) + '/replies', 'POST', { content: reply.value, audioId: replyAudio.value?.id || '', photoIds: replyPhotos.value.map(p => p.id), parentId: quoted.value?.id || '' });
      if (!current()) return;
      if (selected.value?.id === target.id) await detail(target);
      if (!current()) return;
      message.value = '回复已提交审核';await load();
    } catch (e) { if (current()) error.value = (e as Error).message; }
    finally { if (current()) busy.value = false; }
  }
  const labels: Record<string, string> = { approved: '审核通过／恢复', rejected: '退回内容', hidden: '隐藏内容', delete: '删除内容', mute: '板块禁言', kick: '移出版块', restore: '恢复板块参与', block: '拉黑会员', unblock: '取消拉黑', lock: '关闭话题回复', pin: '置顶话题', unpin: '取消置顶', hot: '设为热帖', unhot: '取消热帖' };
  function ask(row: Row, action: string, kind = 'topics') {
    if (action !== 'unblock' && !inBoard(row)) { error.value = '该内容不属于当前板块';return; }
    operation.value = { row, action, kind, title: labels[action] };note.value = '';error.value = '';
  }
  async function perform() {
    if (busy.value || !operation.value) return;
    const { row, action, kind } = operation.value;
    if (action !== 'unblock' && !inBoard(row)) { operation.value = null;error.value = '该内容不属于当前板块';return; }
    const current = scope.capture();busy.value = true;error.value = '';
    try {
      if (['pin', 'unpin', 'hot', 'unhot'].includes(action)) await api('/forum/topics/' + row.id + '/promotion', 'PUT', { revision: row.promotionRevision || 0, ...(['pin', 'unpin'].includes(action) ? { pinned: action === 'pin' } : { hot: action === 'hot' }) });
      else if (['approved', 'rejected', 'hidden'].includes(action)) await api('/forum/' + kind + '/' + row.id + '/review', 'POST', { status: action, note: note.value });
      else if (action === 'delete') await api('/forum/' + kind + '/' + row.id + '/delete', 'POST', { note: note.value });
      else if (action === 'lock') await api('/forum/topics/' + row.id + '/lock', 'POST');
      else if (action === 'block' || action === 'unblock') await api('/members/' + (row.authorId || row.id) + '/block', 'POST', { active: action === 'block' });
      else await api('/forum/restrictions', 'POST', { userId: row.authorId || row.userId, board: lockedBoard.value || row.category || row.board, action, reason: note.value });
      if (!current()) return;
      operation.value = null;message.value = '操作已完成';
      if (action === 'delete' || action === 'block') selected.value = null;
      await load();if (current() && selected.value) await detail(selected.value);
    } catch (e) { if (current()) error.value = (e as Error).message; }
    finally { if (current()) busy.value = false; }
  }
  watch([() => getUser()?.id, () => getUser()?.role, () => getUser()?.status, () => getUser()?.enabled, () => JSON.stringify(getUser()?.forumBoards || []), lockedBoard], () => {
    scope.invalidate();++generation;++detailGeneration;
    busy.value = false;error.value = '';message.value = '';tab.value = 'public';category.value = '全部';query.value = '';discussionType.value = '全部';sort.value = 'latest';
    topics.value = [];replies.value = [];form.value = {};reply.value = '';replyAudio.value = null;replyPhotos.value = [];quoted.value = null;note.value = '';
    selected.value = null;creating.value = false;operation.value = null;mine.value = [];blocks.value = [];managed.value = [];managedReplies.value = [];restrictions.value = [];
    void load();
  }, { flush: 'sync' });
  onMounted(load);
  return { topics, mine, managed, managedReplies, restrictions, blocks, selected, replies, tab, category, query, discussionType, sort, lockedBoard, railwayMode, error, message, busy, creating, form, reply, replyAudio, replyPhotos, quoted, operation, note, moderator, visible, load, detail, create, post, respond, ask, perform };
}
