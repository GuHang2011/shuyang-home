async page => {
  await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:18890/');await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.getByText('我的',{exact:true}).click();await page.getByText('登录账号',{exact:true}).click();await page.getByRole('textbox').nth(0).fill('13800008881');await page.getByRole('textbox').nth(1).fill('CommunityMember2026');await page.getByText('登录，回家看看',{exact:true}).click();await page.getByText('已通过 · 会员',{exact:true}).waitFor();
  await page.getByText('首页',{exact:true}).click();await page.locator('uni-button').filter({hasText:'老乡论坛'}).click();await page.getByText('验收语音 · 合成提示音',{exact:true}).click();await page.getByText('播放语音',{exact:true}).click();await page.getByText('暂停语音',{exact:true}).waitFor();await page.getByText('暂停语音',{exact:true}).click();
  await page.getByText('上传语音',{exact:true}).click();
  // Complete the chooser with Playwright CLI upload, then run browser-forum-audio-reply.js.
}
