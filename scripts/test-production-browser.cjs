// Real static Web and /mobile/ builds against the disposable HTTPS backend.
const assert = require('node:assert/strict'), path = require('node:path'), fs = require('node:fs');
const { chromium } = require('../frontend/node_modules/playwright');
const origin = process.argv[2];
assert.equal(new URL(origin).hostname, '127.0.0.1', 'Only the local disposable proxy is allowed');
const output = path.resolve(__dirname, '../output/production-proxy');
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
    assert.deepEqual(errors, [], 'No browser exceptions');
    assert.deepEqual(failures, [], 'No failed static assets');
    fs.writeFileSync(path.join(output, 'browser-result.json'), JSON.stringify({ checks, errors, failures }, null, 2));
    checks.forEach(check => console.log('PASS: ' + check));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error);process.exitCode = 1; });
