// Railway forum UI integration checks using isolated browser/demo fixtures.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { pathToFileURL } = require('node:url');
const driver = process.env.SHUYANG_PLAYWRIGHT_MODULE || path.resolve(__dirname, '../frontend/node_modules/playwright');
const { chromium } = require(driver), { expect } = require(driver + '/test');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'output/railway-browser');
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.jpg':'image/jpeg', '.png':'image/png', '.webp':'image/webp', '.svg':'image/svg+xml' };
function sampleWav() {
  const rate=8000, samples=rate*30, buffer=Buffer.alloc(44+samples*2);
  buffer.write('RIFF');buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(rate,24);buffer.writeUInt32LE(rate*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(samples*2,40);
  for(let i=0;i<samples;i++)buffer.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*220/rate)*500),44+i*2);
  return buffer;
}
async function run() {
  fs.mkdirSync(out,{recursive:true});
  const { createDemoState, demoRequest } = await import(pathToFileURL(path.join(root,'frontend/demo/demo-runtime.mjs')));
  const state = createDemoState(), checks = [], errors = [], apiErrors = [];
  const check = name => { checks.push(name);console.log('PASS: '+name); };
  const server = http.createServer(async (req,res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      if(pathname.startsWith('/api/')) {
        const chunks=[];for await(const chunk of req) chunks.push(chunk);
        const body=Buffer.concat(chunks), method=req.method || 'GET';
        const request=new Request('https://demo.invalid'+req.url,{method,headers:req.headers,...(!['GET','HEAD'].includes(method)?{body}: {})});
        const data=await demoRequest(state,request);
        if(data instanceof Blob){res.writeHead(200,{'Content-Type':data.type,'Content-Length':data.size});res.end(Buffer.from(await data.arrayBuffer()));return;}
        res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({code:0,data}));return;
      }
      const web=pathname.startsWith('/shuyang-home/'), folder=path.join(root,web?'frontend/dist-demo':'frontend/mobile/dist/build/h5');
      const file=path.resolve(folder,(web?pathname.slice('/shuyang-home/'.length):pathname.slice(1))||'index.html');
      if(!file.startsWith(folder+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
      res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);
    }catch(e){apiErrors.push(e.message);res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({code:1,message:e.message}));}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  let browser, page;
  const click=async (scope,text)=>scope.getByText(text,{exact:true}).click();
  const section=async (p,name)=>p.locator('.rail-section-tabs').getByText(name,{exact:name!=='资讯与解读'}).click();
  const openRail=async(p,mobile)=>{await p.goto(base+(mobile?'/#/pages/index/index?section=railway':'/shuyang-home/#railway'));await p.reload();await expect(p.locator('.railway-hub')).toBeVisible();};
  const switchActor=async(p,actor)=>{await Promise.all([p.waitForEvent('load'),p.getByLabel('演示身份',{exact:true}).selectOption(actor)]);await openRail(p,false);};
  async function fit(p,label) {
    await expect.poll(()=>p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    const overflow=await p.locator('.railway-hub button, .railway-hub uni-button, .railway-hub input, .railway-hub textarea, .railway-hub select').evaluateAll(els=>els.filter(el=>el.getClientRects().length).filter(el=>{const r=el.getBoundingClientRect();return r.left< -1 || r.right>innerWidth+1 || el.scrollWidth>el.clientWidth+2;}).map(el=>({text:el.textContent.slice(0,80),tag:el.tagName,width:el.clientWidth,scroll:el.scrollWidth})));
    expect(overflow, label+' controls fit').toEqual([]);
  }
  async function darkContrast(p) {
    const contrasts=await p.locator('.forum-railway-filters button, .forum-railway-filters uni-button, .forum-tabs button, .forum-tabs .pill, .forum-mobile .post-excerpt, .forum-hub .topic-row > p').evaluateAll(els=>{
      const rgb=value=>(value.match(/[\d.]+/g)||[]).map(Number);
      const luminance=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
      return els.filter(el=>el.getClientRects().length).map(el=>{
        let parent=el, bg;
        while(parent){bg=rgb(getComputedStyle(parent).backgroundColor);if(bg.length===3||bg[3]>0.99)break;parent=parent.parentElement;}
        const fg=rgb(getComputedStyle(el).color), a=luminance(fg), b=luminance(bg||[255,255,255]);
        return {text:el.textContent.slice(0,20),ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
      });
    });
    expect(contrasts.filter(c=>c.ratio<4.5),'dark theme body and filter contrast').toEqual([]);
  }
  try {
    browser=await chromium.launch({headless:true,...(process.env.SHUYANG_CHROMIUM_PATH?{executablePath:process.env.SHUYANG_CHROMIUM_PATH}:{})});
    for(const mobile of [false,true]) {
      const context=await browser.newContext({viewport:{width:1440,height:1080},reducedMotion:'reduce'});
      await context.addInitScript(()=>{
        // Observe detached H5 audio elements without changing native playback.
        window.__railTestAudio=[];
        window.Audio=new Proxy(window.Audio,{construct(target,args,newTarget){const audio=Reflect.construct(target,args,newTarget);window.__railTestAudio.push(audio);return audio;}});
      });
      page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
      await openRail(page,mobile);
      const forum=page.locator(mobile?'.forum-mobile':'.forum-hub'), rows=()=>forum.locator(mobile?':scope > .panel':'.topic-row');
      await expect(rows()).toHaveCount(3);
      await expect(forum).not.toContainText('第一次来，先和老乡打个招呼');
      await expect(forum).not.toContainText('在苏州生活，你有哪些小经验');
      await expect(page.locator('.rail-page-title')).toContainText('HOT');
      check((mobile?'H5':'Web')+' dedicated railway board has only three railway samples');
      for(const theme of ['amber','classic','night']) {
        if(mobile){await page.locator('.appearance-mobile-bar uni-button').click();await page.locator('.appearance-option.skin-'+theme).filter({hasText:new RegExp('^'+{amber:'温暖乡情',classic:'简洁商务',night:'深色'}[theme])}).click();await page.locator('.appearance-mobile-bar uni-button').click();}
        else {await page.evaluate(theme=>localStorage.setItem('shuyang_home_appearance',theme),theme);await page.reload();}
        await expect(page.locator('html')).toHaveAttribute('data-skin',theme);
        const close=page.locator('.rail-celebrate-close');if(await close.isVisible())await close.click();
        const broadcast=page.getByText('本次关闭',{exact:true});if(!mobile)await expect(broadcast).toBeVisible();if(await broadcast.isVisible())await broadcast.click();
        for(const width of [1440,390,320]) {
          await page.setViewportSize({width,height:1080});await fit(page,(mobile?'H5':'Web')+' '+theme+' '+width);
          await page.evaluate(()=>window.scrollTo(0,0));
          await page.mouse.move(2,2);
          if(!mobile)await expect.poll(()=>page.evaluate(()=>document.querySelector('.topbar').getBoundingClientRect().bottom<=document.querySelector('.rail-masthead .rail-kicker').getBoundingClientRect().top)).toBe(true);
          await page.screenshot({path:path.join(out,(mobile?'h5':'web')+'-'+theme+'-'+width+'.png'),animations:'disabled',fullPage:true});
          if(width===(mobile?390:1440))await page.screenshot({path:path.join(out,(mobile?'h5':'web')+'-'+theme+'-overview.png'),animations:'disabled'});
          if(theme==='night')await darkContrast(page);
          check((mobile?'H5':'Web')+' '+theme+' '+width+' layout');
        }
      }
      await page.setViewportSize({width:mobile?390:1440,height:1080});
      await click(forum.locator('.forum-railway-filters'),'站点与接驳');await expect(rows()).toHaveCount(1);await expect(rows()).toContainText('接驳问题');
      await click(forum.locator('.forum-railway-filters'),'全部');await click(forum.locator('.forum-tabs'),'热帖');await expect(rows()).toHaveCount(2);
      await click(forum.locator('.forum-tabs'),'全部话题');
      if(mobile)await click(forum.locator('.forum-railway-filters'),'待回复');else await forum.getByLabel('排列方式').selectOption('unanswered');
      await expect(rows()).toHaveCount(3);check((mobile?'H5':'Web')+' category, hot and unanswered filters');
      await rows().filter({hasText:'先核对来源，再参与讨论'}).getByText('先核对来源，再参与讨论（演示版规）',{exact:true}).click();
      await expect(forum.locator('.forum-source-link')).toContainText('江苏省交通运输厅');
      if(!mobile)await expect(forum.locator('.forum-source-link')).toHaveAttribute('href','https://jtyst.jiangsu.gov.cn/');
      await click(forum,'← 返回话题列表');
      await section(page,'资料与常识');await expect(page.locator('.rail-source')).toHaveCount(4);await expect(page.locator('.rail-reference')).toContainText('官方资料入口');await fit(page,'reference');
      for(const width of [1440,390]){await page.setViewportSize({width,height:1080});await fit(page,'reference '+width);await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(out,(mobile?'h5':'web')+'-reference-'+width+'.png'),animations:'disabled',fullPage:true});}
      await page.setViewportSize({width:mobile?390:1440,height:1080});
      await section(page,'高铁讨论');check((mobile?'H5':'Web')+' source attribution and official reference entries');
      if(mobile) {
        await click(page.locator('.bottom-nav'),'我的');
        await click(page,'登录账号');
        await page.locator('.field').filter({has:page.getByText('手机号 / 管理员账号',{exact:true})}).locator('input').fill('demo');
        await page.locator('.field').filter({has:page.getByText('密码',{exact:true})}).locator('input').fill('Demo12345678');
        await click(page,'登录，回家看看');await expect(page.getByText('演示会员',{exact:true}).first()).toBeVisible();
        await openRail(page,true);
      }
      await click(forum,'＋ 发起话题');
      const form=forum.locator(mobile?'.form-page':'.forum-form');
      const title='高铁来源与审核页面验收'+(mobile?'H5':'Web'), content='分享公开资料时请核对发布单位、日期和原文，以下链接用于验收来源展示。';
      const titleInput=mobile?form.locator('.field').filter({has:page.getByText('标题',{exact:true})}).locator('input'):form.getByLabel('标题',{exact:true});
      const sourceName=mobile?form.locator('.field').filter({has:page.getByText('来源名称（选填）',{exact:true})}).locator('input'):form.getByPlaceholder('如新闻网站、发布单位');
      const sourceUrl=mobile?form.locator('.field').filter({has:page.getByText('来源链接（选填）',{exact:true})}).locator('input'):form.getByPlaceholder('https://',{exact:true});
      await titleInput.fill(title);
      await sourceName.fill('江苏省交通运输厅');await sourceUrl.fill('https://jtyst.jiangsu.gov.cn/');
      if(mobile)await form.locator('.topic-textarea textarea').fill(content);else {await form.locator('select').selectOption('资料分享');await form.getByLabel('话题正文',{exact:true}).fill(content);}
      if(!mobile){await form.locator('.audio-field input[type=file]').setInputFiles({name:'railway-test-tone.wav',mimeType:'audio/wav',buffer:sampleWav()});await expect(form.locator('.audio-pending')).toContainText('railway-test-tone.wav');}
      await section(page,'资讯与解读');await expect(page.locator('.rail-news')).toBeVisible();await section(page,'资料与常识');await section(page,'高铁讨论');
      await expect(titleInput).toHaveValue(title);await expect(sourceUrl).toHaveValue('https://jtyst.jiangsu.gov.cn/');
      await fit(page,'editing form');await page.screenshot({path:path.join(out,(mobile?'h5':'web')+'-form.png'),animations:'disabled',fullPage:true});
      await click(form,'提交审核');await expect(rows().filter({hasText:title})).toBeVisible();await expect(rows().filter({hasText:title})).toContainText('待审核');
      await click(forum.locator('.forum-tabs'),'全部话题');await expect(rows().filter({hasText:title})).toHaveCount(0);
      check((mobile?'H5':'Web')+' sourced draft survives tab changes and submits for approval');
      if(!mobile) {
        await switchActor(page,'demo-admin');await expect(forum.locator('.forum-tabs')).toContainText('版主管理');await click(forum.locator('.forum-tabs'),'版主管理');
        await expect(forum).not.toContainText('第一次来，先和老乡打个招呼');
        let row=forum.locator('.moderation-row').filter({hasText:title});await click(row,'审核通过');await click(forum.locator('.forum-overlay'),'确认操作');await expect(row).toContainText('已通过');
        await switchActor(page,'demo-member');await expect(rows().filter({hasText:title})).toBeVisible();await click(rows().filter({hasText:title}),title);
        await expect(forum.locator('.forum-source-link')).toHaveAttribute('href','https://jtyst.jiangsu.gov.cn/');
        await click(forum.locator('.forum-audio'),'加载语音');const audio=forum.locator('.forum-audio audio');await audio.evaluate(a=>a.play());await expect(audio).toHaveJSProperty('paused',false);
        await section(page,'资讯与解读');await expect(audio).toHaveJSProperty('paused',true);await section(page,'高铁讨论');await expect(audio).toHaveJSProperty('paused',true);
        check('Web switching railway tabs pauses audio and does not resume it');
        const reply='已查看原始来源，继续核对正式文件与发布日期。';await forum.getByLabel('发表回复',{exact:true}).fill(reply);await click(forum,'提交回复');await expect(forum.locator('.floor').filter({hasText:reply})).toContainText('待审核');
        await switchActor(page,'demo-admin');await click(forum.locator('.forum-tabs'),'版主管理');
        row=forum.locator('.moderation-row').filter({hasText:reply});await click(row,'审核通过');await click(forum.locator('.forum-overlay'),'确认操作');await expect(row).toContainText('已通过');
        await switchActor(page,'demo-member');await click(rows().filter({hasText:title}),title);await expect(forum.locator('.floor').filter({hasText:reply})).toContainText('已通过');
        await click(forum,'← 返回话题列表');await forum.getByLabel('排列方式').selectOption('unanswered');await expect(rows().filter({hasText:title})).toHaveCount(0);
        check('Web moderator approves railway topic and reply; unanswered excludes replied topic');
      }else{
        const sound=sampleWav(), audioId='railway-test-audio';
        state.media[audioId]={id:audioId,name:'railway-test-tone.wav',size:sound.length,type:'audio/wav',blob:new Blob([sound],{type:'audio/wav'}),scope:'forum',ownerId:'demo-admin',linked:true};
        state.topics.find(t=>t.id==='demo-rail-rules').audio={id:audioId,name:'railway-test-tone.wav',size:sound.length,contentType:'audio/wav',type:'audio'};
        await openRail(page,true);await click(rows().filter({hasText:'先核对来源，再参与讨论'}),'先核对来源，再参与讨论（演示版规）');
        await click(forum.locator('.forum-audio'),'播放语音');await expect(forum.locator('.forum-audio')).toContainText('暂停语音');
        await expect.poll(()=>page.evaluate(()=>window.__railTestAudio.some(a=>!a.paused))).toBe(true);
        await section(page,'资讯与解读');await expect.poll(()=>page.evaluate(()=>window.__railTestAudio.every(a=>a.paused))).toBe(true);
        await section(page,'高铁讨论');await expect(forum.locator('.forum-audio')).toContainText('播放语音');expect(await page.evaluate(()=>window.__railTestAudio.every(a=>a.paused))).toBe(true);
        check('H5 switching railway tabs pauses actual audio and does not resume it');
      }
      await context.close();
    }
    expect(errors).toEqual([]);expect(apiErrors).toEqual([]);
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({checks,errors,apiErrors},null,2));console.log('RESULT '+checks.length+' passed');
  }catch(e){if(page&&!page.isClosed()){await page.screenshot({path:path.join(out,'failure.png'),fullPage:true});fs.writeFileSync(path.join(out,'failure.txt'),await page.locator('body').innerText());}throw e;}
  finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
