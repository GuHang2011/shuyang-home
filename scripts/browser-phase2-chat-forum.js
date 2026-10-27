async page => {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:18890/');await page.getByText('首页',{exact:true}).click();
  await page.locator('uni-button').filter({hasText:'老乡论坛'}).click();await page.getByText('验收话题 · 家乡记忆',{exact:true}).click();
  await page.getByText('引用回复',{exact:true}).click();await page.getByRole('textbox').last().fill('H5验收引用回复，验证楼层和审核显示。');
  await page.getByText('提交回复',{exact:true}).click();await page.getByText('回复已提交审核',{exact:true}).waitFor();await page.getByText('2 楼 · 待审核',{exact:true}).waitFor();
  await page.getByText('转发',{exact:true}).click();await page.getByRole('textbox').last().fill('H5验收转发，保留原帖来源并验证审核流程。');await page.getByText('提交审核',{exact:true}).click();
  await page.getByText('已提交审核',{exact:true}).waitFor();
  await page.getByText('消息',{exact:true}).click();await page.locator('.chat-conversation').filter({hasText:'交换申请测试'}).click();
  for (const [button,file] of [['图片','fixture.png'],['文件','fixture.txt']]) {
    const chooserPromise=page.waitForEvent('filechooser');await page.getByText(button,{exact:true}).click();const chooser=await chooserPromise;await chooser.setFiles('../output/phase2/'+file);
    await page.locator('.chat-pending').waitFor();await page.getByText('发送',{exact:true}).click();await page.locator('.chat-pending').waitFor({state:'hidden'});
  }
  await page.locator('.attachment-image').waitFor();await page.locator('.attachment-file').filter({hasText:'fixture.txt'}).waitFor();
  await page.screenshot({path:'../output/playwright/phase2-chat-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:900});await page.goto('http://127.0.0.1:18888/');await page.evaluate(()=>sessionStorage.clear());await page.reload();
  await page.getByRole('button',{name:'登录 / 加入',exact:true}).click();await page.getByRole('textbox',{name:'手机号 / 管理员账号'}).fill('13800008882');await page.getByRole('textbox',{name:'登录密码',exact:true}).fill('CommunityMember2026');await page.getByRole('button',{name:'登录，回家看看',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.getByRole('navigation').getByRole('button',{name:/^家里聊聊/}).click();await page.locator('.conversation').filter({hasText:'资源主人测试'}).click();
  await page.locator('.attachment-picture img').waitFor();const dl=page.waitForEvent('download');await page.locator('.attachment-file').filter({hasText:'fixture.txt'}).click();const download=await dl;if(download.suggestedFilename()!=='fixture.txt')throw new Error('Filename lost');
  await page.screenshot({path:'../output/playwright/phase2-chat-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:18890/');await page.getByText('消息',{exact:true}).click();await page.locator('.chat-conversation').filter({hasText:'交换申请测试'}).click();
  await page.locator('.chat-message').filter({has:page.locator('.attachment-file')}).getByText('撤回',{exact:true}).click();await page.getByText('一条消息已撤回',{exact:true}).waitFor();
  if(errors.length)throw new Error(errors.join('\n'));return {quoteFloorAndForward:true,h5ImageAndFileUpload:true,webReceivingAndDownload:true,attachmentRecall:true,pageErrors:errors};
}
