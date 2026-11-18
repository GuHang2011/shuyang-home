// Real static Web and /mobile/ builds against the disposable HTTPS backend.
const assert = require('node:assert/strict'), path = require('node:path'), fs = require('node:fs');
const { chromium } = require('../frontend/node_modules/playwright');
const origin = process.argv[2];
assert.equal(new URL(origin).hostname, '127.0.0.1', 'Only the local disposable proxy is allowed');
const output = path.resolve(__dirname, '../output/production-proxy');
async function verifyRailModerator(browser, errors, checks) {
  const token = process.env.SHUYANG_TEST_ADMIN_TOKEN;
  const memberId = process.env.SHUYANG_TEST_MEMBER_ID;
  const memberName = process.env.SHUYANG_TEST_MEMBER_NAME;
  if (!token && !memberId && !memberName) return; // Standalone public-page smoke checks need no account.
  assert(token && memberId && memberName, 'Complete disposable administrator/member fixture is required');
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true });
  try {
    await context.addInitScript(value => sessionStorage.setItem('shuyang_home_session', value), token);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push('permissions: ' + error.message));
    await page.goto(origin + '/#admin');
    await page.getByRole('tab', { name: '会员与入会', exact: true }).click();
    const memberRow = page.locator('.member-mobile-row').filter({ hasText: memberName });
    await memberRow.getByRole('button', { name: '权限', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '账号权限', exact: true });
    await dialog.getByRole('combobox').selectOption('moderator');
    const boards = dialog.getByRole('listbox');
    await boards.selectOption(['淮新高铁']);
    const saved = page.waitForResponse(response => response.url() === origin + '/api/admin/members/' + memberId + '/access' && response.request().method() === 'POST');
    await dialog.getByRole('button', { name: '保存权限', exact: true }).click();
    const response = await saved;
    assert.equal(response.status(), 200, 'Moderator permission save succeeds');
    const updated = (await response.json()).data;
    assert.equal(updated.role, 'moderator', 'Member becomes a moderator');
    assert.deepEqual(updated.forumBoards, ['淮新高铁'], 'Save grants only the selected railway board');
    await dialog.waitFor({ state: 'hidden' });
    // Read the persisted member independently of the form and its save response.
    const stored = await page.evaluate(async id => {
      const result = await fetch('/api/admin/members', { headers: { Authorization: 'Bearer ' + sessionStorage.getItem('shuyang_home_session') } });
      const body = await result.json();
      const member = Array.isArray(body.data) ? body.data.find(item => item.id === id) : null;
      return { status: result.status, role: member?.role, boards: member?.forumBoards };
    }, memberId);
    assert.equal(stored.status, 200, 'Administrator can read persisted permissions');
    assert.equal(stored.role, 'moderator', 'Persisted role is moderator');
    assert.deepEqual(stored.boards, ['淮新高铁'], 'No additional board permission is persisted');
    await page.reload();
    await page.getByRole('tab', { name: '会员与入会', exact: true }).click();
    await memberRow.getByRole('button', { name: '权限', exact: true }).click();
    await boards.waitFor();
    assert.deepEqual(await boards.evaluate(select => Array.from(select.selectedOptions, option => option.value)), ['淮新高铁'], 'Reopened permission form retains the exact selected board');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'Permissions page fits the phone width');
    assert.equal(await dialog.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= innerWidth + 1 && element.scrollWidth <= element.clientWidth + 1;
    }), true, 'Permissions dialog fits the phone width');
    await dialog.getByRole('button', { name: '保存权限', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, 'permissions-phone.png'), fullPage: true });
    checks.push('permissions: railway-only moderator grant through UI, persistence and 390px dialog');
  } finally { await context.close(); }
}
async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.SHUYANG_CHROMIUM_PATH });
  const errors = [], failures = [], checks = [];
  try {
    // The proxy uses a generated local certificate. The Python checks validate it with its CA.
    for (const [name, suffix] of [['web', '/#home'], ['h5', '/mobile/']]) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(name + ': ' + error.message));
      page.on('response', response => {
        if (response.url().startsWith(origin) && response.status() >= 400 && !response.url().includes('/api/')) failures.push(response.url());
      });
      await page.goto(origin + suffix);
      await page.locator('.community-title').waitFor();
      if (name === 'h5') await page.locator('.community-shortcuts uni-image > img').first().waitFor({ state: 'attached' });
      await page.waitForFunction(() => [...document.images].filter(img => img.getClientRects().length).every(img => img.complete));
      const images = await page.locator('img').evaluateAll(items => items.filter(img => img.getClientRects().length && (!img.complete || !img.naturalWidth)).map(img => img.src));
      assert.deepEqual(images, [], name + ': visible images load');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, name + ': phone layout fits');
      assert.equal(await page.locator('.demo-toolbar').count(), 0, name + ': no demo controls');
      if (name === 'h5') {
        const staticUrls = await page.locator('img').evaluateAll(items => items.map(img => img.src).filter(src => src.includes('/static/')));
        assert(staticUrls.length > 0 && staticUrls.every(src => src.startsWith(origin + '/mobile/static/')), 'H5 images stay under /mobile/: ' + JSON.stringify(staticUrls));
      }
      await page.screenshot({ path: path.join(output, name + '-phone.png'), fullPage: true });
      checks.push(name + ': production home, images, phone layout and demo isolation');
      await context.close();
    }
    await verifyRailModerator(browser, errors, checks);
    assert.deepEqual(errors, [], 'No browser exceptions');
    assert.deepEqual(failures, [], 'No failed static assets');
    fs.writeFileSync(path.join(output, 'browser-result.json'), JSON.stringify({ checks, errors, failures }, null, 2));
    checks.forEach(check => console.log('PASS: ' + check));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error);process.exitCode = 1; });
