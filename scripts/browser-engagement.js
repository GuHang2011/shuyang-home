async page => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:18888');
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 1000 });
  const settled = () => page.waitForFunction(() => document.querySelector('.content')?.getAttribute('aria-busy') === 'false');
  const closed = async () => { await page.getByRole('dialog').waitFor({ state: 'hidden' });await settled(); };
  const nav = async name => { await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name, exact: true }).click();await settled(); };
  const login = async (username, password) => {
    await page.getByRole('button', { name: '登录 / 加入', exact: true }).click();
    await page.getByLabel('手机号 / 管理员账号').fill(username);
    await page.getByLabel('登录密码', { exact: true }).fill(password);
    await page.getByRole('button', { name: '登录，回家看看', exact: true }).click();await closed();
  };
  const logout = async () => { await page.getByRole('button', { name: '我的会员中心', exact: true }).click();await settled();await page.getByRole('button', { name: '退出登录', exact: true }).click();await page.getByRole('button', { name: '登录 / 加入', exact: true }).waitFor(); };
  const localDate = offset => new Date(Date.now() + offset + 8 * 3600000).toISOString().slice(0,16);
  await login('13800008881', 'CommunityMember2026');
  await nav('乡情活动');
  await page.getByRole('button', { name: '发起活动', exact: true }).click();
  await page.getByLabel('活动名称').fill('验收活动 · 老乡茶话会');
  await page.getByLabel('活动详情').fill('一起交流在苏州的生活经验，这是一场隔离测试活动。');
  await page.getByLabel('开始时间（北京时间）').fill(localDate(86400000));
  await page.getByLabel('结束时间（北京时间）').fill(localDate(90000000));
  await page.getByRole('button', { name: '提交发起申请', exact: true }).click();await closed();
  await nav('合作广告');
  await page.getByRole('button', { name: '申请广告展示', exact: true }).click();
  await page.getByLabel('标题', { exact: true }).fill('验收广告 · 老乡公益服务');
  await page.getByLabel('广告主 / 合作方名称').fill('验收合作方');
  await page.getByLabel('广告内容').fill('面向老乡的公益服务信息，此内容仅用于隔离验收。');
  await page.getByLabel('开始时间（北京时间）').fill(localDate(-60000));
  await page.getByLabel('结束时间（北京时间）').fill(localDate(86400000));
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: '提交广告审核', exact: true }).click();await closed();
  await nav('爱心众筹');
  for (const [title, type] of [['验收众筹 · 爱心图书', '物资'], ['验收众筹 · 资金意向', '资金意向']]) {
    await page.getByRole('button', { name: '发起众筹项目', exact: true }).click();
    await page.getByLabel('项目名称', { exact: true }).fill(title);
    await page.getByLabel('支持类型').selectOption(type);
    await page.getByLabel('目标数量', { exact: true }).fill('100');
    if (type === '物资') await page.getByLabel('数量单位').fill('本');
    await page.getByLabel('项目用途与使用计划').fill('为老乡交流活动准备图书，仅用于隔离验收。');
    await page.getByLabel('项目说明', { exact: true }).fill('由发起人整理需求，按约定核实物资与志愿服务交付。资金仅记录意向。');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: '提交项目审核', exact: true }).click();await closed();
  }
  await nav('老乡名录');
  await page.locator('.member-card').filter({ hasText: '交换申请测试' }).getByRole('button', { name: '申请交换联系方式', exact: true }).click();
  await page.getByLabel('打个招呼，说明来意').fill('希望一起交流爱心图书活动的安排。');
  await page.getByLabel('你愿意分享的联系方式', { exact: true }).fill('private-owner-wechat');
  await page.getByRole('button', { name: '发送联系申请', exact: true }).click();await closed();
  await logout();await login('admin', 'CommunityAdmin2026');
  await page.getByRole('button', { name: /管理工作台/ }).click();await settled();
  for (const tab of ['活动发起审核', '广告管理']) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    await page.getByRole('button', { name: '审核申请', exact: true }).click();
    await page.getByRole('button', { name: '确认审核', exact: true }).click();await closed();
  }
  await page.getByRole('button', { name: '众筹审核', exact: true }).click();
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: '审核项目', exact: true }).first().click();
    await page.getByRole('button', { name: '确认审核', exact: true }).click();await closed();
  }
  await page.getByRole('button', { name: '投票管理', exact: true }).click();
  await page.getByRole('button', { name: '发起投票', exact: true }).click();
  await page.getByLabel('标题', { exact: true }).fill('验收投票 · 相聚时间');
  await page.getByLabel('投票说明').fill('选择你方便参加的时间。');
  await page.getByLabel('选项（每行一项，2至10项）').fill('周六上午\n周日下午');
  await page.getByLabel('开始时间（北京时间）').fill(localDate(-60000));
  await page.getByRole('button', { name: '发布投票', exact: true }).click();await closed();
  await page.getByRole('button', { name: '验收投票 · 相聚时间', exact: true }).waitFor();
  await logout();await login('13800008882', 'CommunityMember2026');
  await nav('会员投票');await page.getByRole('button', { name: '查看投票', exact: true }).click();
  await page.getByLabel('周六上午').check();
  await page.getByRole('button', { name: '确认投票（提交后不可更改）', exact: true }).click();await closed();
  await page.getByRole('button', { name: '查看结果', exact: true }).click();
  await page.getByText('共有 1 位会员投票。', { exact: false }).waitFor();
  await page.screenshot({ path: '../output/playwright/voting-results.png', fullPage: true });
  await page.getByRole('button', { name: '关闭操作', exact: true }).click();
  await nav('爱心众筹');
  await page.locator('.post-card').filter({ hasText: '验收众筹 · 爱心图书' }).getByRole('button', { name: '我来支持', exact: true }).click();
  await page.getByLabel('认领数量（本）').fill('3');
  await page.getByLabel('补充说明（仅项目方可见）').fill('private-pledge-note');
  await page.getByRole('button', { name: '确认登记', exact: true }).click();await closed();
  await page.screenshot({ path: '../output/playwright/crowdfunding-desktop.png', fullPage: true });
  await nav('联系方式交换');
  if ((await page.locator('body').innerText()).includes('private-owner-wechat')) throw new Error('Contact visible before consent');
  await nav('乡情首页');await page.getByText('验收广告 · 老乡公益服务', { exact: true }).waitFor();
  const sizes = [];
  for (const width of [360,390,768,1440]) { await page.setViewportSize({ width, height: 1000 });sizes.push(await page.evaluate(() => ({ width: innerWidth, pageWidth: document.documentElement.scrollWidth }))); }
  if (sizes.some(s => s.pageWidth > s.width)) throw new Error('Horizontal overflow: ' + JSON.stringify(sizes));
  await page.screenshot({ path: '../output/playwright/home-expanded-desktop.png', fullPage: true });
  if (errors.length) throw new Error(errors.join('\n'));
  return { activities: 'member proposal and staff approval passed', advertising: 'application, review and scheduled display passed', polls: 'create, vote and results passed', crowdfunding: 'create, review and pledge passed', contacts: 'pending privacy passed', sizes, runtimeErrors: 0 };
}
