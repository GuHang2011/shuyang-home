async page => {
  const errors = [];
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  const results = [];
  try {
    for (const mobile of [false, true]) {
      const origin = mobile ? 'http://127.0.0.1:18890' : 'http://127.0.0.1:18888';
      await page.setViewportSize(mobile ? {width:390,height:844} : {width:1440,height:1000});
      await page.goto(origin);
      const place = page.locator(mobile ? '.weather-place' : '.weather-card header button');
      await place.waitFor();
      await place.click();
      const input = mobile ? page.locator('.weather-picker input') : page.getByPlaceholder('城市、区县名或拼音');
      await input.fill('淮安');
      const searchResponse = page.waitForResponse(r => r.url().includes('/weather/cities?'));
      await page.getByText('搜索', {exact:true}).click();
      const body = await (await searchResponse).json();
      if (body.code !== 0 || body.data.length !== 1 || body.data[0].name !== '淮安市' || body.data[0].admin1 !== '江苏') throw new Error('Incorrect Huaian candidates: ' + JSON.stringify(body));
      const candidate = page.locator(mobile ? '.weather-city' : '.city-result');
      await candidate.filter({hasText:'淮安市'}).waitFor();
      const label = await candidate.innerText();
      if (!label.includes('江苏') || label.includes('福建') || label.includes('云南')) throw new Error('Incorrect hierarchy: '+label);
      await candidate.scrollIntoViewIfNeeded();
      await page.screenshot({path:'../output/playwright/weather-city-'+(mobile?'mobile':'desktop')+'.png',fullPage:!mobile});
      const forecast = page.waitForRequest(r => r.url().includes('/weather?'));
      const forecastResponse = page.waitForResponse(r=>r.url().includes('/weather?') && r.status()===200);
      await candidate.click();
      const requested = new URL((await forecast).url());
      if (requested.searchParams.get('latitude') !== '33.59' || requested.searchParams.get('longitude') !== '119.02') throw new Error('Wrong weather coordinates');
      await forecastResponse;
      if (!(await place.innerText()).includes('淮安市')) throw new Error('Selection not applied');

      let networkCalls=0;
      await page.route('**/api/weather/network-location', route => {
        networkCalls++;
        return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({code:0,data:{name:'淮安市',admin1:'江苏省',country:'中国',latitude:33.59,longitude:119.02,locationSource:'network',source:'ipwho.is',approximate:true}})});
      });
      await page.context().grantPermissions([], {origin});
      await place.click();
      await page.getByText('使用我的位置', {exact:true}).click();
      await page.getByText(/网络估算 · 江苏省 淮安市/).waitFor();
      if (networkCalls!==1) throw new Error('Permission denial did not fall back once');
      await place.click();
      await page.getByText('网络定位', {exact:true}).click();
      await page.getByText(/网络估算 · 江苏省 淮安市/).waitFor();
      if (networkCalls!==2) throw new Error('Explicit network lookup missing');
      await page.unroute('**/api/weather/network-location');
      await page.route('**/api/weather/network-location', route => route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:503,message:'网络定位暂时不可用，请手动选择城市'})}));
      await place.click();await page.getByText('网络定位', {exact:true}).click();
      await page.getByText('网络定位暂时不可用，请手动选择城市', {exact:false}).waitFor();
      const manualResponse = page.waitForResponse(r=>r.url().includes('/weather?') && r.status()===200);
      await page.getByText('沭阳', {exact:true}).click();
      await manualResponse;
      if (!(await place.innerText()).includes('沭阳')) throw new Error('Manual fallback blocked');
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
      if (overflow) throw new Error('Horizontal overflow');
      results.push({platform:mobile?'H5':'Web',huaian:label,weatherCoordinates:'33.59,119.02',networkFallback:'pass',manualFallback:'pass',overflow:false});
      await page.unroute('**/api/weather/network-location');
      await page.context().clearPermissions();
    }
    if(errors.length)throw new Error(errors.join('\n'));
    return {results,pageErrors:errors};
  } finally { page.off('pageerror',onError);await page.unroute('**/api/weather/network-location');await page.context().clearPermissions(); }
}
