async page => {
  const communityFixture = new URL(page.url()).searchParams.get('fixture') === 'community';
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const title='照片验收 · 一起记录家乡 '+Date.now();
  async function login(username,password){
    await page.goto('http://127.0.0.1:18888/#home');await page.evaluate(()=>sessionStorage.removeItem('shuyang_home_session'));await page.reload();
    await page.getByRole('button',{name:'登录 / 加入',exact:true}).click();
    await page.getByLabel('手机号 / 管理员账号',{exact:true}).fill(username);await page.getByLabel('登录密码',{exact:true}).fill(password);
    await page.getByRole('button',{name:'登录，回家看看',exact:true}).click();await page.locator('dialog.modal').waitFor({state:'hidden'});
  }
  await page.setViewportSize({width:1440,height:1000});await login(communityFixture ? '13800008881' : '13800008885',communityFixture ? 'CommunityMember2026' : 'PhotoPreviewMember2026');
  await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'老乡论坛',exact:true}).click();
  await page.getByRole('button',{name:'＋ 发起话题',exact:true}).click();await page.getByLabel('标题',{exact:true}).fill(title);
  const field=page.locator('.photo-field'),input=field.locator('input[multiple]'),submit=page.getByRole('button',{name:'提交审核',exact:true});
  await input.setInputFiles('../output/photo-fixtures/oversize.jpg');await field.locator('.photo-failed').waitFor();
  if(!await submit.isDisabled())throw Error('Oversize photo did not block submission');
  await field.getByRole('button',{name:/移除照片/}).click();
  let failOnce=true;await page.route('**/api/media/upload',async route=>{if(failOnce){failOnce=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:503,message:'模拟网络中断，请重试'})});}else await route.continue();});
  await input.setInputFiles(['../output/photo-fixtures/moment-a.png','../output/photo-fixtures/moment-b.png']);
  await field.getByText('已上传 · 待提交',{exact:true}).waitFor();await field.locator('.photo-failed').waitFor();
  if(!await submit.isDisabled())throw Error('Failed selection allowed publication');
  await field.getByRole('button',{name:'重试',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.photo-selection-item .photo-state').length===2&&[...document.querySelectorAll('.photo-state')].every(p=>p.textContent==='已上传 · 待提交'));
  await page.unroute('**/api/media/upload');
  await field.getByRole('button',{name:'移除照片 moment-b.png',exact:true}).click();await input.setInputFiles('../output/photo-fixtures/moment-b.png');
  await page.waitForFunction(()=>document.querySelectorAll('.photo-selection-item .photo-state').length===2&&[...document.querySelectorAll('.photo-state')].every(p=>p.textContent==='已上传 · 待提交'));
  await page.screenshot({path:'../output/playwright/ux-photo-composer-desktop.png',fullPage:true,animations:'disabled'});
  await submit.click();await page.getByText('已提交审核',{exact:true}).waitFor();await page.getByRole('button',{name:title,exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.topic-detail .photo-grid img').length===2&&[...document.querySelectorAll('.topic-detail .photo-grid img')].every(i=>i.naturalWidth>0));
  await page.getByRole('button',{name:'查看照片 1',exact:true}).click();await page.locator('dialog.photo-dialog').waitFor({state:'visible'});await page.keyboard.press('Escape');await page.locator('dialog.photo-dialog').waitFor({state:'hidden'});
  await login('admin',communityFixture ? 'CommunityAdmin2026' : 'PhotoPreviewAdmin2026');await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'老乡论坛',exact:true}).click();await page.getByRole('button',{name:'版主管理',exact:true}).click();
  await page.locator('.moderation-row').filter({hasText:title}).getByRole('button',{name:'审核通过',exact:true}).click();await page.locator('.forum-overlay').getByRole('button',{name:'确认操作',exact:true}).click();await page.locator('.forum-overlay').waitFor({state:'hidden'});
  await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'相聚相册',exact:true}).click();await page.getByRole('button',{name:'新建相册',exact:true}).click();
  await page.getByLabel('相册名称',{exact:true}).fill('照片验收 · 家乡留影');await page.locator('.album-form select').selectOption('published');await page.getByRole('button',{name:'保存相册',exact:true}).click();
  await page.locator('.album-uploader .photo-field input[multiple]').setInputFiles('../output/photo-fixtures/moment-a.png');await page.getByText('已上传 · 待提交',{exact:true}).waitFor();await page.getByRole('button',{name:'添加到相册（1张）',exact:true}).click();await page.getByText('已添加 1 张照片',{exact:true}).waitFor();
  if(await page.locator('.photo-selection-item').count())throw Error('Published gallery photo remained in pending queue');
  await page.waitForFunction(()=>document.querySelector('.photo-wall img')?.naturalWidth>0);
  await page.goto('http://127.0.0.1:18888/#home');await page.evaluate(()=>sessionStorage.removeItem('shuyang_home_session'));await page.reload();
  await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'老乡论坛',exact:true}).click();await page.getByRole('button',{name:title,exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.topic-detail .photo-grid img').length===2&&[...document.querySelectorAll('.topic-detail .photo-grid img')].every(i=>i.naturalWidth>0));
  await page.screenshot({path:'../output/playwright/ux-photo-topic-desktop.png',animations:'disabled'});
  for(const width of [390,360]){await page.setViewportSize({width,height:900});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Horizontal overflow at '+width);await page.screenshot({path:`../output/playwright/ux-photo-topic-${width}.png`,animations:'disabled'});}
  await page.getByRole('navigation',{name:'手机导航'}).getByRole('button',{name:'活动',exact:true}).click();await page.goBack();if(!page.url().endsWith('#forum'))throw Error('Back navigation lost forum');await page.goForward();if(!page.url().endsWith('#events'))throw Error('Forward navigation lost events');await page.reload();await page.getByRole('heading',{name:'相聚，总有好时光',exact:true}).waitFor();
  if(errors.length)throw Error(errors.join('\n'));return {title,photos:2,oversize:true,retry:true,removeAndReselect:true,approval:true,previewEscape:true,galleryPublished:true,navigation:true,pageErrors:errors};
}
