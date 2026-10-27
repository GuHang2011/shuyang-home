import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { type Row, requestId } from './domain';
type Api = (path: string, method?: string, body?: unknown) => Promise<any>;
export const chatStates: Record<string, string> = { pending: '等待接受', active: '可以聊天', rejected: '申请未接受', cancelled: '申请已取消', blocked: '会话已屏蔽', closed: '群聊已结束' };
export function useChat(getUser: () => Row | null, api: Api, pageVisible: () => boolean = () => true) {
  const isVisible = () => pageVisible() && (typeof document === 'undefined' || !document.hidden);
  const rooms = ref<Row[]>([]), groups = ref<Row[]>([]), people = ref<Row[]>([]), active = ref<Row | null>(null), messages = ref<Row[]>([]);
  const attachment = ref<Row | null>(null);
  const draft = ref(''), error = ref(''), busy = ref(false), loading = ref(false), hasMore = ref(false);
  const canSend = computed(() => active.value?.status === 'active' && active.value?.peerAvailable !== false);
  let generation = 0, reading = false, sendId = '', sendContent = '', timer: ReturnType<typeof setInterval>;
  async function refresh() {
    if (getUser()?.status !== 'approved') return;
    const version = generation;
    try { const data = await Promise.all([api('/chat/conversations'), api('/chat/groups')]);if (version !== generation) return;[rooms.value, groups.value] = data; }
    catch(e) { if (version === generation) error.value = (e as Error).message; }
  }
  async function detail(id: string, older = false) {
    if (reading) return;reading = true;const version = generation;
    try {
      const before = older && messages.value.length ? '?before=' + messages.value[0].sequence : '';
      const data = await api('/chat/conversations/' + id + before);
      if (version !== generation || active.value?.id !== id) return;
      if (older) { messages.value = [...data.messages, ...messages.value];hasMore.value = data.hasMore; }
      else {
        const previous = messages.value.filter(m => m.sequence < (data.messages[0]?.sequence ?? Infinity));
        messages.value = [...previous, ...data.messages];hasMore.value = previous.length ? hasMore.value : data.hasMore;
        active.value = data;
        const last = data.messages[data.messages.length - 1]?.sequence || 0;
        if (isVisible() && last > data.lastRead) await api('/chat/conversations/' + id + '/read', 'POST', { sequence: last });
      }
      if (version !== generation || active.value?.id !== id) return;
      const recalled = new Set(data.recalledIds || []);
      messages.value = messages.value.map(row => recalled.has(row.id) ? { ...row, recalled: true, content: undefined, attachment: undefined } : row);
    } catch(e) { if (version === generation) error.value = (e as Error).message; } finally { if (version === generation) reading = false; }
  }
  async function select(room: Row) { ++generation;reading = false;active.value = room;messages.value = [];draft.value = '';attachment.value = null;error.value = '';loading.value = true;sendId = '';try { await detail(room.id);await refresh(); }finally { loading.value = false; } }
  async function action(id: string, action: string) {
    if (busy.value) return;busy.value = true;error.value = '';
    try { await api('/chat/conversations/' + id + '/action', 'POST', { action });if (action === 'leave') { active.value = null;messages.value = []; }else if (action === 'join') { await select({ id }); }else if (active.value?.id === id) await detail(id);await refresh(); }
    catch(e) { error.value = (e as Error).message; }finally { busy.value = false; }
  }
  async function send() {
    if (busy.value || (!draft.value.trim() && !attachment.value) || !canSend.value || !active.value) return;
    const content = draft.value.trim(), attachmentId = attachment.value?.id || '', signature = content + '|' + attachmentId, id = active.value.id, version = generation;
    if (!sendId || signature !== sendContent) { sendId = requestId();sendContent = signature; }
    busy.value = true;error.value = '';
    try { await api('/chat/conversations/' + id + '/messages', 'POST', { content, attachmentId, requestId: sendId });if (version !== generation) return;draft.value = '';attachment.value = null;sendId = '';await detail(id);await refresh(); }
    catch(e) { if (version === generation) error.value = (e as Error).message; }finally { busy.value = false; }
  }
  async function recall(row: Row) { if (busy.value) return;busy.value = true;try { await api('/chat/messages/' + encodeURIComponent(row.id) + '/recall', 'POST');if (active.value) await detail(active.value.id);await refresh(); }catch(e) { error.value = (e as Error).message; }finally { busy.value = false; } }
  async function loadPeople() { const version = generation;try { const data = await api('/members');if (version === generation) people.value = data.filter((p: Row) => p.id !== getUser()?.id); }catch(e) { if (version === generation) error.value = (e as Error).message; } }
  async function create(kind: string, form: Row) { if (busy.value) return false;busy.value = true;error.value = '';try { const room = await api(kind === 'direct' ? '/chat/direct' : '/chat/groups', 'POST', form);await select(room);return true; }catch(e) { error.value = (e as Error).message;return false; }finally { busy.value = false; } }
  function back() { ++generation;attachment.value = null;active.value = null;messages.value = [];error.value = ''; }
  watch([() => getUser()?.id, () => getUser()?.status], () => { ++generation;rooms.value = [];groups.value = [];people.value = [];messages.value = [];active.value = null;draft.value = '';attachment.value = null;error.value = '';reading = false;refresh(); });
  onMounted(() => { refresh();timer = setInterval(async () => { if (!isVisible() || getUser()?.status !== 'approved' || busy.value) return;await refresh();if (active.value && isVisible()) await detail(active.value.id); }, 4000); });
  onUnmounted(() => { ++generation;clearInterval(timer); });
  return { attachment, rooms, groups, people, active, messages, draft, error, busy, loading, hasMore, canSend, refresh, select, detail, action, send, recall, loadPeople, create, back };
}
export function useChatUnread(getUser: () => Row | null, api: Api) {
  const unread = ref(0);let timer: ReturnType<typeof setInterval>, generation = 0;
  async function refreshUnread() { const version = ++generation;if (getUser()?.status !== 'approved' || getUser()?.mustChangePassword) { unread.value = 0;return; }try { const data = await api('/chat/unread');if (version === generation) unread.value = data.count; }catch { if (version === generation) unread.value = 0; } }
  watch([() => getUser()?.id, () => getUser()?.status, () => getUser()?.mustChangePassword], refreshUnread);
  onMounted(() => { refreshUnread();timer = setInterval(refreshUnread, 6000); });
  onUnmounted(() => { ++generation;clearInterval(timer); });
  return { unread, refreshUnread };
}
