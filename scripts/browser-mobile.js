async page => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:18890');
  await page.getByText('我的', { exact: true }).click();
  await page.getByText('登录账号', { exact: true }).click();
  await page.getByRole('textbox').nth(0).fill('13800009991');
  await page.getByRole('textbox').nth(1).fill('BrowserMember2026');
  await page.getByText('登录，回家看看', { exact: true }).click();
  await page.getByText('已通过 · 会员', { exact: true }).waitFor();
  await page.getByText('验收活动 · 老乡茶叙', { exact: true }).waitFor();
  await page.getByText('验收互助 · 周末同行', { exact: true }).waitFor();
  await page.getByText('老乡名录', { exact: true }).click();
  await page.getByText('验收老乡', { exact: true }).waitFor();
  if (await page.getByText('联系方式：13800009991', { exact: true }).count()) throw new Error('Private phone exposed');
  await page.getByText('活动', { exact: true }).click();
  await page.getByText('验收活动 · 老乡茶叙', { exact: true }).click();
  await page.getByText('你已报名，期待相见', { exact: true }).waitFor();
  await page.screenshot({ path: '../output/playwright/uni-h5-event.png', fullPage: true, animations: 'disabled' });
  await page.getByText('首页', { exact: true }).click();
  await page.screenshot({ path: '../output/playwright/uni-h5-home.png', fullPage: true, animations: 'disabled' });
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('uni-app H5 login, shared signup/post records, member directory privacy: PASS');
}
