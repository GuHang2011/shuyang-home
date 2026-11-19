// Real H5 image-preview lifecycle against isolated, synthetic demo records.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), zlib = require('node:zlib');
const { pathToFileURL } = require('node:url');
const driver = process.env.SHUYANG_PLAYWRIGHT_MODULE || path.resolve(__dirname, '../frontend/node_modules/playwright');
const { chromium } = require(driver), { expect } = require(driver + '/test');
const root = path.resolve(__dirname, '..'), build = path.join(root, 'frontend/mobile/dist/build/h5'), out = path.join(root, 'output/chat-preview-browser');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
function samplePng(alternate = false) {
  const width = 320, height = 200, rows = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = y * (width * 3 + 1) + 1 + x * 3;
    const block = x > 32 && x < 288 && y > 32 && y < 168;
    const color = block ? alternate ? [174, 126, 69] : [41, 73, 91] : [249, 244, 232];
    rows.set(color, offset);
  }
  const crc32 = buffer => { let crc = 0xffffffff; for (const byte of buffer) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; };
  const chunk = (name, data) => { const type = Buffer.from(name), size = Buffer.alloc(4), crc = Buffer.alloc(4); size.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([type, data]))); return Buffer.concat([size, type, data, crc]); };
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}
async function run() {
  if (!fs.existsSync(path.join(build, 'index.html'))) throw Error('Build the mobile H5 application before running this browser regression.');
  fs.mkdirSync(out, { recursive: true });
  const { createDemoState, demoRequest } = await import(pathToFileURL(path.join(root, 'frontend/demo/demo-runtime.mjs')));
  const state = createDemoState(), checks = [], errors = [], apiErrors = [];
  const check = name => { checks.push(name); console.log('PASS:', name); };
  const fixture = (url, method = 'GET', body) => demoRequest(state, new Request('https://demo.invalid/api' + url, {
    method, headers: { Authorization: 'Bearer demo-member', ...(!(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) },
    ...(body !== undefined ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {})
  }));
  async function imageMessage(name, alternate) {
    const form = new FormData(); form.set('scope', 'chat'); form.set('roomId', 'demo-room'); form.set('file', new Blob([samplePng(alternate)], { type: 'image/png' }), name + '.png');
    const media = await fixture('/media/upload', 'POST', form);
    return fixture('/chat/conversations/demo-room/messages', 'POST', { content: name, attachmentId: media.id, requestId: 'chat-preview-' + name });
  }
  const shown = await imageMessage('合成预览图片', false), unopened = await imageMessage('未打开的合成图片', true);
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (pathname.startsWith('/api/')) {
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        const method = req.method || 'GET';
        const data = await demoRequest(state, new Request('https://demo.invalid' + req.url, { method, headers: req.headers, ...(!['GET', 'HEAD'].includes(method) ? { body: Buffer.concat(chunks) } : {}) }));
        if (data instanceof Blob) { res.writeHead(200, { 'Content-Type': data.type, 'Content-Length': data.size }); res.end(Buffer.from(await data.arrayBuffer())); return; }
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ code: 0, data })); return;
      }
      const file = path.resolve(build, pathname.slice(1) || 'index.html');
      if (!file.startsWith(build + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(file).pipe(res);
    } catch (error) { apiErrors.push({ url: req.url, message: error.message }); res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ code: 1, message: error.message })); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  let browser, page;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.SHUYANG_CHROMIUM_PATH ? { executablePath: process.env.SHUYANG_CHROMIUM_PATH } : {}) });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    page = await context.newPage(); page.setDefaultTimeout(12000); page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/#/pages/index/index');
    await page.locator('.bottom-nav').getByText('我的', { exact: true }).click();
    await page.getByText('登录账号', { exact: true }).click();
    await page.locator('.field').filter({ has: page.getByText('手机号 / 管理员账号', { exact: true }) }).locator('input').fill('demo');
    await page.locator('.field').filter({ has: page.getByText('密码', { exact: true }) }).locator('input').fill('Demo12345678');
    await page.getByText('登录，回家看看', { exact: true }).click();
    await expect(page.getByText('演示会员', { exact: true }).first()).toBeVisible();
    await page.locator('.bottom-nav').getByText('消息', { exact: true }).click();
    await page.locator('.chat-conversation').filter({ hasText: '老乡体验群' }).click();
    const shownRow = page.locator('#chat-message-' + shown.sequence), unopenedRow = page.locator('#chat-message-' + unopened.sequence);
    await expect(shownRow.locator('.attachment-image')).toBeVisible(); await expect(unopenedRow.locator('.attachment-image')).toBeVisible();
    await expect.poll(() => shownRow.locator('.attachment-image img').evaluate(img => img.complete && img.naturalWidth === 320)).toBe(true);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    check('390px H5 login loads two synthetic group-chat image messages');
    await shownRow.locator('.attachment-image').click();
    const previewImage = page.locator('#u-a-p img');
    await expect(previewImage).toBeVisible();
    await expect.poll(() => previewImage.evaluate(img => img.complete && img.naturalWidth === 320)).toBe(true);
    const previewUrl = await previewImage.getAttribute('src');
    expect(previewUrl).toMatch(/^blob:/);
    await page.screenshot({ path: path.join(out, 'h5-preview-open.png'), animations: 'disabled' });
    check('group-chat image opens the actual UniApp fullscreen preview and decodes');

    async function recallElsewhere(message) {
      // A separate request by the same synthetic member represents another open
      // session; the visible H5 page must discover this through its normal poll.
      const refreshed = page.waitForResponse(async response => {
        if (new URL(response.url()).pathname !== '/api/chat/conversations/demo-room' || response.request().method() !== 'GET') return false;
        const result = await response.json(); return result.data?.messages?.some(row => row.id === message.id && row.recalled === true);
      });
      await fixture('/chat/messages/' + message.id + '/recall', 'POST', {});
      await refreshed;
      await expect(page.locator('#chat-message-' + message.sequence + ' .chat-recalled')).toHaveText('一条消息已撤回');
      await expect(page.locator('#chat-message-' + message.sequence + ' .attachment-image')).toHaveCount(0);
    }
    await recallElsewhere(unopened);
    await expect(previewImage).toBeVisible(); await expect(previewImage).toHaveAttribute('src', previewUrl);
    await expect.poll(() => previewImage.evaluate(img => img.complete && img.naturalWidth === 320)).toBe(true);
    check('recalling an unopened image through polling preserves the currently owned preview');
    await page.screenshot({ path: path.join(out, 'h5-preview-after-other-recall.png'), animations: 'disabled' });

    await recallElsewhere(shown);
    await expect(previewImage).toHaveCount(0);
    await expect(page.locator('.chat-recalled')).toHaveCount(2);
    await expect(page.locator('.chat-compose')).toBeVisible();
    await page.screenshot({ path: path.join(out, 'h5-preview-closed-on-recall.png'), animations: 'disabled' });
    check('recalling the previewed image closes the fullscreen viewer and shows the recalled message');
    expect(errors).toEqual([]); expect(apiErrors).toEqual([]);
    check('isolated H5 preview flow has no page errors or API failures');
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ checks, errors, apiErrors, viewport: { width: 390, height: 844 } }, null, 2));
    console.log('RESULT ' + checks.length + ' passed');
  } catch (error) {
    if (page && !page.isClosed()) { await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }); fs.writeFileSync(path.join(out, 'failure.html'), await page.content()); fs.writeFileSync(path.join(out, 'failure.txt'), await page.locator('body').innerText()); }
    fs.writeFileSync(path.join(out, 'failure-results.json'), JSON.stringify({ checks, errors, apiErrors }, null, 2)); throw error;
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
