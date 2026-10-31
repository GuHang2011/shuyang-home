async page => {
  if (new URL(page.url()).origin !== 'http://127.0.0.1:18888') throw Error('Use the isolated preview on Web18888 with community fixtures');
  const engine=page.context().browser().browserType().name(), results=[], errors=[];
  const check=(name,ok)=>{results.push({name,passed:!!ok});if(!ok)throw Error(name);};
  const shot=async (name,p=page)=>p.screenshot({path:`../output/playwright/element-${engine}-${name}.png`,timeout:15000});
  const overflow=async p=>p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);
  page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message+' after '+(results[results.length-1]?.name || 'startup')));
  await page.setViewportSize({width:1440,height:1000});await page.goto('http://127.0.0.1:18888/#admin');await page.waitForLoadState('networkidle');
  if(await page.getByRole('button',{name:'登录 / 加入',exact:true}).isVisible()){
    await page.getByRole('button',{name:'登录 / 加入',exact:true}).click();await page.getByLabel('手机号 / 管理员账号').fill('admin');await page.getByLabel('登录密码',{exact:true}).fill('CommunityAdmin2026');await page.getByRole('button',{name:'登录，回家看看',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
    await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'管理工作台',exact:true}).click();
  }
  await page.getByRole('tab',{name:'会员服务',exact:true}).click();
  const management=page.locator('.member-management');await management.waitFor();
  check('member management uses Element table and filter form',await management.locator('.el-table').count()===1&&await management.locator('.el-form').count()===1);
  await management.getByRole('textbox',{name:'搜索管理会员',exact:true}).fill('不存在的会员');await management.getByText('找到 0 个账号',{exact:true}).waitFor();
  check('empty search provides an explicit empty state',await management.locator('.el-table__empty-text').innerText()==='没有符合条件的会员，请调整筛选条件。');
  await management.getByRole('button',{name:'重置筛选',exact:true}).click();await management.locator('.el-table__body tbody tr').first().waitFor();
  await management.locator('.el-select:has(input[aria-label="会员状态筛选"])').click();await page.getByRole('option',{name:'已通过',exact:true}).click();
  check('member status select retains its selected label',await management.locator('.el-select').innerText()==='已通过');
  await management.getByRole('button',{name:'重置筛选',exact:true}).click();
  await management.locator('.member-table').getByRole('button',{name:'资料',exact:true}).first().click();await page.getByRole('dialog').waitFor();
  check('member detail action still opens existing record',await page.getByRole('heading',{name:'会员资料',exact:true}).count()===1);
  await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
  for(const [group,tabs] of [['会员服务',['会员与入会','互助审核']],['内容与活动',['活动发起审核','论坛管理','投票管理']],['运营协作',['众筹审核','广告管理','资源管理']],['数据管理',['文件与打印','操作日志']]]){
    await page.getByRole('tab',{name:group,exact:true}).click();
    for(const name of tabs){await page.getByRole('tab',{name,exact:true}).click();check(`workspace ${name} remains reachable`,await page.getByRole('tab',{name,exact:true}).getAttribute('aria-selected')==='true');}
  }
  await page.getByRole('tab',{name:'会员服务',exact:true}).click();
  for(const [width,height] of [[1920,1080],[1440,1000],[768,1024],[390,844],[320,568],[844,390],[390,420]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(80);check(`workspace ${width}x${height} has no horizontal overflow`,await overflow(page));
    if(width<=700){check(`workspace ${width}x${height} displays member cards`,await management.locator('.member-mobile-list').isVisible());await management.locator('.member-mobile-row').first().getByRole('button',{name:'资料',exact:true}).click();await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();}
    if(width===1440||width===390&&height===844){await page.evaluate(()=>window.scrollTo(0,0));await shot(`workspace-${width}`);}
  }
  // A separate member page covers sign-in, privacy and profile editing without admin privileges.
  const member=await page.context().newPage();member.on('pageerror',e=>errors.push(e.message+' after '+(results[results.length-1]?.name || 'startup')));member.setDefaultTimeout(15000);
  await member.setViewportSize({width:1440,height:1000});await member.goto('http://127.0.0.1:18888/#account');await member.waitForLoadState('networkidle');
  await member.getByRole('button',{name:'登录 / 加入',exact:true}).click();const modal=member.getByRole('dialog');
  await member.getByRole('button',{name:'登录，回家看看',exact:true}).click();await member.getByText('请填写账号',{exact:true}).waitFor();check('login shows field validation before submission',await member.getByText('请填写登录密码',{exact:true}).isVisible());
  for(const [width,height] of [[1440,1000],[390,844],[320,568],[844,390],[390,420]]){
    await member.setViewportSize({width,height});check(`login ${width}x${height} fits screen`,await overflow(member)&&await modal.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
    await member.getByRole('button',{name:'登录，回家看看',exact:true}).scrollIntoViewIfNeeded();
    check(`login ${width}x${height} submit reachable`,await member.getByRole('button',{name:'登录，回家看看',exact:true}).isVisible());
    if(width===1440||width===390&&height===844)await shot(`login-${width}`,member);
  }
  await member.getByLabel('手机号 / 管理员账号').fill('13800008881');await member.getByLabel('登录密码',{exact:true}).fill('CommunityMember2026');await member.getByRole('button',{name:'登录，回家看看',exact:true}).click();await modal.waitFor({state:'hidden'});
  check('ordinary member does not gain management navigation',await member.getByRole('button',{name:'管理工作台',exact:true}).count()===0);
  await member.getByRole('button',{name:'编辑资料',exact:true}).click();await modal.waitFor();
  const name=member.getByLabel('姓名 *',{exact:true}),industry=member.getByLabel('行业 / 职业',{exact:true});const originalName=await name.inputValue(),originalIndustry=await industry.inputValue();
  await name.fill('');await member.getByRole('button',{name:'保存资料',exact:true}).click();await member.getByText('请填写姓名',{exact:true}).waitFor();check('profile rejects an empty name',await modal.isVisible());await name.fill(originalName);
  const checkbox=member.getByRole('checkbox',{name:'在公开名录中同时展示我的手机号',exact:true});const originalPrivacy=await checkbox.isChecked();
  await member.getByText('在公开名录中同时展示我的手机号',{exact:true}).click();check('privacy preference can be changed',await checkbox.isChecked()!==originalPrivacy);await member.getByText('在公开名录中同时展示我的手机号',{exact:true}).click();
  for(const [width,height] of [[1440,1000],[768,1024],[390,844],[320,568],[844,390],[390,420]]){
    await member.setViewportSize({width,height});check(`profile ${width}x${height} fits screen`,await overflow(member)&&await modal.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
    const save=member.getByRole('button',{name:'保存资料',exact:true});await save.scrollIntoViewIfNeeded();check(`profile ${width}x${height} save reachable`,await save.isVisible());
    if(width===1440||width===390&&height===844){await modal.evaluate(el=>el.scrollTop=0);await shot(`profile-${width}`,member);}
  }
  await industry.fill('界面验收 · 合成资料');await member.getByRole('button',{name:'保存资料',exact:true}).click();await modal.waitFor({state:'hidden'});await member.getByRole('button',{name:'编辑资料',exact:true}).click();check('profile form persists edits through the existing API',await industry.inputValue()==='界面验收 · 合成资料');
  check('saving profile preserves privacy preferences',await checkbox.isChecked()===originalPrivacy);await industry.fill(originalIndustry);await member.getByRole('button',{name:'保存资料',exact:true}).click();await modal.waitFor({state:'hidden'});
  await member.close();

  const registration=await page.context().newPage();registration.setDefaultTimeout(15000);registration.on('pageerror',e=>errors.push(e.message));
  await registration.setViewportSize({width:390,height:844});await registration.goto('http://127.0.0.1:18888/#account');await registration.waitForLoadState('networkidle');
  await registration.locator('.member-welcome').getByRole('button',{name:'申请入会',exact:true}).click();
  await registration.getByLabel('姓名 *',{exact:true}).fill('合成入会测试');await registration.getByLabel('手机号 *',{exact:true}).fill('13800008999');
  await registration.getByLabel('家乡乡镇 *',{exact:true}).fill('沭阳沭城');await registration.getByLabel('现居地区 *',{exact:true}).fill('苏州吴中');await registration.getByLabel('设置密码 *',{exact:true}).fill('RegistrationCheck2026');
  check('registration keeps directory and phone private by default',!await registration.getByRole('checkbox',{name:'向已审核会员公开我的名录资料',exact:true}).isChecked()&&!await registration.getByRole('checkbox',{name:'在公开名录中同时展示我的手机号',exact:true}).isChecked());
  const attempts=[];
  await registration.route('**/auth/register',async route=>{attempts.push(route.request().postDataJSON());await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:503,message:'验收模拟：服务暂不可用，请重试'})});});
  await registration.getByRole('button',{name:'提交入会申请',exact:true}).click();await registration.getByText('请先阅读并同意隐私说明及自愿参与约定',{exact:true}).waitFor();
  check('registration cannot submit without consent',attempts.length===0);
  await registration.getByText('我已阅读并同意隐私说明及自愿参与约定',{exact:true}).click();await registration.getByRole('button',{name:'提交入会申请',exact:true}).click();
  await registration.getByRole('alert').filter({hasText:'验收模拟：服务暂不可用，请重试'}).waitFor();
  check('registration preserves existing request contract',attempts.length===1&&attempts[0].consent===true&&attempts[0].phone==='13800008999'&&attempts[0].name==='合成入会测试');
  check('registration failure preserves entered details',await registration.getByLabel('姓名 *',{exact:true}).inputValue()==='合成入会测试');
  check('registration failure keeps submit available for retry',await registration.getByRole('button',{name:'提交入会申请',exact:true}).isEnabled());
  await registration.close();

  check('no uncaught page errors: '+errors.join('; '),errors.length===0);return {engine,passed:results.length,failed:0,results,errors};
}
