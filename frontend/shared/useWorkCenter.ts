import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { type Row } from './domain';
import { useRequestScope } from './useRequestScope';

type Api = (path: string, method?: string, body?: unknown) => Promise<any>;
export type WorkMode = 'mine' | 'manage' | 'notices';
export const workKinds = [{ id: 'all', label: '全部类型' }, ...Object.entries({ life_entry: '生活服务', user: '入会申请', signup: '活动报名', post: '互助信息', order: '特产订单', exchange: '资源交换', contact_exchange: '联系方式交换', crowd_pledge: '爱心认领', event_proposal: '活动申请', forum_topic: '论坛主题', forum_reply: '论坛回帖', resource: '资源发布', advertisement: '合作广告', crowd_project: '众筹项目' }).map(([id, label]) => ({ id, label }))];
export const workSections = [{ id: 'all', label: '全部事项' }, { id: 'action', label: '需要我处理' }, { id: 'waiting', label: '等待对方' }, { id: 'upcoming', label: '近期安排' }, { id: 'done', label: '已结束' }];
export const helpProgress: Record<string, string> = { open: '还需要帮助', helping: '处理中', resolved: '已解决', expired: '已过期', closed: '已关闭' };
export function useHelpDiscovery(getPosts: () => Row[], getCategory: () => string, getQuery: () => string) {
  const progress = ref('active'), district = ref('');
  const rows = computed(() => getPosts().filter(p => {
    const state = p.progressState || 'open', text = [p.title, p.content].join(' ').toLocaleLowerCase();
    return (getCategory() === '全部' || p.category === getCategory()) && text.includes(getQuery().trim().toLocaleLowerCase())
      && (p.district || '').toLocaleLowerCase().includes(district.value.trim().toLocaleLowerCase())
      && (progress.value === 'all' || (progress.value === 'active' ? ['open', 'helping'].includes(state) : state === progress.value));
  }));
  return { progress, district, rows };
}
export function useWorkCenter(getUser: () => Row | null, getMode: () => WorkMode, api: Api, updated: () => void = () => {}) {
  const scope = useRequestScope();let listVersion = 0, detailVersion = 0;
  const rows = ref<Row[]>([]), total = ref(0), page = ref(1), pages = ref(1), counts = ref<Row>({}), through = ref(0);
  const filter = ref('all'), kind = ref('all'), loading = ref(false), busy = ref(false), error = ref(''), detailError = ref(''), message = ref('');
  const selected = ref<Row | null>(null), pending = ref<Row | null>(null), form = ref<Row>({}), editing = ref(false), editForm = ref<Row>({}), opening = ref(false), target = ref<Row | null>(null);
  const allowed = computed(() => !!getUser() && !getUser()?.mustChangePassword);
  const filters = computed(() => getMode() === 'mine' ? workSections : getMode() === 'manage' ? [{ id: 'all', label: '全部待办' }, { id: 'overdue', label: '等待超过24小时' }] : [{ id: 'all', label: '全部通知' }, { id: 'unread', label: '未读通知' }]);
  function clearDetail() { ++detailVersion;selected.value = null;pending.value = null;target.value = null;editing.value = false;form.value = {};editForm.value = {};detailError.value = '';opening.value = false; }
  function reset() { scope.invalidate();++listVersion;rows.value = [];total.value = 0;counts.value = {};through.value = 0;page.value = 1;pages.value = 1;loading.value = false;busy.value = false;error.value = '';message.value = '';clearDetail(); }
  async function load() {
    if (!allowed.value) return;const current = scope.capture(), version = ++listVersion;loading.value = true;error.value = '';rows.value = [];
    const url = getMode() === 'notices' ? '/work/notices?unread=' + (filter.value === 'unread') : '/work/items?manage=' + (getMode() === 'manage') + '&filter=' + encodeURIComponent(filter.value) + '&kind=' + encodeURIComponent(kind.value);
    try { const data = await api(url + '&page=' + page.value);if (!current() || version !== listVersion) return;
      if (!Array.isArray(data?.items) || !Number.isInteger(data.total) || !Number.isInteger(data.page) || !Number.isInteger(data.pages)) throw new Error('事项列表暂不可用，请重试');
      rows.value = data.items;total.value = data.total;page.value = data.page;pages.value = data.pages;counts.value = data.counts || {};through.value = data.through || 0;
    } catch (e) { if (current() && version === listVersion) error.value = (e as Error).message; }
    finally { if (current() && version === listVersion) loading.value = false; }
  }
  async function open(row: Row) {
    if (!allowed.value || busy.value) return;clearDetail();target.value = row;const current = scope.capture(), version = detailVersion;opening.value = true;
    try { const data = await api('/work/target?kind=' + encodeURIComponent(row.kind) + '&id=' + encodeURIComponent(row.targetId || row.id) + '&manage=' + (getMode() === 'manage'));
      if (!current() || version !== detailVersion) return;
      if (!data || !Array.isArray(data.fields) || !Array.isArray(data.actions)) throw new Error('事项详情暂不可用，请重试');
      selected.value = data;
      if (getMode() === 'notices' && !row.read) { await api('/work/notices/' + encodeURIComponent(row.id) + '/read', 'POST');if (current() && version === detailVersion) { row.read = true;updated(); } }
    } catch (e) { if (current() && version === detailVersion) detailError.value = (e as Error).message; }
    finally { if (current() && version === detailVersion) opening.value = false; }
  }
  function choose(action: Row) { if (busy.value) return;pending.value = action;editing.value = false;form.value = { ...(action.body || {}), ...(action.field ? { [action.field]: '' } : {}) };detailError.value = '';message.value = ''; }
  function edit() { if (!selected.value?.editForm || busy.value) return;editing.value = true;pending.value = null;editForm.value = { validDays: 30, ...selected.value.editForm };detailError.value = ''; }
  async function submit() {
    if (!allowed.value || busy.value || !selected.value || (!pending.value && !editing.value)) return;
    const action = pending.value, isEdit = editing.value, row = target.value!, current = scope.capture(), version = detailVersion;
    const body = isEdit ? { ...editForm.value } : { ...form.value };
    if (isEdit && (!body.title?.trim() || !body.content?.trim() || body.title.trim().length < 2 || body.content.trim().length < 10)) { detailError.value = '标题至少2字，内容至少10字';return; }
    if (action?.field && (String(body[action.field] || '').trim().length < action.min || String(body[action.field] || '').length > action.max)) { detailError.value = action.hint + '，请检查填写长度';return; }
    busy.value = true;detailError.value = '';message.value = '';
    try {
      await api(isEdit ? '/help-posts/' + encodeURIComponent(selected.value.id) : action!.url, isEdit ? 'PUT' : 'POST', body);
      if (!current() || version !== detailVersion) return;
      pending.value = null;editing.value = false;message.value = isEdit ? '修改已提交审核，审核通过后公开展示。' : '操作已完成';updated();
      busy.value = false;await open(row);if (current()) await load();
    } catch (e) { if (current() && version === detailVersion) detailError.value = (e as Error).message; }
    finally { if (current()) busy.value = false; }
  }
  async function markRead(row?: Row) {
    if (!allowed.value || busy.value || getMode() !== 'notices' || loading.value || error.value) return;
    const current = scope.capture();busy.value = true;error.value = '';
    try { await api(row ? '/work/notices/' + encodeURIComponent(row.id) + '/read' : '/work/notices/read-through', 'POST', row ? undefined : { through: through.value });if (!current()) return;updated();await load(); }
    catch (e) { if (current()) error.value = (e as Error).message; }
    finally { if (current()) busy.value = false; }
  }
  function selectFilter(id: string) { if (busy.value) return;filter.value = id;page.value = 1;clearDetail();load(); }
  function selectKind(id: string) { if (busy.value) return;kind.value = id;page.value = 1;clearDetail();load(); }
  function turn(next: number) { if (busy.value || loading.value) return;page.value = next;clearDetail();load(); }
  watch([() => getUser()?.id, () => getUser()?.role, () => getUser()?.status, () => getUser()?.mustChangePassword, () => JSON.stringify(getUser()?.forumBoards || []), getMode], () => { reset();filter.value = 'all';kind.value = 'all';load(); }, { immediate: true, flush: 'sync' });
  return { rows, total, page, pages, counts, filter, kind, filters, loading, busy, error, detailError, message, selected, pending, form, editing, editForm, opening, target, allowed, load, open, clearDetail, choose, edit, submit, markRead, selectFilter, selectKind, turn };
}
export function useWorkSummary(getUser: () => Row | null, api: Api, visible: () => boolean = () => true) {
  const summary = ref<Row | null>(null), summaryError = ref(false);let generation = 0, timer: ReturnType<typeof setInterval>;
  async function refreshSummary() {
    const version = ++generation;if (!getUser() || getUser()?.mustChangePassword) { summary.value = null;return; }
    if (!visible() || (typeof document !== 'undefined' && document.hidden)) return;
    try { const data = await api('/work/summary');if (version === generation) { summary.value = data;summaryError.value = false; } }
    catch { if (version === generation) summaryError.value = true; }
  }
  watch([() => getUser()?.id, () => getUser()?.role, () => getUser()?.status, () => getUser()?.mustChangePassword, () => JSON.stringify(getUser()?.forumBoards || [])], () => { summary.value = null;summaryError.value = false;refreshSummary(); }, { flush: 'sync' });
  watch(visible, value => { if (value) refreshSummary(); });
  onMounted(() => { refreshSummary();timer = setInterval(refreshSummary, 15000); });
  onUnmounted(() => { ++generation;clearInterval(timer); });
  return { summary, summaryError, refreshSummary };
}
