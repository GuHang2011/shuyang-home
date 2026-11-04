import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { type Row, requestId, localDateInput, fromLocalInput } from './domain';
import { useRequestScope } from './useRequestScope';

type API = (path: string, method?: string, body?: unknown) => Promise<any>;
export const broadcastStates: Record<string, string> = { draft: '草稿', scheduled: '待生效', active: '广播中', expired: '已到期', withdrawn: '已撤下' };
export const canBroadcast = (user: Row | null) => user?.status === 'approved' && ['superadmin', 'admin'].includes(user.role);
export function useBroadcastFeed(getUser: () => Row | null, api: API, foreground: () => boolean = () => true) {
  const rows = ref<Row[]>([]), error = ref(''), loading = ref(false), now = ref(Date.now()), dismissed = ref<string[]>([]), position = ref(0);
  const scope = useRequestScope();let offset = 0, lastFetch = 0, timer: ReturnType<typeof setInterval> | undefined;
  const key = (row: Row) => row.id + ':' + row.revision;
  const visible = computed(() => rows.value.filter(row => Date.parse(row.startsAt) <= now.value && Date.parse(row.endsAt) > now.value && !dismissed.value.includes(key(row))));
  const current = computed(() => visible.value[position.value % Math.max(1, visible.value.length)] || null);
  const active = () => foreground() && (typeof document === 'undefined' || !document.hidden);
  async function refresh() {
    if (loading.value || !active()) return;
    const valid = scope.capture();loading.value = true;lastFetch = Date.now();
    try {
      const data = await api('/broadcasts');if (!valid()) return;
      if (!data || !Array.isArray(data.items) || !Number.isFinite(Date.parse(data.serverTime)) || data.items.some((row: Row) => !row || typeof row.id !== 'string' || typeof row.title !== 'string' || typeof row.content !== 'string' || !Number.isInteger(row.revision) || !Number.isFinite(Date.parse(row.startsAt)) || !Number.isFinite(Date.parse(row.endsAt)))) throw new Error('广播响应异常，请重试');
      offset = Date.parse(data.serverTime) - Date.now();now.value = Date.now() + offset;rows.value = data.items;error.value = '';
    } catch (e) { if (valid()) { rows.value = [];error.value = (e as Error).message; } }
    finally { if (valid()) loading.value = false; }
  }
  function dismiss() { if (current.value) dismissed.value.push(key(current.value)); }
  function next() { position.value++; }
  function tick() { if (!active()) return;now.value = Date.now() + offset;if (Date.now() - lastFetch >= 30000) void refresh(); }
  function resume() { if (active()) { now.value = Date.now() + offset;void refresh(); } }
  watch(() => [getUser()?.id, getUser()?.role], () => { scope.invalidate();loading.value = false;rows.value = [];dismissed.value = [];position.value = 0;error.value = '';void refresh(); }, { flush: 'sync' });
  watch(foreground, value => { if (value) resume(); });
  onMounted(() => { void refresh();timer = setInterval(tick, 1000);if (typeof document !== 'undefined') document.addEventListener?.('visibilitychange', resume); });
  onUnmounted(() => { if (timer) clearInterval(timer);if (typeof document !== 'undefined') document.removeEventListener?.('visibilitychange', resume); });
  return { current, visible, position, error, loading, refresh, dismiss, next, key };
}

export function useBroadcastManager(getUser: () => Row | null, api: API, changed: () => void) {
  const allowed = computed(() => canBroadcast(getUser())), rows = ref<Row[]>([]), form = ref<Row | null>(null), withdrawing = ref<Row | null>(null);
  const error = ref(''), message = ref(''), busy = ref(false), loading = ref(false);const scope = useRequestScope();let listVersion = 0;
  async function load() {
    if (!allowed.value) return;const valid = scope.capture(), version = ++listVersion;loading.value = true;error.value = '';
    try { const data = await api('/admin/broadcasts');if (!valid() || version !== listVersion) return;if (!Array.isArray(data)) throw new Error('广播列表响应异常');rows.value = data; }
    catch (e) { if (valid() && version === listVersion) error.value = (e as Error).message; }
    finally { if (valid() && version === listVersion) loading.value = false; }
  }
  function edit(row?: Row) {
    if (busy.value) return;error.value = '';message.value = '';withdrawing.value = null;
    form.value = row ? { ...row, audio: row.audio || null, startsAt: localDateInput(new Date(row.startsAt)), endsAt: localDateInput(new Date(row.endsAt)) } : { requestId: requestId(), title: '', content: '', startsAt: '', endsAt: localDateInput(new Date(Date.now() + 86400000)), audio: null };
  }
  async function save(status: 'draft' | 'published') {
    if (!form.value || busy.value || !allowed.value) return;
    const target = form.value, valid = scope.capture();busy.value = true;error.value = '';message.value = '';
    try {
      const body = { title: target.title.trim(), content: target.content.trim(), startsAt: target.startsAt ? fromLocalInput(target.startsAt) : '', endsAt: fromLocalInput(target.endsAt), audioId: target.audio?.id || '', status, ...(target.id ? { revision: target.revision } : { requestId: target.requestId }) };
      if (body.title.length < 2 || body.content.length < 2) throw new Error('请填写至少2字的广播标题和文字内容');
      if (Date.parse(body.endsAt) <= Math.max(Date.now(), body.startsAt ? Date.parse(body.startsAt) : 0)) throw new Error('到期时间须晚于生效时间和当前时间');
      const saved = await api('/admin/broadcasts' + (target.id ? '/' + target.id : ''), target.id ? 'PUT' : 'POST', body);
      if (!valid()) return;form.value = null;message.value = '广播已保存' + (broadcastStates[saved?.state] ? '（' + broadcastStates[saved.state] + '）' : '') + '，其他页面将在30秒内更新';changed();await load();
    } catch (e) { if (valid()) error.value = (e as Error).message; }
    finally { if (valid()) busy.value = false; }
  }
  async function withdraw() {
    if (!withdrawing.value || busy.value || !allowed.value) return;const row = withdrawing.value, valid = scope.capture();busy.value = true;error.value = '';message.value = '';
    try { await api('/admin/broadcasts/' + row.id + '/withdraw', 'POST', { revision: row.revision });if (!valid()) return;withdrawing.value = null;message.value = '广播已撤下';changed();await load(); }
    catch (e) { if (valid()) error.value = (e as Error).message; }
    finally { if (valid()) busy.value = false; }
  }
  watch(() => [getUser()?.id, getUser()?.role, getUser()?.status], () => { scope.invalidate();listVersion++;rows.value = [];form.value = null;withdrawing.value = null;busy.value = false;loading.value = false;error.value = '';message.value = '';void load(); }, { flush: 'sync' });
  onMounted(load);
  return { allowed, rows, form, withdrawing, error, message, busy, loading, load, edit, save, withdraw };
}
