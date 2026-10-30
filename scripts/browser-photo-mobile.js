async page => {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const button=text=>page.locator('uni-button').filter({hasText:new RegExp('^'+text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')});
  async function login(username,password){
    await page.goto('http://127.0.0.1:18890/');await page.evaluate(()=>localStorage.removeItem('shuyang_home_token'));await page.reload();
    await page.getByText('我的',{exact:true}).click();await page.getByText('登录账号',{exact:true}).click();await page.getByRole('textbox').nth(0).fill(username);await page.getByRole('textbox').nth(1).fill(password);await page.getByText('登录，回家看看',{exact:true}).click();await page.getByText('编辑资料',{exact:true}).waitFor();
  }
  async function choose(files){const waiting=page.waitForEvent('filechooser');await button('＋ 选择照片').click();await (await waiting).setFiles(files);await page.getByText('已上传 · 待提交',{exact:true}).first().waitFor();}
  await page.setViewportSize({width:390,height:900});await login('13800008885','PhotoPreviewMember2026');
  await page.getByText('首页',{exact:true}).click();await page.locator('uni-button').filter({hasText:'老乡论坛'}).click();
  await page.locator('.card-title').filter({hasText:'照片验收 · 一起记录家乡'}).first().click();
  await page.waitForFunction(()=>document.querySelectorAll('.photo-grid img').length>=2&&[...document.querySelectorAll('.photo-grid img')].every(i=>i.naturalWidth>0));
  await choose(['../output/photo-fixtures/moment-b.png']);
  await page.locator('textarea').fill('手机照片回复验收，记录每一份乡情。');
  await page.locator('.photo-field').scrollIntoViewIfNeeded();await page.screenshot({path:'../output/playwright/ux-photo-composer-h5.png',animations:'disabled'});
  await button('提交回复').click();await page.getByText('回复已提交审核',{exact:true}).waitFor();
  if(await page.locator('.photo-selection-item').count())throw Error('Reply photo queue did not reset');
  await page.waitForFunction(()=>document.querySelectorAll('.photo-grid img').length>=3&&[...document.querySelectorAll('.photo-grid img')].every(i=>i.naturalWidth>0));
  for(const width of [390,360]){await page.setViewportSize({width,height:900});await page.evaluate(()=>window.scrollTo(0,0));if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('H5 overflow at '+width);await page.screenshot({path:`../output/playwright/ux-photo-topic-h5-${width}.png`,animations:'disabled'});}
  await page.setViewportSize({width:390,height:900});await login('admin','PhotoPreviewAdmin2026');
  await page.getByText('首页',{exact:true}).click();await page.locator('uni-button').filter({hasText:'相聚相册'}).click();await button('新建相册').click();
  await page.getByRole('textbox').nth(0).fill('手机相册验收 · 乡情留影');await button('保存相册').click();await page.getByText('手机相册验收 · 乡情留影',{exact:true}).waitFor();
  await choose(['../output/photo-fixtures/moment-a.png']);await button('添加到相册（1张）').click();await page.getByText('已添加 1 张照片',{exact:true}).waitFor();
  if(await page.locator('.photo-selection-item').count())throw Error('H5 album photo queue did not reset');await page.getByText('点击预览未公开照片',{exact:true}).waitFor();
  await page.screenshot({path:'../output/playwright/ux-gallery-upload-h5.png',fullPage:true,animations:'disabled'});
  if(errors.length)throw Error(errors.join('\n'));return {h5ReplyPhoto:true,pendingPhotoReadableByOwner:true,mobileAlbumCreate:true,mobileAlbumUpload:true,queueReset:true,pageErrors:errors};
}
