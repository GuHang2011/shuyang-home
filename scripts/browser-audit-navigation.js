async page => {
  const errors = [], visited = [], layouts = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  const base = new URL(page.url());
  if (!['127.0.0.1', 'localhost'].includes(base.hostname)) throw new Error('Open the isolated local Web preview before running this audit');
  await page.goto(base.origin + '/');
  await page.evaluate(() => sessionStorage.removeItem('shuyang_home_session'));
  await page.reload();
  await page.getByRole('button', { name: '登录 / 加入', exact: true }).click();
  await page.getByRole('textbox', { name: '手机号 / 管理员账号' }).fill('13800008881');
  await page.getByRole('textbox', { name: '登录密码', exact: true }).fill('CommunityMember2026');
  await page.getByRole('button', { name: '登录，回家看看', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  const navigation = page.getByRole('navigation', { name: '主导航', exact: true });
  const buttons = await navigation.getByRole('button').allTextContents();
  for (const [index, name] of buttons.entries()) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await navigation.getByRole('button').nth(index).click();
    await page.locator('.content[aria-busy="false"]').waitFor();
    await page.getByRole('heading', { level: 1 }).waitFor();
    if (await page.locator('.page-alert').count()) throw new Error(name + ': ' + await page.locator('.page-alert').innerText());
    visited.push(name.trim());
    await page.setViewportSize({ width: 390, height: 844 });
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    if (width > 391) throw new Error(name + ': overflow at 390px: ' + width);
    layouts.push(name.trim());
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await navigation.getByRole('button', { name: '家里聊聊', exact: true }).click();
  await page.locator('.conversation').filter({ hasText: '交换申请测试' }).click();
  const message = '三角色回归：聊天发送 ' + Date.now();
  await page.getByRole('textbox', { name: '聊天消息', exact: true }).fill(message);
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  const bubble = page.locator('.message').filter({ hasText: message });
  await bubble.waitFor();
  await bubble.getByRole('button', { name: '撤回', exact: true }).click();
  await page.getByText('一条消息已撤回', { exact: true }).first().waitFor();
  if (errors.length) throw new Error(errors.join('\n'));
  return { visited, phoneLayouts: layouts.length, chatSendAndRecall: 'passed', pageErrors: errors };
}
