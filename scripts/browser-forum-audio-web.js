async page => {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  async function login(username,password) {
    await page.goto('http://127.0.0.1:18888/');await page.evaluate(()=>sessionStorage.clear());await page.reload();
    await page.getByRole('button',{name:'登录 / 加入',exact:true}).click();await page.getByRole('textbox',{name:'手机号 / 管理员账号'}).fill(username);await page.getByRole('textbox',{name:'登录密码',exact:true}).fill(password);await page.getByRole('button',{name:'登录，回家看看',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  }
  await page.setViewportSize({width:1440,height:1000});await login('13800008881','CommunityMember2026');
  await page.getByRole('navigation').getByRole('button',{name:'老乡论坛',exact:true}).click();await page.getByRole('button',{name:'＋ 发起话题',exact:true}).click();
  await page.getByLabel('标题',{exact:true}).fill('验收语音 · 合成提示音');
  await page.locator('.audio-field input[type=file]').setInputFiles('../output/forum-audio/tone.wav');await page.locator('.audio-pending').getByText('tone.wav',{exact:true}).waitFor();
  await page.getByRole('button',{name:'提交审核',exact:true}).click();await page.getByText('已提交审核',{exact:true}).waitFor();
  await page.getByRole('button',{name:'验收语音 · 合成提示音',exact:true}).click();await page.getByRole('button',{name:'加载语音',exact:true}).click();
  await page.waitForFunction(()=>{const audio=document.querySelector('audio');return audio && audio.readyState>=2 && audio.duration>5;});
  await login('admin','CommunityAdmin2026');await page.getByRole('navigation').getByRole('button',{name:'老乡论坛',exact:true}).click();await page.getByRole('button',{name:'版主管理',exact:true}).click();
  const topic=page.locator('.moderation-row').filter({hasText:'验收语音 · 合成提示音'});
  await topic.getByRole('button',{name:'加载语音',exact:true}).click();await page.waitForFunction(()=>document.querySelector('audio')?.readyState>=2);
  await topic.getByRole('button',{name:'审核通过',exact:true}).click();await page.locator('.forum-overlay').getByRole('button',{name:'确认操作',exact:true}).click();await page.locator('.forum-overlay').waitFor({state:'hidden'});
  if(errors.length)throw new Error(errors.join('\n'));return {audioOnlyTopicUpload:true,ownerAndModeratorDecodedWav:true,approved:true,pageErrors:errors};
}
