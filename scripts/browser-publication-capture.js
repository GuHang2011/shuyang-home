async page => {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:1000});await page.goto('http://127.0.0.1:18888/');await page.evaluate(()=>sessionStorage.clear());await page.reload();
  await page.getByRole('button',{name:'登录 / 加入',exact:true}).waitFor();await page.waitForLoadState('networkidle');
  await page.screenshot({path:'../output/playwright/public-desktop-home.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:18890/');await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.getByText('首页',{exact:true}).click();await page.waitForLoadState('networkidle');
  await page.screenshot({path:'../output/playwright/public-mobile-home.png',fullPage:true});
  if(errors.length)throw new Error(errors.join('\n'));return {desktopHome:true,mobileHome:true,pageErrors:errors};
}
