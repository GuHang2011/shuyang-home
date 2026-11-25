// Verify actual Web checkout against the disposable production HTTPS proxy.
// All products, images, addresses and orders below are synthetic test fixtures.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib');
const { chromium } = require('../frontend/node_modules/playwright');
const { expect } = require('../frontend/node_modules/playwright/test');
const origin = process.argv[2], parsedOrigin = new URL(origin);
assert.equal(parsedOrigin.hostname, '127.0.0.1', 'Only the local disposable proxy is allowed');
assert.equal(parsedOrigin.protocol, 'https:', 'The production proxy must use HTTPS');
const adminToken = process.env.SHUYANG_TEST_ADMIN_TOKEN, memberToken = process.env.SHUYANG_TEST_MEMBER_TOKEN;
assert(adminToken && memberToken, 'Disposable administrator/member sessions are required');
const output = path.resolve(__dirname, '../output/shop-price-browser');
fs.mkdirSync(output, { recursive: true });

function syntheticPng() {
  const width = 64, height = 48, rows = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) rows.set(x > 12 && x < 52 && y > 8 && y < 40 ? [174, 126, 69] : [249, 244, 232], y * (width * 3 + 1) + 1 + x * 3);
  const crc32 = buffer => { let crc = 0xffffffff;for (const byte of buffer) { crc ^= byte;for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }return (crc ^ 0xffffffff) >>> 0; };
  const chunk = (name, data) => { const type = Buffer.from(name), size = Buffer.alloc(4), crc = Buffer.alloc(4);size.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([type, data])));return Buffer.concat([size, type, data, crc]); };
  const header = Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height, 4);header[8] = 8;header[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}

async function run() {
  const checks = [], errors = [], failures = [], orderRequests = [], orderStatuses = [];
  const check = name => { checks.push(name);console.log('PASS:', name); };
  const browser = await chromium.launch({ headless: true, executablePath: process.env.SHUYANG_CHROMIUM_PATH });
  let page;
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true, timezoneId: 'Asia/Shanghai' });
    await context.addInitScript(value => sessionStorage.setItem('shuyang_home_session', value), memberToken);
    async function fixture(route, method = 'GET', body, token = adminToken) {
      const response = await context.request.fetch(origin + '/api' + route, { method,
        headers: { Authorization: 'Bearer ' + token }, ...(body !== undefined ? { data: body } : {}) });
      assert.equal(response.status(), 200, 'Synthetic fixture ' + method + ' ' + route + ' succeeds');
      return (await response.json()).data;
    }
    const uploaded = await context.request.post(origin + '/api/media/upload', {
      headers: { Authorization: 'Bearer ' + adminToken },
      multipart: { scope: 'product', file: { name: 'synthetic-product.png', mimeType: 'image/png', buffer: syntheticPng() } }
    });
    assert.equal(uploaded.status(), 200, 'A generated PNG uploads through the real media API');
    const imageId = (await uploaded.json()).data.id;
    const product = await fixture('/products', 'POST', {
      title: '金额确认浏览器验收特产', category: '家乡美食', description: '这是一件合成验收商品，仅用于隔离测试，不是真实商品。',
      specification: '合成样品每袋500克', origin: '江苏沭阳', seller: '隔离测试供货商', sellerContact: '仅供合成测试联系',
      afterSales: '仅用于自动化验收，不会发生真实购买或售后。', price: '12.50', shippingFee: '5.00', stock: 5, images: [imageId], status: 'published'
    });
    const ownOrders = async () => (await fixture('/orders', 'GET', undefined, memberToken)).filter(row => row.productId === product.id);
    const storedProduct = async () => (await fixture('/products?manage=true')).find(row => row.id === product.id);
    page = await context.newPage();page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.url() === origin + '/api/orders' && request.method() === 'POST') orderRequests.push(request.postDataJSON()); });
    page.on('response', response => {
      if (response.url() === origin + '/api/orders' && response.request().method() === 'POST') orderStatuses.push(response.status());
      if (response.url().startsWith(origin) && response.status() >= 400 && !response.url().includes('/api/')) failures.push(response.url());
    });
    const authenticated = page.waitForResponse(response => response.url() === origin + '/api/auth/me');
    await page.goto(origin + '/#shop');assert.equal((await authenticated).status(), 200);
    const shop = page.locator('.shop');
    await expect(shop).toHaveAttribute('aria-busy', 'false');
    const card = shop.locator('.product-card').filter({ hasText: product.title });
    await expect.poll(() => card.locator('img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    await card.locator('button').first().click();
    await expect(shop.getByRole('button', { name: '填写订单', exact: true })).toBeEnabled();
    await shop.getByRole('button', { name: '填写订单', exact: true }).click();
    const form = shop.locator('.order-form'), consent = form.getByRole('checkbox');
    const submit = form.getByRole('button', { name: '提交订单 · 待人工确认', exact: true });
    await form.getByLabel('购买数量', { exact: true }).fill('2');
    // The wrapping label also contains both option texts in its accessible name.
    await form.getByRole('combobox', { name: /配送方式/ }).selectOption('shipping');
    await form.getByLabel('联系人', { exact: true }).fill('合成测试买家');
    await form.getByLabel('联系电话', { exact: true }).fill('13800005552');
    await form.getByLabel('收货地址', { exact: true }).fill('隔离验收地址，不是真实收货地址');
    await expect(form.locator('.order-total strong')).toHaveText('¥30.00');await consent.check();
    await page.screenshot({ path: path.join(output, 'web-order-original-amount.png'), fullPage: true });
    check('Member opens the uploaded product image and confirms the original total in the actual Web form');

    const repriced = await fixture('/products', 'POST', { ...product, price: '15.00', shippingFee: '7.00' });
    const rejected = page.waitForResponse(response => response.url() === origin + '/api/orders' && response.request().method() === 'POST');
    await submit.click();const rejectedResponse = await rejected;assert.equal(rejectedResponse.status(), 409);
    assert.match((await rejectedResponse.json()).message, /商品价格或运费已变化/);
    assert.equal(orderRequests[0].expectedUnitCents, 1250);assert.equal(orderRequests[0].expectedShippingCents, 500);
    await expect(form.locator('.order-total strong')).toHaveText('¥37.00');await expect(consent).not.toBeChecked();
    await expect(shop.getByText('商品价格或运费已更新，请核对新合计并重新确认下单。', { exact: true })).toBeVisible();
    await expect(shop.getByRole('alert')).toContainText('商品价格或运费已变化');await expect(submit).toBeEnabled();
    assert.deepEqual(await ownOrders(), []);assert.deepEqual(await storedProduct(), repriced);
    await submit.click();assert.equal(await consent.evaluate(input => input.validity.valueMissing), true);assert.equal(orderRequests.length, 1);
    await page.screenshot({ path: path.join(output, 'web-order-price-changed.png'), fullPage: true });
    check('A real 409 refreshes the total, clears consent and creates no order or stock change');

    await consent.check();
    const accepted = page.waitForResponse(response => response.url() === origin + '/api/orders' && response.request().method() === 'POST');
    await submit.click();const acceptedResponse = await accepted;assert.equal(acceptedResponse.status(), 200);
    const receipt = (await acceptedResponse.json()).data;
    assert.equal(receipt.totalCents, 3700);assert.equal(receipt.quantity, 2);assert.equal(receipt.unitCents, 1500);assert.equal(receipt.shippingCents, 700);
    assert.equal(orderRequests[1].requestId, orderRequests[0].requestId);assert.equal(orderRequests[1].expectedUnitCents, 1500);assert.equal(orderRequests[1].expectedShippingCents, 700);
    await expect(form).toHaveCount(0);
    const orderCard = shop.locator('.shop-order').filter({ hasText: receipt.orderNo });
    await expect(orderCard).toContainText('¥37.00');await expect(orderCard).toContainText('待人工确认');
    assert.equal((await ownOrders()).length, 1);assert.equal((await storedProduct()).stock, 3);
    check('Explicitly reconfirming the new amount creates exactly one order and reserves two units');

    await orderCard.getByRole('button', { name: '取消订单', exact: true }).click();
    const dialog = shop.getByRole('dialog', { name: '取消订单', exact: true });
    const cancelled = page.waitForResponse(response => response.url() === origin + '/api/orders/' + encodeURIComponent(receipt.id) + '/action' && response.request().method() === 'POST');
    await dialog.getByRole('button', { name: '确认', exact: true }).click();assert.equal((await cancelled).status(), 200);
    await expect(dialog).toHaveCount(0);await expect(orderCard).toContainText('已取消，无需结算');
    const finalOrders = await ownOrders();assert.equal(finalOrders.length, 1);assert.equal(finalOrders[0].status, 'cancelled');assert.equal(finalOrders[0].totalCents, 3700);
    const finalProduct = await storedProduct();assert.equal(finalProduct.stock, 5);assert.equal(finalProduct.stockRevision, repriced.stockRevision + 2);
    await page.screenshot({ path: path.join(output, 'web-order-cancelled.png'), fullPage: true });
    check('Cancelling through the member confirmation dialog returns the exact reserved stock');

    assert.deepEqual(orderStatuses, [409, 200]);assert.deepEqual(errors, []);assert.deepEqual(failures, []);
    check('Checkout completes without browser exceptions or broken static assets');
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ checks, errors, failures, orderStatuses }, null, 2));
    console.log('SHOP PRICE RESULT ' + checks.length + ' passed');
  } catch (error) {
    if (page && !page.isClosed()) {
      await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
      fs.writeFileSync(path.join(output, 'failure.txt'), await page.locator('body').innerText().catch(() => 'Page unavailable'));
    }
    fs.writeFileSync(path.join(output, 'failure-results.json'), JSON.stringify({ checks, errors, failures, orderStatuses }, null, 2));throw error;
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error);process.exitCode = 1; });
