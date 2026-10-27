async page => {
  await page.goto('http://127.0.0.1:18888');await page.evaluate(() => sessionStorage.clear());await page.reload();
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.getByRole('link', { name: 'Open-Meteo ↗', exact: true }).waitFor();
  await page.screenshot({ path: '../output/playwright/redesign-desktop.png', fullPage: true, animations: 'disabled' });
  const widths = [];
  for (const width of [360,390,768,1440]) { await page.setViewportSize({ width, height: 900 });widths.push(await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }))); }
  if (widths.some(row => row.width < row.scroll)) throw new Error('Overflow: ' + JSON.stringify(widths));
  await page.getByRole('button', { name: '⌖ 苏州 ⌄', exact: true }).click();
  await page.getByRole('textbox', { name: '搜索天气城市', exact: true }).fill('Shuyang');
  await page.getByRole('button', { name: '搜索', exact: true }).click();
  await page.locator('.city-result').first().waitFor();await page.locator('.city-result').first().click();
  await page.getByRole('link', { name: 'Open-Meteo ↗', exact: true }).waitFor();
  await page.context().grantPermissions(['geolocation'], { origin: 'http://127.0.0.1:18888' });
  await page.context().setGeolocation({ latitude: 31.301234, longitude: 120.601234 });
  await page.locator('.weather-card header button').click();
  await page.getByRole('button', { name: '使用我的位置', exact: true }).click();
  await page.getByRole('button', { name: '⌖ 当前位置 ⌄', exact: true }).waitFor();
  await page.getByRole('link', { name: 'Open-Meteo ↗', exact: true }).waitFor();
  await page.context().clearPermissions();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '../output/playwright/redesign-web-mobile.png', fullPage: true, animations: 'disabled' });
  await page.goto('http://127.0.0.1:18890');await page.evaluate(() => localStorage.clear());await page.reload();
  await page.locator('.weather-degree').waitFor();
  await page.screenshot({ path: '../output/playwright/redesign-uni-mobile.png', fullPage: true, animations: 'disabled' });
  const mobile = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  if (mobile.width < mobile.scroll) throw new Error('H5 overflow');
  return { widths, mobile, actualWeather: 'passed', citySearch: 'passed', simulatedGeolocation: 'passed' };
}
