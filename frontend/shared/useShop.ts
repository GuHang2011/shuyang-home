import { useRequestScope } from './useRequestScope';
import { computed, onMounted, ref, watch } from 'vue';
import { type Row, requestId } from './domain';
export const productCategories = ['家乡美食', '农副产品', '手工文创', '其他特产'];
export const orderStates: Record<string,string> = { pending: '待人工确认', confirmed: '已确认', shipped: '已发货', ready: '待自提', completed: '已收货', cancelled: '已取消' };
export const settlementStates: Record<string,string> = { unconfirmed: '待线下结算', confirmed: '已核实线下结算', refunded: '已核实线下退款' };
export const orderSettlementLabel = (order: Row) => order.status === 'cancelled' && order.settlement === 'unconfirmed' ? '已取消，无需结算' : settlementStates[order.settlement];
export const money = (cents: number) => '¥' + (Number(cents || 0) / 100).toFixed(2);
export function useShop(getUser: () => Row | null, api: (path: string, method?: string, body?: unknown) => Promise<any>) {
  const products = ref<Row[]>([]), orders = ref<Row[]>([]), selected = ref<Row | null>(null), filter = ref('全部'), query = ref(''), tab = ref('products'), manage = ref(false), error = ref(''), message = ref(''), loading = ref(false), busy = ref(false), ordering = ref(false), orderForm = ref<Row>({});let generation = 0;const scope = useRequestScope();
  const admin = computed(() => ['superadmin', 'admin'].includes(getUser()?.role || ''));
  const filtered = computed(() => products.value.filter(p => (filter.value === '全部' || p.category === filter.value) && [p.title,p.origin,p.description].join(' ').toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase())));
  function resetFilters() { filter.value = '全部'; query.value = ''; }
  async function load() {
    const version = ++generation, valid = scope.capture();
    const current = () => version === generation && valid();
    loading.value = true;error.value = '';
    try {
      const data = await api('/products?manage=' + (manage.value && admin.value));
      if (!current()) return;
      products.value = data;
      if (getUser()?.status === 'approved') {
        const data = await api('/orders?manage=' + (manage.value && admin.value));
        if (current()) orders.value = data;
      } else orders.value = [];
    } catch(e) { if (current()) error.value = (e as Error).message; }
    finally { if (current()) loading.value = false; }
  }
  function buy(product: Row) { if (busy.value) return;selected.value = product;orderForm.value = { productId: product.id, requestId: requestId(), quantity: 1, delivery: 'shipping', name: getUser()?.name || '', phone: getUser()?.phone || '', address: '', consent: false };ordering.value = true;error.value = '';message.value = ''; }
  function orderError() {
    const form = orderForm.value, quantity = Number(form.quantity);
    if (getUser()?.status !== 'approved') return '请先登录并完成入会审核';
    if (!selected.value || selected.value.status !== 'published') return '商品暂不可购买，请返回列表刷新';
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > Math.min(99, selected.value.stock)) return '购买数量须为1至可售库存范围内的整数，每单最多99件';
    if (String(form.name || '').trim().length < 2 || String(form.name).trim().length > 30) return '请填写2至30字的联系人姓名';
    if (!/^1[3-9][0-9]{9}$/.test(String(form.phone || '').trim())) return '请填写正确的11位手机号';
    if (!['shipping', 'pickup'].includes(form.delivery)) return '请选择配送方式';
    if (form.delivery === 'shipping' && (String(form.address || '').trim().length < 5 || String(form.address).trim().length > 300)) return '请填写5至300字的完整收货地址';
    if (form.consent !== true) return '请先确认商品、售后说明与收货信息使用约定';
    return '';
  }
  async function submitOrder() {
    if (busy.value) return false;
    error.value = orderError();if (error.value) return false;
    busy.value = true;message.value = '';const current = scope.capture();
    try {
      await api('/orders', 'POST', { ...orderForm.value, quantity: Number(orderForm.value.quantity), name: String(orderForm.value.name).trim(), phone: String(orderForm.value.phone).trim(), address: String(orderForm.value.address || '').trim() });
      if (!current()) return false;
      ordering.value = false;selected.value = null;tab.value = 'orders';
      message.value = '订单已提交，等待卖家人工确认；请勿重复下单。';
      await load();return current();
    } catch(e) { if (current()) error.value = (e as Error).message;return false; }
    finally { if (current()) busy.value = false; }
  }
  async function saveProduct(form: Row) { if (busy.value) return false;busy.value = true;error.value = '';const current = scope.capture();try { await api('/products','POST',{ ...form, stock: Number(form.stock) });if (!current()) return false;await load();return current(); } catch(e) { if (current()) error.value = (e as Error).message;return false; } finally { if (current()) busy.value = false; } }
  async function act(row: Row, action: string, note = '') { if (busy.value) return false;busy.value = true;error.value = '';message.value = '';const current = scope.capture();try { await api('/orders/' + encodeURIComponent(row.id) + '/action','POST',{ action, note, verified: action === 'settle' });if (!current()) return false;message.value = '订单操作已完成';await load();return current(); } catch(e) { if (current()) error.value = (e as Error).message;return false; } finally { if (current()) busy.value = false; } }
  watch([() => getUser()?.id, () => getUser()?.role, () => getUser()?.status, manage], () => { scope.invalidate();busy.value = false;error.value = '';message.value = '';orders.value = [];products.value = []; selected.value = null;ordering.value = false;orderForm.value = {};load(); }, { flush: 'sync' });onMounted(load);
  return { products, orders, selected, filter, query, tab, manage, error, message, loading, busy, ordering, orderForm, admin, filtered, load, resetFilters, buy, submitOrder, saveProduct, act };
}
