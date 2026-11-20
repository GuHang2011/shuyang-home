// Exercise production Web/H5 check-in screens through the disposable HTTPS proxy.
// Every account, event, coordinate and image used here is a synthetic fixture.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('../frontend/node_modules/playwright');
const { expect } = require('../frontend/node_modules/playwright/test');
const QRCode = require('../frontend/node_modules/qrcode');
const origin = process.argv[2], parsedOrigin = new URL(origin);
assert.equal(parsedOrigin.hostname, '127.0.0.1', 'Only the local disposable proxy is allowed');
assert.equal(parsedOrigin.protocol, 'https:', 'The production proxy must use HTTPS');
const adminToken = process.env.SHUYANG_TEST_ADMIN_TOKEN, memberToken = process.env.SHUYANG_TEST_MEMBER_TOKEN;
assert(adminToken && memberToken, 'Disposable administrator/member session fixtures are required');
const output = path.resolve(__dirname, '../output/checkin-browser');
fs.mkdirSync(output, { recursive: true });

function beijingInput(value) { return new Date(value.getTime() + 8 * 3600000).toISOString().slice(0, 16); }
async function run() {
  const checks = [], errors = [], failures = [], unexpectedNavigations = [], consoleMessages = [];
  const check = name => { checks.push(name); console.log('PASS:', name); };
  const browser = await chromium.launch({ headless: true, executablePath: process.env.SHUYANG_CHROMIUM_PATH });
  let page;
  function observe(current, label) {
    page = current; current.setDefaultTimeout(15000);
    current.on('pageerror', error => errors.push(label + ': ' + error.message));
    current.on('console', message => {
      if (['error', 'warning'].includes(message.type())) consoleMessages.push({ page: label, type: message.type(), text: message.text() });
    });
    current.on('response', response => {
      if (response.url().startsWith(origin) && response.status() >= 400 && !response.url().includes('/api/')) failures.push(response.url());
    });
    current.on('request', request => { if (request.url().startsWith('https://untrusted.invalid/')) unexpectedNavigations.push(request.url()); });
  }
  async function fixture(context, route, method, body, token = adminToken) {
    const response = await context.request.fetch(origin + '/api' + route, {
      method, headers: { Authorization: 'Bearer ' + token }, ...(body !== undefined ? { data: body } : {})
    });
    assert.equal(response.status(), 200, 'Synthetic fixture ' + method + ' ' + route + ' succeeds');
    return (await response.json()).data;
  }
  try {
    const adminContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true, timezoneId: 'Asia/Shanghai' });
    await adminContext.addInitScript(value => sessionStorage.setItem('shuyang_home_session', value), adminToken);
    const clock = Date.now(), startsAt = new Date(clock + 30 * 60000), endsAt = new Date(clock + 120 * 60000);
    async function event(title) {
      return fixture(adminContext, '/events', 'POST', {
        title, category: '乡情聚会', location: '隔离验收场地',
        description: '仅用于自动化签到验收的虚构活动，不是真实活动。',
        startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), capacity: 10, status: 'published'
      });
    }
    const first = await event('签到浏览器验收甲'), second = await event('签到浏览器验收乙');
    await fixture(adminContext, '/events/' + first.id + '/signup', 'POST', undefined, memberToken);
    const adminPage = await adminContext.newPage(); observe(adminPage, 'web');
    await adminPage.goto(origin + '/#checkin');
    await adminPage.getByRole('button', { name: '设置活动签到点', exact: true }).click();
    await adminPage.locator('.checkin-event').filter({ hasText: first.title }).click();
    await expect(adminPage.getByRole('button', { name: '保存签到设置', exact: true })).toBeEnabled();
    await adminPage.getByLabel('开启地点签到', { exact: true }).check();
    await adminPage.getByLabel('签到点纬度（WGS84）', { exact: true }).fill('31.3');
    await adminPage.getByLabel('签到点经度（WGS84）', { exact: true }).fill('120.6');
    await adminPage.getByLabel('允许半径（米）', { exact: true }).fill('200');
    const opensAt = beijingInput(new Date(clock - 10 * 60000)), closesAt = beijingInput(endsAt);
    await adminPage.getByLabel('签到开始（北京时间）', { exact: true }).fill(opensAt);
    await adminPage.getByLabel('签到结束（北京时间）', { exact: true }).fill(closesAt);
    await adminPage.getByRole('button', { name: '保存签到设置', exact: true }).click();
    await expect(adminPage.getByText('签到设置已保存', { exact: true })).toBeVisible();
    const saved = await fixture(adminContext, '/events/' + first.id + '/checkin-config', 'GET');
    assert.equal(saved.enabled, true); assert.equal(saved.latitude, 31.3); assert.equal(saved.longitude, 120.6); assert.equal(saved.radius, 200);
    assert.equal(Date.parse(saved.opensAt), Date.parse(opensAt + '+08:00'));
    assert.equal(Date.parse(saved.closesAt), Date.parse(closesAt + '+08:00'));
    check('Web administrator saves coordinates, radius and Beijing check-in window through the actual form');

    const generated = adminPage.waitForResponse(response => response.url() === origin + '/api/events/' + first.id + '/checkin-code' && response.request().method() === 'POST');
    await adminPage.getByRole('button', { name: '生成现场二维码', exact: true }).click();
    const codeResponse = await generated; assert.equal(codeResponse.status(), 200);
    const signedCode = (await codeResponse.json()).data.code;
    assert.match(signedCode, /^SYH:CHECKIN:[0-9a-f-]{36}:[0-9a-f-]{36}$/i);
    const qr = adminPage.getByRole('img', { name: '活动签到二维码', exact: true });
    await expect(qr).toBeVisible(); await expect.poll(() => qr.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    const qrImage = Buffer.from((await qr.getAttribute('src')).split(',')[1], 'base64');
    const qrFile = path.join(output, 'synthetic-checkin-qr.png'); fs.writeFileSync(qrFile, qrImage);
    await adminPage.screenshot({ path: path.join(output, 'web-checkin-config.png'), fullPage: true });
    check('Web administrator generates and displays a signed event QR image');

    await adminPage.locator('.checkin-event').filter({ hasText: second.title }).click();
    await expect(adminPage.getByRole('button', { name: '保存签到设置', exact: true })).toBeEnabled();
    await expect(qr).toHaveCount(0);
    await expect(adminPage.getByLabel('开启地点签到', { exact: true })).not.toBeChecked();
    await expect(adminPage.getByRole('button', { name: '生成现场二维码', exact: true })).toHaveCount(0);
    await expect(adminPage.getByText('签到设置已保存', { exact: true })).toHaveCount(0);
    check('Switching events clears the previous QR, saved message and enabled settings');

    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true,
      timezoneId: 'Asia/Shanghai', geolocation: { latitude: 31.3, longitude: 120.6, accuracy: 10 }, permissions: ['geolocation'] });
    await mobileContext.addInitScript(value => localStorage.setItem('shuyang_home_token', value), memberToken);
    const mobilePage = await mobileContext.newPage(); observe(mobilePage, 'h5');
    await mobilePage.goto(origin + '/mobile/');
    await mobilePage.locator('.community-title').waitFor();
    await mobilePage.locator('.bottom-nav').getByText('活动', { exact: true }).click();
    await mobilePage.getByText(first.title, { exact: true }).click();
    await mobilePage.getByText('地点签到／扫一扫', { exact: true }).click();
    await expect(mobilePage.locator('.selected-event')).toContainText(first.title);
    await mobilePage.getByText('扫一扫／选择二维码图片', { exact: true }).click();
    const scanner = mobilePage.locator('.scanner-panel'), picker = scanner.locator('input[type=file]'), result = scanner.locator('.scan-result');
    const confirm = scanner.getByText('确认打开站内签到', { exact: true });
    await picker.setInputFiles(qrFile);
    await expect(result).toContainText(signedCode);
    check('390px H5 opens a registered event and decodes the real administrator-generated QR image');

    await picker.setInputFiles({ name: 'synthetic-no-qr.svg', mimeType: 'image/svg+xml',
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="#fff"/></svg>') });
    await expect(scanner.getByText('没有识别到二维码，请选用清晰、完整的图片。', { exact: true })).toBeVisible();
    await expect(result).toHaveCount(0);
    await picker.setInputFiles(qrFile);
    await expect(result).toContainText(signedCode);
    await expect(scanner.locator('.form-error')).toHaveCount(0);
    check('An unreadable image clears the prior result; reselecting the same QR successfully retries');

    const foreignCode = 'https://untrusted.invalid/synthetic-checkin';
    await picker.setInputFiles({ name: 'synthetic-foreign-qr.png', mimeType: 'image/png', buffer: await QRCode.toBuffer(foreignCode, { width: 280, margin: 2 }) });
    await expect(result).toContainText(foreignCode);
    await confirm.click();
    await expect(mobilePage.getByText('已识别二维码，内容不是本平台活动签到码。不会自动打开陌生链接。', { exact: true })).toBeVisible();
    await expect(scanner).toBeVisible(); await expect(mobilePage.locator('.selected-event')).toHaveCount(0);
    assert.equal(mobilePage.url().startsWith(origin + '/mobile/'), true); assert.deepEqual(unexpectedNavigations, []);
    check('A foreign QR clears stale event selection, retains the scanner and never opens the encoded URL');

    await picker.setInputFiles(qrFile); await expect(result).toContainText(signedCode);
    const unavailablePath = origin + '/api/events/' + first.id + '/checkin-config';
    await mobilePage.route(unavailablePath, route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 1, message: '验收模拟：签到设置暂不可用' }) }), { times: 1 });
    await confirm.click();
    await expect(mobilePage.getByText('验收模拟：签到设置暂不可用', { exact: true })).toBeVisible();
    await expect(scanner).toBeVisible(); await expect(mobilePage.getByText('授权定位并签到', { exact: true })).toHaveCount(0);
    await mobilePage.screenshot({ path: path.join(output, 'h5-recoverable-error.png'), fullPage: true });
    await confirm.click();
    await expect(scanner).toHaveCount(0);
    await expect(mobilePage.locator('.selected-event')).toContainText(first.title);
    await expect(mobilePage.getByText('授权定位并签到', { exact: true })).toBeVisible();
    await expect(mobilePage.getByText('验收模拟：签到设置暂不可用', { exact: true })).toHaveCount(0);
    check('A failed settings request keeps the scanner open; confirmation retries and opens the correct event');

    const checkedIn = mobilePage.waitForResponse(response => response.url() === origin + '/api/events/' + first.id + '/self-check-in' && response.request().method() === 'POST');
    await mobilePage.getByText('授权定位并签到', { exact: true }).click();
    const checkinResponse = await checkedIn; assert.equal(checkinResponse.status(), 200, 'Synthetic browser geolocation passes real backend validation');
    await expect(mobilePage.locator('.selected-event')).toContainText('已签到');
    const registrations = await fixture(mobileContext, '/my/signups', 'GET', undefined, memberToken);
    assert.equal(registrations.find(item => item.eventId === first.id)?.status, 'checked_in');
    check('H5 authorized browser geolocation submits the signed QR and persists a real isolated check-in');

    assert.equal(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'Check-in fits the phone viewport');
    await mobilePage.screenshot({ path: path.join(output, 'h5-checkin-success.png'), fullPage: true });
    assert.deepEqual(errors, [], 'No browser exceptions'); assert.deepEqual(failures, [], 'No failed static assets');
    check('Phone check-in layout fits 390px with no browser exceptions or broken static assets');
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ checks, errors, failures, unexpectedNavigations, consoleMessages, viewport: { width: 390, height: 844 } }, null, 2));
    console.log('CHECKIN RESULT ' + checks.length + ' passed');
  } catch (error) {
    if (page && !page.isClosed()) {
      await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
      fs.writeFileSync(path.join(output, 'failure.txt'), await page.locator('body').innerText().catch(() => 'Page unavailable'));
    }
    fs.writeFileSync(path.join(output, 'failure-results.json'), JSON.stringify({ checks, errors, failures, consoleMessages }, null, 2));
    throw error;
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
