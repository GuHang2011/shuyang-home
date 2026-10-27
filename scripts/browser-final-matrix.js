async page => {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const results=[];
  async function check(surface, view) {
    for(const [width,height] of [[360,800],[390,844],[412,915],[844,390],[768,1024]]) {
      await page.setViewportSize({width,height});
      await page.waitForTimeout(120);
      const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,
        tinyButtons:[...document.querySelectorAll('button,uni-button')].filter(e=>e.getBoundingClientRect().height>0&&e.getBoundingClientRect().height<43.9).length,
        composer:!!document.querySelector('textarea')}));
      if(layout.scroll>width+1 || layout.tinyButtons) throw new Error(JSON.stringify({surface,view,width,height,...layout}));
      results.push({surface,view,width,height,...layout});
    }
  }
  await page.goto('http://127.0.0.1:18890/');await page.getByText('首页',{exact:true}).click();await check('h5','home');
  await page.getByText('消息',{exact:true}).click();await page.locator('.chat-conversation').filter({hasText:'交换申请测试'}).click();await check('h5','chat');
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'../output/playwright/phase2-chat-mobile.png',fullPage:true});
  await page.goto('http://127.0.0.1:18888/');await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>sessionStorage.clear());await page.reload();
  await page.getByRole('button',{name:'登录 / 加入',exact:true}).click();await page.getByRole('textbox',{name:'手机号 / 管理员账号'}).fill('13800008882');await page.getByRole('textbox',{name:'登录密码',exact:true}).fill('CommunityMember2026');await page.getByRole('button',{name:'登录，回家看看',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  await check('web','home');await page.setViewportSize({width:1440,height:900});
  await page.getByRole('navigation').getByRole('button',{name:/^家里聊聊/}).click();await page.locator('.conversation').filter({hasText:'资源主人测试'}).click();await check('web','chat');
  if(errors.length)throw new Error(errors.join('\n'));return {results,pageErrors:errors};
}
