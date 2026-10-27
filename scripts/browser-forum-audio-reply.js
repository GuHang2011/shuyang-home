async page => {
  await page.locator('.audio-pending').getByText('tone.wav',{exact:true}).waitFor();await page.getByText('提交回复',{exact:true}).click();await page.getByText('回复已提交审核',{exact:true}).waitFor();
  await page.getByText('1 楼 · 待审核',{exact:true}).waitFor();await page.getByText('播放语音',{exact:true}).last().click();await page.getByText('暂停语音',{exact:true}).waitFor();await page.getByText('暂停语音',{exact:true}).click();
  await page.screenshot({path:'../output/playwright/forum-audio-mobile.png',fullPage:true});
  if(await page.locator('.error').count())throw new Error(await page.locator('.error').allTextContents());
  const layout=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth}));if(layout.width>layout.viewport)throw new Error('Audio page overflow');
  return {h5TopicPlayback:true,h5AudioOnlyReplyUploadAndPlayback:true,layout};
}
