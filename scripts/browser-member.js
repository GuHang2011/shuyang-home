async page => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '登录 / 加入', exact: true }).click();
  await page.getByRole('textbox', { name: '手机号 / 管理员账号' }).fill('13800009991');
  await page.getByRole('textbox', { name: '登录密码', exact: true }).fill('BrowserMember2026');
  await page.getByRole('button', { name: '登录，回家看看', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByRole('navigation', { name: '手机导航' }).getByRole('button', { name: '活动', exact: true }).click();
  await page.getByRole('button', { name: '查看详情', exact: true }).click();
  await page.getByRole('button', { name: '我要报名', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: '已报名 · 查看', exact: true }).waitFor();
  await page.screenshot({ path: '../output/playwright/events-mobile.png', fullPage: true });
  await page.getByRole('navigation', { name: '手机导航' }).getByRole('button', { name: '互助', exact: true }).click();
  await page.getByRole('button', { name: '发布互助', exact: true }).click();
  await page.getByRole('textbox', { name: '标题', exact: true }).fill('验收互助 · 周末同行');
  await page.getByRole('textbox', { name: '具体内容', exact: true }).fill('用于浏览器验收的互助信息，等待管理员审核，测试完成后清空。');
  await page.getByRole('button', { name: '提交审核', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByRole('navigation', { name: '手机导航' }).getByRole('button', { name: '我的', exact: true }).click();
  await page.getByText('验收互助 · 周末同行', { exact: true }).waitFor();
  await page.getByRole('button', { name: '编辑资料', exact: true }).click();
  await page.getByRole('checkbox', { name: '向已审核会员公开我的名录资料', exact: true }).check();
  await page.getByRole('button', { name: '保存资料', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByRole('navigation', { name: '手机导航' }).getByRole('button', { name: '首页', exact: true }).click();
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: width > 700 ? 1050 : 844 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    if (overflow) throw new Error('Horizontal overflow at ' + width);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '../output/playwright/home-mobile.png', fullPage: true });
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Mobile login, signup, post, profile, 360/390/768/1440 widths: PASS');
}
