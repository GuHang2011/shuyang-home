async page => {
  if (new URL(page.url()).origin !== 'http://127.0.0.1:18888') throw new Error('Open isolated Web18888 first; prepare community, phase2 and business-files fixtures');
  await page.unrouteAll();for(const other of page.context().pages())if(other!==page)await other.close();
  const engine=page.context().browser().browserType().name(),results=[],errors=[];
  const check=(name,ok)=>{results.push({name,passed:!!ok});if(!ok)throw Error(name);};
  page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);await page.setViewportSize({width:1440,height:1000});
  // Capture the exact report passed to the browser print API, without opening an OS dialog.
  await page.context().addInitScript(()=>{window.__printed=[];window.print=()=>window.top.__printed.push(document.documentElement.outerHTML);});
  await page.goto('http://127.0.0.1:18888');await page.waitForLoadState('networkidle');await page.getByRole('button',{name:/登录 \/ 加入|我的会员中心/}).waitFor();
  if(await page.getByRole('button',{name:'登录 / 加入',exact:true}).count()){
  await page.getByRole('button',{name:'登录 / 加入',exact:true}).click();await page.getByLabel('手机号 / 管理员账号').fill('admin');await page.getByLabel('登录密码',{exact:true}).fill('CommunityAdmin2026');
  await page.getByRole('button',{name:'登录，回家看看',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});}
  await page.getByRole('navigation').getByRole('button',{name:'管理工作台',exact:true}).click();await page.getByRole('tab',{name:'数据管理',exact:true}).click();await page.getByRole('tab',{name:'文件与打印',exact:true}).click();
  const hub=page.locator('.business-files');await hub.locator('.report-summary').waitFor();
  if((await hub.locator('tbody').innerText()).includes('文件导入验收-Web')) {
    await hub.locator('input[type=file]').setInputFiles('../output/business-files/members-h5.xlsx');await hub.getByRole('button',{name:'确认导入 1 条',exact:true}).waitFor();await hub.locator('.import-confirmation').click();await hub.getByRole('button',{name:'确认导入 1 条',exact:true}).click();await hub.getByText('已完成导入，更新 1 条记录。',{exact:true}).waitFor();await hub.locator('tbody').getByText('文件导入验收-H5',{exact:true}).waitFor();
  }
  check('Web members report excludes administrative accounts',await hub.locator('tbody tr').count()===2);
  async function download(p,button,name){const pending=p.waitForEvent('download');await button.click();const file=await pending;check(name+' has XLSX filename',file.suggestedFilename().endsWith('.xlsx'));await file.saveAs('../output/business-files/'+engine+'-'+name+'.xlsx');}
  await download(page,hub.getByRole('button',{name:'导出 Excel',exact:true}),'members-export');
  await download(page,hub.getByRole('button',{name:'下载导入模板',exact:true}),'members-template');
  const input=hub.locator('input[type=file]');await input.setInputFiles('../output/business-files/members-invalid.xlsx');
  await hub.getByText('尚未写入任何业务数据。请修正以下问题后重新选择文件。',{exact:true}).waitFor();
  check('invalid workbook identifies the failing row',await hub.locator('.import-lines .invalid').count()===1);
  check('invalid workbook cannot be committed',await hub.getByRole('button',{name:/确认导入/}).count()===0);
  check('invalid workbook did not partially update report',!(await hub.locator('tbody').innerText()).includes('不得部分写入'));
  await input.setInputFiles('../output/business-files/members-web.xlsx');await hub.getByRole('button',{name:'确认导入 1 条',exact:true}).waitFor();
  check('preview requires confirmation',await hub.getByRole('button',{name:'确认导入 1 条',exact:true}).isDisabled());
  const tokens=[];let loseResponse=true;
  await page.route('**/data-files/commit',async route=>{tokens.push(route.request().postDataJSON().token);if(loseResponse){loseResponse=false;const response=await route.fetch();if(response.status()!==200)throw Error('Server did not commit fixture');return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:503,message:'模拟提交后网络中断，请重试'})});}return route.continue();});
  await hub.locator('.import-confirmation').click();await hub.getByRole('button',{name:'确认导入 1 条',exact:true}).click();
  await hub.getByRole('alert').filter({hasText:'模拟提交后网络中断'}).waitFor();
  check('lost commit response preserves preview',await hub.locator('.import-lines li').count()===1);
  await hub.getByRole('button',{name:'确认导入 1 条',exact:true}).click();await hub.getByText('已完成导入，更新 1 条记录。',{exact:true}).waitFor();
  check('retry uses same committed batch',tokens.length===2&&tokens[0]===tokens[1]);await page.unroute('**/data-files/commit');
  await hub.locator('tbody').getByText('文件导入验收-Web',{exact:true}).waitFor();check('member workbook changes appear after success',true);
  await hub.getByLabel('搜索',{exact:true}).fill('资源主人测试');check('editing filters disables stale export',await hub.getByRole('button',{name:'导出 Excel',exact:true}).isDisabled());
  await hub.getByRole('button',{name:'查询 / 刷新',exact:true}).click();await hub.locator('tbody tr').waitFor();check('report query filters rows',await hub.locator('tbody tr').count()===1);
  await hub.getByRole('tab',{name:'订单履约',exact:true}).click();await hub.getByText('第 1 / 2 页',{exact:true}).waitFor();
  check('large report paginates screen to 20 rows',await hub.locator('tbody tr').count()===20);
  await hub.getByRole('button',{name:'下一页',exact:true}).click();check('remaining page has five rows',await hub.locator('tbody tr').count()===5);
  await download(page,hub.getByRole('button',{name:'导出 Excel',exact:true}),'orders-export');
  await hub.getByRole('button',{name:'打印 / 保存 PDF',exact:true}).click();await page.waitForFunction(()=>window.__printed.length>0);
  const html=await page.evaluate(()=>window.__printed[window.__printed.length-1]);
  const printPage=await page.context().newPage();await printPage.setContent(html);await printPage.emulateMedia({media:'print'});
  check('print includes all 25 filtered rows rather than only visible page',await printPage.locator('tbody tr').count()===25);
  check('print includes repeating headers and no management controls',await printPage.locator('button,input,nav').count()===0&&await printPage.locator('thead').count()===1);
  if(engine==='chromium')await printPage.pdf({path:'../output/business-files/orders-print.pdf',preferCSSPageSize:true,printBackground:true});
  await printPage.close();await page.bringToFront();
  await input.setInputFiles('../output/business-files/orders.xlsx');await hub.getByRole('heading',{name:'导入预览',exact:true}).waitFor();
  check('order workbook has no validation errors',await hub.locator('.import-lines .invalid').count()===0);
  if(await hub.getByRole('button',{name:'确认导入 2 条',exact:true}).count()){await hub.locator('.import-confirmation').click();await hub.getByRole('button',{name:'确认导入 2 条',exact:true}).click();await hub.getByText('已完成导入，更新 2 条记录。',{exact:true}).waitFor();}
  else check('reimported fulfillment workbook is a no-op',await hub.getByText('数据相同，无需修改',{exact:true}).count()===2);
  await hub.locator('.el-select:has(input[aria-label="状态"])').click();await page.getByRole('option',{name:'已发货',exact:true}).click();await hub.locator('tbody tr').waitFor();check('order shipment state imported',await hub.locator('tbody tr').count()===1);
  await hub.getByRole('tab',{name:'活动报名',exact:true}).click();check('activity workbook requires choosing an event',await input.isDisabled());
  await hub.locator('.el-select:has(input[aria-label="活动"])').click();await page.getByRole('option',{name:'文件验收活动 · 非真实报名',exact:true}).click();await hub.locator('.report-summary').waitFor();
  await input.setInputFiles('../output/business-files/signups.xlsx');await hub.getByRole('heading',{name:'导入预览',exact:true}).waitFor();check('signup workbook validates chosen event',await hub.locator('.import-lines .invalid').count()===0);
  if(await hub.getByRole('button',{name:'确认导入 1 条',exact:true}).count()){await hub.locator('.import-confirmation').click();await hub.getByRole('button',{name:'确认导入 1 条',exact:true}).click();await hub.getByText('已完成导入，更新 1 条记录。',{exact:true}).waitFor();}
  else check('reimported signup workbook is a no-op',await hub.getByText('数据相同，无需修改',{exact:true}).count()===1);
  check('event roster contains both members',await hub.locator('tbody tr').count()===2);
  await download(page,hub.getByRole('button',{name:'导出 Excel',exact:true}),'signups-export');
  const mobile=await page.context().newPage();mobile.setDefaultTimeout(15000);mobile.on('pageerror',e=>errors.push(e.message));await mobile.setViewportSize({width:390,height:844});
  await mobile.goto('http://127.0.0.1:18890');await mobile.evaluate(()=>localStorage.clear());await mobile.reload();await mobile.getByText('我的',{exact:true}).click();await mobile.getByText('登录账号',{exact:true}).click();
  await mobile.getByRole('textbox').nth(0).fill('admin');await mobile.getByRole('textbox').nth(1).fill('CommunityAdmin2026');await mobile.getByText('登录，回家看看',{exact:true}).click();await mobile.getByText('已通过 · 超级管理员',{exact:true}).waitFor();
  await mobile.getByText('文件与打印',{exact:true}).click();await mobile.locator('.report-title').first().waitFor();const mhub=mobile.locator('.business-files');
  check('H5 report displays existing member rows',await mhub.locator('.file-row:not(.heading)').count()===2);
  await download(mobile,mhub.getByText('导出 Excel',{exact:true}),'h5-export');
  const chooser=mobile.waitForEvent('filechooser');await mhub.getByText('选择文件并预览',{exact:true}).click();await (await chooser).setFiles('../output/business-files/members-h5.xlsx');
  await mhub.getByText('确认导入 1 条',{exact:true}).waitFor();await mhub.locator('uni-switch').click();await mhub.getByText('确认导入 1 条',{exact:true}).click();await mhub.getByText('已完成导入，更新 1 条记录。',{exact:true}).waitFor();
  check('H5 uploads and commits a real XLSX file',await mhub.getByText('文件导入验收-H5',{exact:true}).count()===1);
  await mhub.getByText('打印 / 保存 PDF',{exact:true}).click();await mobile.waitForFunction(()=>window.__printed.length>0);check('H5 calls browser print with its own report',true);
  async function reachable(p,control){
    for(let attempt=0;attempt<5;attempt++){
      await control.evaluate(el=>{for(let parent=el.parentElement;parent;parent=parent.parentElement){if(parent===document.scrollingElement||!['auto','scroll'].includes(getComputedStyle(parent).overflowY))continue;const r=el.getBoundingClientRect(),q=parent.getBoundingClientRect();parent.scrollTop+=(r.top+r.bottom-q.top-q.bottom)/2;}const r=el.getBoundingClientRect(),nav=document.querySelector('.bottom-nav,.mobile-nav')?.getBoundingClientRect(),bottom=nav?.height?nav.top:innerHeight;window.scrollBy({top:(r.top+r.bottom-bottom)/2,behavior:'instant'});});
      await p.waitForTimeout(150);
      if(await control.evaluate(el=>{const r=el.getBoundingClientRect(),nav=document.querySelector('.bottom-nav,.mobile-nav')?.getBoundingClientRect(),bottom=nav?.height?nav.top:innerHeight,hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return r.top>=0&&r.bottom<=bottom+1&&(hit===el||el.contains(hit));}))return true;
    }
    return false;
  }
  for(const [surface,p] of [['web',page],['h5',mobile]])for(const [width,height] of [[320,568],[390,844],[844,390],[768,1024],[390,420]]){
    await p.bringToFront();await p.setViewportSize({width,height});check(`${surface} ${width}x${height} page has no horizontal overflow`,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    const control=surface==='web'?p.locator('.business-files').getByRole('button',{name:'打印 / 保存 PDF',exact:true}):p.getByText('打印 / 保存 PDF',{exact:true});
    check(`${surface} ${width}x${height} print control reachable`,await reachable(p,control));
    if(width===390&&height===844)await p.screenshot({path:`../output/playwright/business-files-${engine}-${surface}.png`,fullPage:true});
  }
  await page.setViewportSize({width:1440,height:1000});await page.bringToFront();await page.screenshot({path:`../output/playwright/business-files-${engine}-desktop.png`,fullPage:true});
  await mobile.close();check('no uncaught page errors',errors.length===0);return {engine,passed:results.length,failed:0,results,errors};
}
