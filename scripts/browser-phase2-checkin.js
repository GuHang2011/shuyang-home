async page => {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:900});await page.goto('http://127.0.0.1:18888/');
  await page.getByRole('navigation').getByRole('button',{name:'签到与扫一扫',exact:true}).click();
  await page.getByRole('button',{name:'设置活动签到点',exact:true}).click();await page.locator('.checkin-event').filter({hasText:'验收活动 · 定位签到'}).click();
  await page.getByRole('button',{name:'生成现场二维码',exact:true}).click();await page.getByAltText('活动签到二维码').waitFor();
  await page.getByAltText('活动签到二维码').screenshot({path:'../output/phase2/checkin-qr.png'});
  await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:18890/');
  await page.getByText('首页',{exact:true}).click();await page.locator('uni-button').filter({hasText:'签到／扫一扫'}).click();
  await page.getByText('扫一扫／选择二维码图片',{exact:true}).click();
  if (!await page.evaluate(()=>document.querySelector('.scanner-panel video') instanceof HTMLVideoElement)) throw new Error('Scanner must use native video');
  await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Test permission denied','NotAllowedError')}});
  await page.getByText('打开摄像头',{exact:true}).click();await page.getByText('未能打开摄像头，请检查摄像头权限，或选择二维码图片。',{exact:true}).waitFor();
  await page.locator('input[type=file]').setInputFiles('../output/phase2/checkin-qr.png');
  await page.getByText('确认打开站内签到',{exact:true}).click();await page.getByText('授权定位并签到',{exact:true}).waitFor();
  await page.context().grantPermissions(['geolocation'],{origin:'http://127.0.0.1:18890'});await page.context().setGeolocation({latitude:32.3,longitude:120.6,accuracy:10});
  await page.getByText('授权定位并签到',{exact:true}).click();await page.locator('.error').filter({hasText:'需进入200米范围'}).waitFor();
  await page.context().setGeolocation({latitude:31.3,longitude:120.6,accuracy:10});await page.getByText('授权定位并签到',{exact:true}).click();
  await page.getByText('地点签到成功，欢迎来相聚。志愿时长由组织者另行核定。',{exact:true}).waitFor();
  await page.screenshot({path:'../output/playwright/phase2-checkin-mobile.png',fullPage:true});
  if(errors.length)throw new Error(errors.join('\n'));return {nativeVideo:true,cameraDeniedFallback:true,qrImageDecoded:true,outsideRadiusRejected:true,simulatedCheckinPassed:true,pageErrors:errors};
}
