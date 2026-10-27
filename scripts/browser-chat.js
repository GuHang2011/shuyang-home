async page => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:18888');await page.evaluate(() => sessionStorage.clear());await page.reload();await page.setViewportSize({ width: 1440, height: 1000 });
  const wait = () => page.waitForFunction(() => document.querySelector('.content')?.getAttribute('aria-busy') === 'false');
  const login = async (name, password) => { await page.getByRole('button', { name: '登录 / 加入', exact: true }).click();await page.getByLabel('手机号 / 管理员账号').fill(name);await page.getByLabel('登录密码', { exact: true }).fill(password);await page.getByRole('button', { name: '登录，回家看看', exact: true }).click();await page.getByRole('dialog').waitFor({ state: 'hidden' });await wait(); };
  const nav = async name => { await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name, exact: true }).click();await wait(); };
  await login('admin','CommunityAdmin2026');await nav('家里聊聊');await page.getByRole('button', { name: '发现群聊', exact: true }).click();await page.getByRole('button', { name: '创建群聊', exact: true }).click();
  await page.getByLabel('群聊名称').fill('验收群聊 · 周末相聚');await page.getByLabel('群聊介绍').fill('自愿加入，商量老乡活动安排。');await page.getByRole('dialog').getByRole('button', { name: '创建群聊', exact: true }).click();await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByRole('textbox', { name: '聊天消息', exact: true }).fill('欢迎老乡，自愿加入这次隔离测试群。');await page.getByRole('button', { name: '发送消息', exact: false }).click();
  await page.getByRole('button', { name: '我的会员中心', exact: true }).click();await wait();await page.getByRole('button', { name: '退出登录', exact: true }).click();await page.getByRole('button', { name: '登录 / 加入', exact: true }).waitFor();
  await login('13800008881','CommunityMember2026');await nav('老乡名录');await page.locator('.member-card').filter({ hasText: '交换申请测试' }).getByRole('button', { name: '站内聊聊', exact: true }).click();
  await page.getByLabel('说声你好，说明来意').fill('老乡你好，一起商量周末的公益活动。');await page.getByRole('button', { name: '发送聊天申请', exact: true }).click();await page.getByRole('dialog').waitFor({ state: 'hidden' });await page.getByText('问候已送达，等待对方接受后可以继续聊天。', { exact: true }).waitFor();
  const mobile = await page.context().newPage();mobile.on('pageerror', e => errors.push(e.message));await mobile.goto('http://127.0.0.1:18890');await mobile.evaluate(() => localStorage.clear());await mobile.reload();await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.getByText('我的', { exact: true }).click();await mobile.getByText('登录账号', { exact: true }).click();await mobile.getByRole('textbox').nth(0).fill('13800008882');await mobile.getByRole('textbox').nth(1).fill('CommunityMember2026');await mobile.getByText('登录，回家看看', { exact: true }).click();await mobile.getByText('已通过 · 会员', { exact: true }).waitFor();
  await mobile.locator('.bottom-nav').getByText('消息', { exact: false }).click();await mobile.locator('.chat-conversation').filter({ hasText: '资源主人测试' }).click();await mobile.getByText('接受聊天', { exact: true }).click();
  await mobile.locator('.chat-compose textarea').fill('手机收到啦，周末一起见老乡。');await mobile.getByText('发送', { exact: true }).click();await mobile.locator('.chat-bubble').filter({ hasText: '手机收到啦，周末一起见老乡。' }).waitFor();
  await page.bringToFront();await page.locator('.message-content p').filter({ hasText: '手机收到啦，周末一起见老乡。' }).waitFor({ timeout: 15000 });
  await page.getByRole('textbox', { name: '聊天消息', exact: true }).fill('电脑端也收到消息了，跨端聊天成功。');await page.getByRole('button', { name: '发送消息', exact: false }).click();await mobile.bringToFront();await mobile.locator('.chat-bubble').filter({ hasText: '电脑端也收到消息了，跨端聊天成功。' }).waitFor({ timeout: 15000 });
  await page.screenshot({ path: '../output/playwright/chat-desktop.png', fullPage: true, animations: 'disabled' });await mobile.screenshot({ path: '../output/playwright/chat-mobile.png', fullPage: true, animations: 'disabled' });
  await mobile.locator('.chat-message.mine').filter({ hasText: '手机收到啦' }).getByText('撤回', { exact: true }).click();await page.bringToFront();await page.getByText('一条消息已撤回', { exact: true }).waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: '发现群聊', exact: true }).click();await page.locator('.conversation').filter({ hasText: '验收群聊 · 周末相聚' }).click();await page.getByText('欢迎老乡，自愿加入这次隔离测试群。', { exact: true }).waitFor();await page.getByRole('textbox', { name: '聊天消息', exact: true }).fill('我已自愿加入，期待一起活动。');await page.getByRole('button', { name: '发送消息', exact: false }).click();
  await mobile.bringToFront();await mobile.getByText('‹', { exact: true }).click();await mobile.getByText('发现群聊', { exact: true }).click();await mobile.locator('.chat-conversation').filter({ hasText: '验收群聊 · 周末相聚' }).click();await mobile.locator('.chat-bubble').filter({ hasText: '我已自愿加入，期待一起活动。' }).waitFor();await mobile.getByText('退出群聊', { exact: true }).click();await mobile.getByText('确定', { exact: true }).click();await mobile.getByText('家里的消息', { exact: true }).waitFor();
  await mobile.close();
  if (errors.length) throw new Error(errors.join('\n'));
  return { directConsent: 'passed', desktopToMobile: 'passed', mobileToDesktopAutomaticRefresh: 'passed', recall: 'passed', voluntaryGroups: 'passed', leaveGroup: 'passed', runtimeErrors: 0 };
}
