async page => {
  await page.goto('http://127.0.0.1:18888');
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.waitForFunction(() => document.querySelector('.content')?.getAttribute('aria-busy') === 'false');
  await page.screenshot({ path: '../output/playwright/home-desktop.png', fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '../output/playwright/home-mobile.png', fullPage: true, animations: 'disabled' });
  for (const name of ['老乡论坛', '资源互换']) {
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name, exact: true }).click();
    for (const width of [360, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: width > 700 ? 1050 : 844 });
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw new Error(name + ' overflow at ' + width);
    }
  }
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '乡情首页', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.content')?.getAttribute('aria-busy') === 'false');
  return { cleanPreview: 'ready', newCommunityPages: 'no horizontal overflow at 360, 390, 768, 1440px' };
}
