// Actual Web/H5 builds against isolated synthetic records using the repository demo API.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require('../frontend/node_modules/playwright'), { expect } = require('../frontend/node_modules/playwright/test');
const root = path.resolve(__dirname, '..'), web = path.join(root, 'frontend/dist'), mobile = path.join(root, 'frontend/mobile/dist/build/h5'), output = path.join(root, 'output/event-discovery-browser');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
async function run() {
  assert(fs.existsSync(path.join(web, 'index.html')) && fs.existsSync(path.join(mobile, 'index.html')), 'Build Web and H5 first');
  fs.mkdirSync(output, { recursive: true });
  const { createDemoState, demoRequest } = await import(pathToFileURL(path.join(root, 'frontend/demo/demo-runtime.mjs')));
  let state, failSignup = false; const checks = [], errors = [], apiErrors = [];
  const check = name => { checks.push(name); console.log('PASS:', name); };
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (pathname.startsWith('/api/')) {
        // Home mounts before H5 navigation; keep unrelated weather independent of external services.
        if (pathname === '/api/weather') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ code: 0, data: { current: { temperature_2m: 18, weather_code: 0, is_day: 1 }, daily: { time: [] } } })); return; }
        if (failSignup && pathname === '/api/events/open/signup') {
          failSignup = false; state.signups.push({ id: 'late-seat', eventId: 'open', userId: 'demo-admin', status: 'registered', createdAt: new Date().toISOString() });
          res.writeHead(409, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ code: 409, message: '本次活动名额已满' })); return;
        }
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        const method = req.method || 'GET', data = await demoRequest(state, new Request('https://demo.invalid' + req.url, { method, headers: req.headers, ...(!['GET', 'HEAD'].includes(method) ? { body: Buffer.concat(chunks) } : {}) }));
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ code: 0, data })); return;
      }
      const dir = pathname.startsWith('/mobile/') ? mobile : web, relative = dir === mobile ? pathname.slice('/mobile/'.length) : pathname.slice(1), file = path.resolve(dir, relative || 'index.html');
      if (!file.startsWith(dir + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(file).pipe(res);
    } catch (error) { apiErrors.push({ url: req.url, message: error.message }); res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ code: 1, message: error.message })); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port; let browser, page;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.SHUYANG_CHROMIUM_PATH ? { executablePath: process.env.SHUYANG_CHROMIUM_PATH } : {}) });
    for (const surface of ['web', 'mobile']) {
      state = createDemoState(); state.broadcasts = []; state.signups = []; const clock = Date.now();
      const event = (id, title, extra = {}) => ({ id, title, category: '交流分享', location: '苏州吴中演示活动室', description: '此为合成展示活动，用于验证筛选、报名及状态变化，不实际举办。', status: 'published', capacity: 10, startsAt: new Date(clock + 86400000).toISOString(), endsAt: new Date(clock + 90000000).toISOString(), createdAt: new Date(clock).toISOString(), ...extra });
      state.events = [event('open', '苏州摄影交流会', { capacity: 1 }), event('full', '植物养护分享', { capacity: 1 }), event('joined', '周末老乡茶话会'), event('ongoing', '社区志愿活动', { category: '公益志愿', startsAt: new Date(clock - 60000).toISOString(), endsAt: new Date(clock + 3600000).toISOString() }), event('ended', '家乡手作体验', { startsAt: new Date(clock - 7200000).toISOString(), endsAt: new Date(clock - 3600000).toISOString() }), event('cancelled', '周末徒步相约', { status: 'cancelled' }), event('boundary', '读书交流会', { startsAt: new Date(clock + 60000).toISOString(), endsAt: new Date(clock + 120000).toISOString() }), event('my-boundary', '老乡志愿集合', { startsAt: new Date(clock + 60000).toISOString(), endsAt: new Date(clock + 120000).toISOString() })];
      for (const [eventId, userId] of [['full', 'demo-admin'], ['joined', 'demo-member'], ['my-boundary', 'demo-member']]) state.signups.push({ id: 'signup-' + eventId, eventId, userId, status: 'registered', hours: 0, createdAt: new Date(clock).toISOString() });
      const context = await browser.newContext({ viewport: surface === 'web' ? { width: 1360, height: 1050 } : { width: 390, height: 844 }, timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce' });
      await context.addInitScript(() => { sessionStorage.setItem('shuyang_home_session', 'demo-member'); localStorage.setItem('shuyang_home_token', 'demo-member'); });
      page = await context.newPage(); page.setDefaultTimeout(12000); page.on('pageerror', error => errors.push(surface + ': ' + error.message));
      await page.clock.install({ time: clock }); await page.clock.pauseAt(clock);
      await page.goto(base + (surface === 'web' ? '/#events' : '/mobile/'));
      const goEvents = () => surface === 'web' ? page.locator('.sidebar').getByRole('button', { name: '乡情活动', exact: true }).click() : page.locator('.bottom-nav').getByText('活动', { exact: true }).click();
      if (surface === 'mobile') await goEvents();
      const cards = surface === 'web' ? page.locator('.event-card') : page.locator('.panel').filter({ has: page.locator('.card-actions') });
      await expect(cards).toHaveCount(8);
      const button = (container, name) => surface === 'web' ? container.getByRole('button', { name, exact: true }) : container.getByText(name, { exact: true });
      const disabled = async (control, value = true) => expect.poll(() => control.evaluate(element => element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true' || element.classList.contains('uni-button-disabled'))).toBe(value);
      if (surface === 'mobile') {
        const firstTitle = cards.first().locator('.card-title'), titleBox = await firstTitle.boundingBox(), navBox = await page.locator('.bottom-nav').boundingBox();
        assert(titleBox && navBox && titleBox.y >= 0 && titleBox.y + titleBox.height < navBox.y, 'First activity title must appear above mobile bottom navigation without scrolling');
        await page.screenshot({ path: path.join(output, 'mobile-event-first-screen.png'), animations: 'disabled' });
        await button(page, '＋ 发起活动／我的申请').click(); await expect(page.getByText('我的活动发起', { exact: true })).toBeVisible();
        await button(page, '＋ 发起活动').click(); await expect(page.getByText('发起活动申请', { exact: true })).toBeVisible();
        await button(page, '← 返回').last().click(); await expect(page.getByText('我的活动发起', { exact: true })).toBeVisible();
        await button(page, '← 返回').click(); await expect(cards).toHaveCount(8);
        check('mobile: first activity appears in the initial viewport and organizer application/list remain accessible');
      }
      const filters = page.locator('.event-status-filters'), filter = name => button(filters, name);
      await filter('可报名').click(); await expect(cards).toHaveCount(2); await expect(cards).toContainText(['苏州摄影交流会', '读书交流会']);
      const search = surface === 'web' ? page.locator('.search-box input') : page.locator('.search input');
      const fillSearch = async value => { await search.fill(value); if (surface === 'mobile') await page.clock.runFor(150); }; // Uni H5 throttles input updates for 100 ms.
      await fillSearch('  摄影  '); await expect(cards).toHaveCount(1); await expect(cards).toContainText(['苏州摄影交流会']);
      await fillSearch('不存在的活动'); await expect(cards).toHaveCount(0); await button(page, '清除筛选').click(); await expect(cards).toHaveCount(8);
      await filter('已结束').click(); await expect(cards).toHaveCount(1); await expect(cards).toContainText(['家乡手作体验']);
      await filter('我已报名').click(); await expect(cards).toHaveCount(2);
      check(`${surface}: normal list filters exclude full/ongoing/ended/cancelled/joined events and combine with trimmed search`);

      await filter('全部活动').click(); await cards.filter({ hasText: '植物养护分享' }).getByText('植物养护分享', { exact: true }).click();
      const detail = surface === 'web' ? page.locator('dialog[open]') : page.locator('.form-page');
      await disabled(button(detail, '已满员'));
      const close = () => button(page, surface === 'web' ? '关闭弹窗' : '← 返回').click();
      await close(); await cards.filter({ hasText: '苏州摄影交流会' }).getByText('苏州摄影交流会', { exact: true }).click();
      failSignup = true; await button(detail, '我要报名').click(); await expect(page.getByText('本次活动名额已满', { exact: false })).toBeVisible();
      await button(page, surface === 'web' ? '刷新活动' : '重新加载').click(); await disabled(button(detail, '已满员'));
      await expect(page.getByText('本次活动名额已满', { exact: false })).toHaveCount(0); await close();
      check(`${surface}: full-capacity failure can refresh the still-open detail and disables the obsolete signup action`);

      if (surface === 'web') await page.getByRole('button', { name: '我的会员中心', exact: true }).click(); else await page.locator('.bottom-nav').getByText('我的', { exact: true }).click();
      const mine = surface === 'web' ? page.locator('.record-row').filter({ hasText: '周末老乡茶话会' }) : page.locator('.panel').filter({ hasText: '周末老乡茶话会' });
      await button(mine, '取消报名').click();
      if (surface === 'web') await page.locator('dialog[open]').getByRole('button', { name: '确认', exact: true }).click();
      else { await page.locator('uni-modal').getByText('确定', { exact: true }).click(); await page.clock.runFor(350); } // Allow Uni modal's leave transition to remove its overlay.
      await expect(mine).toContainText('已取消'); assert.equal(state.signups.find(row => row.eventId === 'joined').status, 'cancelled');
      await goEvents(); await filter('可报名').click(); await expect(cards.filter({ hasText: '周末老乡茶话会' })).toHaveCount(1);
      check(`${surface}: cancelling through My Account releases the registration and restores availability`);

      await cards.filter({ hasText: '读书交流会' }).getByText('读书交流会', { exact: true }).click(); await disabled(button(detail, '我要报名'), false);
      await page.clock.fastForward(60000); await disabled(button(detail, '进行中')); if (surface === 'mobile') await page.clock.runFor(350);
      await page.screenshot({ path: path.join(output, surface + '-ongoing-event.png'), fullPage: true, animations: 'disabled' });
      await page.clock.fastForward(60000); await disabled(button(detail, '已结束')); await close();
      if (surface === 'web') await page.getByRole('button', { name: '我的会员中心', exact: true }).click(); else await page.locator('.bottom-nav').getByText('我的', { exact: true }).click();
      const expiredCancellation = surface === 'web' ? page.locator('.record-row').filter({ hasText: '老乡志愿集合' }) : page.locator('.panel').filter({ hasText: '老乡志愿集合' });
      await expect(button(expiredCancellation, '取消报名')).toHaveCount(0); await expect(expiredCancellation).toContainText('活动已开始');
      check(`${surface}: open detail crosses start/end boundaries automatically and past-start cancellation is removed`);
      await goEvents(); await filter('全部活动').click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      await page.screenshot({ path: path.join(output, surface + '-event-list.png'), fullPage: true, animations: 'disabled' });
      await context.close();
    }
    assert.deepEqual(errors, []); assert.deepEqual(apiErrors, []);
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ checks, errors, apiErrors }, null, 2)); console.log(`EVENT DISCOVERY RESULT ${checks.length} passed`);
  } catch (error) {
    if (page && !page.isClosed()) { await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {}); fs.writeFileSync(path.join(output, 'failure.txt'), await page.locator('body').innerText().catch(() => 'Page unavailable')); }
    throw error;
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
