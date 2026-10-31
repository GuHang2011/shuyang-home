async page => {
  // Run with playwright-cli against scripts/start-preview.ps1 + both fixture scripts.
  if (new URL(page.url()).origin !== 'http://127.0.0.1:18888') throw new Error('Open the isolated Web preview on port 18888 first');
  await page.unrouteAll();
  for (const old of page.context().pages()) if (old !== page) await old.close();
  const results = [], errors = [], stamp = String(Date.now());
  const check = (name, value) => { results.push({ name, passed: !!value });if (!value) throw new Error(name); };
  page.setDefaultTimeout(15000);page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => sessionStorage.clear());await page.reload();
  await page.getByRole('button', { name: '登录 / 加入', exact: true }).click();
  await page.getByLabel('手机号 / 管理员账号').fill('13800008881');
  await page.getByLabel('登录密码', { exact: true }).fill('CommunityMember2026');
  await page.getByRole('button', { name: '登录，回家看看', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: '打开内部聊天', exact: true }).click();
  await page.locator('.conversation').filter({ hasText: '交换申请测试' }).click();
  const webSend = page.locator('.chat-composer button.primary');
  await page.route('**/chat/sticker-packs', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 503, message: '表情目录暂不可用' }) }));
  await page.getByRole('button', { name: '表情包', exact: true }).click();
  await page.getByText('表情目录暂不可用', { exact: false }).waitFor();
  await page.unroute('**/chat/sticker-packs');
  await page.getByRole('button', { name: '重新加载', exact: true }).click();
  await page.getByRole('button', { name: '选择表情：老乡好', exact: true }).waitFor();
  check('catalogue retry restores picker', await page.locator('.sticker-grid button').count() === 6);
  // Simulate failure before this image enters WebKit's decoded-image cache.
  await page.route('**/chat/stickers/hug.png', route => route.fulfill({ status: 404, contentType: 'text/plain', body: 'missing test image' }));
  await page.getByRole('button', { name: '暖心回应', exact: true }).click();
  await page.locator('.sticker-picker').getByText('[表情] 抱抱', { exact: true }).waitFor();
  check('failed image shows readable fallback', true);await page.unroute('**/chat/stickers/hug.png');
  await page.getByRole('button', { name: '关闭表情面板', exact: true }).click();
  await page.getByRole('button', { name: '表情包', exact: true }).click();
  for (const pack of ['乡音问候', '暖心回应']) {
    await page.getByRole('button', { name: pack, exact: true }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('.sticker-grid img')].length === 6 && [...document.querySelectorAll('.sticker-grid img')].every(img => img.complete && img.naturalWidth === 320));
    check(pack + ' has six decoded images', true);
  }
  await page.getByRole('button', { name: '暖心回应', exact: true }).focus();await page.keyboard.press('Escape');
  check('Escape closes picker', await page.locator('.sticker-picker').count() === 0);
  await page.getByRole('button', { name: '表情包', exact: true }).click();
  await page.getByRole('button', { name: '乡音问候', exact: true }).click();
  const before = await page.locator('.message').count();
  await page.getByRole('button', { name: '选择表情：老乡好', exact: true }).click();
  await page.locator('.sticker-pending').waitFor();
  check('selection waits for send', await page.locator('.message').count() === before);
  check('attachment disabled while sticker selected', await page.locator('.chat-attach-tools input').first().isDisabled());
  await page.getByRole('textbox', { name: '聊天消息' }).fill('保留文字草稿');
  await page.getByRole('button', { name: '移除表情', exact: true }).click();
  check('removing sticker preserves draft', await page.getByRole('textbox', { name: '聊天消息' }).inputValue() === '保留文字草稿');
  await page.getByRole('textbox', { name: '聊天消息' }).fill('');
  await page.getByRole('button', { name: '表情包', exact: true }).click();
  await page.getByRole('button', { name: '选择表情：老乡好', exact: true }).click();
  await webSend.click();await page.locator('.sticker-pending').waitFor({ state: 'hidden' });
  await page.locator('.message').last().locator('img[alt="老乡好"]').waitFor();
  check('pure sticker renders without duplicate fallback', await page.locator('.message').last().locator('.message-content p').count() === 0);
  const mobile = await page.context().newPage();mobile.setDefaultTimeout(15000);mobile.on('pageerror', e => errors.push(e.message));
  await mobile.setViewportSize({ width: 390, height: 844 });await mobile.goto('http://127.0.0.1:18890/');
  await mobile.evaluate(() => localStorage.clear());await mobile.reload();
  await mobile.getByText('我的', { exact: true }).click();await mobile.getByText('登录账号', { exact: true }).click();
  await mobile.getByRole('textbox').nth(0).fill('13800008882');await mobile.getByRole('textbox').nth(1).fill('CommunityMember2026');
  await mobile.getByText('登录，回家看看', { exact: true }).click();await mobile.getByText('已通过 · 会员', { exact: true }).waitFor();
  await mobile.locator('.bottom-nav uni-button').filter({ hasText: '消息' }).click();
  await mobile.locator('.chat-conversation').filter({ hasText: '资源主人测试' }).click();
  await mobile.locator('.chat-message').last().locator('.sticker-picture image,.sticker-picture uni-image').waitFor();
  check('Web sticker received on H5', await mobile.locator('.chat-message').last().locator('.chat-bubble').count() === 0);
  await mobile.getByText('表情包', { exact: true }).click();await mobile.getByText('暖心回应', { exact: true }).click();
  await mobile.locator('[aria-label="选择表情：真棒"]').click();
  const caption = '表情配文字 ' + stamp;await mobile.locator('.chat-compose textarea').fill(caption);
  await mobile.getByText('发送', { exact: true }).click();await mobile.locator('.sticker-pending').waitFor({ state: 'hidden' });
  const mobileMessage = mobile.locator('.chat-message').filter({ hasText: caption });await mobileMessage.waitFor();
  check('H5 sticker and caption coexist', await mobileMessage.locator('.sticker-picture').count() === 1);
  const box = await mobileMessage.locator('.sticker-picture').boundingBox();check('H5 sticker has usable dimensions', box.width > 100 && box.height > 100);
  await page.bringToFront();const received = page.locator('.message').filter({ hasText: caption });await received.waitFor({ timeout: 20000 });
  check('H5 sticker received on Web', await received.locator('img[alt="真棒"]').count() === 1);
  await mobile.bringToFront();await mobileMessage.getByText('撤回', { exact: true }).click();
  await mobile.getByText('一条消息已撤回', { exact: true }).last().waitFor();await page.bringToFront();
  await received.waitFor({ state: 'hidden', timeout: 20000 });check('recall removes image and caption on both clients', true);
  const bodies = [];let fail = true;
  await page.route('**/chat/conversations/*/messages', async route => {
    if (route.request().method() !== 'POST') return route.continue();bodies.push(route.request().postDataJSON());
    if (fail) { fail = false;return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 503, message: '网络暂不可用，请重试' }) }); }
    return route.continue();
  });
  await page.getByRole('button', { name: '表情包', exact: true }).click();
  await page.getByRole('button', { name: '选择表情：谢谢啦', exact: true }).click();
  const retryCaption = '重试只发一次 ' + stamp;await page.getByRole('textbox', { name: '聊天消息' }).fill(retryCaption);
  await webSend.click();await page.getByRole('alert').filter({ hasText: '网络暂不可用，请重试' }).waitFor();
  check('failed send keeps sticker and text', await page.locator('.sticker-pending').count() === 1 && await page.getByRole('textbox', { name: '聊天消息' }).inputValue() === retryCaption);
  await webSend.click();await page.locator('.sticker-pending').waitFor({ state: 'hidden' });
  check('retry reuses request id', bodies.length === 2 && bodies[0].requestId === bodies[1].requestId);
  check('retry creates exactly one displayed message', await page.locator('.message').filter({ hasText: retryCaption }).count() === 1);
  await page.unroute('**/chat/conversations/*/messages');
  // Match touch scrolling: do not scroll overflow:hidden containers to hide clipping bugs.
  async function reachable(control) {
    await control.evaluate(el => { for (let p = el.parentElement; p; p = p.parentElement) { if (p !== document.scrollingElement && ['auto', 'scroll'].includes(getComputedStyle(p).overflowY)) { const r = el.getBoundingClientRect(), q = p.getBoundingClientRect();p.scrollTop += (r.top + r.bottom - q.top - q.bottom) / 2; } }const r = el.getBoundingClientRect();window.scrollBy({ top: (r.top + r.bottom - innerHeight) / 2, behavior: 'instant' }); });
    await control.page().waitForTimeout(100);
    return control.evaluate(el => { const r = el.getBoundingClientRect(), nav = document.querySelector('.bottom-nav,.mobile-nav')?.getBoundingClientRect();const bottom = nav?.height ? nav.top : innerHeight;return r.top >= 0 && r.bottom <= bottom + 1 && [.2, .5, .8].every(n => { const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height * n);return hit === el || el.contains(hit); }); });
  }
  for (const [surface, p] of [['web', page], ['h5', mobile]]) {
    await p.bringToFront();
    for (const [width, height] of [[320,568],[360,800],[390,844],[412,915],[844,390],[768,1024],[390,420]]) {
      await p.setViewportSize({ width, height });
      const open = surface === 'web' ? p.getByRole('button', { name: '表情包', exact: true }) : p.getByText('表情包', { exact: true });
      await open.click();await p.locator('.sticker-grid').waitFor();
      check(`${surface} ${width}x${height} no picker overflow`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      const pick = p.locator('[aria-label="选择表情：欢迎回家"]');
      check(`${surface} ${width}x${height} selection reachable`, await reachable(pick));await pick.click();
      const remove = surface === 'web' ? p.getByRole('button', { name: '移除表情', exact: true }) : p.getByText('移除表情', { exact: true });
      check(`${surface} ${width}x${height} removal reachable`, await reachable(remove));
      const submit = p.locator(surface === 'web' ? '.chat-composer button.primary' : '.chat-compose uni-button');
      check(`${surface} ${width}x${height} send reachable`, await reachable(submit));
      if (width === 390 && height === 844) await p.screenshot({ path: `../output/playwright/chat-stickers-${surface}.png`, fullPage: true });
      await remove.click();
    }
    // Leaving the conversation must discard the selection and close the picker.
    const open = surface === 'web' ? p.getByRole('button', { name: '表情包', exact: true }) : p.getByText('表情包', { exact: true });
    await open.click();await p.locator('[aria-label="选择表情：老乡好"]').click();
    await p.locator(surface === 'web' ? '.chat-back' : '.chat-return').click();
    await p.locator(surface === 'web' ? '.conversation' : '.chat-conversation').first().click();
    check(`${surface} leave and reopen clears selection`, await p.locator('.sticker-pending,.sticker-picker').count() === 0);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });await page.bringToFront();
  await page.getByRole('button', { name: '表情包', exact: true }).click();
  await page.screenshot({ path: '../output/playwright/chat-stickers-desktop-picker.png', fullPage: true });
  await mobile.close();check('no uncaught page errors', errors.length === 0);
  return { engine: page.context().browser().browserType().name(), passed: results.length, failed: 0, results, errors };
}
