async page => {
  const errors = [];
  const failed = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.url().includes('/api/') && response.status() >= 500) failed.push(response.url() + ' ' + response.status()); });
  async function loginWeb() {
    if (await page.getByRole('button', { name: '我的会员中心', exact: true }).count()) {
      await page.getByRole('button', { name: '我的会员中心', exact: true }).click();
      if (await page.getByRole('button', { name: '退出登录', exact: true }).count()) await page.getByRole('button', { name: '退出登录', exact: true }).click();
    }
    await page.getByRole('button', { name: '登录 / 加入', exact: true }).click();
    await page.getByRole('textbox', { name: '手机号 / 管理员账号' }).fill('admin');
    await page.getByRole('textbox', { name: '登录密码', exact: true }).fill('CommunityAdmin2026');
    await page.getByRole('button', { name: '登录，回家看看', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:18888/');
  await loginWeb();
  await page.getByRole('button', { name: '相聚相册', exact: true }).click();
  await page.getByText('沭阳之家活动影像', { exact: true }).waitFor();
  await page.getByRole('button', { name: '家乡特产', exact: true }).click();
  await page.getByRole('heading', { name: '家乡好物，捎一份乡情', exact: true }).waitFor();
  await page.getByRole('button', { name: '老乡论坛', exact: true }).click();
  await page.getByRole('heading', { name: '聊乡音，话家常', exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:18888/');
  const small = await page.evaluate(() => [...document.querySelectorAll('button')].map(el => Math.round(el.getBoundingClientRect().height)).filter(h => h > 0 && h < 44));
  if (small.length) throw new Error('Web mobile touch targets below 44px: ' + JSON.stringify(small));
  await page.goto('http://127.0.0.1:18890/');
  await page.getByText('我的', { exact: true }).click();
  if (await page.getByText('退出', { exact: true }).count()) await page.getByText('退出', { exact: true }).click();
  await page.getByText('登录账号', { exact: true }).click();
  await page.getByRole('textbox').nth(0).fill('13800008881');
  await page.getByRole('textbox').nth(1).fill('CommunityMember2026');
  await page.getByText('登录，回家看看', { exact: true }).click();
  await page.getByText('已通过 · 会员', { exact: true }).waitFor();
  await page.getByText('我的论坛话题', { exact: true }).click();
  const mobileSmall = await page.evaluate(() => [...document.querySelectorAll('uni-button')].map(el => Math.round(el.getBoundingClientRect().height)).filter(h => h > 0 && h < 44));
  if (mobileSmall.length) throw new Error('H5 touch targets below 44px: ' + JSON.stringify(mobileSmall));
  if (errors.length || failed.length) throw new Error(JSON.stringify({ errors, failed }));
  await page.screenshot({ path: '../output/playwright/phase2-final-h5-home.png', fullPage: true, animations: 'disabled' });
  return { webModules: ['gallery-source-card', 'shop', 'forum'], webPhoneTouchTargets: 'passed', h5LoginAndForum: 'passed', h5TouchTargets: 'passed' };
}
