async page => {
  const base=new URL(page.url());
  if(!['127.0.0.1','localhost'].includes(base.hostname) || !['18890','28890'].includes(base.port))throw new Error('Use the isolated local H5 preview on port 18890 or 28890');
  const engine=page.context().browser().browserType().name(),passed=[],errors=[],skipped=[];
  const check=(ok,name)=>{if(!ok)throw new Error(name);passed.push(name);};
  page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(15000);
  await page.setViewportSize({width:390,height:844});await page.goto(base.origin+'/');
  await page.getByText('我的',{exact:true}).tap();
  if(await page.getByText('登录账号',{exact:true}).count()) {
    await page.getByText('登录账号',{exact:true}).tap();
    await page.getByRole('textbox').nth(0).fill('13800008882');await page.getByRole('textbox').nth(1).fill('CommunityMember2026');
    await page.getByText('登录，回家看看',{exact:true}).tap();await page.getByText('已通过 · 会员',{exact:true}).waitFor();
  }
  const home=()=>page.getByText('首页',{exact:true}).tap();
  const shop=()=>page.locator('uni-button').filter({hasText:'家乡特产'}).tap();
  const invalid=route=>route.fulfill({status:200,contentType:'application/json',body:'null'});
  await page.route('**/api/products?*',invalid);await home();await shop();
  try {
    await page.getByText('服务响应异常，请稍后重试',{exact:false}).waitFor();
    check(await page.getByText('正在加载商品与订单…',{exact:true}).count()===0,'null response releases loading state and offers retry');
  } finally {await page.unroute('**/api/products?*',invalid);}
  const gateway=route=>route.fulfill({status:502,contentType:'text/html',body:'<html>Bad gateway</html>'});
  await page.route('**/api/products?*',gateway);
  try {
    await page.getByText('重新加载',{exact:true}).last().tap();
    await page.getByText('服务响应异常，请稍后重试',{exact:false}).waitFor();
    check(await page.getByText('Bad gateway',{exact:true}).count()===0,'gateway HTML is not rendered as application data');
  } finally {await page.unroute('**/api/products?*',gateway);}
  await page.getByText('重新加载',{exact:true}).last().tap();await page.getByText('验收特产 · 不销售',{exact:true}).waitFor();
  check(await page.locator('.error').count()===0,'healthy retry clears gateway errors');

  await page.context().setOffline(true);
  try {
    await page.getByText('我的',{exact:true}).tap();
    await page.getByText('连接失败，请检查网络后重试',{exact:false}).waitFor();
    check(await page.getByText('已通过 · 会员',{exact:true}).count()===1,'offline navigation keeps the current member signed in');
  } finally {await page.context().setOffline(false);}
  await page.getByText('重新加载',{exact:true}).tap();await page.locator('.error').waitFor({state:'hidden'});
  passed.push('online retry removes the top-level network error');
  await home();await shop();await page.getByText('验收特产 · 不销售',{exact:true}).tap();await page.getByText('填写订单',{exact:true}).tap();
  const address='网络恢复验收地址，苏州市测试路100号';
  await page.locator('.form-page textarea').fill(address);await page.locator('uni-switch').tap();await page.waitForTimeout(400);
  const writes=[];const record=request=>{if(request.url().endsWith('/api/orders') && request.method()==='POST')writes.push(request.postDataJSON().requestId);};page.on('request',record);
  await page.context().setOffline(true);
  try {
    await page.getByText('提交订单 · 待人工确认',{exact:true}).tap();
    await page.getByText('连接失败，请检查网络后重试',{exact:true}).waitFor();
    check(await page.locator('.form-page textarea').inputValue()===address,'offline submit preserves the address and form');
  } finally {await page.context().setOffline(false);}
  await page.waitForTimeout(400);await page.getByText('提交订单 · 待人工确认',{exact:true}).tap();
  await page.getByText('订单已提交，等待卖家人工确认；请勿重复下单。',{exact:true}).waitFor();page.off('request',record);
  check(writes.length===2 && writes[0]===writes[1],'online retry reuses the order request ID');

  await home();await page.locator('uni-button').filter({hasText:'签到／扫一扫'}).tap();
  await page.getByText('扫一扫／选择二维码图片',{exact:true}).tap();
  const cameraApiAvailable=await page.evaluate(()=>typeof navigator.mediaDevices?.getUserMedia==='function');
  if(cameraApiAvailable) {
    await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Simulated permission denial','NotAllowedError');};});
    await page.getByText('打开摄像头',{exact:true}).tap();
    await page.getByText('未能打开摄像头，请检查摄像头权限，或选择二维码图片。',{exact:true}).waitFor();
    check(await page.locator('input[type=file]').count()===1,'simulated camera denial keeps QR image selection available');
  } else skipped.push('camera permission denial: this browser runtime has no mediaDevices API; native unsupported fallback is tested instead');
  await page.evaluate(()=>Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:undefined}));
  await page.waitForTimeout(400);await page.getByText('打开摄像头',{exact:true}).tap();
  await page.getByText('摄像头需要HTTPS或localhost访问，也可以选择二维码图片识别。',{exact:true}).waitFor();
  check(await page.locator('input[type=file]').count()===1,'browser without camera API offers image fallback');

  await page.reload();await page.getByText('我的',{exact:true}).tap();await page.getByText('已通过 · 会员',{exact:true}).waitFor();
  const expired=route=>route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({code:401,message:'环境测试：登录已失效'})});
  await page.route('**/api/auth/me',expired);
  try {
    await home();await page.getByText('我的',{exact:true}).tap();await page.getByText('登录账号',{exact:true}).waitFor();
    check(await page.getByText('会员编号',{exact:true}).count()===0,'401 clears member-only data and exposes login entry');
  } finally {await page.unroute('**/api/auth/me',expired);}
  check(errors.length===0,'no unhandled page exceptions in failure scenarios');
  await page.screenshot({path:`../output/playwright/mobile-resilience-${engine}.png`,fullPage:true});
  return {engine,passed,count:passed.length,pageErrors:errors,cameraApiAvailable,skipped};
}
