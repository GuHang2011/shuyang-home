async page => {
  await page.goto('http://127.0.0.1:18888');
  await page.evaluate(() => sessionStorage.clear());await page.reload();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('link', { name: 'Open-Meteo ↗', exact: true }).waitFor();
  await page.context().grantPermissions([], { origin: 'http://127.0.0.1:18888' });
  await page.route('**/api/weather/network-location', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 503, message: '网络定位暂时不可用，请手动选择城市' }) }));
  try {
    await page.locator('.weather-card header button').click();
    await page.getByRole('button', { name: '使用我的位置', exact: true }).click();
    await page.getByText('网络定位暂时不可用，请手动选择城市', { exact: false }).waitFor();
    await page.getByRole('button', { name: '沭阳', exact: true }).click();
    await page.getByRole('button', { name: '⌖ 沭阳 ⌄', exact: true }).waitFor();
    await page.getByRole('link', { name: 'Open-Meteo ↗', exact: true }).waitFor();
    await page.route('**/api/weather?*', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 503, message: '天气服务暂时连接不上，请稍后重试或手动选择城市' }) }));
    await page.locator('.weather-card header button').click();
    await page.getByRole('button', { name: '苏州', exact: true }).click();
    await page.getByText('天气服务暂时连接不上，请稍后重试或手动选择城市', { exact: false }).waitFor();
    if (await page.locator('.weather-now').count()) throw new Error('Failed weather query displays invented data');
    await page.unroute('**/api/weather?*');
    await page.getByRole('button', { name: '重新获取', exact: true }).click();
    await page.getByRole('link', { name: 'Open-Meteo ↗', exact: true }).waitFor();
    return { deniedGeolocation: 'passed', manualCityFallback: 'passed', simulatedServiceFailure: 'passed', realRetry: 'passed' };
  } finally { await page.context().clearPermissions();await page.unroute('**/api/weather?*');await page.unroute('**/api/weather/network-location'); }
}
