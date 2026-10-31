import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { type Row, requestId } from './domain';
import { type Sticker } from './useStickers';
type Api = (path: string, method?: string, body?: unknown) => Promise<any>;
export const chatStates: Record<string, string> = { pending: '等待接受', active: '可以聊天', rejected: '申请未接受', cancelled: '申请已取消', blocked: '会话已屏蔽', closed: '群聊已结束' };
export function useChat(getUser: () => Row | null, api: Api, pageVisible: () => boolean = () => true) {
  const isVisible = () => pageVisible() && (typeof document === 'undefined' || !document.hidden);
  const rooms = ref<Row[]>([]), groups = ref<Row[]>([]), people = ref<Row[]>([]), active = ref<Row | null>(null), messages = ref<Row[]>([]);
  const attachment = ref<Row | null>(null), sticker = ref<Sticker | null>(null);
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
      messages.value = messages.value.map(row => recalled.has(row.id) ? { ...row, recalled: true, content: undefined, attachment: undefined, sticker: undefined, stickerOnly: undefined } : row);
    } catch(e) { if (version === generation) error.value = (e as Error).message; } finally { if (version === generation) reading = false; }
  }
  async function select(room: Row) { const version = ++generation;reading = false;busy.value = false;active.value = room;messages.value = [];hasMore.value = false;draft.value = '';attachment.value = null;sticker.value = null;error.value = '';loading.value = true;sendId = '';try { await detail(room.id);if (version === generation) await refresh(); }finally { if (version === generation) loading.value = false; } }
  async function action(id: string, action: string) {
    if (busy.value) return;const version = generation;busy.value = true;error.value = '';
    try { await api('/chat/conversations/' + id + '/action', 'POST', { action });if (version !== generation) return;if (action === 'leave' && active.value?.id === id) { active.value = null;messages.value = []; }else if (action === 'join') { await select({ id });return; }else if (active.value?.id === id) await detail(id);if (version === generation) await refresh(); }
    catch(e) { if (version === generation) error.value = (e as Error).message; }finally { if (version === generation) busy.value = false; }
  }
  async function send() {
    if (busy.value || (!draft.value.trim() && !attachment.value && !sticker.value) || !canSend.value || !active.value) return;
    if (sticker.value && attachment.value) { error.value = '表情和附件请分开发送';return; }
    const content = draft.value.trim(), attachmentId = attachment.value?.id || '', stickerId = sticker.value?.id || '', signature = JSON.stringify([content, attachmentId, stickerId]), id = active.value.id, version = generation;
    if (!sendId || signature !== sendContent) { sendId = requestId();sendContent = signature; }
    busy.value = true;error.value = '';
    try { await api('/chat/conversations/' + id + '/messages', 'POST', { content, attachmentId, stickerId, requestId: sendId });if (version !== generation) return;if (draft.value.trim() === content) draft.value = '';if ((attachment.value?.id || '') === attachmentId) attachment.value = null;if ((sticker.value?.id || '') === stickerId) sticker.value = null;sendId = '';await detail(id);if (version === generation) await refresh(); }
    catch(e) { if (version === generation) error.value = (e as Error).message; }finally { if (version === generation) busy.value = false; }
  }
  async function recall(row: Row) { if (busy.value) return;const version = generation;busy.value = true;error.value = '';try { await api('/chat/messages/' + encodeURIComponent(row.id) + '/recall', 'POST');if (version !== generation) return;if (active.value) await detail(active.value.id);if (version === generation) await refresh(); }catch(e) { if (version === generation) error.value = (e as Error).message; }finally { if (version === generation) busy.value = false; } }
  async function loadPeople() { const version = generation;try { const data = await api('/members');if (version === generation) people.value = data.filter((p: Row) => p.id !== getUser()?.id); }catch(e) { if (version === generation) error.value = (e as Error).message; } }
  async function create(kind: string, form: Row) { if (busy.value) return false;const version = generation;busy.value = true;error.value = '';try { const room = await api(kind === 'direct' ? '/chat/direct' : '/chat/groups', 'POST', form);if (version !== generation) return false;const selectedVersion = generation + 1;await select(room);return generation === selectedVersion; }catch(e) { if (version === generation) error.value = (e as Error).message;return false; }finally { if (version === generation) busy.value = false; } }
  function back() { ++generation;reading = false;busy.value = false;loading.value = false;hasMore.value = false;draft.value = '';sendId = '';attachment.value = null;sticker.value = null;active.value = null;messages.value = [];error.value = ''; }
  watch([() => getUser()?.id, () => getUser()?.status], () => { back();rooms.value = [];groups.value = [];people.value = [];refresh(); }, { flush: 'sync' });
  onMounted(() => { refresh();timer = setInterval(async () => { if (!isVisible() || getUser()?.status !== 'approved' || busy.value) return;const version = generation;await refresh();if (version === generation && active.value && isVisible()) await detail(active.value.id); }, 4000); });
  onUnmounted(() => { ++generation;clearInterval(timer); });
  return { attachment, sticker, rooms, groups, people, active, messages, draft, error, busy, loading, hasMore, canSend, refresh, select, detail, action, send, recall, loadPeople, create, back };
}
export function useChatUnread(getUser: () => Row | null, api: Api, pageVisible: () => boolean = () => true) {
  const unread = ref(0);let timer: ReturnType<typeof setInterval>, generation = 0;
  const isVisible = () => pageVisible() && (typeof document === 'undefined' || !document.hidden);
  async function refreshUnread() { const version = ++generation;if (getUser()?.status !== 'approved' || getUser()?.mustChangePassword) { unread.value = 0;return; }if (!isVisible()) return;try { const data = await api('/chat/unread');if (version === generation) unread.value = data.count; }catch { /* Keep the last known count during temporary network failures. */ } }
  watch([() => getUser()?.id, () => getUser()?.status, () => getUser()?.mustChangePassword], () => { unread.value = 0;refreshUnread(); }, { flush: 'sync' });
  watch(pageVisible, visible => { if (visible) refreshUnread(); });
  onMounted(() => { refreshUnread();timer = setInterval(refreshUnread, 6000); });
  onUnmounted(() => { ++generation;clearInterval(timer); });
  return { unread, refreshUnread };
}
