async page => {
  // Synthetic accounts created by prepare-community-fixture.py; never run against production.
  if (new URL(page.url()).origin !== 'http://127.0.0.1:18888') throw Error('Open the isolated Web preview on port 18888');
  page.setDefaultTimeout(12000);
  const passed = [], errors = [], tokens = {}, stamp = Date.now();
  page.on('pageerror', e => errors.push(e.message));
  const web = 'http://127.0.0.1:18888', h5 = 'http://127.0.0.1:18890', api = 'http://127.0.0.1:19999';
  const nav = name => page.getByRole('navigation', { name: '主导航', exact: true }).getByRole('button', { name: name === '管理工作台' ? /^管理工作台/ : name, exact: name !== '管理工作台' }).click();
  const button = name => page.getByRole('button', { name, exact: true });
  const closed = () => page.locator('dialog[open]').waitFor({ state: 'hidden' });
  async function as(username) {
    if (!tokens[username]) {
      const response = await page.request.post(api + '/auth/login', { data: { username, password: username === 'admin' ? 'CommunityAdmin2026' : 'CommunityMember2026' } });
      const result = await response.json();if (!response.ok() || result.code !== 0) throw Error('Fixture login failed: ' + result.message);
      tokens[username] = result.data.token;
    }
    await page.setViewportSize({ width: 1440, height: 1000 });await page.goto(web);
    await page.evaluate(token => sessionStorage.setItem('shuyang_home_session', token), tokens[username]);await page.reload();
    await page.locator('.content[aria-busy="false"]').waitFor();
  }
  const resourceTitle = '模块验收 · 技能交换 ' + stamp, postTitle = '模块验收 · 邻里帮助 ' + stamp, railTitle = '模块验收 · 原创高铁观察 ' + stamp;
  await as('13800008881');await nav('资源互换');await button('发布交换资源').click();
  await page.getByLabel('标题', { exact: true }).fill(resourceTitle);
  await page.getByLabel('我能提供', { exact: true }).fill('为隔离测试活动拍摄照片，不涉及真实交易。');
  await page.getByLabel('我需要', { exact: true }).fill('交流一次基础视频剪辑方法。');
  await page.getByLabel('联系方式（仅审核会员可见）').fill('synthetic-owner-contact');
  await button('提交审核').click();await closed();await button('我的发布').click();await button(resourceTitle).waitFor();
  await nav('互助广场');await button('发布互助').click();
  await page.getByLabel('标题', { exact: true }).fill(postTitle);await page.getByLabel('具体内容').fill('这是隔离测试的互助内容，可以提供基础摄影经验交流。');
  await page.getByLabel('联系方式（选填）').fill('synthetic-help-contact');await button('提交审核').click();await closed();
  passed.push('member resource and mutual-help submissions');
  await as('admin');await nav('管理工作台');await page.getByLabel('搜索管理会员').fill('13800008881');
  const member = page.getByRole('row').filter({ hasText: '资源主人测试' });await member.waitFor();
  if (await page.getByRole('row').filter({ hasText: '交换申请测试' }).count()) throw Error('Member search leaked unrelated row');
  await member.getByRole('button', { name: '资料', exact: true }).click();await page.getByRole('heading', { name: '会员资料', exact: true }).waitFor();await button('关闭弹窗').click();
  await button('互助审核').click();await page.locator('.record-row').filter({ hasText: postTitle }).getByRole('button', { name: '审核内容', exact: true }).click();
  await page.locator('dialog[open] button.primary').click();await closed();
  await button('资源管理').click();await page.locator('.record-row').filter({ hasText: resourceTitle }).getByRole('button', { name: '审核', exact: true }).click();
  await button('确认处理').click();await closed();
  await button('操作日志').click();await page.getByText('最近200条操作记录', { exact: true }).waitFor();
  if (await page.locator('.table-wrap tbody tr').count() === 0) throw Error('Audit records missing');
  passed.push('admin member search, profile, moderation and audit log');
  await as('13800008882');await nav('资源互换');await button(resourceTitle).click();await button('我想交换').click();
  await page.getByLabel('你的交换方案').fill('可以交流剪辑经验，希望交换活动拍摄方法。');
  await page.getByLabel('联系方式（仅双方和组织者可见）').fill('synthetic-requester-contact');await button('发送交换申请').click();await closed();
  await as('13800008881');await nav('资源互换');await button('我的交换').click();
  const exchange = page.locator('article.panel').filter({ hasText: resourceTitle });
  await exchange.getByRole('button', { name: '接受交换', exact: true }).click();await button('确认').click();await closed();
  await exchange.getByRole('button', { name: '确认我已完成交付', exact: true }).click();await button('确认').click();await closed();
  await exchange.getByText('资源主人已确认交付 · 申请者未确认交付', { exact: true }).waitFor();
  await as('13800008882');await nav('资源互换');await button('我的交换').click();
  await exchange.getByRole('button', { name: '确认我已完成交付', exact: true }).click();await button('确认').click();await closed();
  await exchange.getByText('双方已确认完成', { exact: true }).waitFor();passed.push('resource exchange completes only after both parties confirm');
  await page.evaluate(() => sessionStorage.removeItem('shuyang_home_session'));await page.reload();await nav('互助广场');
  await page.getByRole('heading', { name: postTitle, exact: true }).waitFor();
  await page.locator('article.post-card').filter({ hasText: postTitle }).getByRole('button', { name: '详情', exact: true }).click();
  await page.getByText('联系方式仅向已审核会员展示', { exact: true }).waitFor();
  if ((await page.locator('body').innerText()).includes('synthetic-help-contact')) throw Error('Guest saw private help contact');
  await button('关闭弹窗').click();passed.push('approved help visible to guests with private contact withheld');
  await as('admin');await nav('一凡说高铁 HOT');await button('一凡解读').click();await button('＋ 发布内容').click();
  await page.getByLabel('标题', { exact: true }).fill(railTitle);await page.getByLabel('内容', { exact: true }).fill('用于隔离验收的原创观察，不包含真实施工或通车信息。');
  await button('保存公告').click();await closed();await button(railTitle).waitFor();await button('阅读全文').first().click();
  passed.push('original railway commentary publishes with source and date without external link');
  await page.setViewportSize({ width: 390, height: 844 });await page.goto(h5);await page.locator('.railway-entry').click();await page.getByText(railTitle, { exact: true }).waitFor();
  await page.locator('.rail-tabs uni-button').filter({ hasText: '一凡解读' }).click();await page.getByText(railTitle, { exact: true }).waitFor();
  await page.locator('.rail-faq uni-button').first().click();await page.locator('.rail-faq-answer').first().waitFor();
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Railway mobile overflow');
  passed.push('railway H5 read, category filter, FAQ and 390px layout');
  await as('admin');await nav('一凡说高铁 HOT');const article = page.locator('.rail-article').filter({ hasText: railTitle });
  await article.getByRole('button', { name: '编辑', exact: true }).click();await page.getByRole('dialog').getByRole('combobox', { name: '状态', exact: true }).selectOption('withdrawn');await button('保存公告').click();await closed();await article.waitFor({ state: 'hidden' });
  await page.goto(h5);await page.locator('.railway-entry').click();if (await page.getByText(railTitle, { exact: true }).count()) throw Error('Withdrawn commentary remained public');passed.push('withdrawn railway content absent from Web and H5');
  await as('13800008882');await nav('乡情活动');await page.locator('.event-status-filters').getByRole('button', { name: '我已报名', exact: true }).click();
  await page.locator('.event-card').filter({ hasText: '验收活动 · 定位签到' }).waitFor();
  await page.locator('.event-status-filters').getByRole('button', { name: '可报名', exact: true }).click();
  if (await page.locator('.event-card').filter({ hasText: '验收活动 · 定位签到' }).count()) throw Error('Already joined event shown as available');
  await page.getByLabel('搜索内容').fill('不存在的活动' + stamp);await button('清除筛选').click();await page.locator('.event-card').first().waitFor();
  passed.push('Web event membership filter, availability exclusion and reset');
  for (const [name, endpoint] of [['资源互换','/resources'],['爱心众筹','/crowdfunding'],['联系方式交换','/my/contact-exchanges'],['合作广告','/ads'],['会员投票','/polls'],['乡情活动','/my/event-proposals']]) {
    await nav('关于我们');const pattern = '**/api' + endpoint;
    await page.route(pattern, route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 503, message: '模块故障注入' }) }));
    await nav(name);await page.getByText('模块故障注入', { exact: false }).first().waitFor();await page.unroute(pattern);
    await button('重新加载').click();await page.getByText('模块故障注入', { exact: false }).waitFor({ state: 'hidden' });
    await page.locator('.content[aria-busy="false"]').waitFor();passed.push('Web retry: ' + name);
  }
  await page.setViewportSize({ width: 390, height: 844 });await page.goto(h5);await page.getByText('我的', { exact: true }).click();
  if (await page.getByText('退出', { exact: true }).count()) await page.getByText('退出', { exact: true }).click();
  await page.getByText('登录账号', { exact: true }).click();await page.getByRole('textbox').nth(0).fill('13800008882');await page.getByRole('textbox').nth(1).fill('CommunityMember2026');
  await page.getByText('登录，回家看看', { exact: true }).click();await page.getByText('已通过 · 会员', { exact: true }).waitFor();
  await page.getByText('活动', { exact: true }).click();await page.locator('.event-status-filters uni-button').filter({ hasText: '我已报名' }).click();await page.getByText('验收活动 · 定位签到', { exact: true }).waitFor();
  await page.locator('.event-status-filters uni-button').filter({ hasText: '可报名' }).click();if (await page.getByText('验收活动 · 定位签到', { exact: true }).count()) throw Error('H5 available filter includes joined event');
  await page.locator('.search input').fill('不存在的活动' + stamp);await page.getByText('清除筛选', { exact: true }).click();await page.getByText('验收活动 · 定位签到', { exact: true }).waitFor();
  passed.push('H5 event membership filter, availability exclusion and reset');
  for (const [name, endpoint] of [['资源互换','/resources'],['爱心众筹','/crowdfunding'],['联系方式交换','/my/contact-exchanges'],['合作广告','/ads'],['会员投票','/polls'],['乡情活动','/my/event-proposals']]) {
    await page.getByText('首页', { exact: true }).click();const pattern = '**/api' + endpoint;
    await page.route(pattern, route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 503, message: '模块故障注入' }) }));
    await page.locator('.shortcuts uni-button').filter({ hasText: name }).click();await page.getByText('模块故障注入', { exact: false }).first().waitFor();await page.unroute(pattern);
    await page.getByText('重新加载', { exact: true }).click();await page.getByText('模块故障注入', { exact: false }).waitFor({ state: 'hidden' });passed.push('H5 retry: ' + name);
  }
  if (errors.length) throw Error(errors.join('\n'));
  await page.screenshot({ path: '../output/playwright/module-events-h5.png', fullPage: true });
  return { passed, count: passed.length, pageErrors: errors };
}
