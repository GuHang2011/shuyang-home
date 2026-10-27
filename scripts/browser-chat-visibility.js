async page => {
  // Run after browser-chat.js against the isolated fixture database.
  await page.bringToFront();
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '家里聊聊', exact: true }).click();
  await page.getByRole('button', { name: '我的会话', exact: true }).click();
  await page.locator('.conversation').filter({ hasText: '交换申请测试' }).click();
  const mobile = await page.context().newPage();
  try {
    await mobile.goto('http://127.0.0.1:18890');
    await mobile.setViewportSize({ width: 390, height: 844 });
    await mobile.locator('.bottom-nav').getByText('消息', { exact: false }).click();
    await mobile.locator('.chat-conversation').filter({ hasText: '资源主人测试' }).click();
    await mobile.locator('.chat-compose textarea').waitFor();
    const login = await (await page.request.post('http://127.0.0.1:19999/auth/login', { data: { username: '13800008882', password: 'CommunityMember2026' } })).json();
    const headers = { Authorization: 'Bearer ' + login.data.token };
    await page.bringToFront();
    // Automation keeps all tabs visible; simulate the platform visibility signal.
    await mobile.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });document.dispatchEvent(new Event('visibilitychange')); });
    const content = '后台未读验收 ' + Date.now();
    await page.getByRole('textbox', { name: '聊天消息', exact: true }).fill(content);
    await page.getByRole('button', { name: '发送消息', exact: false }).click();
    await page.locator('.message-content p').filter({ hasText: content }).waitFor();
    // Observe two active-page refreshes, exceeding the hidden page's 4-second timer.
    for (let i = 0; i < 2; i++) await page.waitForResponse(r => r.url().endsWith('/api/chat/conversations'), { timeout: 12000 });
    const unread = await (await page.request.get('http://127.0.0.1:19999/chat/unread', { headers })).json();
    if (unread.data.count < 1) throw new Error('Hidden conversation incorrectly marked the message read');
    const read = mobile.waitForResponse(r => /\/chat\/conversations\/[^/]+\/read$/.test(r.url()) && r.request().method() === 'POST', { timeout: 15000 });
    await mobile.bringToFront();
    await mobile.evaluate(() => { delete document.hidden;document.dispatchEvent(new Event('visibilitychange')); });
    await mobile.locator('.chat-bubble').filter({ hasText: content }).waitFor({ timeout: 15000 });
    await read;
    const after = await (await page.request.get('http://127.0.0.1:19999/chat/unread', { headers })).json();
    if (after.data.count !== 0) throw new Error('Foreground conversation did not mark the message read');
    return { simulatedBackgroundUnreadPreserved: true, foregroundRead: true };
  } finally { await mobile.close(); }
}
