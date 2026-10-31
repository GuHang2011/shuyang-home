import { computed, ref, watch } from 'vue';
import { type Row } from './domain';
import { useRequestScope } from './useRequestScope';

export type WorkbookFile = { filename: string; base64: string; mime?: string };
export type BusinessReport = { title: string; headers: string[]; rows: string[][]; total: number; generatedAt: string; filter: { query: string; status: string } };
type Api = (path: string, method?: string, body?: unknown) => Promise<any>;
export const fileInstructions: Record<string, string> = {
  members: '按会员编号更新普通会员的姓名、家乡、现居地、行业和简介。可选字段留空会清除原值；不新增账号，不修改手机、权限或隐私设置。',
  signups: '先选择活动，再按会员编号填写“报名”或“取消报名”。请确认会员参与意愿；只处理尚未开始、开放报名的活动，名额与签到规则仍有效。',
  orders: '按订单号填写“发货”或“备妥自提”，并填写5—300字的履约说明。只处理已确认订单，不创建订单，也不更改付款、价格或库存。'
};
export const fileStatuses: Record<string, { id: string; label: string }[]> = {
  members: [{ id: 'pending', label: '待审核' }, { id: 'approved', label: '已通过' }, { id: 'rejected', label: '已退回' }, { id: 'disabled', label: '已停用' }],
  signups: [{ id: 'registered', label: '已报名' }, { id: 'checked_in', label: '已签到' }, { id: 'cancelled', label: '已取消' }],
  orders: [{ id: 'pending', label: '待确认' }, { id: 'confirmed', label: '已确认' }, { id: 'shipped', label: '已发货' }, { id: 'ready', label: '待自提' }, { id: 'completed', label: '已完成' }, { id: 'cancelled', label: '已取消' }]
};
export function useBusinessFiles(getUser: () => Row | null, api: Api, save: (file: WorkbookFile) => Promise<void>, print: (report: BusinessReport) => Promise<void>, updated: () => void = () => {}) {
  const scope = useRequestScope();let reportRevision = 0;
  const kinds = ref<Row[]>([]), events = ref<Row[]>([]), kind = ref(''), eventId = ref(''), query = ref(''), status = ref('all');
  const report = ref<BusinessReport | null>(null), preview = ref<Row | null>(null), filename = ref(''), confirmed = ref(false);
  const busy = ref(false), loading = ref(false), error = ref(''), message = ref(''), page = ref(1);
  const allowed = computed(() => getUser()?.status === 'approved' && ['superadmin', 'admin', 'organizer'].includes(getUser()?.role) && !getUser()?.mustChangePassword);
  const rows = computed(() => report.value?.rows.slice((page.value - 1) * 20, page.value * 20) || []);
  const pages = computed(() => Math.max(1, Math.ceil((report.value?.total || 0) / 20)));
  const canCommit = computed(() => !!preview.value?.token && preview.value.invalid === 0 && preview.value.changes > 0 && confirmed.value && !busy.value);
  const selection = computed(() => kind.value && (kind.value !== 'signups' || eventId.value));
  function path(action: string) { return '/data-files/' + action + '?kind=' + encodeURIComponent(kind.value) + '&eventId=' + encodeURIComponent(eventId.value) + '&query=' + encodeURIComponent(query.value) + '&status=' + encodeURIComponent(status.value); }
  function clear() { scope.invalidate();++reportRevision;report.value = null;preview.value = null;filename.value = '';confirmed.value = false;error.value = '';message.value = '';busy.value = false;loading.value = false;page.value = 1; }
  async function loadReport() {
    if (!allowed.value || !selection.value) return;
    const current = scope.capture(), revision = ++reportRevision;loading.value = true;error.value = '';report.value = null;page.value = 1;
    try { const data = await api(path('report'));if (!current() || revision !== reportRevision) return;
      if (!data || !Array.isArray(data.headers) || !Array.isArray(data.rows) || data.total !== data.rows.length) throw new Error('报表响应异常，请重新加载');
      report.value = data;
    } catch (e) { if (current() && revision === reportRevision) error.value = (e as Error).message; }
    finally { if (current() && revision === reportRevision) loading.value = false; }
  }
  async function loadOptions() {
    if (!allowed.value) return;const current = scope.capture();loading.value = true;error.value = '';
    try { const data = await api('/data-files/options');if (!current()) return;
      if (!Array.isArray(data?.kinds) || !data.kinds.length || !Array.isArray(data.events)) throw new Error('文件功能暂不可用，请重新加载');
      kinds.value = data.kinds;events.value = data.events;kind.value = data.kinds[0].id;
      await loadReport();
    } catch (e) { if (current()) error.value = (e as Error).message; }
    finally { if (current()) loading.value = false; }
  }
  async function task(work: (current: () => boolean) => Promise<void>) {
    if (busy.value || !allowed.value) return;const current = scope.capture();busy.value = true;error.value = '';message.value = '';
    try { await work(current); } catch (e) { if (current()) error.value = (e as Error).message; }
    finally { if (current()) busy.value = false; }
  }
  async function download(template = false) { if (!kind.value || (!template && !report.value)) return;await task(async current => { const file = await api(path(template ? 'template' : 'export'));if (current()) await save(file); }); }
  async function printReport() { if (!report.value || loading.value) return;const selected = report.value;await task(async current => { if (current()) await print(selected); }); }
  async function chooseFile(read: () => Promise<WorkbookFile | null>) {
    if (!selection.value) return;
    await task(async current => {
      preview.value = null;confirmed.value = false;filename.value = '';
      const file = await read();if (!current() || !file) return;filename.value = file.filename;
      const data = await api('/data-files/preview', 'POST', { kind: kind.value, eventId: eventId.value, ...file });
      if (current()) preview.value = data;
    });
  }
  async function commit() {
    if (!canCommit.value) return;const token = preview.value!.token;
    await task(async current => {
      const result = await api('/data-files/commit', 'POST', { token, confirmed: true });if (!current()) return;
      preview.value = null;confirmed.value = false;filename.value = '';message.value = `已完成导入，更新 ${result.count} 条记录。`;
      updated();await loadReport();
    });
  }
  watch([kind, eventId, query, status], clear, { flush: 'sync' });
  watch([() => getUser()?.id, () => getUser()?.role, () => getUser()?.status, () => getUser()?.mustChangePassword], () => {
    clear();kinds.value = [];events.value = [];kind.value = '';eventId.value = '';query.value = '';status.value = 'all';loadOptions();
  }, { immediate: true, flush: 'sync' });
  function selectKind(value: string) { kind.value = value;eventId.value = '';query.value = '';status.value = 'all';loadReport(); }
  return { kinds, events, kind, eventId, query, status, report, preview, filename, confirmed, busy, loading, error, message, page, rows, pages, canCommit, allowed, selection, selectKind, loadOptions, loadReport, download, printReport, chooseFile, commit };
}
