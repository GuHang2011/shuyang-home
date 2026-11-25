// Real production Web/H5 bundles, normal UI navigation and an isolated synthetic demo API.
// This checks browser behavior; backend validation remains in the Spring integration tests.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require('../frontend/node_modules/playwright'), { expect } = require('../frontend/node_modules/playwright/test');
const root = path.resolve(__dirname, '..'), web = path.join(root, 'frontend/dist'), mobile = path.join(root, 'frontend/mobile/dist/build/h5'), output = path.join(root, 'output/shop-browser');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
async function run() {
  assert(fs.existsSync(path.join(web, 'index.html')) && fs.existsSync(path.join(mobile, 'index.html')), 'Build production Web and H5 first');
  fs.mkdirSync(output, { recursive: true });
  const { createDemoState, demoRequest } = await import(pathToFileURL(path.join(root, 'frontend/demo/demo-runtime.mjs')));
  let state, failProducts = false, failOrders = false, loseOrderResponse = false, loseActionResponse = false;
  const checks = [], errors = [], expectedRejections = [], unexpectedApiErrors = [], staticErrors = [], writes = [];
  const check = label => { checks.push(label); console.log('PASS:', label); };
  const json = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (pathname.startsWith('/api/')) {
        if (pathname === '/api/weather') return json(res, 200, { code: 0, data: { current: { temperature_2m: 18, weather_code: 0, is_day: 1 }, daily: { time: [] } } });
        if (req.method === 'GET' && ((pathname === '/api/products' && failProducts) || (pathname === '/api/orders' && failOrders))) return json(res, 503, { code: 503, message: '测试网络暂不可用，请稍后重试' });
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        const method = req.method || 'GET', body = Buffer.concat(chunks);
        if (method === 'POST' && (pathname === '/api/orders' || /^\/api\/orders\/[^/]+\/action$/.test(pathname))) writes.push({ url: pathname, body: JSON.parse(body.toString()) });
        const result = await demoRequest(state, new Request('https://demo.invalid' + req.url, { method, headers: req.headers, ...(!['GET', 'HEAD'].includes(method) ? { body } : {}) }));
        // Mutation succeeds in the fixture, but its result is lost in transit.
        if (loseOrderResponse && pathname === '/api/orders' && method === 'POST') { loseOrderResponse = false; return json(res, 503, { code: 503, message: '测试：提交结果未送达，请核对订单后重试' }); }
        if (loseActionResponse && /^\/api\/orders\/[^/]+\/action$/.test(pathname) && method === 'POST') { loseActionResponse = false; return json(res, 503, { code: 503, message: '测试：操作结果未送达，请重试' }); }
        return json(res, 200, { code: 0, data: result });
      }
      const dir = pathname.startsWith('/mobile/') ? mobile : web, relative = dir === mobile ? pathname.slice('/mobile/'.length) : pathname.slice(1), file = path.resolve(dir, relative || 'index.html');
      if (!file.startsWith(dir + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(file).pipe(res);
    } catch (error) { (/商品价格或运费已变化/.test(error.message) ? expectedRejections : unexpectedApiErrors).push({ url: req.url, message: error.message }); json(res, 400, { code: 1, message: error.message }); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port; let browser, page;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.SHUYANG_CHROMIUM_PATH ? { executablePath: process.env.SHUYANG_CHROMIUM_PATH } : {}) });
    const selectedSurface = process.argv.find(arg => arg.startsWith('--surface='))?.split('=')[1];
    assert(!selectedSurface || ['web', 'mobile'].includes(selectedSurface), 'Use --surface=web or --surface=mobile');
    for (const surface of selectedSurface ? [selectedSurface] : ['web', 'mobile']) {
      state = createDemoState(); state.broadcasts = []; state.orders = []; writes.length = 0;
      const product = (id, title, extra = {}) => ({ id, title, category: '家乡美食', specification: '合成样品一份', origin: '江苏沭阳', seller: '验收供货商', sellerContact: '合成商品，不实际销售', priceCents: 2900, shippingCents: 800, stock: 6, stockRevision: 0, images: [], status: 'published', description: '用于商城浏览器验收的合成商品，不实际销售或发货。', afterSales: '合成测试样品，不收款，不履约，不涉及真实个人资料。', createdAt: new Date().toISOString(), ...extra });
      state.products = [product('sample-food', '沭阳风味礼盒（验收样品）'), product('sample-last', '手工文创（最后一件样品）', { category: '手工文创', stock: 1, priceCents: 1900, shippingCents: 0 }), product('sample-sold', '家乡杂粮（售罄样品）', { category: '农副产品', stock: 0 })];
      const order = (id, extra) => ({ id, orderNo: 'SY' + id.toUpperCase(), buyerId: 'demo-member', productId: 'sample-food', title: '历史验收订单', specification: '合成样品一份', quantity: 1, delivery: 'shipping', name: '验收会员', phone: '13800000001', address: '合成验收地址，不实际配送', seller: '验收供货商', sellerContact: '合成商品，不实际销售', unitCents: 2900, shippingCents: 800, totalCents: 3700, settlement: 'unconfirmed', requestId: 'fixture-' + id, createdAt: new Date().toISOString(), ...extra });
      state.orders = [order('shipped', { status: 'shipped', title: '已发货的合成样品', fulfillment: '合成物流记录，仅供测试' }), order('settled', { status: 'confirmed', title: '已结算的合成样品', settlement: 'confirmed', settlementNote: '合成核实记录' }), order('otherbuyer', { buyerId: 'demo-admin', title: '其他会员的私有订单', status: 'pending' })];
      failProducts = true; failOrders = false; loseOrderResponse = false; loseActionResponse = false;
      const context = await browser.newContext({ viewport: surface === 'web' ? { width: 1360, height: 1000 } : { width: 390, height: 844 }, timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce' });
      await context.addInitScript(() => { sessionStorage.setItem('shuyang_home_session', 'demo-member'); localStorage.setItem('shuyang_home_token', 'demo-member'); });
      page = await context.newPage(); page.setDefaultTimeout(12000);
      page.on('pageerror', error => errors.push(surface + ': ' + error.message));
      page.on('response', response => { if (response.url().startsWith(base) && response.status() >= 400 && !response.url().includes('/api/')) staticErrors.push(response.url()); });
      await page.goto(base + (surface === 'web' ? '/#home' : '/mobile/'));
      await page.locator('.community-title').waitFor();
      if (surface === 'web') await page.locator('.community-directory').getByRole('button', { name: '家乡特产', exact: false }).click();
      else await page.locator('.community-directory').getByText('家乡特产', { exact: false }).click();
      const shop = surface === 'web' ? page.locator('.shop') : page.locator('.page');
      const button = (container, name) => surface === 'web' ? container.getByRole('button', { name, exact: true }) : container.getByText(name, { exact: true });
      const disabled = async (control, value = true) => expect.poll(() => control.evaluate(element => element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true' || element.classList.contains('uni-button-disabled'))).toBe(value);
      const cards = shop.locator('.product-card');
      const orderCard = number => surface === 'web' ? shop.locator('.shop-order').filter({ hasText: number }) : shop.locator('.panel').filter({ hasText: number });
      const switchTab = async name => { const tabs = surface === 'web' ? shop.locator(':scope > .chips') : shop.locator('.shop-tabs'); await button(tabs, name).click(); };
      const confirmAction = async () => { if (surface === 'web') await page.locator('dialog[open]').getByRole('button', { name: '确认', exact: true }).click(); else await page.locator('uni-modal').getByText('确定', { exact: true }).click(); };
      const openProduct = async title => { const card = cards.filter({ hasText: title }); if (surface === 'web') await card.locator('button').first().click(); else await card.click(); };
      const backProducts = () => button(shop, surface === 'web' ? '← 全部家乡特产' : '← 全部特产').click();
      const fillOrder = async (quantity = '2') => {
        if (surface === 'web') { await shop.getByLabel('购买数量', { exact: true }).fill(quantity); await shop.getByLabel('联系人', { exact: true }).fill('验收会员'); await shop.getByLabel('联系电话', { exact: true }).fill('13800000001'); await shop.getByLabel('收货地址', { exact: true }).fill('合成验收地址，不实际配送'); await shop.getByRole('checkbox').check(); }
        else {
          const field = label => shop.locator('.field').filter({ has: page.locator('.field-label').filter({ hasText: label }) });
          await field('购买数量').locator('input').fill(quantity); await field('联系人').locator('input').fill('验收会员'); await field('联系电话').locator('input').fill('13800000001'); await field('收货地址').locator('textarea').fill('合成验收地址，不实际配送'); await shop.locator('uni-switch').click();
        }
      };
      await expect(shop.getByText('测试网络暂不可用，请稍后重试', { exact: false })).toBeVisible();
      assert.equal(await shop.locator('.empty').count(), 0, 'Network failure must not look like an empty catalogue');
      failProducts = false; await button(shop, '重新加载').click(); await expect(cards).toHaveCount(3);
      check(`${surface}: product failure is visible and retry restores the catalogue`);
      const search = surface === 'web' ? shop.getByRole('textbox', { name: '搜索家乡特产' }) : shop.locator('.search input');
      await search.fill('  风味礼盒  '); await expect(cards).toHaveCount(1);
      await search.fill('不存在的验收商品'); await expect(cards).toHaveCount(0); await button(shop, '清除筛选').click(); await expect(cards).toHaveCount(3);
      await openProduct('家乡杂粮（售罄样品）'); await disabled(button(shop, '暂时售罄')); await backProducts();
      check(`${surface}: trimmed search, empty reset and sold-out purchase protection work`);
      await openProduct('沭阳风味礼盒（验收样品）'); await button(shop, '填写订单').click(); await fillOrder();
      await expect(shop.locator('.order-total')).toContainText('¥66.00');
      await button(shop, '提交订单 · 待人工确认').click();
      await expect(shop.getByText('订单已提交，等待卖家人工确认；请勿重复下单。', { exact: true })).toBeVisible();
      const created = state.orders.find(row => row.productId === 'sample-food' && row.status === 'pending' && row.buyerId === 'demo-member');
      assert(created); assert.equal(created.totalCents, 6600); assert.equal(state.products[0].stock, 4); assert.equal(created.seller, '验收供货商');
      await expect(orderCard(created.orderNo)).toContainText('待人工确认');
      assert.equal(writes.filter(row => row.url === '/api/orders').length, 1); assert.equal(await shop.getByText('其他会员的私有订单', { exact: false }).count(), 0);
      check(`${surface}: shipping order has correct total, seller snapshot, stock deduction and buyer isolation`);
      await button(orderCard(created.orderNo), '取消订单').click(); await confirmAction();
      await expect(orderCard(created.orderNo)).toContainText('已取消，无需结算'); assert.equal(state.products[0].stock, 6); assert.equal(created.status, 'cancelled');
      check(`${surface}: cancelling an unpaid order restores stock and removes the settlement request`);
      await button(orderCard('SYSHIPPED'), '确认已收货').click(); await confirmAction(); await expect(orderCard('SYSHIPPED')).toContainText('已收货');
      await expect(button(orderCard('SYSHIPPED'), '确认已收货')).toHaveCount(0); await expect(button(orderCard('SYSETTLED'), '取消订单')).toHaveCount(0);
      check(`${surface}: receiving shipped goods updates status and settled orders cannot be cancelled by buyers`);
      failProducts = true; await switchTab('我的订单'); await expect(shop.getByText('测试网络暂不可用，请稍后重试', { exact: false })).toBeVisible(); await expect(orderCard(created.orderNo)).toBeVisible();
      failProducts = false; await button(shop, '重新加载').click(); await expect(shop.getByText('测试网络暂不可用，请稍后重试', { exact: false })).toHaveCount(0);
      state.orders.find(row => row.id === 'settled').status = 'shipped'; await switchTab('家乡特产'); await switchTab('我的订单'); await expect(button(orderCard('SYSETTLED'), '确认已收货')).toBeVisible();
      check(`${surface}: product outage does not hide existing orders and ordinary tab navigation refreshes changed order status`);
      await switchTab('家乡特产'); await openProduct('手工文创（最后一件样品）'); await button(shop, '填写订单').click(); await fillOrder('1');
      failOrders = true; loseOrderResponse = true;
      await button(shop, '提交订单 · 待人工确认').click();
      await expect(shop.getByText(/测试：提交结果未送达|测试网络暂不可用/).first()).toBeVisible();
      const uncertain = state.orders.find(row => row.productId === 'sample-last'); assert(uncertain); assert.equal(state.products[1].stock, 0);
      await button(shop, '← 商品详情').click(); await button(shop, '继续确认上次订单').click();
      if (surface === 'web') await expect(shop.getByLabel('收货地址', { exact: true })).toHaveValue('合成验收地址，不实际配送');
      else await expect(shop.locator('.field textarea')).toHaveValue('合成验收地址，不实际配送');
      failOrders = false; await button(shop, '提交订单 · 待人工确认').click();
      await expect(orderCard(uncertain.orderNo)).toContainText('待人工确认');
      assert.equal(state.orders.filter(row => row.productId === 'sample-last').length, 1); assert.equal(state.products[1].stock, 0);
      const attempts = writes.filter(row => row.url === '/api/orders' && row.body.productId === 'sample-last'); assert.equal(new Set(attempts.map(row => row.body.requestId)).size, 1);
      check(`${surface}: lost final-item response and failed reconciliation can recover after returning to checkout without a duplicate order`);
      loseActionResponse = true; await button(orderCard(uncertain.orderNo), '取消订单').click(); await confirmAction();
      await expect(shop.getByText('测试：操作结果未送达，请重试', { exact: false }).first()).toBeVisible();
      if (surface === 'mobile') { await button(orderCard(uncertain.orderNo), '取消订单').click(); await confirmAction(); }
      else await confirmAction();
      await expect(orderCard(uncertain.orderNo)).toContainText('已取消，无需结算'); assert.equal(state.products[1].stock, 1);
      check(`${surface}: retrying a lost cancellation response restores inventory only once`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${surface}: no horizontal overflow`);
      await page.screenshot({ path: path.join(output, surface + '-orders.png'), fullPage: true, animations: 'disabled' });
      await switchTab('家乡特产'); await expect(cards).toHaveCount(3);
      await page.screenshot({ path: path.join(output, surface + '-products.png'), fullPage: true, animations: 'disabled' });
      await openProduct('沭阳风味礼盒（验收样品）'); await button(shop, '填写订单').click(); await fillOrder();
      const beforePriceChange = state.orders.length; state.products[0].priceCents = 3500;
      await button(shop, '提交订单 · 待人工确认').click();
      await expect(shop.getByText('商品价格或运费已更新，请核对新合计并重新确认下单。', { exact: true })).toBeVisible();
      await expect(shop.locator('.order-total')).toContainText('¥78.00'); assert.equal(state.orders.length, beforePriceChange);
      if (surface === 'web') await expect(shop.getByRole('checkbox')).not.toBeChecked();
      else await expect(shop.locator('uni-switch')).not.toHaveClass(/uni-switch-checked/);
      await page.screenshot({ path: path.join(output, surface + '-price-confirmation.png'), fullPage: true, animations: 'disabled' });
      if (surface === 'web') await shop.getByRole('checkbox').check(); else await shop.locator('uni-switch').click();
      await button(shop, '提交订单 · 待人工确认').click();
      await expect(shop.getByText('订单已提交，等待卖家人工确认；请勿重复下单。', { exact: true })).toBeVisible();
      assert.equal(state.orders.length, beforePriceChange + 1); assert.equal(state.orders[0].totalCents, 7800);
      check(`${surface}: price changes block stale-price orders and require renewed consent at the updated total`);
      await context.close();
    }
    assert.deepEqual(errors, []); assert.deepEqual(unexpectedApiErrors, []); assert.deepEqual(staticErrors, []);
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ checks, errors, expectedRejections, unexpectedApiErrors, staticErrors }, null, 2)); console.log(`SHOP BROWSER RESULT ${checks.length} passed`);
  } catch (error) {
    if (page && !page.isClosed()) { await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {}); fs.writeFileSync(path.join(output, 'failure.txt'), await page.locator('body').innerText().catch(() => 'Page unavailable')); }
    throw error;
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
