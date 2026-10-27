async page => {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const ctx=page.context();
  const report=[];
  async function webLogin(user='admin',password='CommunityAdmin2026') {
    await page.goto('http://127.0.0.1:18888/');await page.evaluate(()=>sessionStorage.clear());await page.reload();
    await page.getByRole('button',{name:'登录 / 加入',exact:true}).click();
    await page.getByRole('textbox',{name:'手机号 / 管理员账号'}).fill(user);
    await page.getByRole('textbox',{name:'登录密码',exact:true}).fill(password);
    await page.getByRole('button',{name:'登录，回家看看',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  }
  async function h5Login(){
    await page.goto('http://127.0.0.1:18890/');await page.evaluate(()=>localStorage.clear());await page.reload();
    await page.getByText('我的',{exact:true}).click();await page.getByText('登录账号',{exact:true}).click();
    await page.getByRole('textbox').nth(0).fill('13800008881');await page.getByRole('textbox').nth(1).fill('CommunityMember2026');
    await page.getByText('登录，回家看看',{exact:true}).click();await page.getByText('已通过 · 会员',{exact:true}).waitFor();
  }
  await page.setViewportSize({width:1440,height:900});await webLogin();
  await page.getByRole('navigation').getByRole('button',{name:'相聚相册',exact:true}).click();
  await page.getByRole('button').filter({hasText:'验收相册 · 非真实活动'}).click();
  await page.locator('input[type=file][multiple]').setInputFiles('../output/phase2/fixture.png');
  await page.getByText('fixture',{exact:true}).waitFor();
  await page.locator('.photo-wall article').filter({hasText:'fixture'}).getByRole('button',{name:'隐藏照片',exact:true}).click();
  await page.locator('.photo-wall article').filter({hasText:'fixture'}).getByRole('button',{name:'恢复展示',exact:true}).waitFor();
  await page.locator('.photo-wall article').filter({hasText:'fixture'}).getByRole('button',{name:'恢复展示',exact:true}).click();
  await page.locator('.photo-wall article').filter({hasText:'fixture'}).getByRole('button',{name:'隐藏照片',exact:true}).waitFor();
  report.push('Web相册上传、隐藏、恢复');
  await page.getByRole('navigation').getByRole('button',{name:'家乡特产',exact:true}).click();
  await page.getByRole('button',{name:'商品与订单管理',exact:true}).click();
  await page.getByRole('button',{name:'编辑／下架',exact:true}).click();
  await page.getByLabel('可售库存',{exact:true}).fill('12');
  await page.getByLabel('真实商品图片（JPG/PNG，最多8张）').setInputFiles('../output/phase2/fixture.png');
  await page.getByText('图片 2',{exact:false}).waitFor();
  await page.getByRole('button',{name:'保存商品',exact:true}).click();await page.locator('.product-editor').waitFor({state:'hidden'});
  report.push('Web商品编辑及真实图片上传');
  await page.getByRole('navigation').getByRole('button',{name:'签到与扫一扫',exact:true}).click();
  await page.getByRole('button',{name:'设置活动签到点',exact:true}).click();
  await page.locator('.checkin-event').filter({hasText:'验收活动 · 定位签到'}).click();
  await page.getByRole('button',{name:'生成现场二维码',exact:true}).click();
  await page.getByAltText('活动签到二维码').waitFor();
  await page.getByAltText('活动签到二维码').screenshot({path:'../output/phase2/checkin-qr.png'});
  report.push('Web生成活动二维码');
  await page.setViewportSize({width:390,height:844});await h5Login();
  await page.getByText('首页',{exact:true}).click();await page.locator('uni-button').filter({hasText:'相聚相册'}).click();
  await page.getByText('验收相册 · 非真实活动',{exact:true}).click();await page.getByText('验收条纹图 · 非活动照片',{exact:true}).waitFor();
  await page.screenshot({path:'../output/playwright/phase2-gallery-mobile.png',fullPage:true});
  await page.getByText('首页',{exact:true}).click();await page.locator('uni-button').filter({hasText:'家乡特产'}).click();
  await page.getByText('验收特产 · 不销售',{exact:true}).click();await page.getByText('填写订单',{exact:true}).click();
  await page.getByRole('textbox').last().fill('隔离验收地址，不是真实地址');await page.locator('uni-switch').click();
  await page.getByText('提交订单 · 待人工确认',{exact:true}).click();await page.getByText('待人工确认',{exact:true}).waitFor();
  await page.screenshot({path:'../output/playwright/phase2-order-mobile.png',fullPage:true});
  report.push('H5商品查看、隐私同意、在线下单');
  await page.getByText('取消订单',{exact:true}).click();await page.getByText('确定',{exact:true}).click();await page.getByText('已取消',{exact:true}).waitFor();
  report.push('H5取消订单');
  await page.getByText('首页',{exact:true}).click();await page.locator('uni-button').filter({hasText:'签到／扫一扫'}).click();
  await page.getByText('扫一扫／选择二维码图片',{exact:true}).click();
  await page.locator('input[type=file]').setInputFiles('../output/phase2/checkin-qr.png');
  await page.getByRole('button',{name:'确认打开站内签到',exact:true}).click();
  await page.getByText('授权定位并签到',{exact:true}).waitFor();
  await ctx.grantPermissions(['geolocation'],{origin:'http://127.0.0.1:18890'});await ctx.setGeolocation({latitude:32.3,longitude:120.6,accuracy:10});
  await page.getByText('授权定位并签到',{exact:true}).click();await page.locator('.error').filter({hasText:'需进入200米范围'}).waitFor();
  await ctx.setGeolocation({latitude:31.3,longitude:120.6,accuracy:10});await page.getByText('授权定位并签到',{exact:true}).click();
  await page.getByText('地点签到成功，欢迎来相聚。志愿时长由组织者另行核定。',{exact:true}).waitFor();
  await page.screenshot({path:'../output/playwright/phase2-checkin-mobile.png',fullPage:true});
  report.push('H5二维码图片识别、远距离拒绝、模拟到场签到');
  if(errors.length)throw new Error(errors.join('\n'));
  return {passed:report,pageErrors:errors};
}
