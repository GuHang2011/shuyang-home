import { useRequestScope } from './useRequestScope';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { type Row, requestId } from './domain';
export const productCategories = ['家乡美食', '农副产品', '手工文创', '其他特产'];
export const orderStates: Record<string,string> = { pending: '待人工确认', confirmed: '已确认', shipped: '已发货', ready: '待自提', completed: '已收货', cancelled: '已取消' };
export const settlementStates: Record<string,string> = { unconfirmed: '待线下结算', confirmed: '已核实线下结算', refunded: '已核实线下退款' };
export const orderSettlementLabel = (order: Row) => order.status === 'cancelled' && order.settlement === 'unconfirmed' ? '已取消，无需结算' : settlementStates[order.settlement];
export const money = (cents: number) => '¥' + (Number(cents || 0) / 100).toFixed(2);
let retainedSession = '';let retainedDrafts = new Map<string, Row>(), retainedAttempts = reactive(new Map<string, Row>());
export function useShop(getUser: () => Row | null, api: (path: string, method?: string, body?: unknown) => Promise<any>, getSession?: () => string) {
  const products = ref<Row[]>([]), orders = ref<Row[]>([]), selected = ref<Row | null>(null), filter = ref('全部'), query = ref(''), tab = ref('products'), manage = ref(false), error = ref(''), message = ref(''), loading = ref(false), busy = ref(false), ordering = ref(false), orderForm = ref<Row>({});
  let generation = 0, viewVersion = 0;const scope = useRequestScope(), session = getSession?.();
  // Retain drafts only in this runtime and this login session, never browser storage.
  if (session && session !== retainedSession) { retainedSession = session;retainedDrafts = new Map();retainedAttempts = reactive(new Map()); }
  const drafts = session ? retainedDrafts : new Map<string, Row>(), attempts = session ? retainedAttempts : reactive(new Map<string, Row>());
  const retrying = computed(() => attempts.has(orderForm.value.requestId));
  const canResumeOrder = computed(() => Array.from(attempts.values()).some(attempt => attempt.productId === selected.value?.id));
  const member = () => getUser()?.status === 'approved' && getUser()?.enabled !== false;
  const admin = computed(() => member() && ['superadmin', 'admin'].includes(getUser()?.role || ''));
  const filtered = computed(() => products.value.filter(p => (filter.value === '全部' || p.category === filter.value) && [p.title,p.origin,p.description].join(' ').toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase())));
  watch([tab, ordering, () => selected.value?.id], () => { ++viewVersion; }, { flush: 'sync' });
  function resetFilters() { filter.value = '全部';query.value = ''; }
  function rows(value: unknown): Row[] { if (!Array.isArray(value) || value.some(row => !row || typeof row !== 'object' || Array.isArray(row) || typeof row.id !== 'string')) throw Error('商城数据响应异常，请重新加载');return value; }
  function syncQuote(draft: Row, product: Row) {
    const shippingChanged = draft.delivery === 'shipping' && draft.displayedShippingCents !== product.shippingCents;
    if (draft.consent && (draft.displayedUnitCents !== product.priceCents || shippingChanged)) {
      draft.consent = false;
      message.value = '商品价格或运费已更新，请核对新合计并重新确认下单。';
    }
    draft.displayedUnitCents = product.priceCents;
    draft.displayedShippingCents = product.shippingCents;
  }
  function updateSelected(data: Row[]) {
    if (!selected.value) return;
    const latest = data.find(row => row.id === selected.value?.id);
    if (latest && ordering.value && !retrying.value) syncQuote(orderForm.value, latest);
    selected.value = latest || { ...selected.value, status: 'withdrawn', stock: 0, images: [] };
    if (!latest || latest.status !== 'published') message.value = '该商品已下架，暂时不能购买。已提交的订单仍可在“我的订单”查看。';
  }
  async function load() {
    const version = ++generation, valid = scope.capture(), management = manage.value && admin.value;
    const current = () => version === generation && valid();
    loading.value = true;error.value = '';
    const result = await Promise.allSettled([api('/products?manage=' + management), member() ? api('/orders?manage=' + management) : Promise.resolve([])]);
    if (!current()) return;
    const failures: string[] = [];
    try {
      const item = result[0];if (item.status === 'rejected') throw item.reason;
      products.value = rows(item.value);updateSelected(products.value);
    } catch(e) { products.value = [];if (selected.value) selected.value = { ...selected.value, status: 'unavailable', images: [] };failures.push((e as Error).message || '商品加载失败'); }
    try { const item = result[1];if (item.status === 'rejected') throw item.reason;orders.value = rows(item.value); }
    catch(e) { orders.value = [];failures.push((e as Error).message || '订单加载失败'); }
    error.value = failures.join('；');loading.value = false;
  }
  function openProduct(product: Row) { ordering.value = false;selected.value = product;error.value = '';message.value = '';void load(); }
  function backToProducts() { ordering.value = false;selected.value = null;error.value = '';message.value = '';void load(); }
  function backToProduct() { if (busy.value) return;ordering.value = false;error.value = '';void load(); }
  function switchTab(value: string) { ordering.value = false;selected.value = null;tab.value = value;error.value = '';message.value = '';void load(); }
  function buy(product: Row) {
    if (busy.value || loading.value) return;
    selected.value = product;
    let draft = drafts.get(product.id);
    if (!draft) { draft = { productId: product.id, requestId: requestId(), quantity: 1, delivery: 'shipping', name: getUser()?.name || '', phone: getUser()?.phone || '', address: '', consent: false };drafts.set(product.id, draft); }
    orderForm.value = draft;ordering.value = true;error.value = '';message.value = '';
    if (!retrying.value) syncQuote(orderForm.value, product);
  }
  function restoreAttempt() { const saved = attempts.get(orderForm.value.requestId);if (saved && !busy.value) { orderForm.value = { ...saved };drafts.set(saved.productId, orderForm.value);error.value = ''; } }
  function orderPayload(form = orderForm.value): Row {
    return { productId: form.productId, requestId: form.requestId, delivery: form.delivery, consent: form.consent,
      expectedUnitCents: selected.value?.priceCents, expectedShippingCents: form.delivery === 'shipping' ? selected.value?.shippingCents : 0,
      quantity: Number(form.quantity), name: String(form.name || '').trim(), phone: String(form.phone || '').trim(), address: String(form.address || '').trim() };
  }
  function orderError(retrying = false) {
    const form = orderForm.value, quantity = Number(form.quantity);
    if (!member()) return '请先登录并完成入会审核';
    if (!selected.value || form.productId !== selected.value.id) return '请重新选择商品';
    // A previous request may already have consumed the last unit. Reconcile/replay
    // that exact request before applying a newer stock/status snapshot locally.
    if (!retrying && selected.value.status !== 'published') return '商品暂不可购买，请返回列表刷新';
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > (retrying ? 99 : Math.min(99, selected.value.stock))) return '购买数量须为1至可售库存范围内的整数，每单最多99件';
    if (String(form.name || '').trim().length < 2 || String(form.name).trim().length > 30) return '请填写2至30字的联系人姓名';
    if (!/^1[3-9][0-9]{9}$/.test(String(form.phone || '').trim())) return '请填写正确的11位手机号';
    if (!['shipping', 'pickup'].includes(form.delivery)) return '请选择配送方式';
    if (form.delivery === 'shipping' && (String(form.address || '').trim().length < 5 || String(form.address).trim().length > 300)) return '请填写5至300字的完整收货地址';
    if (form.consent !== true) return '请先确认商品、售后说明与收货信息使用约定';
    return '';
  }
  function samePayload(one: Row, two: Row) { return ['productId','quantity','delivery','name','phone','address','consent'].every(key => one[key] === two[key]); }
  async function reconcile(payload: Row, current: () => boolean) {
    try {
      const data = rows(await api('/orders?manage=false'));if (!current()) return { known: false, receipt: null };
      if (!(manage.value && admin.value)) orders.value = data;
      return { known: true, receipt: data.find(row => row.id === getUser()?.id + ':' + payload.requestId || row.requestId === payload.requestId) || null };
    } catch { return { known: false, receipt: null }; }
  }
  async function submitOrder() {
    if (busy.value || !member()) { if (!member()) error.value = '请先登录并完成入会审核';return false; }
    const current = scope.capture(), view = viewVersion, original = orderForm.value;
    let payload = orderPayload(), previous = attempts.get(payload.requestId);
    const here = () => current() && view === viewVersion && orderForm.value === original;
    busy.value = true;error.value = '';message.value = '';
    async function completed(receipt: Row) {
      if (!current()) return false;
      drafts.delete(payload.productId);attempts.delete(payload.requestId);
      if (here()) {
        ordering.value = false;selected.value = null;tab.value = 'orders';orderForm.value = {};
        message.value = receipt?.status && receipt.status !== 'pending' ? '已找到本次订单，当前状态为' + (orderStates[receipt.status] || '已处理') + '。' : '订单已提交，等待卖家人工确认；请勿重复下单。';
      }
      await load();
      // Preserve the authoritative receipt even if the following orders refresh fails.
      if (current() && receipt?.id && !orders.value.some(row => row.id === receipt.id)) orders.value.unshift(receipt);
      return current();
    }
    try {
      if (previous) {
        const result = await reconcile(previous, current);if (!current()) return false;
        if (result.receipt) return await completed(result.receipt);
        if (samePayload(previous, payload)) payload = previous;
        if (!result.known && !samePayload(previous, payload)) {
          if (here()) error.value = '上次订单结果暂未确认，请恢复原收货信息后重试，或稍后查看“我的订单”。';return false;
        }
      }
      const validation = orderError(!!previous && samePayload(previous, payload));
      if (validation) { if (here()) error.value = validation;return false; }
      attempts.set(payload.requestId, payload);
      const receipt = await api('/orders', 'POST', payload);return await completed(receipt);
    } catch(e) {
      if (!current()) return false;
      const failure = (e as Error).message, result = await reconcile(payload, current);
      if (!current()) return false;
      if (result.receipt) return await completed(result.receipt);
      if (result.known && /商品价格或运费已变化/.test(failure)) {
        attempts.delete(payload.requestId);await load();if (here()) { orderForm.value.consent = false;message.value = '商品价格或运费已更新，请核对新合计并重新确认下单。';error.value = failure; }return false;
      }
      // Keep the request number after an ambiguous response: editing/retrying with
      // this same number cannot create a second order if the first write finishes late.
      if (here()) error.value = failure + (result.known ? '' : '；订单结果暂未确认，可重试或稍后查看“我的订单”。');
      return false;
    } finally { if (current()) busy.value = false; }
  }
  async function saveProduct(form: Row) { if (busy.value) return false;busy.value = true;error.value = '';const current = scope.capture();try { await api('/products','POST',{ ...form, stock: Number(form.stock) });if (!current()) return false;await load();return current(); } catch(e) { if (current()) error.value = (e as Error).message;return false; } finally { if (current()) busy.value = false; } }
  async function act(row: Row, action: string, note = '') { if (busy.value || !member()) return false;busy.value = true;error.value = '';message.value = '';const current = scope.capture(), view = viewVersion;try { await api('/orders/' + encodeURIComponent(row.id) + '/action','POST',{ action, note, verified: action === 'settle' });if (!current()) return false;if (view === viewVersion) message.value = '订单操作已完成';await load();return current(); } catch(e) { if (current() && view === viewVersion) error.value = (e as Error).message;return false; } finally { if (current()) busy.value = false; } }
  watch([() => getUser()?.id, () => getUser()?.role, () => getUser()?.status, () => getUser()?.enabled, manage], () => { scope.invalidate();busy.value = false;error.value = '';message.value = '';orders.value = [];products.value = [];selected.value = null;ordering.value = false;orderForm.value = {};drafts.clear();attempts.clear();void load(); }, { flush: 'sync' });onMounted(load);
  return { products, orders, selected, filter, query, tab, manage, error, message, loading, busy, ordering, orderForm, admin, filtered, load, resetFilters, openProduct, backToProducts, backToProduct, switchTab, retrying, canResumeOrder, restoreAttempt, buy, submitOrder, saveProduct, act };
}
