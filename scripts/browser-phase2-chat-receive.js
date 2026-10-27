async page => {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:900});await page.goto('http://127.0.0.1:18888/');await page.evaluate(()=>sessionStorage.clear());await page.reload();
  await page.getByRole('button',{name:'登录 / 加入',exact:true}).click();await page.getByRole('textbox',{name:'手机号 / 管理员账号'}).fill('13800008882');await page.getByRole('textbox',{name:'登录密码',exact:true}).fill('CommunityMember2026');await page.getByRole('button',{name:'登录，回家看看',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.getByRole('navigation').getByRole('button',{name:/^家里聊聊/}).click();await page.locator('.conversation').filter({hasText:'资源主人测试'}).click();
  await page.locator('.attachment-picture img').waitFor();const dl=page.waitForEvent('download');await page.locator('.attachment-file').filter({hasText:'fixture.txt'}).click();const download=await dl;if(download.suggestedFilename()!=='fixture.txt')throw new Error('Filename lost');
  await page.screenshot({path:'../output/playwright/phase2-chat-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:18890/');await page.getByText('我的',{exact:true}).click();
  if(await page.getByText('登录账号',{exact:true}).count()) {await page.getByText('登录账号',{exact:true}).click();await page.getByRole('textbox').nth(0).fill('13800008881');await page.getByRole('textbox').nth(1).fill('CommunityMember2026');await page.getByText('登录，回家看看',{exact:true}).click();await page.getByText('已通过 · 会员',{exact:true}).waitFor();}
  await page.getByText('消息',{exact:true}).click();await page.locator('.chat-conversation').filter({hasText:'交换申请测试'}).click();
  await page.getByRole('textbox').fill('附件跨端收到后的撤回验收');await page.getByText('发送',{exact:true}).click();
  await page.locator('.chat-message').filter({hasText:'附件跨端收到后的撤回验收'}).getByText('撤回',{exact:true}).click();await page.getByText('一条消息已撤回',{exact:true}).waitFor();
  if(errors.length)throw new Error(errors.join('\n'));return {webImageReceived:true,fileDownloaded:true,h5Recall:true,pageErrors:errors};
}
