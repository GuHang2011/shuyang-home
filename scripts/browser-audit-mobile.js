async page => {
  const passed = [], errors = [];
  const check = (condition, label) => { if (!condition) throw new Error(label); passed.push(label); };
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  const base = new URL(page.url());
  if (!['127.0.0.1', 'localhost'].includes(base.hostname)) throw new Error('Open the isolated local H5 preview before running this audit');
  await page.goto(base.origin + '/');
  await page.getByText('我的', { exact: true }).click();
  if (await page.getByText('退出', { exact: true }).count()) await page.getByText('退出', { exact: true }).click();
  await page.getByText('登录账号', { exact: true }).click();
  await page.getByRole('textbox').nth(0).fill('13800008881');
  await page.getByRole('textbox').nth(1).fill('CommunityMember2026');
  await page.getByText('登录，回家看看', { exact: true }).click();
  await page.getByText('已通过 · 会员', { exact: true }).waitFor();
  await page.getByText('首页', { exact: true }).click();
  let release;
  const pending = new Promise(resolve => release = resolve);
  const slow = async route => { await pending;await route.continue(); };
  await page.route('**/api/products?*', slow);
  await page.locator('uni-button').filter({ hasText: '家乡特产' }).click();
  try {
    await page.getByText('正在加载商品与订单…', { exact: true }).waitFor();
    check(await page.getByText(/家乡好物正在准备中/).count() === 0, 'H5 slow loading does not claim catalogue is empty');
  } finally { release(); }
  await page.getByText('验收特产 · 不销售', { exact: true }).waitFor();
  await page.unroute('**/api/products?*', slow);
  await page.getByRole('textbox').fill('不存在的审计商品');
  await page.getByText('没有找到符合条件的商品。', { exact: false }).waitFor();
  await page.getByText('清除筛选', { exact: true }).click();
  await page.getByText('验收特产 · 不销售', { exact: true }).click();
  await page.getByText('填写订单', { exact: true }).click();
  let writes = 0;
  const countOrder = request => { if (request.url().endsWith('/api/orders') && request.method() === 'POST') writes++; };
  page.on('request', countOrder);
  await page.locator('.form-page input').nth(0).fill('0');
  await page.getByText('提交订单 · 待人工确认', { exact: true }).click();
  await page.getByText('购买数量须为1至可售库存范围内的整数，每单最多99件', { exact: true }).waitFor();
  check(writes === 0, 'H5 invalid quantity is rejected before sending any order');
  await page.locator('.form-page input').nth(0).fill('1');
  await page.locator('.form-page textarea').fill('江苏省苏州市测试地址，仅用于隔离验收');
  // uni-app forwards native input/tap events asynchronously on H5.
  await page.waitForTimeout(400);
  await page.getByText('提交订单 · 待人工确认', { exact: true }).click();
  await page.getByText('请先确认商品、售后说明与收货信息使用约定', { exact: true }).waitFor();
  check(writes === 0, 'H5 requires explicit order consent');
  await page.locator('uni-switch').click();
  await page.waitForTimeout(400);
  await page.getByText('提交订单 · 待人工确认', { exact: true }).click();
  await page.getByText('订单已提交，等待卖家人工确认；请勿重复下单。', { exact: true }).waitFor();
  await page.getByText('取消订单', { exact: true }).first().waitFor();
  check(writes === 1, 'H5 creates one real order and shows success');
  page.off('request', countOrder);
  for (const size of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 412, height: 915 }, { width: 768, height: 1024 }]) {
    await page.setViewportSize(size);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `H5 order layout fits ${size.width}px`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('uni-toast').waitFor({ state: 'hidden' });
  await page.screenshot({ path: '../output/playwright/audit-h5-orders.png', fullPage: true });
  check(errors.length === 0, 'no H5 uncaught browser errors: ' + errors.join('; '));
  return { passed, count: passed.length };
}
