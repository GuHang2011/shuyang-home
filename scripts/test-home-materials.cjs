// Integration check for the credited homepage carousel and public notice feed.
// Uses isolated demo fixtures; no production database or remote writes.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { pathToFileURL } = require('node:url');
const driver = process.env.SHUYANG_PLAYWRIGHT_MODULE || path.resolve(__dirname, '../frontend/node_modules/playwright');
const { chromium, webkit } = require(driver), { expect } = require(driver + '/test');
const root = path.resolve(__dirname, '..'), out = path.join(root, process.env.SHUYANG_BROWSER==='webkit'?'output/home-materials-webkit':'output/home-materials');
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.jpg':'image/jpeg', '.png':'image/png', '.webp':'image/webp', '.svg':'image/svg+xml' };
async function run() {
  fs.mkdirSync(out,{recursive:true});
  const { createDemoState, demoRequest } = await import(pathToFileURL(path.join(root,'frontend/demo/demo-runtime.mjs')));
  const state = createDemoState(), checks = [], errors = [];
  state.notices.push({id:'hidden-notice', title:'撤下公告不应展示', category:'平台公告', status:'withdrawn', createdAt:new Date().toISOString()});
  const server = http.createServer(async (req,res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      if(pathname.startsWith('/api/')) {
        const data = await demoRequest(state,new Request('https://demo.invalid'+req.url,{headers:req.headers}));
        res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({code:0,data}));return;
      }
      const web = pathname.startsWith('/shuyang-home/'), folder=path.join(root,web?'frontend/dist-demo':'frontend/mobile/dist/build/h5');
      const file=path.resolve(folder,(web?pathname.slice(14):pathname.slice(1))||'index.html');
      if(!file.startsWith(folder+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
      res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
    }catch(e){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({code:1,message:e.message}));}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  let browser;
  try {
    const engine=process.env.SHUYANG_BROWSER==='webkit'?webkit:chromium;
    const executable=process.env.SHUYANG_BROWSER==='webkit'?process.env.SHUYANG_WEBKIT_PATH:process.env.SHUYANG_CHROMIUM_PATH;
    browser=await engine.launch({headless:true,...(executable?{executablePath:executable}:{})});
    for(const mobile of [false,true]) {
      const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),p=await context.newPage();
      p.on('pageerror',e=>errors.push(e.message));
      for(const theme of ['amber','classic','night']) {
        await p.goto(base+(mobile?'/':'/shuyang-home/'));
        if(mobile) {
          await p.locator('.appearance-mobile-bar uni-button').click();
          await p.locator('.appearance-option.skin-'+theme).filter({hasText:new RegExp('^'+{amber:'温暖乡情',classic:'简洁商务',night:'深色'}[theme])}).click();
          await p.locator('.appearance-mobile-bar uni-button').click();
        }else{await p.evaluate(theme=>localStorage.setItem('shuyang_home_appearance',theme),theme);await p.reload();}
        await expect(p.locator('html')).toHaveAttribute('data-skin',theme);
        await expect(p.locator('.community-home')).toBeVisible();
        await expect(p.locator('.community-notice').first()).toContainText('欢迎体验沭阳之家');
        await expect(p.getByText('撤下公告不应展示',{exact:true})).toHaveCount(0);
        const carousel=p.locator(mobile?'.home-carousel-mobile':'.home-carousel');
        for(const width of [1440,390,320]) {
          await p.setViewportSize({width,height:900});
          await expect.poll(()=>p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
          const next=carousel.getByRole('button',{name:'下一张推荐'});
          // uni-app does not consistently expose the button role in older H5 builds.
          const nextControl=mobile?carousel.locator('[aria-label="下一张推荐"]'):next;
          await expect(nextControl).toBeVisible();
          const inside=await nextControl.evaluate(el=>{const a=el.getBoundingClientRect(),b=el.closest('.home-carousel,.home-carousel-mobile').getBoundingClientRect();return a.left>=b.left&&a.right<=b.right+1&&a.width>=43&&a.height>=43;});
          if(!inside){await p.screenshot({path:path.join(out,'bounds-failure.png')});console.log({mobile,theme,width,bounds:await nextControl.boundingBox(),carousel:await carousel.boundingBox()});}
          expect(inside).toBe(true);
          if(!mobile) {
            await carousel.getByRole('button',{name:'查看第1张：沭阳之家'}).click();
            await expect(carousel.locator('.carousel-slide.active img')).toHaveJSProperty('naturalWidth',474);
            await expect(carousel.locator('.carousel-slide.active')).toContainText('CC BY 2.0');
            await carousel.getByRole('button',{name:'下一张推荐'}).click();
            await expect(carousel.locator('.carousel-slide.active')).toContainText('生活示意');
            await expect(carousel.locator('.carousel-slide.active img')).toHaveJSProperty('complete',true);
            await carousel.getByRole('button',{name:'查看第1张：沭阳之家'}).click();
          } else {
            await expect(carousel.locator('.home-banner-photo img').first()).toHaveJSProperty('naturalWidth',474);
            await expect.poll(()=>carousel.locator('.home-banner-slide').evaluateAll(slides=>slides.every(el=>el.getBoundingClientRect().height<=el.closest('uni-swiper').getBoundingClientRect().height+1))).toBe(true);
          }
          await carousel.scrollIntoViewIfNeeded();
          await p.screenshot({path:path.join(out,(mobile?'h5':'web')+'-'+theme+'-'+width+'.png'),animations:'disabled',fullPage:false});
          checks.push({surface:mobile?'H5':'Web',theme,width,checks:'assets, notices, control bounds, layout',font:await carousel.evaluate(el=>getComputedStyle(el).fontFamily)});
        }
        // Capture the real page after using its dismiss controls; no image retouching.
        const close=p.locator('.rail-celebrate-close');
        if(await close.isVisible())await close.click();
        const broadcast=p.getByText('本次关闭',{exact:true});
        if(await broadcast.isVisible())await broadcast.click();
        await p.setViewportSize({width:mobile?390:1440,height:1080});
        await p.evaluate(()=>window.scrollTo(0,0));
        await p.screenshot({path:path.join(out,(mobile?'h5':'web')+'-'+theme+'-overview.png'),animations:'disabled'});
      }
      await context.close();
    }
    expect(errors).toEqual([]);
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({checks,errors},null,2));
    console.log('PASS '+checks.length+' homepage layout and material scenarios');
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
