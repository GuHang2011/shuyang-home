async page => {
  if (!['18888','18890'].includes(new URL(page.url()).port)) throw Error('Use the isolated local previews');
  const passed=[],errors=[];page.on('pageerror',error=>errors.push(error.message));
  for (const mobile of [false,true]) {
    const origin=mobile?'http://127.0.0.1:18890':'http://127.0.0.1:18888';
    await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:900});await page.goto(origin);
    const token=await page.evaluate(mobile=>mobile?localStorage.getItem('shuyang_home_token'):sessionStorage.getItem('shuyang_home_session'),mobile);
    if(!token)throw Error('Precondition: log in to both isolated Web and H5 previews first');
    if(mobile){await page.getByText('我的',{exact:true}).click();await page.getByText('退出',{exact:true}).click();await page.getByText('登录账号',{exact:true}).waitFor();}
    else {await page.getByRole('button',{name:'我的会员中心',exact:true}).click();await page.getByRole('button',{name:'退出登录',exact:true}).click();await page.getByRole('button',{name:'登录 / 加入',exact:true}).waitFor();}
    async function events(){if(mobile)await page.getByText('活动',{exact:true}).click();else await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'乡情活动',exact:true}).click();await page.getByText('验收活动 · 老乡茶话会',{exact:true}).waitFor();}
    await events();passed.push((mobile?'H5':'Web')+' logout retains public browsing');
    await page.evaluate(({mobile,token})=>{if(mobile)localStorage.setItem('shuyang_home_token',token);else sessionStorage.setItem('shuyang_home_session',token);},{mobile,token});
    await page.goto(origin);await page.reload();
    if(mobile){await page.getByText('我的',{exact:true}).click();await page.getByText('登录账号',{exact:true}).waitFor();}
    else await page.getByRole('button',{name:'登录 / 加入',exact:true}).waitFor();
    await events();passed.push((mobile?'H5':'Web')+' expired startup token falls back to public browsing');
  }
  if(errors.length)throw Error(errors.join('\n'));await page.screenshot({path:'../output/playwright/module-events-h5.png',fullPage:true});
  return {passed,count:passed.length,pageErrors:errors};
}
