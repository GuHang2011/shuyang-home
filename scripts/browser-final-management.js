async page => {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:18890/');
  await page.getByText('首页',{exact:true}).click();await page.locator('uni-button').filter({hasText:'家乡特产'}).click();
  await page.getByText('验收特产 · 不销售',{exact:true}).click();await page.getByText('填写订单',{exact:true}).click();
  await page.getByRole('textbox').last().fill('隔离验收地址，不是真实地址');await page.locator('uni-switch').click();
  await page.getByText('提交订单 · 待人工确认',{exact:true}).click();await page.getByText('待人工确认',{exact:true}).waitFor();
  await page.setViewportSize({width:1440,height:900});await page.goto('http://127.0.0.1:18888/');await page.evaluate(()=>sessionStorage.clear());await page.reload();
  await page.getByRole('button',{name:'登录 / 加入',exact:true}).click();await page.getByRole('textbox',{name:'手机号 / 管理员账号'}).fill('admin');await page.getByRole('textbox',{name:'登录密码',exact:true}).fill('CommunityAdmin2026');await page.getByRole('button',{name:'登录，回家看看',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.getByRole('navigation').getByRole('button',{name:'家乡特产',exact:true}).click();await page.getByRole('button',{name:'商品与订单管理',exact:true}).click();await page.getByRole('button',{name:'订单处理',exact:true}).click();
  for(const [button,note] of [['确认订单',''],['核实线下结算','隔离测试，模拟核实线下结算记录'],['登记发货','模拟快递 TEST000001，仅用于验收']]) {
    await page.getByRole('button',{name:button,exact:true}).click();
    if(note)await page.locator('.action-overlay textarea').fill(note);
    await page.locator('.action-overlay').getByRole('button',{name:'确认',exact:true}).click();await page.locator('.action-overlay').waitFor({state:'hidden'});
  }
  await page.getByRole('navigation').getByRole('button',{name:'老乡论坛',exact:true}).click();await page.getByRole('button',{name:'版主管理',exact:true}).click();
  const reply=page.locator('.moderation-row').filter({hasText:'H5验收引用回复，验证楼层和审核显示。'});
  for(const action of ['审核通过','隐藏','恢复展示']) {
    if(action === '审核通过' && !await reply.getByRole('button',{name:action,exact:true}).count()) continue;
    await reply.getByRole('button',{name:action,exact:true}).click();
    if(action==='隐藏')await page.locator('.forum-overlay textarea').fill('验收隐藏与恢复');
    await page.locator('.forum-overlay').getByRole('button',{name:'确认操作',exact:true}).click();await page.locator('.forum-overlay').waitFor({state:'hidden'});
  }
  const forward=page.locator('.moderation-row').filter({hasText:'H5验收转发，保留原帖来源并验证审核流程。'});
  if(await forward.getByRole('button',{name:'审核通过',exact:true}).count()) { await forward.getByRole('button',{name:'审核通过',exact:true}).click();await page.locator('.forum-overlay').getByRole('button',{name:'确认操作',exact:true}).click();await page.locator('.forum-overlay').waitFor({state:'hidden'}); }
  await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:18890/');await page.getByText('首页',{exact:true}).click();await page.locator('uni-button').filter({hasText:'家乡特产'}).click();await page.getByText('我的订单',{exact:true}).click();
  await page.getByText('确认已收货',{exact:true}).click();await page.getByText('确定',{exact:true}).click();await page.getByText('已收货',{exact:true}).first().waitFor();
  await page.getByText('首页',{exact:true}).click();await page.locator('uni-button').filter({hasText:'老乡论坛'}).click();await page.getByText('验收话题 · 家乡记忆',{exact:true}).click();await page.getByText('H5验收引用回复，验证楼层和审核显示。',{exact:true}).waitFor();
  await page.screenshot({path:'../output/playwright/phase2-forum-mobile.png',fullPage:true});
  if(errors.length)throw new Error(errors.join('\n'));return {orderConfirmSettlementShippingAndH5Receipt:true,forumApprovalHideRestore:true,pageErrors:errors};
}
