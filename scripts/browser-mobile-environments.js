async page => {
  // Open the isolated H5 preview first. The paired Web preview uses port H5-2.
  const base = new URL(page.url());
  if (!['127.0.0.1','localhost'].includes(base.hostname) || !['18890','28890'].includes(base.port)) throw new Error('Open isolated H5 on port 18890 or 28890 first');
  const web = new URL(base);web.port=String(Number(base.port)-2);
  const browser=page.context().browser(), engine=browser.browserType().name(), results=[], errors=[];
  await page.goto(base.origin+'/');
  await page.getByText('我的',{exact:true}).click();
  if(await page.getByText('退出',{exact:true}).count()) await page.getByText('退出',{exact:true}).click();
  await page.getByText('登录账号',{exact:true}).click();
  await page.getByRole('textbox').nth(0).fill('13800008882');
  await page.getByRole('textbox').nth(1).fill('CommunityMember2026');
  const login=page.waitForResponse(r=>r.url().endsWith('/auth/login') && r.request().method()==='POST');
  await page.getByText('登录，回家看看',{exact:true}).click();
  const auth=(await (await login).json()).data;
  await page.getByText('已通过 · 会员',{exact:true}).waitFor();
  const storageState=await page.context().storageState();
  const profiles=[
    {name:'compact',viewport:{width:320,height:568},deviceScaleFactor:2},
    {name:'android',viewport:{width:360,height:800},deviceScaleFactor:3},
    {name:'dark-reduced-motion',viewport:{width:390,height:844},deviceScaleFactor:3,colorScheme:'dark',reducedMotion:'reduce'},
    {name:'wechat-ua',viewport:{width:412,height:915},deviceScaleFactor:3,userAgent:engine==='webkit'?'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 MicroMessenger/8.0.50':'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36 MicroMessenger/8.0.50'},
    {name:'landscape',viewport:{width:844,height:390},deviceScaleFactor:2},
    {name:'tablet-foreign-timezone',viewport:{width:768,height:1024},deviceScaleFactor:2,timezoneId:'America/New_York',locale:'en-US'},
    {name:'keyboard-sized-viewport',viewport:{width:390,height:420},deviceScaleFactor:3}
  ];
  async function measure(p,profile,surface,screen) {
    await p.waitForTimeout(120);
    const info=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,touch:navigator.maxTouchPoints,
      smallButtons:[...document.querySelectorAll('button,uni-button')].filter(el=>{const r=el.getBoundingClientRect();return r.height>0 && r.width>0 && r.height<43.9 && el.getAttribute('type')!=='file';}).map(el=>({text:el.textContent.trim().slice(0,35),height:Math.round(el.getBoundingClientRect().height)}))}));
    const failures=[];if(info.scroll>profile.viewport.width+1 || info.width>profile.viewport.width+1)failures.push('horizontal overflow');if(info.smallButtons.length)failures.push('button height below 44px');
    results.push({profile:profile.name,surface,screen,status:failures.length?'failed':'passed',...info,failures});
    if(failures.length)await p.screenshot({path:`../output/playwright/mobile-env-${engine}-${profile.name}-${surface}-${screen}.png`,fullPage:true});
  }
  async function checkReachability(p,profile,surface,screen,control) {
    await control.evaluate(el=>{
      // Scroll only user-scrollable areas. scrollIntoView can secretly scroll an
      // overflow:hidden container and hide a real touch-screen clipping defect.
      for(let parent=el.parentElement;parent;parent=parent.parentElement) {
        if(parent===document.scrollingElement)continue;
        if(!['auto','scroll'].includes(getComputedStyle(parent).overflowY))continue;
        const r=el.getBoundingClientRect(),p=parent.getBoundingClientRect();
        parent.scrollTop+=(r.top+r.bottom-p.top-p.bottom)/2;
      }
      const r=el.getBoundingClientRect();window.scrollBy({top:(r.top+r.bottom-innerHeight)/2,behavior:'instant'});
    });
    await p.waitForTimeout(120);
    const info=await control.evaluate(el=>{
      const r=el.getBoundingClientRect(),nav=document.querySelector('.bottom-nav,.mobile-nav'),n=nav?.getBoundingClientRect();
      const bottom=n && n.height>0?n.top:innerHeight;
      const points=[.2,.5,.8].map(fraction=>({x:r.left+r.width/2,y:r.top+r.height*fraction}));
      return {top:r.top,bottom:r.bottom,availableBottom:bottom,unobstructed:points.every(({x,y})=>{const hit=document.elementFromPoint(x,y);return hit===el || el.contains(hit);})};
    });
    const reachable=info.top>=0 && info.bottom<=info.availableBottom+1 && info.unobstructed;
    results.push({profile:profile.name,surface,screen,status:reachable?'passed':'failed',...info});
    if(!reachable)await p.screenshot({path:`../output/playwright/mobile-env-${engine}-${profile.name}-${surface}-${screen}.png`,fullPage:true});
  }
  for(const profile of profiles) {
    const {name,...options}=profile;
    const context=await browser.newContext({isMobile:true,hasTouch:true,locale:'zh-CN',timezoneId:'Asia/Shanghai',storageState,...options});
    await context.addInitScript(token=>sessionStorage.setItem('shuyang_home_session',token),auth.token);
    try {
      for(const surface of ['h5','web']) {
        const p=await context.newPage();p.setDefaultTimeout(10000);p.on('pageerror',error=>errors.push({profile:name,surface,message:error.message}));
        try {
          await p.goto((surface==='h5'?base:web).origin+'/');
          if(surface==='h5')await p.getByText('在苏州，也在家。',{exact:true}).waitFor();else await p.getByRole('heading',{level:1}).waitFor();
          await measure(p,profile,surface,'home');
          if(surface==='h5')await p.locator('uni-button').filter({hasText:'家乡特产'}).tap();
          else await p.locator('.community-links button').filter({hasText:'家乡特产'}).tap();
          await p.getByText('验收特产 · 不销售',{exact:true}).waitFor();
          await measure(p,profile,surface,'shop');
          await p.getByText('验收特产 · 不销售',{exact:true}).tap();
          await p.getByText('填写订单',{exact:true}).tap();
          await measure(p,profile,surface,'order');
          const address=p.locator(surface==='h5'?'.form-page textarea':'.order-form textarea');
          await address.fill('移动端环境测试地址，仅用于隔离验收');
          const submit=p.getByText('提交订单 · 待人工确认',{exact:true});await submit.evaluate(el=>el.scrollIntoView({block:'center'}));await p.waitForTimeout(120);
          const reachable=await submit.evaluate(el=>{const r=el.getBoundingClientRect(),nav=document.querySelector('.bottom-nav,.mobile-nav'),n=nav?.getBoundingClientRect();const bottom=n && n.height>0?n.top:innerHeight;return r.top>=0 && r.bottom<=bottom+1;});
          results.push({profile:name,surface,screen:'order-submit-reachability',status:reachable?'passed':'failed'});
          if(surface==='h5')await p.getByText('我的',{exact:true}).tap();else await p.getByRole('button',{name:'我的会员中心',exact:true}).tap();
          await p.getByText('交换申请测试',{exact:true}).filter({visible:true}).first().waitFor();
          await measure(p,profile,surface,'account');
          if(surface==='h5')await p.locator('.bottom-nav uni-button').filter({hasText:'消息'}).tap();else await p.getByRole('button',{name:'打开内部聊天',exact:true}).tap();
          await p.locator(surface==='h5'?'.chat-conversation':'.conversation').first().tap();
          const composer=p.locator(surface==='h5'?'.chat-compose textarea':'.chat-composer textarea');
          await composer.fill('只检查输入、旋转和可见性，不发送');
          await measure(p,profile,surface,'chat');
          await checkReachability(p,profile,surface,'chat-input-reachability',composer);
          await checkReachability(p,profile,surface,'chat-send-reachability',p.locator(surface==='h5'?'.chat-compose uni-button':'.chat-composer button.primary'));
          if(name==='landscape' || name==='keyboard-sized-viewport')await p.screenshot({path:`../output/playwright/mobile-env-${engine}-${name}-${surface}.png`,fullPage:true});
        } catch(error) {results.push({profile:name,surface,status:'failed',error:error.message});await p.screenshot({path:`../output/playwright/mobile-env-${engine}-${name}-${surface}-failure.png`,fullPage:true});}
        finally {await p.close();}
      }
    } finally {await context.close();}
  }
  return {engine,profiles:profiles.map(p=>p.name),passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length,pageErrors:errors,results};
}
