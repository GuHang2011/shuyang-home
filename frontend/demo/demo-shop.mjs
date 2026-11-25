const reject = message => { throw new Error(message); };
const revision = product => product.stockRevision ?? 0;
const placedOrders = ['confirmed', 'shipped', 'ready', 'completed'];
const cancellable = ['pending', 'confirmed'];
const states = {pending: '待确认', confirmed: '已确认', shipped: '已发货', ready: '待自提', completed: '已收货', cancelled: '已取消'};

function shopAdmin(actor) {
  return actor?.enabled && actor.status === 'approved' && ['admin', 'superadmin'].includes(actor.role);
}
function requireAdmin(actor) {
  if (!shopAdmin(actor)) reject('请切换到演示管理员体验此操作');
}
function productById(state, id) {
  return state.products.find(product => product.id === id) || reject('商品不存在，请刷新商品列表');
}
function adjustStock(product, amount) {
  product.stock += amount;
  product.stockRevision = revision(product) + 1;
}
function saveProduct(state, body) {
  const original = body.id ? productById(state, body.id) : null;
  if (original && revision(original) !== revision(body)) reject('商品库存或资料已变化，请刷新后重新编辑');
  const stock = Number(body.stock);
  if (!Number.isInteger(stock) || stock < 0 || stock > 1000000) reject('请填写有效的商品库存');
  const row = {
    ...body, stock, id: original?.id || 'product-' + crypto.randomUUID(),
    priceCents: Math.round(Number(body.price) * 100), shippingCents: Math.round(Number(body.shippingFee) * 100),
    stockRevision: (original ? revision(original) : 0) + 1, updatedAt: new Date().toISOString()
  };
  state.products = [row, ...state.products.filter(product => product.id !== row.id)];
  return row;
}
function orderFields(body) {
  const {productId, delivery} = body;
  return { productId, quantity: Number(body.quantity), delivery,
    name: (body.name ?? '').trim(), phone: (body.phone ?? '').trim(), address: (body.address ?? '').trim() };
}
function placeOrder(state, actor, body) {
  const fields = orderFields(body);
  const {quantity, name, phone, address, delivery} = fields;
  if (body.consent !== true || !body.requestId) reject('请确认商品和线下结算说明');
  if (!['shipping', 'pickup'].includes(delivery) || name.length < 2 || name.length > 30 ||
      !/^1[3-9]\d{9}$/.test(phone) || address.length > 300 || (delivery === 'shipping' && address.length < 5)) reject('请核对联系人与配送信息');
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) reject('购买数量须为1至99之间的整数');
  const existing = state.orders.find(o => o.buyerId === actor.id && o.requestId === body.requestId);
  if (existing) {
    const previous = orderFields(existing);
    if (Object.keys(fields).some(key => fields[key] !== previous[key])) reject('同一请求不能用于不同订单');
    return existing;
  }
  const product = productById(state, fields.productId);
  if (product.status !== 'published') reject('商品已下架');
  if (quantity > product.stock) reject('库存不足，请调整数量');
  const uuid = crypto.randomUUID(), shippingCents = delivery === 'shipping' ? product.shippingCents : 0;
  if ('expectedUnitCents' in body || 'expectedShippingCents' in body) {
    if (![body.expectedUnitCents, body.expectedShippingCents].every(value => Number.isSafeInteger(value) && value >= 0)) {
      reject('请确认商品单价和运费');
    }
    if (body.expectedUnitCents !== product.priceCents || body.expectedShippingCents !== shippingCents) {
      reject('商品价格或运费已变化，请刷新商品并确认金额后重新下单');
    }
  }
  const row = {
    ...fields, requestId: body.requestId, buyerId: actor.id, id: 'order-' + uuid, orderNo: orderNumber(uuid),
    title: product.title, specification: product.specification, seller: product.seller, sellerContact: product.sellerContact,
    afterSales: product.afterSales, unitCents: product.priceCents, shippingCents, totalCents: product.priceCents * quantity + shippingCents,
    status: 'pending', settlement: 'unconfirmed', createdAt: new Date().toISOString()
  };
  adjustStock(product, -quantity);
  state.orders.unshift(row);
  return row;
}
function orderNumber(uuid) {
  return 'SY' + uuid.replaceAll('-', '').slice(0, 16).toUpperCase();
}
export function upgradeShopOrders(state) {
  for (const row of state.orders || []) {
    const match = /^order-([a-f0-9-]{36})$/i.exec(row.id);
    if (!row.orderNo && match) row.orderNo = orderNumber(match[1]);
  }
}
function actionNote(body) {
  const note = String(body.note || '').trim();
  if (note.length < 5 || note.length > 300) reject('请填写5至300字的处理说明');
  return note;
}
function sameNote(original, note) {
  if (original !== note) reject('已登记的说明不同，请刷新订单核对');
}
function act(state, row, actor, body) {
  const {action} = body;
  const buyer = row.buyerId === actor.id;
  if (!(buyer && ['cancel', 'receive'].includes(action))) requireAdmin(actor);
  switch (action) {
    case 'confirm':
      if (placedOrders.includes(row.status)) return row;
      if (row.status !== 'pending') reject('订单已处理');
      row.status = 'confirmed';
      break;
    case 'settle': {
      if (!placedOrders.includes(row.status) || body.verified !== true) reject('请先确认订单并核实线下结算');
      const note = actionNote(body);
      if (row.settlement === 'confirmed') { sameNote(row.settlementNote, note); return row; }
      row.settlement = 'confirmed';
      row.settlementNote = note;
      break;
    }
    case 'cancel':
    case 'refund': {
      if (action === 'refund' && row.settlement === 'refunded' && row.status === 'cancelled') {
        sameNote(row.settlementNote, actionNote(body));
        return row;
      }
      if (action === 'cancel' && row.status === 'cancelled') return row;
      if (!cancellable.includes(row.status)) reject('当前订单不可取消');
      const product = productById(state, row.productId);
      if (action === 'refund') {
        if (row.settlement !== 'confirmed') reject('请先核实线下结算');
        row.settlementNote = actionNote(body);
        row.settlement = 'refunded';
      } else if (row.settlement === 'confirmed') reject('请先由管理员核实线下退款');
      adjustStock(product, row.quantity);
      row.status = 'cancelled';
      break;
    }
    case 'ship':
    case 'ready': {
      if ((action === 'ship') !== (row.delivery === 'shipping')) reject('操作与配送方式不符');
      const next = action === 'ship' ? 'shipped' : 'ready', note = actionNote(body);
      if ([next, 'completed'].includes(row.status)) { sameNote(row.fulfillment, note); return row; }
      if (row.status !== 'confirmed') reject('确认订单后才能履约');
      row.fulfillment = note;
      row.status = next;
      break;
    }
    case 'receive':
      if (!buyer) reject('请由买家本人确认收货');
      if (row.status === 'completed') return row;
      if (!['shipped', 'ready'].includes(row.status)) reject('商品发出或备妥后才可确认收货');
      row.status = 'completed';
      break;
    default: reject('订单操作无效');
  }
  row.updatedAt = new Date().toISOString();
  return row;
}
export function demoShop(state, {path, method, body, actor, member, query}) {
  const manage = query.get('manage') === 'true';
  if (path === '/products') {
    if (method === 'GET') {
      if (manage) requireAdmin(actor);
      return state.products.filter(p => manage || p.status === 'published');
    }
    if (method === 'POST') { requireAdmin(actor); return saveProduct(state, body); }
  }
  if (path === '/orders') {
    member();
    if (method === 'GET') {
      if (manage) requireAdmin(actor);
      return state.orders.filter(o => manage || o.buyerId === actor.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    if (method === 'POST') return placeOrder(state, actor, body);
  }
  const match = /^\/orders\/([^/]+)\/action$/.exec(path);
  if (match && method === 'POST') {
    member();
    const row = state.orders.find(o => o.id === match[1]) || reject('订单不存在，请刷新');
    return act(state, row, actor, body);
  }
}
export function orderWork(row, manage) {
  if (manage && !cancellable.includes(row.status)) return null;
  const section = manage || ['ready', 'shipped'].includes(row.status) ? 'action'
    : cancellable.includes(row.status) ? 'waiting' : 'done';
  return {state: states[row.status], section};
}
export function orderWorkActions(row, manage) {
  const actions = [], url = '/orders/' + row.id + '/action';
  const add = (label, action, extra = {}) => actions.push({label, url, body: {action}, ...extra});
  if (manage && row.status === 'pending') add('确认订单', 'confirm');
  if (manage && row.status === 'confirmed') {
    const shipping = row.delivery === 'shipping';
    add(shipping ? '登记发货' : '通知自提', shipping ? 'ship' : 'ready',
      {field: 'note', hint: shipping ? '物流与单号' : '自提地点和时间', min: 5, max: 300});
  }
  if (!manage && ['ready', 'shipped'].includes(row.status)) add('确认已收货', 'receive');
  if (cancellable.includes(row.status) && row.settlement !== 'confirmed') add('取消订单', 'cancel');
  return actions;
}
